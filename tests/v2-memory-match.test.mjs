import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedRoom,applySharedRoomAction,isCpuSeat} from '../v2/core/shared-room.mjs';
import {createTwoPlayerMemoryMatch} from '../v2/session/two-player-memory-match.mjs';
import {mulberry32} from '../games.mjs';

const H='hostMemoryUID88',A='friendMemoryA88',B='friendMemoryB88',C='friendMemoryC88';
function step(room,type,actor=H,extra={}){
 return applySharedRoomAction(room,{type,actor,expectedRevision:room.revision,...extra});
}
function start({people=[H],seed=20261028}={}){
 let r=createSharedRoom({roomCode:'76290',hostId:H});
 for(const id of people.slice(1))r=step(r,'join',id);
 r=step(r,'selectGame',H,{gameId:'shinkei'});
 if(people.length>2)r=step(r,'setParticipants',H,{memberIds:[H,B]});
 for(const id of r.participants.filter(id=>r.members.includes(id)))
  r=step(r,'setReady',id,{ready:true});
 r=step(r,'startMatch');
 return {room:r,match:createTwoPlayerMemoryMatch({room:r,seedSource:()=>seed})};
}
test('Memory private deck stays hidden; only currently revealed cards enter public view',()=>{
 const {room,match}=start({people:[H,A]});
 const initial=match.publicSnapshot().publicView;
 assert.equal(initial.game,'shinkei');assert.equal(initial.tiles.length,24);
 assert.equal(initial.tiles.filter(t=>t.card!==null).length,0);
 assert.deepEqual(initial.scores,[0,0]);
 assert.equal(match.privateSnapshot(H).privateView.hand.length,0);
 assert.ok(!('board' in match.privateSnapshot(A).privateView));
 const actor=room.match.participants[initial.turn];
 const first=match.apply({actor,type:'flip',index:0,matchId:match.matchId,
  actionId:'firstFlip001',expectedRevision:initial.revision,round:0});
 assert.equal(first.ok,true);
 const next=match.publicSnapshot().publicView;
 assert.equal(next.tiles.filter(t=>t.card!==null).length,1);
 assert.equal(next.tiles[0].flipped,true);
 assert.equal(match.viewFor(actor).legal.flipIndices.includes(0),false);
 assert.equal(match.viewFor(actor).board.tiles.length,24);
 assert.equal(match.apply({actor,type:'flip',index:0,matchId:match.matchId,
  actionId:'repeatFlip001',expectedRevision:next.revision,round:0}).reason,'ILLEGAL_FLIP');
 assert.equal(match.apply({actor,type:'flip',index:1,matchId:'76290-m888',
  actionId:'staleFlip001',expectedRevision:next.revision,round:0}).reason,'STALE_MATCH');
 assert.equal(match.apply({actor:'strangerUID99',type:'flip',index:1,matchId:match.matchId,
  actionId:'strangerFlip',expectedRevision:next.revision,round:0}).reason,'NOT_A_MEMBER');
});
test('one person and one host-side CPU finish Memory using original bot and rules',()=>{
 const {room,match}=start();
 assert.equal(room.match.participants.filter(id=>isCpuSeat(room,id)).length,1);
 let human=0,cpu=0,flips=0;
 while(match.phase==='playing'&&flips<500){
  const pub=match.publicSnapshot().publicView;
  const actor=room.match.participants[pub.turn];
  if(isCpuSeat(room,actor)){
   const result=match.takeCpuTurn();assert.equal(result?.ok,true);
   cpu++;
  }else{
   const view=match.viewFor(actor);
   const index=view.legal.flipIndices[0];
   assert.ok(Number.isInteger(index));
   const result=match.apply({actor,type:'flip',index,matchId:match.matchId,
    actionId:'memoryFlip'+String(flips).padStart(5,'0'),
    expectedRevision:pub.revision,round:0});
   assert.equal(result.ok,true,'human flip '+flips);human++;
  }
  flips++;
 }
 assert.equal(match.phase,'finished','Memory must finish in 500 flips');
 assert.ok(human>0&&cpu>0);
 const final=match.publicSnapshot().publicView;
 assert.equal(final.tiles.filter(x=>x.taken).length,24);
 assert.equal(final.scores.reduce((a,b)=>a+b,0),12);
 assert.equal(match.viewFor(H).phase,'finished');
 console.log('MEMORY_CPU_FINISHED human='+human+' cpu='+cpu+' flips='+flips);
});
test('four-member room selects two humans; other two cannot issue Memory moves',()=>{
 const {room,match}=start({people:[H,A,B,C]});
 assert.deepEqual(room.members,[H,A,B,C]);
 assert.deepEqual(room.match.participants,[H,B]);
 assert.equal(match.viewFor(B).players.length,2);
 assert.throws(()=>match.privateSnapshot(A),/NOT_A_MATCH_PLAYER/);
 const p=match.publicSnapshot().publicView;
 assert.equal(match.apply({actor:A,matchId:match.matchId,type:'flip',index:0,
  actionId:'spectatorFlip01',expectedRevision:p.revision,round:0}).reason,'NOT_A_MATCH_PLAYER');
});
test('two human Memory players can finish a full match with no CPU',()=>{
 const {room,match}=start({people:[H,A],seed:491});
 let actions=0;
 const rng=mulberry32(7511);
 while(match.phase==='playing'&&actions<2000){
  const pub=match.publicSnapshot().publicView,actor=room.match.participants[pub.turn];
  const options=match.viewFor(actor).legal.flipIndices;
  const index=options[Math.floor(rng()*options.length)];
  const result=match.apply({actor,type:'flip',index,matchId:match.matchId,
   actionId:'humanFlip'+String(actions).padStart(5,'0'),
   expectedRevision:pub.revision,round:0});
  assert.equal(result.ok,true,'memory turn '+actions);actions++;
 }
 assert.equal(match.phase,'finished');
 assert.equal(match.publicSnapshot().publicView.tiles.filter(x=>x.taken).length,24);
});
