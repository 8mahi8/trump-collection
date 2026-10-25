import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildConfiguredSitesHtml,inspectConfiguredSitesRules} from '../dev/build-configured-sites.mjs';
import {planOpenRootMigration} from '../dev/plan-open-root-migration.mjs';
const original=JSON.parse(readFileSync(new URL('./fixtures/owner-reported-open-root.example.rules.json',import.meta.url),'utf8'));
const dedicated=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
const roots=['rooms','rooms2v2','shokokuRooms1v1','lemonClashRoomsV1'];
const shared={projectId:'mygame-df915',apiKey:'fake-emulator-public-key',databaseURL:'https://mygame-df915-default-rtdb.firebaseio.com'};
const candidate=()=>planOpenRootMigration(original,dedicated,roots,{legacyExpiryDate:'2026-12-08'}).combinedRules;
const copy=x=>JSON.parse(JSON.stringify(x));

test('Sites packager injects only a shape-validated public config into latest single-file HTML',()=>{
 const rules=candidate(),originalCopy=copy(rules);
 const packaged=buildConfiguredSitesHtml({config:shared,reviewedRules:rules});
 assert.equal(packaged.includes('window.TRUMP_FIREBASE_CONFIG={"projectId":"mygame-df915"'),true);
 assert.equal(packaged.includes('const APP_HTML='),true);
 assert.equal(packaged.includes('configureFriendsGame'),true);
 assert.ok(packaged.length>190000);
 assert.doesNotMatch(packaged,/serviceAccount|service_role|private_key/);
 assert.deepEqual(rules,originalCopy,'offline packager never mutates rules');
});
test('Sites packager rejects currently open root and missing or changed private hand/chat rules',()=>{
 assert.throws(()=>inspectConfiguredSitesRules(shared,original),/OPEN_ROOT_MUST_BE_CLOSED/);
 const altered=candidate();delete altered.rules.trumpRoomsV1.$room.chat;
 assert.throws(()=>inspectConfiguredSitesRules(shared,altered),/TRUMP_RULES_NOT_MATCHING_AUDITED_SOURCE/);
 const wildcard=candidate();wildcard.rules.$path={'.read':true};
 assert.throws(()=>inspectConfiguredSitesRules(shared,wildcard),/ROOT_WILDCARD_OR_VALIDATION_REQUIRES_REVIEW/);
 const broad=candidate();broad.rules['.read']='now < 1796655600000';
 assert.throws(()=>inspectConfiguredSitesRules(shared,broad),/OPEN_ROOT_MUST_BE_CLOSED/);
});
test('Sites packager does not silently discard old school game namespaces',()=>{
 const rules=candidate();delete rules.rules.lemonClashRoomsV1;
 assert.throws(()=>inspectConfiguredSitesRules(shared,rules),/SHARED_LEGACY_PATH_MISSING_lemonClashRoomsV1/);
});
test('Sites packager rejects wrong Firebase origin, unknown config fields and absent rules file',()=>{
 const rules=candidate();
 assert.throws(()=>inspectConfiguredSitesRules({...shared,databaseURL:'https://another-project.firebaseio.com'},rules),/DATABASE_MISMATCH/);
 assert.throws(()=>inspectConfiguredSitesRules({...shared,serviceAccount:'secret'},rules),/UNEXPECTED_FIREBASE_CONFIG_FIELD/);
 assert.throws(()=>inspectConfiguredSitesRules(shared,null),/REVIEWED_RULES_REQUIRED/);
});
test('Dedicated project can package with isolated dedicated Rules, even without legacy game roots',()=>{
 const config={projectId:'trump-collection-local-ci',apiKey:'fake-emulator-public-key',
   databaseURL:'https://trump-collection-local-ci-default-rtdb.us-central1.firebasedatabase.app'};
 const html=buildConfiguredSitesHtml({config,reviewedRules:dedicated});
 assert.ok(html.includes('trump-collection-local-ci-default-rtdb'));
});
