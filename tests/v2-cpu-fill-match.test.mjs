import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedRoom,applySharedRoomAction,isCpuSeat} from '../v2/core/shared-room.mjs';
import {createFourPlayerMatch} from '../v2/session/four-player-match.mjs';
import {mulberry32} from '../games.mjs';
const HOST='human-host-1234';
const ROOM='61728';
function roomFor(game,humans=1){
 let room=createSharedRoom({roomCode:ROOM,hostId:HOST});
 for(let n=1;n<humans;n++)room=applySharedRoomAction(room,{
  type:'join',actor:'human-friend-'+n,expectedRevision:room.revision});
 room=applySharedRoomAction(room,{type:'selectGame',actor:HOST,
  gameId:game,expectedRevision:room.revision});
 for(const actor of room.members)
  room=applySharedRoomAction(room,{type:'setReady',actor,ready:true,expectedRevision:room.revision});
 return applySharedRoomAction(room,{type:'startMatch',actor:HOST,expectedRevision:room.revision});
}
function humanMove(game,view,rng){
 if(game==='babanuki')return {type:'draw',index:view.legal.drawIndices[
  Math.floor(rng()*view.legal.drawIndices.length)]};
 if(game==='shichinarabe')return view.legal.playIds.length?
  {type:'play',id:view.legal.playIds[0]}:{type:'pass'};
 return view.legal.playMoves.length?{type:'play',ids:view.legal.playMoves[0]}:{type:'pass'};
}
test('one human versus three CPUs fully completes all three existing four-player card games',()=>{
 for(const game of ['babanuki','shichinarabe','daifugo']){
  const room=roomFor(game),match=createFourPlayerMatch({room,seedSource:()=>42});
  assert.equal(match.publicSnapshot().publicView.seats.filter(s=>s.cpu).length,3);
  let cpuMoves=0,humanMoves=0,steps=0;
  const rng=mulberry32(19301);
  while(match.phase==='playing'&&steps<1800){
   const state=match.publicSnapshot().publicView,actor=room.match.participants[state.turn];
   let move;
   if(isCpuSeat(room,actor)){
    move=match.takeCpuTurn();
    assert.ok(move,'host must advance CPU turn '+game);
    assert.equal(move.ok,true);
    cpuMoves++;
   }else{
    const mine=match.viewFor(actor);
    const action=humanMove(game,mine,rng);
    move=match.apply({...action,actor,matchId:match.matchId,
     actionId:'human'+String(steps).padStart(5,'0'),expectedRevision:state.revision,round:state.round});
    assert.equal(move.ok,true,game+' step='+steps+' '+JSON.stringify(move));
    humanMoves++;
   }
   assert.ok(match.revision>state.revision,'advance after every turn');
   steps++;
  }
  assert.equal(match.phase,'finished',game+' stalled after '+steps+' moves');
  assert.ok(cpuMoves>1&&humanMoves>0,game+' was not actually mixed');
  console.log(game+' human moves '+humanMoves+', CPU moves '+cpuMoves);
 }
});
test('real players replace empty CPU seats as they join before a match',()=>{
 for(const humans of [1,2,3,4]){
  const room=roomFor('daifugo',humans);
  assert.equal(room.match.participants.filter(id=>isCpuSeat(room,id)).length,4-humans);
  const match=createFourPlayerMatch({room,seedSource:()=>9});
  assert.equal(match.publicSnapshot().publicView.seats.filter(s=>s.cpu).length,4-humans);
 }
});

test('two human players plus two CPUs finish each four-seat game without a human timeout',()=>{
 for(const game of ['babanuki','shichinarabe','daifugo']){
  const room=roomFor(game,2);
  const match=createFourPlayerMatch({room,seedSource:()=>98765});
  let humans=0,bots=0,steps=0;
  const rng=mulberry32(271828);
  while(match.phase==='playing'&&steps<1800){
   const pub=match.publicSnapshot().publicView;
   const actor=room.match.participants[pub.turn];
   if(isCpuSeat(room,actor)){
    const move=match.takeCpuTurn();
    assert.equal(move?.ok,true,game+' bot '+steps);
    bots++;
   }else{
    const view=match.viewFor(actor);
    const move=match.apply({...humanMove(game,view,rng),actor,matchId:match.matchId,
     actionId:'duo'+String(steps).padStart(5,'0'),
     expectedRevision:pub.revision,round:pub.round});
    assert.equal(move.ok,true,game+' human '+steps+' '+JSON.stringify(move));
    humans++;
   }
   steps++;
  }
  assert.equal(match.phase,'finished',game+' stalled after '+steps+' steps');
  assert.ok(humans>0&&bots>0,game+' must have active human and CPU turns');
  console.log('MIXED_MATCH_FINISHED '+game+' humans='+humans+' bots='+bots+' turns='+steps);
 }
});
