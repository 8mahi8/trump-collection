// REVIEW-ONLY generator for migrating an entirely open RTDB root into
// explicit legacy namespaces plus private trumpRoomsV1 permissions.
// No HTTP, Firebase admin calls, or deployment functionality.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const name=/^[A-Za-z][A-Za-z0-9_-]{0,80}$/;

// Optional expiry review date is interpreted at midnight Japan Standard Time.
// It may only extend the old legacy window by 1..90 days and is NEVER implicit.
function plannedLegacyPermission(permission,legacyExpiryDate){
 const previousExpiry=Number(permission.match(/[0-9]{13}$/)?.[0]);
 if(legacyExpiryDate===null)return {permission,previousExpiry,newExpiry:previousExpiry,expirationUnchanged:true};
 if(typeof legacyExpiryDate!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(legacyExpiryDate))
  throw Error('LEGACY_EXPIRY_DATE_MUST_BE_YYYY_MM_DD');
 const iso=legacyExpiryDate+'T00:00:00+09:00';
 const newExpiry=Date.parse(iso);
 if(!Number.isSafeInteger(newExpiry)||new Date(newExpiry+9*60*60*1000).toISOString().slice(0,10)!==legacyExpiryDate)
  throw Error('INVALID_LEGACY_EXPIRY_DATE');
 if(newExpiry<=previousExpiry||newExpiry-previousExpiry>90*24*60*60*1000)
  throw Error('LEGACY_EXPIRY_EXTENSION_OUT_OF_RANGE');
 return {permission:'now < '+newExpiry,previousExpiry,newExpiry,expirationUnchanged:false};
}

export function planOpenRootMigration(existing,trump,legacyRoots,{legacyExpiryDate=null}={}){
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
 const timing=plannedLegacyPermission(permission,legacyExpiryDate);
 const candidate={rules:{'.read':false,'.write':false}};
 for(const path of unique){candidate.rules[path]={'.read':timing.permission,'.write':timing.permission};}
 candidate.rules.trumpRoomsV1=JSON.parse(JSON.stringify(trump.rules.trumpRoomsV1));
 return {
  combinedRules:candidate,
  legacyRoots:[...unique],
  rootReadDenied:true,rootWriteDenied:true,
  productionApproved:false,
  liveRulesVerified:false,
  allLegacyRootsVerified:false,
  expirationUnchanged:timing.expirationUnchanged,
  previousLegacyExpiryMs:timing.previousExpiry,
  proposedLegacyExpiryMs:timing.newExpiry,
  legacyExpiryDateJST:legacyExpiryDate||null
 };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const argv=process.argv.slice(2);
 const param=key=>argv.includes(key)?argv[argv.indexOf(key)+1]:null;
 const existingPath=param('--existing'),legacyParam=param('--legacy-roots'),out=param('--out');
 const legacyExpiryDate=param('--legacy-expiry-date');
 if(!existingPath||!legacyParam){
  console.error('Usage: node dev/plan-open-root-migration.mjs --existing RULES.json --legacy-roots rooms,rooms2v2 [--legacy-expiry-date YYYY-MM-DD (JST, <=90 days extension)] [--out NEW-REVIEW.json]');
  process.exitCode=2;
 }else{
  try{
   const existing=JSON.parse(readFileSync(resolve(existingPath),'utf8'));
   const trump=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
   const result=planOpenRootMigration(existing,trump,legacyParam.split(','),{legacyExpiryDate});
   console.log('REVIEW ONLY: root-wide grants replaced with scoped legacy candidates.');
   console.log('Legacy roots:',result.legacyRoots.join(', '));
   console.log('Legacy expiry:',new Date(result.previousLegacyExpiryMs).toISOString(),'→',new Date(result.proposedLegacyExpiryMs).toISOString());
   console.log('Production NOT approved; current live Rules and all existing paths NOT independently verified.');
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
