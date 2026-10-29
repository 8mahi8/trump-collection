import test from 'node:test';
import assert from 'node:assert/strict';
import {projectHeadToHead} from '../v2/ui/seat-selection.mjs';
const ids=['host','second','third','fourth'];
const room=(patch={})=>({roomCode:'12345',hostId:ids[0],members:[...ids],
 participants:[ids[0],ids[2]],...patch});
const cpu=(r,id)=>id.startsWith('cpu-');
test('Head-to-head seat projection numbers players by stable lobby membership',()=>{
 const result=projectHeadToHead(room(),{selfId:ids[0],isCpuSeat:cpu});
 assert.deepEqual(result.players,['P1','P3']);
 assert.deepEqual(result.spectators,['P2','P4']);
 assert.equal(result.matchup,'P1 VS P3');
 assert.equal(result.spectatorLine,'観戦：P2・P4');
 assert.equal(result.selfRole,'player');
 assert.deepEqual(result.opponents.map(o=>[o.label,o.selected]),
  [['P2',false],['P3',true],['P4',false]]);
});
test('Spectators see exact role and one selected guest sees player role',()=>{
 assert.equal(projectHeadToHead(room(),{selfId:ids[1]}).selfRole,'spectator');
 assert.equal(projectHeadToHead(room(),{selfId:ids[2]}).selfRole,'player');
 assert.equal(projectHeadToHead(room(),{selfId:'not-joined'}).selfRole,'pending');
});
test('CPU opponent has readable seat label without leaking hidden identity',()=>{
 const state=room({members:ids.slice(0,2),participants:[ids[0],'cpu-12345-1']});
 const result=projectHeadToHead(state,{selfId:ids[1],isCpuSeat:cpu});
 assert.equal(result.matchup,'P1 VS CPU2');
 assert.equal(result.selfRole,'spectator');
 assert.deepEqual(result.opponents.map(o=>o.label),['P2']);
});
test('Projection never mutates room state and missing data fail closed',()=>{
 const state=room();const frozen=JSON.stringify(state);
 projectHeadToHead(state,{selfId:ids[0],isCpuSeat:cpu});
 assert.equal(JSON.stringify(state),frozen);
 assert.equal(projectHeadToHead({members:[],participants:[],hostId:'h'},{}).matchup,'');
});
