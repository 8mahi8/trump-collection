import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomMatchGuest} from '../v2/session/room-match-guest.mjs';

const UID='mytestUID1122',ROOM='12345',MATCH=ROOM+'-m1';
const room={protocol:3,roomCode:ROOM,phase:'playing',
 match:{matchId:MATCH,gameId:'babanuki',participants:[UID,'friendTwoUID99','friendThreeUID99','friendFourUID99']}};
function fake(){
 let current={...room},pub={matchId:MATCH,gameId:'babanuki',
  publicView:{game:'babanuki',round:0,revision:5,phase:'playing'}};
 let priv={matchId:MATCH,gameId:'babanuki',
  privateView:{game:'babanuki',round:0,revision:5,seat:0,hand:[]}};
 const submissions=[];
 const store={uid:UID,async read(){return {state:current}},
  async matchPublic(){return pub},async matchPrivate(){return priv},
  async submitMatch(code,match,id,payload){submissions.push({code,match,id,payload})},
  async matchReceipt(){return {ok:true,revision:6}}};
 return {store,submissions,setPrivate:v=>{priv=v},setPublic:v=>{pub=v},setRoom:v=>{current=v}};
}
test('never display a mix of public and private hands from different revisions',async()=>{
 const data=fake(),guest=createRoomMatchGuest({store:data.store,roomCode:ROOM,
  matchId:MATCH,actionIdSource:()=> 'safeid9912'});
 assert.equal((await guest.poll()).status,'ready');
 data.setPrivate({matchId:MATCH,gameId:'babanuki',
  privateView:{game:'babanuki',round:0,revision:6,seat:0,hand:[]}});
 assert.equal((await guest.poll()).status,'syncing');
 await assert.rejects(guest.act('draw',{index:0}),/MATCH_NOT_READY/);
 data.setPrivate({matchId:MATCH,gameId:'babanuki',
  privateView:{game:'babanuki',round:0,revision:5,seat:0,hand:[]}});
 assert.equal((await guest.poll()).status,'ready');
 const id=await guest.act('draw',{index:2});
 assert.equal(id,'safeid9912');
 assert.equal(data.submissions[0].payload.actor,UID);
 assert.equal(data.submissions[0].payload.expectedRevision,5);
 assert.equal(data.submissions[0].payload.index,2);
});
test('spectators and ended rooms cannot enqueue match moves',async()=>{
 const data=fake(),guest=createRoomMatchGuest({store:data.store,roomCode:ROOM,matchId:MATCH});
 data.setRoom({...room,match:{...room.match,participants:room.match.participants.slice(1)}});
 assert.equal((await guest.poll()).status,'spectating');
 data.setRoom({...room,phase:'results'});
 assert.equal((await guest.poll()).status,'ready');
 await assert.rejects(guest.act('draw',{index:0}),/MATCH_NOT_READY/);
 data.setRoom({...room,match:{...room.match,matchId:'12345-m2'}});
 assert.equal((await guest.poll()).status,'room_closed');
});
