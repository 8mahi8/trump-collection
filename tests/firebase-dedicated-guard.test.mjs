import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDedicatedFirebaseConfig as validate} from '../online/firebase-dedicated-guard.mjs';

const safe={
 projectId:'trump-collection-school-qa',
 apiKey:'AIzaPublicBrowserTestKey0000000000',
 databaseURL:'https://trump-collection-school-qa-default-rtdb.asia-northeast1.firebasedatabase.app/'
};
function rejects(overrides,reason){
 assert.throws(()=>validate({...safe,...overrides}),e=>e.message===reason,reason);
}
test('Firebase dedicated preflight: isolated project and regional RTDB default endpoint allowed',()=>{
 const out=validate(safe);
 assert.deepEqual(out,{...safe,databaseURL:safe.databaseURL.slice(0,-1)});
 assert.equal(Object.isFrozen(out),true);
});
test('Firebase dedicated preflight: legacy *.firebaseio.com hostname allowed when project matches',()=>{
 const u=validate({...safe,databaseURL:'https://trump-collection-school-qa-default-rtdb.firebaseio.com'});
 assert.ok(u.databaseURL.endsWith('.firebaseio.com'));
});
test('Firebase dedicated preflight: known existing game and non-dedicated names blocked',()=>{
 rejects({projectId:'mygame-df915',databaseURL:'https://mygame-df915-default-rtdb.firebaseio.com'},
  'FIREBASE_DEDICATED_PROJECT_REQUIRED');
 rejects({projectId:'brawl-online'},'FIREBASE_DEDICATED_PROJECT_REQUIRED');
 rejects({projectId:'trump-collection-xy'},'FIREBASE_DEDICATED_PROJECT_REQUIRED');
 rejects({projectId:'trump-collection-school-qa-'},'FIREBASE_DEDICATED_PROJECT_REQUIRED');
});
test('Firebase dedicated preflight: reject mismatch, wrong or spoofed host suffix',()=>{
 rejects({databaseURL:'https://mygame-df915-default-rtdb.firebaseio.com'},'FIREBASE_PROJECT_DATABASE_MISMATCH');
 rejects({databaseURL:'https://trump-collection-school-qa-default-rtdb.firebaseio.com.evil.example'},
  'FIREBASE_PROJECT_DATABASE_MISMATCH');
 rejects({databaseURL:'https://trump-collection-school-qa-otherdb.asia-northeast1.firebasedatabase.app'},
  'FIREBASE_PROJECT_DATABASE_MISMATCH');
});
test('Firebase dedicated preflight: reject URL paths, credentials, search, http and ports',()=>{
 for(const databaseURL of [
 'http://trump-collection-school-qa-default-rtdb.firebaseio.com',
 'https://trump-collection-school-qa-default-rtdb.firebaseio.com/trumpRoomsV1',
 'https://trump-collection-school-qa-default-rtdb.firebaseio.com?ns=other',
 'https://trump-collection-school-qa-default-rtdb.firebaseio.com#frag',
 'https://user:pass@trump-collection-school-qa-default-rtdb.firebaseio.com',
 'https://trump-collection-school-qa-default-rtdb.firebaseio.com:8443',
 ])rejects({databaseURL},'INVALID_DATABASE_URL');
});
test('Firebase dedicated preflight: reject SDK admin credential fields and missing key',()=>{
 rejects({apiKey:'not key'},'INVALID_FIREBASE_API_KEY');
 rejects({apiKey:''},'INVALID_FIREBASE_API_KEY');
 rejects({serviceAccount:'sensitive-test'},'UNEXPECTED_FIREBASE_CONFIG_FIELD');
 assert.throws(()=>validate(null),/FIREBASE_CONFIG_MISSING/);
});
