// REVIEW-ONLY generator for migrating an entirely open RTDB root into
// explicit legacy namespaces plus private trumpRoomsV1 permissions.
// No HTTP, Firebase admin calls, or deployment functionality.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const name=/^[A-Za-z][A-Za-z0-9_-]{0,80}$/;

export function planOpenRootMigration(existing,trump,legacyRoots){
 if(!obj(existing)||!obj(existing.rules))throw Error('EXISTING_RULES_REQUIRED');
 if(!obj(trump)||!obj(trump.rules)||!obj(trump.rules.trumpRoomsV1)||
   trump.rules['.read']!==false||trump.rules['.write']!==false||
   Object.keys(trump.rules).some(k=>!['.read','.write','trumpRoomsV1'].includes(k)))
  throw Error('PRIVATE_TRUMP_RULES_REQUIRED');
 const root=existing.rules;
 // The exact current rules must be reviewed first. Never silently drop
 // unfamiliar existing paths, index declarations, or validators.
 if(Object.keys(root).sort().join(',')!=='.read,.write')
  throw Error('ADDITIONAL_ROOT_RULES_REQUIRE_MANUAL_REVIEW');
 const permission=root['.read'];
 if(typeof permission!=='string'||!/^now\s*<\s*[0-9]{13}$/.test(permission)||
   root['.write']!==permission)
  throw Error('UNEXPECTED_OPEN_ROOT_RULES');
 if(!Array.isArray(legacyRoots)||legacyRoots.length===0)
  throw Error('EXPLICIT_LEGACY_ROOTS_REQUIRED');
 const unique=new Set();
 for(const path of legacyRoots){
  if(typeof path!=='string'||!name.test(path)||path==='trumpRoomsV1'||unique.has(path))
   throw Error('INVALID_OR_DUPLICATE_LEGACY_ROOT');
  unique.add(path);
 }
 const candidate={rules:{'.read':false,'.write':false}};
 for(const path of unique){candidate.rules[path]={'.read':permission,'.write':permission};}
 candidate.rules.trumpRoomsV1=JSON.parse(JSON.stringify(trump.rules.trumpRoomsV1));
 return {
  combinedRules:candidate,
  legacyRoots:[...unique],
  rootReadDenied:true,rootWriteDenied:true,
  productionApproved:false,
  liveRulesVerified:false,
  allLegacyRootsVerified:false,
  expirationUnchanged:true
 };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);
 const param=key=>argv.includes(key)?argv[argv.indexOf(key)+1]:null;
 const existingPath=param('--existing'),legacyParam=param('--legacy-roots'),out=param('--out');
 if(!existingPath||!legacyParam){
  console.error('Usage: node dev/plan-open-root-migration.mjs --existing RULES.json --legacy-roots rooms,rooms2v2 [--out NEW-REVIEW.json]');
  process.exitCode=2;
 }else{
  try{
   const existing=JSON.parse(readFileSync(resolve(existingPath),'utf8'));
   const trump=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
   const result=planOpenRootMigration(existing,trump,legacyParam.split(','));
   console.log('REVIEW ONLY: root-wide grants replaced with scoped legacy candidates.');
   console.log('Legacy roots:',result.legacyRoots.join(', '));
   console.log('Known expiry kept; production NOT approved, actual root inventory NOT verified.');
   if(out){
    const target=resolve(out);
    if(target===resolve(existingPath)||existsSync(target))throw Error('REFUSING_TO_OVERWRITE_EXISTING_FILE');
    mkdirSync(dirname(target),{recursive:true});
    writeFileSync(target,JSON.stringify(result.combinedRules,null,2)+'\n',{flag:'wx'});
    console.log('Created review-only rules:',target);
   }
  }catch(error){console.error('BLOCKED:',error.message);process.exitCode=1;}
 }
}
