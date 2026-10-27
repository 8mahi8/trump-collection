// Actual Auth+RTDB emulator, isolated demo project. No production writes.
// Room-first: four independent Firebase UIDs, simultaneous joins, ready,
// match switch and security rules deny guest writes to authoritative lobby.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseAnonymousAuth} from '../online/firebase-room-store.mjs';
import {createFirebaseRoomLobbyRest} from '../v2/net/firebase-room-lobby-rest.mjs';
import {createRoomCoordinator,createRoomLobbyClient} from '../v2/session/room-coordinator.mjs';

const NS='demo-trumpcards-default-rtdb';
const DB='https://trump-ci-default-rtdb.firebasedatabase.app';
const APIKEY='emulator-fake-api-key';
const ROOM='73624';
function emulatedFetch(input,opts){
 const url=new URL(input);
 if(url.hostname==='identitytoolkit.googleapis.com'||url.hostname==='securetoken.googleapis.com'){
  const source=url.hostname;
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9099';
  url.pathname='/'+source+url.pathname;
 }else if(url.hostname.endsWith('.firebasedatabase.app')||url.hostname.endsWith('.firebaseio.com')){
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9000';
  url.searchParams.set('ns',NS);
 }else throw Error('UNEXPECTED_EXTERNAL_URL');
 return fetch(url,opts);
}
async function account(){
 const auth=createFirebaseAnonymousAuth({apiKey:APIKEY,fetchImpl:emulatedFetch});
 await auth.signIn();
 const store=createFirebaseRoomLobbyRest({databaseURL:DB,auth,fetchImpl:emulatedFetch});
 return {auth,store,uid:auth.uid,client:createRoomLobbyClient({store,roomCode:ROOM})};
}
async function direct(user,route,method='GET',body=null){
 const url=new URL(DB+'/trumpRoomsV2/'+ROOM+'/'+route+'.json');
 url.searchParams.set('auth',await user.auth.token());
 return emulatedFetch(url.toString(),{method,headers:{'Content-Type':'application/json'},
  ...(method==='PUT'?{body:JSON.stringify(body)}:{})});
}
async function send(user,type,id,extra={}){
 const state=await user.client.room();
 return user.client.submit({type,expectedRevision:state.revision,...extra},id);
}
async function receipt(user,id){
 const answer=await user.client.receipt(id);
 assert.ok(answer,'receipt must exist for '+id);
 return answer;
}
test('actual Firebase: four UIDs share one room, switch games and deny guest tampering',{timeout:160000},async()=>{
 const [host,a,b,c,outsider]=await Promise.all(Array.from({length:5},account));
 const coordinator=createRoomCoordinator({store:host.store,roomCode:ROOM});
 await coordinator.bootstrap();
 assert.equal((await a.client.room()).selectedGame,null);
 assert.equal((await b.client.room()).roomCode,ROOM);

 // Host-only authoritative lobby; no client can forge authority or another UID's request.
 const badLobby=await direct(a,'lobby','PUT',{protocol:3,roomCode:ROOM,hostId:a.uid,revision:99});
 assert.ok([401,403].includes(badLobby.status),'guest must not write lobby '+badLobby.status);
 const badOther=await direct(a,'requests/'+b.uid+'/hijack77','PUT',
  {protocol:3,requestId:'hijack77',type:'join',expectedRevision:0});
 assert.ok([401,403].includes(badOther.status),'guest must not impersonate other UID');
 const guestReceipt=await direct(a,'receipts/'+b.uid+'/notmine');
 assert.ok([401,403].includes(guestReceipt.status),'cannot inspect other friend receipts');

 // Everyone reads revision 0, sends join concurrently; host rebases commutative joins.
 await Promise.all([send(a,'join','joinAAA001'),send(b,'join','joinBBB002'),send(c,'join','joinCCC003')]);
 const joined=await coordinator.tick();
 assert.equal(joined.accepted,3,JSON.stringify(joined));
 for(const [u,id] of [[a,'joinAAA001'],[b,'joinBBB002'],[c,'joinCCC003']])
  assert.equal((await receipt(u,id)).ok,true,id);
 let room=await host.client.room();
 assert.equal(room.members.length,4);
 assert.equal(room.roomCode,ROOM);assert.equal(room.selectedGame,null);

 // An ordinary guest cannot choose the game; host processes and rejects it.
 await send(a,'selectGame','spoofGame9',{gameId:'babanuki'});
 const rejected=await coordinator.tick();
 assert.equal(rejected.rejected,1);
 assert.equal((await receipt(a,'spoofGame9')).reason,'HOST_ONLY');

 assert.equal((await coordinator.applyHost({type:'selectGame',gameId:'babanuki'})).ok,true);
 room=await a.client.room();
 assert.deepEqual(room.participants.slice().sort(),[host.uid,a.uid,b.uid,c.uid].sort());
 // A delayed Ready for an earlier selection of the SAME game must not
 // become valid just because the host selects that game again.
 await a.client.submit({type:'setReady',ready:true,expectedRevision:room.revision,
  gameId:'babanuki',matchSequence:room.matchSequence,
  selectionEpoch:room.selectionEpoch},'staleReady77');
 assert.equal((await coordinator.applyHost({type:'selectGame',gameId:'babanuki'})).ok,true);
 const obsolete=await coordinator.tick();
 assert.equal(obsolete.rejected,1);
 assert.equal((await receipt(a,'staleReady77')).reason,'STALE_ROOM_REVISION');
 room=await a.client.room();
 assert.equal((await coordinator.applyHost({type:'setReady',ready:true})).ok,true);
 // Guests all use same room revision. Ready can rebase only if game/epoch match.
 await Promise.all([a,b,c].map((u,i)=>send(u,'setReady','ready000'+i,{
  ready:true,gameId:'babanuki',matchSequence:room.matchSequence,
  selectionEpoch:room.selectionEpoch})));
 const readied=await coordinator.tick();
 assert.equal(readied.accepted,3,JSON.stringify(readied));
 assert.deepEqual((await host.client.room()).ready.sort(),
  [host.uid,a.uid,b.uid,c.uid].sort());
 assert.equal((await coordinator.applyHost({type:'startMatch'})).ok,true);
 room=await host.client.room();
 const oldMatch=room.match.matchId;
 assert.equal(room.phase,'playing');
 assert.equal(room.match.gameId,'babanuki');

 // Host finishes a match; room identity remains after lobby return.
 assert.equal((await coordinator.applyHost({type:'completeMatch',matchId:oldMatch})).ok,true);
 assert.equal((await coordinator.applyHost({type:'returnToLobby',matchId:oldMatch})).ok,true);
 room=await host.client.room();
 assert.equal(room.phase,'lobby');assert.equal(room.roomCode,ROOM);
 assert.deepEqual(room.members.slice().sort(),[host.uid,a.uid,b.uid,c.uid].sort());

 // Switch to shinkei in same room, explicitly select 2 participants.
 assert.equal((await coordinator.applyHost({type:'selectGame',gameId:'shinkei'})).ok,true);
 assert.equal((await coordinator.applyHost({type:'setParticipants',memberIds:[host.uid,c.uid]})).ok,true);
 assert.equal((await coordinator.applyHost({type:'setReady',ready:true})).ok,true);
 const beforeReady=await c.client.room();
 await c.client.submit({type:'setReady',ready:true,expectedRevision:beforeReady.revision,
  gameId:'shinkei',matchSequence:beforeReady.matchSequence,
  selectionEpoch:beforeReady.selectionEpoch},'readyShinkei');
 assert.equal((await coordinator.tick()).accepted,1);
 assert.equal((await coordinator.applyHost({type:'startMatch'})).ok,true);
 room=await host.client.room();
 assert.equal(room.match.gameId,'shinkei');
 assert.equal(room.match.participants.length,2);
 assert.notEqual(room.match.matchId,oldMatch);
 assert.equal(room.members.length,4);

 const stale=await coordinator.applyHost({type:'completeMatch',matchId:oldMatch});
 assert.deepEqual({ok:stale.ok,reason:stale.reason},{ok:false,reason:'STALE_MATCH'});
 const intruder=await direct(outsider,'lobby');
 assert.equal(intruder.status,200,'lobby is nonsecret and code-addressable; match hands elsewhere');
});
