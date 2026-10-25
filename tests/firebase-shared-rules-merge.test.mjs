import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeExistingFirebaseRules,inspectRulesCompatibility} from '../dev/merge-existing-firebase-rules.mjs';
const source=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/existing-school.rules.json',import.meta.url),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
const fails=(obj,reason)=>assert.throws(()=>mergeExistingFirebaseRules(obj,source),
 err=>err.message===reason,reason);
test('Shared Firebase Rules: add only trumpRoomsV1, preserve legacy permissions unchanged',()=>{
 const original=clone(fixture);
 const merged=mergeExistingFirebaseRules(fixture,source);
 assert.deepEqual(fixture,original,'never mutate existing rules');
 assert.deepEqual(merged.rules.rooms,original.rules.rooms);
 assert.deepEqual(merged.rules.rooms2v2,original.rules.rooms2v2);
 assert.deepEqual(merged.rules.legacyPublic,original.rules.legacyPublic);
 assert.deepEqual(merged.rules.legacyPrivate,original.rules.legacyPrivate);
 assert.deepEqual(merged.rules.trumpRoomsV1,source.rules.trumpRoomsV1);
 assert.deepEqual(Object.keys(merged.rules).sort(),
  [...Object.keys(original.rules),'trumpRoomsV1'].sort());
 const result=inspectRulesCompatibility(fixture,source);
 assert.equal(result.productionApproved,false);
 assert.equal(result.safeToTestInEmulator,true);
});
test('Shared Firebase Rules: refuse any root-level grant that could reveal private hands',()=>{
 fails({rules:{'.read':true,'.write':false}},'UNSAFE_ANCESTOR_READ');
 fails({rules:{'.read':"auth !== null",'.write':false}},'UNSAFE_ANCESTOR_READ');
 fails({rules:{'.read':false,'.write':true}},'UNSAFE_ANCESTOR_WRITE');
 fails({rules:{'.read':false,'.write':"auth !== null"}},'UNSAFE_ANCESTOR_WRITE');
});
test('Shared Firebase Rules: root wildcard must be reviewed, even with conditional grants',()=>{
 fails({rules:{'.read':false,'.write':false,'$room':{'.read':"auth !== null"}}},
  'ROOT_WILDCARD_REQUIRES_MANUAL_AUDIT');
 fails({rules:{'$key':{'.read':false,'.write':false}}},
  'ROOT_WILDCARD_REQUIRES_MANUAL_AUDIT');
});
test('Shared Firebase Rules: root validator and pre-existing trump path require manual resolution',()=>{
 fails({rules:{'.validate':"newData.hasChildren(['legacy'])"}},
  'ROOT_VALIDATION_REQUIRES_MANUAL_AUDIT');
 fails({rules:{trumpRoomsV1:{}}},
  'TRUMP_PATH_ALREADY_EXISTS');
});
test('Shared Firebase Rules: incomplete inputs and altered trump root are rejected',()=>{
 assert.throws(()=>mergeExistingFirebaseRules(null,source),/EXISTING_RULES_DOCUMENT_REQUIRED/);
 assert.throws(()=>mergeExistingFirebaseRules({},source),/EXISTING_RULES_DOCUMENT_REQUIRED/);
 assert.throws(()=>mergeExistingFirebaseRules(fixture,null),/TRUMP_RULES_DOCUMENT_REQUIRED/);
 const unsafe=clone(source);unsafe.rules['.read']=true;
 assert.throws(()=>mergeExistingFirebaseRules(fixture,unsafe),/TRUMP_RULES_NOT_ISOLATED/);
 const extra=clone(source);extra.rules.rooms={'.read':true};
 assert.throws(()=>mergeExistingFirebaseRules(fixture,extra),/TRUMP_RULES_UNEXPECTED_ROOT/);
});
