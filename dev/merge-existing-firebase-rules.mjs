// Offline-only composition of existing Firebase RTDB Rules with trumpRoomsV1.
// Existing rules are NEVER fetched or deployed by this script.
//
// WARNING: Firebase .read/.write granted at shallower paths cannot be revoked.
// Refuse ancestor grants/wildcards rather than pretending private hands are safe.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const deny=value=>value===false||value==='false';
function parseDocument(input,label){
 if(!isObject(input)||!isObject(input.rules))throw Error(label+'_RULES_DOCUMENT_REQUIRED');
 return input;
}
export function mergeExistingFirebaseRules(existing,trump){
 const before=parseDocument(existing,'EXISTING');
 const dedicated=parseDocument(trump,'TRUMP');
 const root=before.rules,source=dedicated.rules;
 if(own(root,'trumpRoomsV1'))throw Error('TRUMP_PATH_ALREADY_EXISTS');
 if(!isObject(source.trumpRoomsV1)||!deny(source['.read'])||!deny(source['.write']))
  throw Error('TRUMP_RULES_NOT_ISOLATED');
 if(Object.keys(source).some(k=>!['.read','.write','trumpRoomsV1'].includes(k)))
  throw Error('TRUMP_RULES_UNEXPECTED_ROOT');
 for(const key of ['.read','.write']){
  if(own(root,key)&&!deny(root[key]))
   throw Error('UNSAFE_ANCESTOR_'+key.slice(1).toUpperCase());
 }
 // Root wildcard rules can potentially grant access to /trumpRoomsV1/*.
 // Even if a wildcard looks safe, we cannot certify complex expressions
 // statically. Fail closed rather than risk cross-game hand disclosure.
 if(Object.keys(root).some(key=>key.startsWith('$')))
  throw Error('ROOT_WILDCARD_REQUIRES_MANUAL_AUDIT');
 if(own(root,'.validate'))throw Error('ROOT_VALIDATION_REQUIRES_MANUAL_AUDIT');
 // Prevent prototype pollution from untrusted JSON and leave all existing
 // paths/conditions byte-for-byte logically unchanged.
 const copy=JSON.parse(JSON.stringify(before));
 Object.defineProperty(copy.rules,'trumpRoomsV1',{
  value:JSON.parse(JSON.stringify(source.trumpRoomsV1)),
  enumerable:true,writable:true,configurable:true
 });
 return copy;
}
export function inspectRulesCompatibility(existing,trump){
 const candidate=mergeExistingFirebaseRules(existing,trump);
 const oldKeys=Object.keys(existing.rules);
 if(!oldKeys.every(key=>JSON.stringify(existing.rules[key])===JSON.stringify(candidate.rules[key])))
  throw Error('EXISTING_RULES_CHANGED');
 return {existingTopLevelKeys:oldKeys.slice().sort(),
  addedPath:'trumpRoomsV1',safeToTestInEmulator:true,
  productionApproved:false,combinedRules:candidate};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);
 const i=argv.indexOf('--existing'),j=argv.indexOf('--out');
 if(i<0||!argv[i+1]){
  console.error('Usage: node dev/merge-existing-firebase-rules.mjs --existing path/to/CURRENT.rules.json [--out path/to/REVIEW-CANDIDATE.json]');
  process.exitCode=2;
 }else{
  try{
   const existing=JSON.parse(readFileSync(resolve(argv[i+1]),'utf8'));
   const trump=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
   const outcome=inspectRulesCompatibility(existing,trump);
   console.log('OFFLINE AUDIT PASSED. Preserved root keys:',outcome.existingTopLevelKeys.join(', '));
   console.log('Added only:',outcome.addedPath);
   console.log('This does NOT verify live server rules, nor authorize a production deploy.');
   if(j>=0){
    const target=resolve(argv[j+1]||'');
    if(!argv[j+1]||target===resolve(argv[i+1])||existsSync(target))
     throw Error('REFUSING_TO_OVERWRITE_EXISTING_FILE');
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,JSON.stringify(outcome.combinedRules,null,2)+'\n',{flag:'wx'});
    console.log('Wrote review-only candidate:',target);
   }
  }catch(err){console.error('BLOCKED:',err.message);process.exitCode=1;}
 }
}
