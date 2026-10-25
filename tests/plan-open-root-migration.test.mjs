import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planOpenRootMigration} from '../dev/plan-open-root-migration.mjs';
const existing=JSON.parse(readFileSync(new URL('./fixtures/open-root.example.rules.json',import.meta.url),'utf8'));
const dedicated=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
const roots=['rooms','rooms2v2','shokokuRooms1v1','lemonClashRoomsV1'];
const copy=o=>JSON.parse(JSON.stringify(o));
test('Migration draft restricts root while keeping scoped legacy time window and private trump access',()=>{
 const original=copy(existing);
 const result=planOpenRootMigration(existing,dedicated,roots);
 assert.deepEqual(existing,original,'must not alter input');
 assert.deepEqual(result.combinedRules.rules['.read'],false);
 assert.deepEqual(result.combinedRules.rules['.write'],false);
 for(const root of roots){
  assert.equal(result.combinedRules.rules[root]['.read'],existing.rules['.read']);
  assert.equal(result.combinedRules.rules[root]['.write'],existing.rules['.write']);
 }
 assert.deepEqual(result.combinedRules.rules.trumpRoomsV1,dedicated.rules.trumpRoomsV1);
 assert.deepEqual(Object.keys(result.combinedRules.rules).sort(),['.read','.write',...roots,'trumpRoomsV1'].sort());
 assert.equal(result.productionApproved,false);
 assert.equal(result.liveRulesVerified,false);
 assert.equal(result.allLegacyRootsVerified,false);
 assert.equal(result.expirationUnchanged,true);
});
test('Migration draft rejects unknown existing root paths instead of deleting them',()=>{
 const rules=copy(existing);rules.rules.unidentifiedExistingGame={'.read':true};
 assert.throws(()=>planOpenRootMigration(rules,dedicated,roots),/ADDITIONAL_ROOT_RULES_REQUIRE_MANUAL_REVIEW/);
});
test('Migration draft cannot silently accept unexpected root or widened rules',()=>{
 for(const obj of [null,{}, {rules:{'.read':true,'.write':true}},
  {rules:{'.read':'auth != null','.write':'auth != null'}},
  {rules:{'.read':'now < 1994063600000','.write':true}}]){
  assert.throws(()=>planOpenRootMigration(obj,dedicated,roots));
 }
 const leaked=copy(dedicated);leaked.rules['.read']=true;
 assert.throws(()=>planOpenRootMigration(existing,leaked,roots),/PRIVATE_TRUMP_RULES_REQUIRED/);
});
test('Migration draft requires an explicit audited set of unique legacy roots',()=>{
 for(const input of [[],['rooms','rooms'],['rooms','trumpRoomsV1'],['rooms','$anything'],['rooms','oops/other'],[''],null])
  assert.throws(()=>planOpenRootMigration(existing,dedicated,input));
});
