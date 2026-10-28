import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedRoom,applySharedRoomAction} from '../v2/core/shared-room.mjs';
import {createRoomMatchHost} from '../v2/session/room-match-host.mjs';

const players=['parallelHost001','parallelGuest002','parallelGuest003','parallelGuest004'];
function gameRoom(humans=4){
 let r=createSharedRoom({roomCode:'68243',hostId:players[0]});
 const act=(type,actor,extra={})=>{r=applySharedRoomAction(r,{type,actor,expectedRevision:r.revision,...extra});};
 for(const id of players.slice(1,humans))act('join',id);
 act('selectGame',players[0],{gameId:'daifugo'});
 for(const id of players.slice(0,humans))act('setReady',id,{ready:true});
 act('startMatch',players[0]);
 return r;
}
function makeDeferredRoom(humans){
 const room=gameRoom(humans),calls=[],resolvers=new Map();
 const store={
  uid:players[0],read:async()=>({state:room}),
  publishMatchPrivate:(code,id,uid,data)=>new Promise(resolve=>{
   calls.push('private:'+uid);resolvers.set(uid,resolve);
  }),
  publishMatchPublic:async()=>{calls.push('PUBLIC')},
  matchCommands:async()=>({}),
  writeMatchReceipt:async()=>{},removeMatchCommand:async()=>{}
 };
 const coordinator={applyHost:async()=>({ok:true})};
 const engine=createRoomMatchHost({store,coordinator,roomCode:room.roomCode,
  seedSource:()=>27});
 return {engine,calls,resolvers,room};
}
test('publish all human private seats concurrently, commit public revision only after all finish',async()=>{
 const {engine,calls,resolvers}=makeDeferredRoom(4);
 const started=engine.start();
 // Let the asynchronous room read resolve and all independent writes begin.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(resolvers.size,4,'four private writes should all have been initiated');
 assert.equal(calls.includes('PUBLIC'),false,'never publish public while private writes are pending');
 for(const id of players.slice(0,3))resolvers.get(id)();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.includes('PUBLIC'),false,'one slow seat must hold the public revision');
 resolvers.get(players[3])();
 const result=await started;
 assert.equal(result.gameId,'daifugo');
 assert.equal(calls.at(-1),'PUBLIC','public revision must commit only after all hands are ready');
});
test('CPU private hands stay host-only even when human private publishes overlap',async()=>{
 const {engine,calls,resolvers,room}=makeDeferredRoom(2);
 assert.equal(room.match.participants.length,4);
 const started=engine.start();
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual([...resolvers.keys()].sort(),players.slice(0,2).sort());
 assert.equal(calls.includes('PUBLIC'),false);
 for(const resolve of resolvers.values())resolve();
 await started;
 assert.equal(calls.at(-1),'PUBLIC');
 assert.equal(calls.filter(s=>s.startsWith('private:')).length,2);
});
