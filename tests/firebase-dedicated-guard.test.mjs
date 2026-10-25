import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFirebaseConfig as validate} from '../online/firebase-dedicated-guard.mjs';

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
test('Firebase shared preflight: known existing school Firebase URL is valid in shape only',()=>{
 const a=validate({projectId:'mygame-df915',
  apiKey:safe.apiKey,databaseURL:'https://mygame-df915-default-rtdb.firebaseio.com/'});
 assert.equal(a.projectId,'mygame-df915');
 assert.equal(a.databaseURL,'https://mygame-df915-default-rtdb.firebaseio.com');
});
test('Firebase preflight: other or misnamed projects are blocked',()=>{
 rejects({projectId:'brawl-online'},'FIREBASE_PROJECT_NOT_ALLOWED');
 rejects({projectId:'trump-collection-xy'},'FIREBASE_PROJECT_NOT_ALLOWED');
 rejects({projectId:'trump-collection-school-qa-'},'FIREBASE_PROJECT_NOT_ALLOWED');
});
test('Firebase shared preflight: reject cross-database configuration and lookalike domains',()=>{
 const shared={...safe,projectId:'mygame-df915'};
 for(const databaseURL of [
  safe.databaseURL,
  'https://mygame-df915-default-rtdb.firebaseio.com.attacker.test',
  'https://mygame-df915-other.firebaseio.com'
 ])rejects({...shared,databaseURL},'FIREBASE_PROJECT_DATABASE_MISMATCH');
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
