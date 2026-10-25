import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseOpenRootTrialIdentity,createFirebaseRoomStore} from '../online/firebase-room-store.mjs';
import {buildOpenRootTrialSitesHtml} from '../dev/build-configured-sites.mjs';

const DB='https://mygame-df915-default-rtdb.firebaseio.com';
test('Open-root trial uses distinct in-memory IDs with no Auth REST calls or persisted account',async()=>{
 let counter=0;
 const getRandom=bytes=>{bytes.fill(++counter);return bytes;};
 const a=createFirebaseOpenRootTrialIdentity(getRandom);
 const b=createFirebaseOpenRootTrialIdentity(getRandom);
 assert.notEqual(a.uid,b.uid);
 assert.match(a.uid,/^tc[0-9a-f]{32}$/);
 assert.equal(a.authenticated,false);
 assert.equal(await a.token(),null);
 assert.deepEqual(await a.signIn(),{uid:a.uid});
 assert.equal(a.uid.length,34);
 assert.throws(()=>createFirebaseOpenRootTrialIdentity('bad'),/INVALID_TRIAL_RANDOM/);
 const calls=[];
 const fetchImpl=async(url,opt)=>{
  calls.push({url,opt});
  return new Response(JSON.stringify(null),{status:200,headers:{'content-type':'application/json'}});
 };
 const store=createFirebaseRoomStore({databaseURL:DB,auth:a,fetchImpl});
 await store.meta('12345');
 assert.equal(calls.length,1);
 assert.equal(new URL(calls[0].url).searchParams.has('auth'),false);
 assert.equal(calls[0].opt.method,'GET');
});
test('Open-root trial single HTML requires explicit acknowledgment and known DB',()=>{
 assert.throws(()=>buildOpenRootTrialSitesHtml({databaseURL:DB}),/PUBLIC_DATABASE_RISK_ACKNOWLEDGEMENT_REQUIRED/);
 assert.throws(()=>buildOpenRootTrialSitesHtml({databaseURL:'https://another-default-rtdb.firebaseio.com',acknowledgePublicData:true}),/TRIAL_MUST_USE_CONFIRMED_SCHOOL_DATABASE/);
 const html=buildOpenRootTrialSitesHtml({databaseURL:DB+'/',acknowledgePublicData:true});
 assert.ok(html.includes('TRUMP_FIREBASE_OPEN_ROOT_TRIAL=true'));
 assert.ok(html.includes('window.TRUMP_FIREBASE_CONFIG={"projectId":"mygame-df915"'));
 assert.ok(html.includes('誰でも手札'));
 assert.ok(html.includes('開発版')||html.includes('トランプコレクション'));
 assert.doesNotMatch(html,/serviceAccount|service_role|private_key/);
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match);
 assert.doesNotThrow(()=>new Function(match[1]));
});
