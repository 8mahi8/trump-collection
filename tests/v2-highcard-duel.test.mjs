import test from 'node:test';
import assert from 'node:assert/strict';
import {createHighcard,flipHighcard,highcardPublic,highcardLegal,highcardRanks}
 from '../v2/games/highcard-duel.mjs';
import {createCpuSession} from '../v2/session/cpu-session.mjs';
import {createSharedRoom,applySharedRoomAction} from '../v2/core/shared-room.mjs';
import {createTwoPlayerHighcardMatch} from '../v2/session/two-player-highcard-match.mjs';
const HOST='human-host-1234',FRIEND='human-friend-1234',ROOM='46826';
function liveRoom(cpu=false){
 let r=createSharedRoom({roomCode:ROOM,hostId:HOST});
 if(!cpu)r=applySharedRoomAction(r,{actor:FRIEND,type:'join',expectedRevision:r.revision});
 r=applySharedRoomAction(r,{actor:HOST,type:'selectGame',gameId:'highcard',expectedRevision:r.revision});
 for(const id of r.members)r=applySharedRoomAction(r,{actor:id,type:'setReady',ready:true,expectedRevision:r.revision});
 return applySharedRoomAction(r,{actor:HOST,type:'startMatch',expectedRevision:r.revision});
}
test('Six-round high-card rule never exposes hidden cards to viewers',()=>{
 const a=createHighcard(58),b=createHighcard(58);
 assert.deepEqual(a.tiles,b.tiles,'seeded testing must be reproducible');
 assert.equal(a.tiles.length,12);
 assert.equal(highcardLegal(a,0).length,6);
 assert.equal(highcardLegal(a,1).length,0);
 const before=highcardPublic(a);
 assert.equal(before.tiles.filter(t=>t.card!==null).length,0);
 assert.equal(flipHighcard(a,1,6),false,'wrong turn');
 assert.equal(flipHighcard(a,0,6),false,'wrong owner');
 assert.equal(flipHighcard(a,0,0),true);
 assert.equal(highcardPublic(a).tiles.filter(t=>t.card!==null).length,1);
 assert.equal(a.turn,1);
 assert.equal(flipHighcard(a,1,6),true);
 assert.equal(a.round,1);
 assert.equal(a.turn,0);
 assert.equal(highcardPublic(a).tiles.filter(t=>t.card!==null).length,2);
});
test('Both players can complete six rounds and all results remain bounded',()=>{
 const s=createHighcard(912);
 for(let i=0;i<6;i++){
  assert.equal(flipHighcard(s,0,i),true);
  assert.equal(flipHighcard(s,1,i+6),true);
 }
 assert.equal(s.phase,'end');assert.equal(s.round,6);
 assert.equal(s.scores.length,2);
 assert.ok(s.scores[0]+s.scores[1]<=6);
 assert.ok(Object.values(highcardRanks(s)).every(r=>r>=1&&r<=2));
 assert.equal(flipHighcard(s,0,0),false);
});
test('One person and CPU complete the game via shared CPU Session',()=>{
 const session=createCpuSession({game:'highcard',seed:41,seat:0});
 let human=0,cpu=0;
 while(session.getView().phase!=='finished'&&human+cpu<24){
  const mine=session.getView();
  if(mine.isMyTurn){
   assert.equal(session.dispatch({type:'flip',index:mine.legal.flipIndices[0]}),true);human++;
  }else{assert.equal(session.stepCpu(),true);cpu++;}
 }
 assert.equal(session.getView().phase,'finished');
 assert.equal(human,6);assert.equal(cpu,6);
 assert.equal(session.getView().result.scores.length,2);
 session.dispose();
});
test('Two-human online match finishes with no deck leakage or invalid moves',()=>{
 const room=liveRoom(),match=createTwoPlayerHighcardMatch({room,seedSource:()=>89});
 assert.equal(match.phase,'playing');
 let revision=match.revision;
 for(let i=0;i<12;i++){
  const seat=i%2,actor=room.match.participants[seat];
  const hidden=match.publicSnapshot().publicView.tiles.filter(t=>!t.flipped);
  assert.ok(hidden.every(t=>t.card===null),'the host must keep hidden cards secret');
  assert.deepEqual(match.privateSnapshot(actor).privateView.hand,[]);
  const view=match.viewFor(actor);
  const index=view.legal.flipIndices[0];
  assert.ok(Number.isInteger(index));
  const wrong=match.apply({actor,matchId:match.matchId,
   actionId:'bad'+String(i).padStart(6,'0'),type:'flip',
   expectedRevision:revision,round:0,index:seat===0?6:0});
  assert.equal(wrong.ok,false);
  assert.equal(match.revision,revision);
  const result=match.apply({actor,matchId:match.matchId,
   actionId:'move'+String(i).padStart(6,'0'),type:'flip',
   expectedRevision:revision,round:0,index});
  assert.equal(result.ok,true);
  assert.ok(match.revision>revision);
  revision=match.revision;
 }
 assert.equal(match.phase,'finished');
 assert.equal(match.publicSnapshot().publicView.phase,'finished');
 assert.ok(match.publicSnapshot().publicView.scores.reduce((a,b)=>a+b,0)<=6);
 assert.deepEqual(match.publicSnapshot().publicView.tiles.filter(t=>t.card===null),[]);
});
test('Experimental high-card host advances its own CPU in a one-person room',()=>{
 const room=liveRoom(true),match=createTwoPlayerHighcardMatch({room,seedSource:()=>23});
 let moves=0;
 while(match.phase==='playing'&&moves<24){
  const p=match.publicSnapshot().publicView;
  if(p.turn===0){
   const index=match.viewFor(HOST).legal.flipIndices[0];
   assert.equal(match.apply({actor:HOST,matchId:match.matchId,
    actionId:'solo'+String(moves).padStart(6,'0'),type:'flip',
    expectedRevision:p.revision,round:0,index}).ok,true);
  }else{assert.equal(match.takeCpuTurn()?.ok,true);}
  moves++;
 }
 assert.equal(moves,12);assert.equal(match.phase,'finished');
});
