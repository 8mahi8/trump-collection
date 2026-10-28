import test from 'node:test';
import assert from 'node:assert/strict';
import {projectMatchResults} from '../v2/ui/results-view.mjs';

test('Ranked four-seat match uses placement, highlights human and names CPUs',()=>{
 const rows=projectMatchResults({
  participants:['h','cpu-1','guest','cpu-3'],members:['h','guest'],
  selfId:'h',ranks:{0:2,1:4,2:1,3:3},scores:null,
  isCpu:id=>id.startsWith('cpu-')
 });
 assert.deepEqual(rows.map(r=>r.rank),[1,2,3,4]);
 assert.deepEqual(rows.map(r=>r.name),['P2','自分','CPU4','CPU2']);
 assert.equal(rows[1].isYou,true);
 assert.ok(rows.every(r=>r.score===null));
});
test('Memory scores work without ranks and are sorted descending',()=>{
 const rows=projectMatchResults({participants:['a','b'],members:['a','b'],
  selfId:'a',ranks:null,scores:[5,7]});
 assert.deepEqual(rows.map(r=>r.score),[7,5]);
 assert.deepEqual(rows.map(r=>r.name),['P2','自分']);
 assert.ok(rows.every(r=>r.rank===null));
});
test('Missing outcomes do not fabricate winner positions',()=>{
 assert.deepEqual(projectMatchResults({participants:['a'],members:['a'],
  selfId:'a'}),[]);
 assert.deepEqual(projectMatchResults({participants:[]}),[]);
});
