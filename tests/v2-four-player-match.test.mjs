import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedRoom,applySharedRoomAction} from '../v2/core/shared-room.mjs';
import {createFourPlayerMatch} from '../v2/session/four-player-match.mjs';
const IDS=['hostUIDabc123','friendUIDb123','friendUIDc123','friendUIDd123'];
function roomFor(game){
 let r=createSharedRoom({roomCode:'67429',hostId:IDS[0]});
 for(const id of IDS.slice(1))r=applySharedRoomAction(r,{type:'join',actor:id,expectedRevision:r.revision});
 r=applySharedRoomAction(r,{type:'selectGame',actor:IDS[0],gameId:game,expectedRevision:r.revision});
 for(const actor of IDS)r=applySharedRoomAction(r,{type:'setReady',actor,ready:true,expectedRevision:r.revision});
 return applySharedRoomAction(r,{type:'startMatch',actor:IDS[0],expectedRevision:r.revision});
}
test('room match bridges existing authority for all three 4-seat games',()=>{
 for(const game of ['babanuki','shichinarabe','daifugo']){
  const room=roomFor(game),match=createFourPlayerMatch({room,seedSource:()=>8});
  assert.equal(match.matchId,room.match.matchId);
  const pub=match.publicSnapshot();
  assert.equal(pub.gameId,game);
  assert.equal(pub.publicView.protocol,2);
  assert.equal(pub.publicView.phase,'playing');
  assert.ok(!('hands' in pub.publicView),'public must never include private hands');
  for(let seat=0;seat<4;seat++){
   const mine=match.privateSnapshot(IDS[seat]);
   assert.equal(mine.privateView.seat,seat);
   const v=match.viewFor(IDS[seat]);
   assert.equal(v.game,game);
   assert.equal(v.seat,seat);
   assert.equal(v.players.length,4);
   assert.equal(v.hand.length,pub.publicView.counts[seat]);
  }
  assert.throws(()=>match.privateSnapshot('strangerUIDx3'),/NOT_A_MATCH_PLAYER/);
 }
});
test('room match rejects stale match ID, invalid actor, bad revision and wrong room',()=>{
 const room=roomFor('babanuki'),match=createFourPlayerMatch({room,seedSource:()=>16});
 const p=match.publicSnapshot().publicView;
 const actor=IDS[p.turn];
 const common={actor,actionId:'command001',expectedRevision:p.revision,round:p.round,
  type:'draw',index:0};
 assert.equal(match.apply({...common,matchId:'67429-m0'}).reason,'STALE_MATCH');
 assert.equal(match.apply({...common,matchId:match.matchId,expectedRevision:p.revision-1}).reason,'STALE_MATCH_REVISION');
 assert.equal(match.apply({...common,matchId:match.matchId,actor:'strangerUIDx3'}).reason,'NOT_A_MEMBER');
 assert.equal(match.apply({...common,matchId:match.matchId,type:'forbidden'}).reason,'INVALID_MATCH_ACTION');
 assert.throws(()=>match.syncRoom({...room,roomCode:'00000'}),/WRONG_MATCH/);
 assert.equal(match.phase,'playing');
});
test('four independent seat actions finish a real Old Maid match without exposing hands',()=>{
 const room=roomFor('babanuki'),match=createFourPlayerMatch({room,seedSource:()=>18});
 let turns=0;
 while(match.phase==='playing'&&turns<500){
  const pub=match.publicSnapshot().publicView,actor=IDS[pub.turn];
  const my=match.viewFor(actor);
  assert.equal(my.isMyTurn,true);
  assert.ok(my.legal.drawIndices.length>0);
  const output=match.apply({actor,matchId:match.matchId,
   type:'draw',index:0,actionId:'turn'+String(turns).padStart(6,'0'),
   expectedRevision:pub.revision,round:pub.round});
  assert.equal(output.ok,true,'turn '+turns+': '+JSON.stringify(output));
  turns++;
 }
 assert.ok(turns>5&&turns<500,'finished in '+turns+' moves');
 assert.equal(match.phase,'finished');
 const end=match.publicSnapshot().publicView;
 assert.equal(end.phase,'finished');
 assert.equal(match.viewFor(IDS[0]).phase,'finished');
 assert.equal(match.apply({actor:IDS[0],matchId:match.matchId,
  type:'draw',index:0,actionId:'lateMove222',expectedRevision:end.revision,round:end.round}).reason,'MATCH_FINISHED');
});
