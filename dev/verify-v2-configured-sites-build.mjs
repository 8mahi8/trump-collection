// Static/offline packaging gate. This never connects to the supplied Firebase.
import assert from 'node:assert/strict';
import {buildV2OnlineLab,validateV2DatabaseURL} from '../v2/build/build-online-lab.mjs';
import {onlineUiGames} from '../v2/ui/online-readiness.mjs';
const sample='https://example-default-rtdb.firebaseio.com';
for(const value of [
 'http://example-default-rtdb.firebaseio.com',
 'https://example-default-rtdb.firebaseio.com/private',
 'https://example-default-rtdb.firebaseio.com/?auth=secret',
 'https://example-default-rtdb.firebaseio.com#tag',
 'https://user:pass@example-default-rtdb.firebaseio.com',
 'https://example-default-rtdb.firebaseio.com.evil.test',
 'https://127.0.0.1:9000',
 ' https://example-default-rtdb.firebaseio.com',
 'https://example-default-rtdb.firebaseio.com:8443'
])assert.throws(()=>validateV2DatabaseURL(value),/V2_DATABASE_URL_INVALID/);
assert.equal(validateV2DatabaseURL(sample+'/'),sample);
assert.equal(validateV2DatabaseURL('https://school-db.asia-southeast1.firebasedatabase.app'),
 'https://school-db.asia-southeast1.firebasedatabase.app');
const html=await buildV2OnlineLab({databaseURL:sample});
const plain=await buildV2OnlineLab();
assert.ok(plain.length>30000);
assert.ok(!plain.includes('window.TRUMP_V2_FIREBASE_CONFIG='));
assert.ok(html.includes('window.TRUMP_V2_FIREBASE_CONFIG={"databaseURL":"'+sample+'"}'));
const configIndex=html.indexOf('window.TRUMP_V2_FIREBASE_CONFIG=');
const gameIndex=html.indexOf('TRUMP_V2_ONLINE_LAB');
assert.ok(configIndex>=0&&gameIndex>configIndex,'configure before game initialization');
assert.equal((html.match(/<script>/g)||[]).length,2);
assert.equal((html.match(/<\/script>/g)||[]).length,2);
assert.ok(!/<iframe\b|<script\b[^>]+src=|<link\b[^>]+rel="stylesheet"/i.test(html));
assert.ok(!html.includes('auth=')&&!html.includes('apiKey:'));
assert.ok(!html.includes('TRUMP_V2_TEST_SEED=98765'));
assert.ok(!html.includes('mygame-df915'),'sample build must not silently select production DB');
assert.deepEqual(onlineUiGames({schoolOnly:true}),
 ['babanuki','shichinarabe','shinkei','daifugo'],
 'Only four independently validated games are eligible for school release');
assert.equal(onlineUiGames().length,5,'Development still retains experimental fifth game');
await assert.rejects(()=>buildV2OnlineLab({schoolRelease:true}),
 /SCHOOL_RELEASE_REQUIRES_DATABASE_URL/);
const school=await buildV2OnlineLab({databaseURL:sample,schoolRelease:true});
assert.ok(school.length>30000);
assert.ok(school.includes('window.TRUMP_V2_FIREBASE_CONFIG={"databaseURL":"'+sample+'"}'));
assert.ok(!/<iframe\\b|<script\\b[^>]+src=|<link\\b[^>]+stylesheet/i.test(school));
assert.ok(!school.includes('TRUMP_V2_TEST_SEED=98765'));
console.log('SCHOOL_FOUR_GAME_OFFLINE_BUILD_PASS bytes='+Buffer.byteLength(school)+
 ' code=four-online-games config=public-url noLiveWrites=true');
console.log('SITES_OFFLINE_CONFIGURED_BUNDLE_PASS bytes='+Buffer.byteLength(html)+
 ' scripts=2 auth=none staticOnly=true');
