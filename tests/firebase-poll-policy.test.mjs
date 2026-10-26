import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFirebasePollDelay as delay} from '../online/firebase-poll-policy.mjs';
test('Firebase polling: active host and current player preserve 650ms gameplay pacing',()=>{
 assert.equal(delay({phase:'playing',isHost:true}),650);
 assert.equal(delay({phase:'playing',myTurn:true}),650);
 assert.equal(delay({phase:'playing',isHost:false,myTurn:false}),900);
});
test('Firebase polling: lobby and finished games read less frequently than active play',()=>{
 assert.equal(delay({phase:'lobby',isHost:true}),1000);
 assert.equal(delay({phase:'lobby',isHost:false}),1500);
 assert.equal(delay({phase:'finished',isHost:true}),1600);
 assert.equal(delay({phase:'finished',isHost:false}),2000);
});
test('Firebase polling: pending action ACK and synchronizing are prioritized',()=>{
 assert.equal(delay({phase:'finished',pendingAction:true}),250);
 assert.equal(delay({status:'syncing'}),700);
 assert.equal(delay({status:'stale'}),700);
});
test('Firebase polling: no-host and join waiting use a moderate slow interval',()=>{
 assert.equal(delay({status:'waiting_for_host'}),1500);
 assert.equal(delay({status:'host_unavailable'}),2300);
});
test('Firebase polling: failures cause bounded backoff instead of busy looping',()=>{
 assert.equal(delay({failCount:1,pendingAction:true}),1900);
 assert.equal(delay({failCount:2}),2600);
 assert.equal(delay({failCount:100}),6000);
 assert.throws(()=>delay({failCount:-1}),/INVALID_FAILURE_COUNT/);
});
