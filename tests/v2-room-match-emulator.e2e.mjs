// Real four-client game moves through an isolated Firebase Auth+RTDB Emulator.
// No real projects, credentials or school Google Sites writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseAnonymousAuth} from '../online/firebase-room-store.mjs';
import {createFirebaseRoomLobbyRest} from '../v2/net/firebase-room-lobby-rest.mjs';
import {createRoomCoordinator,createRoomLobbyClient} from '../v2/session/room-coordinator.mjs';
import {createRoomMatchHost} from '../v2/session/room-match-host.mjs';
import {createRoomMatchGuest} from '../v2/session/room-match-guest.mjs';
import {createRoomSession} from '../v2/session/room-session.mjs';
import {mulberry32} from '../games.mjs';

const NS='demo-trumpcards-default-rtdb';
const DB='https://trump-ci-default-rtdb.firebasedatabase.app';
const CODE='76429';
const rng=mulberry32(20261027);
function emulatorFetch(input,opts){
 const url=new URL(input);
 if(url.hostname==='identitytoolkit.googleapis.com'||url.hostname==='securetoken.googleapis.com'){
  const domain=url.hostname;
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9099';
  url.pathname='/'+domain+url.pathname;
 }else if(url.hostname.endsWith('.firebaseio.com')||url.hostname.endsWith('.firebasedatabase.app')){
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9000';
  url.searchParams.set('ns',NS);
 }else throw Error('UNEXPECTED_EXTERNAL_URL');
 return fetch(url.toString(),opts);
}
async function user(){
 const auth=createFirebaseAnonymousAuth({apiKey:'emulator-fake-api-key',fetchImpl:emulatorFetch});
 await auth.signIn();
 const store=createFirebaseRoomLobbyRest({databaseURL:DB,auth,fetchImpl:emulatorFetch});
 return {uid:auth.uid,auth,store,lobby:createRoomLobbyClient({store,roomCode:CODE})};
}
async function send(user,action,id){
 const state=await user.lobby.room();
 await user.lobby.submit({expectedRevision:state.revision,...action},id);
}
async function raw(user,path,method='GET',body=null){
 const url=new URL(DB+'/trumpRoomsV2/'+CODE+'/'+path+'.json');
 url.searchParams.set('auth',await user.auth.token());
 return emulatorFetch(url,{method,headers:{'Content-Type':'application/json'},
  ...(method==='PUT'?{body:JSON.stringify(body)}:{})});
}
test('actual Firebase: 4 players receive only own hands and play a live room-first Old Maid match',{timeout:240000},async()=>{
 const people=await Promise.all(Array.from({length:5},user));
 const [host,...rest]=people;
 const players=people.slice(0,4),outsider=people[4];
 const coord=createRoomCoordinator({store:host.store,roomCode:CODE});
 await coord.bootstrap();
 await Promise.all(players.slice(1).map((p,i)=>send(p,{type:'join'},'connect'+i+'44')));
 assert.equal((await coord.tick()).accepted,3);
 assert.equal((await coord.applyHost({type:'selectGame',gameId:'babanuki'})).ok,true);
 assert.equal((await coord.applyHost({type:'setReady',ready:true})).ok,true);
 const lobby=await host.lobby.room();
 await Promise.all(players.slice(1).map((p,i)=>send(p,{
  type:'setReady',ready:true,gameId:'babanuki',matchSequence:lobby.matchSequence,
  selectionEpoch:lobby.selectionEpoch},'ready'+i+'mm44')));
 assert.equal((await coord.tick()).accepted,3);
 assert.equal((await coord.applyHost({type:'startMatch'})).ok,true);
 const room=await host.lobby.room();
 const matchId=room.match.matchId;
 const runner=createRoomMatchHost({store:host.store,coordinator:coord,roomCode:CODE,seedSource:()=>18});
 const initial=await runner.start();
 assert.equal(initial.gameId,'babanuki');
 assert.equal(initial.matchId,matchId);
 assert.equal((await host.store.matchPublic(CODE,matchId)).publicView.game,'babanuki');
 const outsiders=[await raw(outsider,'matches/'+matchId+'/public'),
  await raw(outsider,'matches/'+matchId+'/private/'+players[0].uid),
  await raw(outsider,'matches/'+matchId+'/commands')];
 for(const denial of outsiders)
  assert.ok([401,403].includes(denial.status),'outsider data read blocked '+denial.status);
 const snoop=await raw(players[1],'matches/'+matchId+'/private/'+players[0].uid);
 assert.ok([401,403].includes(snoop.status),'cannot read other cards '+snoop.status);
 const forged=await raw(players[1],'matches/'+matchId+'/public','PUT',{
  matchId,gameId:'babanuki',publicView:{protocol:2,revision:99}});
 assert.ok([401,403].includes(forged.status),'guest cannot overwrite match '+forged.status);

 const sessions=players.map((p,i)=>createRoomSession({
  game:'babanuki',guest:createRoomMatchGuest({store:p.store,roomCode:CODE,matchId,
   actionIdSource:()=>('move'+i+'t'+String(++counters[i]).padStart(6,'0'))})
 }));
 const counters=[0,0,0,0];
 let moves=0;
 for(;moves<16&&runner.phase==='playing';moves++){
  const pub=(await host.store.matchPublic(CODE,matchId)).publicView;
  const memberId=room.match.participants[pub.turn];
  const seat=players.findIndex(p=>p.uid===memberId);
  assert.ok(seat>=0,'UID maps to the actual game seat');
  const session=sessions[seat];
  assert.equal((await session.refresh()).status,'ready');
  const v=session.getView();
  assert.equal(v.seat,pub.turn);
  assert.equal(v.isMyTurn,true);
  assert.equal(v.hand.length,pub.counts[v.seat]);
  assert.ok(v.legal.drawIndices.length>0);
  const action=await session.dispatch({type:'draw',
   index:Math.floor(rng()*v.legal.drawIndices.length)});
  assert.equal(action.submitted,true);
  const processed=await runner.tick();
  assert.equal(processed.accepted,1,JSON.stringify(processed));
  assert.ok((await players[seat].store.matchReceipt(CODE,matchId,memberId,action.actionId)).ok);
  const newer=await session.refresh();
  assert.ok(['ack','ready'].includes(newer.status),newer.status);
  const updated=(await host.store.matchPublic(CODE,matchId)).publicView;
  assert.ok(updated.revision>pub.revision,'revision must advance after drawing');
  // Public payload must have only counts, never complete hands.
  assert.equal(JSON.stringify(updated).includes('"hands"'),false);
 }
 assert.ok(moves>=6,'multiple seats interacted via actual Firebase: '+moves);
 const spectator=await raw(outsider,'matches/'+matchId+'/private/'+players[2].uid);
 assert.ok([401,403].includes(spectator.status));
 for(const session of sessions)session.dispose();
});
