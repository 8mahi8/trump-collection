import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameRegistry} from '../v2/core/game-registry.mjs';
import {chooseRoomCpuMove} from '../v2/session/room-cpu-choice.mjs';
import {sortHandForGame} from '../v2/ui/card-order.mjs';
const dummy={id:'fifth-game',label:'第5ゲーム',seats:4,boardKind:'draw',
 actions:['draw'],createLocal:()=>({phase:'play',turn:0}),
 localHand:()=>[],localCounts:()=>[0,0,0,0],
 localBoard:()=>({kind:'draw'}),localLegal:()=>({drawIndices:[0]}),
 remoteBoard:()=>({kind:'draw'}),remoteLegal:()=>({drawIndices:[0]})};
test('fifth game can provide its own CPU policy without adding any runtime branch',()=>{
 const registry=createGameRegistry([{...dummy,remoteCpuChoose:({publicView,privateView})=>
  ({type:'draw',index:privateView.seat+publicView.turn})}]);
 const publicView={game:'fifth-game',phase:'playing',turn:2};
 const privateView={game:'fifth-game',seat:2};
 assert.deepEqual(chooseRoomCpuMove({game:'fifth-game',publicView,privateView,registry}),
  {type:'draw',index:4});
 assert.throws(()=>chooseRoomCpuMove({game:'fifth-game',
  publicView:{...publicView,turn:1},privateView,registry}),/CPU_VIEW_OUT_OF_SYNC/);
});
test('game without an online CPU policy remains explicitly unsupported',()=>{
 const registry=createGameRegistry([dummy]);
 assert.throws(()=>chooseRoomCpuMove({game:'fifth-game',
  publicView:{game:'fifth-game',phase:'playing',turn:0},
  privateView:{game:'fifth-game',seat:0},registry}),/CPU_UNSUPPORTED_GAME/);
});
test('fifth game can define card strength without editing renderer or sorter',()=>{
 const registry=createGameRegistry([{...dummy,sortRank:card=>20-card.rank}]);
 const hand=[{rank:2,suit:0},{rank:8,suit:0},{rank:13,suit:0}];
 assert.deepEqual(sortHandForGame(hand,'fifth-game',{registry}).map(c=>c.rank),[13,8,2]);
 assert.deepEqual(sortHandForGame(hand,'fifth-game',{registry,bySuit:true}).map(c=>c.rank),[13,8,2]);
 assert.deepEqual(hand.map(c=>c.rank),[2,8,13]);
});
test('registration rejects malformed custom CPU or ranking hooks',()=>{
 for(const key of ['sortRank','remoteCpuChoose'])
  assert.throws(()=>createGameRegistry([{...dummy,[key]:'not-function'}]),
   /INVALID_/);
});
