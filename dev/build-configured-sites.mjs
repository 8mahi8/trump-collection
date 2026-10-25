// OFFLINE Google Sites copy/paste packager. NEVER fetches or deploys Rules,
// signs in to Firebase, or calls a live backend. This static check is NOT proof
// that the same Rules are currently deployed in Firebase.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {buildCollectionLabHtml} from './build-collection-lab.mjs';
import {validateFirebaseConfig} from '../online/firebase-dedicated-guard.mjs';

const dedicated=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
const legacy=['rooms','rooms2v2','shokokuRooms1v1','lemonClashRoomsV1'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export function inspectConfiguredSitesRules(config,rulesDocument){
 const valid=validateFirebaseConfig(config);
 if(!object(rulesDocument)||!object(rulesDocument.rules))throw Error('REVIEWED_RULES_REQUIRED');
 const rules=rulesDocument.rules;
 if(rules['.read']!==false||rules['.write']!==false)throw Error('OPEN_ROOT_MUST_BE_CLOSED');
 if(Object.keys(rules).some(k=>k.startsWith('$'))||Object.hasOwn(rules,'.validate'))
  throw Error('ROOT_WILDCARD_OR_VALIDATION_REQUIRES_REVIEW');
 // Comparison includes all chat and private-hand ACLs, not just room names.
 if(!isDeepStrictEqual(rules.trumpRoomsV1,dedicated.rules.trumpRoomsV1))
  throw Error('TRUMP_RULES_NOT_MATCHING_AUDITED_SOURCE');
 if(valid.projectId==='mygame-df915'){
  for(const path of legacy){
   if(!object(rules[path])||!Object.hasOwn(rules[path],'.read')||
       !Object.hasOwn(rules[path],'.write'))
    throw Error('SHARED_LEGACY_PATH_MISSING_'+path);
  }
 }
 return valid;
}
export function buildConfiguredSitesHtml({config,reviewedRules}){
 const validated=inspectConfiguredSitesRules(config,reviewedRules);
 const html=buildCollectionLabHtml();
 const marker='const APP_HTML=';
 if(!html.includes(marker))throw Error('LAUNCHER_CONFIG_INSERTION_POINT_MISSING');
 const publicConfig=JSON.stringify(validated).replace(/</g,'\\u003c');
 // The child srcdoc gets its own config through configureFriendsGame().
 // No parent->child direct DOM access; compatible with a Sites sandbox.
 const packaged=html.replace(marker,'window.TRUMP_FIREBASE_CONFIG='+publicConfig+';\n'+marker);
 if(packaged===html)throw Error('CONFIG_NOT_EMBEDDED');
 return packaged;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),flag=k=>{const p=args.indexOf(k);return p>=0?args[p+1]:null};
 const webConfig=flag('--config'),rulesFile=flag('--reviewed-rules'),target=flag('--out');
 if(!webConfig||!rulesFile||!target){
  console.error('Usage: node dev/build-configured-sites.mjs --config firebase/local-web-config.json --reviewed-rules firebase/local-reviewed.rules.json --out dist/local-configured-trump.html');
  process.exitCode=2;
 }else{
  try{
   if(!/^local-configured-[A-Za-z0-9_-]+\\.html$/.test(basename(target)))
    throw Error('OUTPUT_MUST_USE_LOCAL_CONFIGURED_FILENAME');
   const dest=resolve(target);
   if(dest===resolve(webConfig)||dest===resolve(rulesFile)||existsSync(dest))
    throw Error('REFUSING_TO_OVERWRITE_EXISTING_FILE');
   const config=JSON.parse(readFileSync(resolve(webConfig),'utf8'));
   const rules=JSON.parse(readFileSync(resolve(rulesFile),'utf8'));
   const html=buildConfiguredSitesHtml({config,reviewedRules:rules});
   mkdirSync(dirname(dest),{recursive:true});
   writeFileSync(dest,html,{encoding:'utf8',flag:'wx',mode:0o600});
   console.log('OFFLINE ONLY: wrote local Google Sites HTML:',dest,'bytes:',Buffer.byteLength(html));
   console.log('NOT VERIFIED: deployed Firebase Rules, Anonymous Auth, actual Google Sites, school iPad.');
   console.log('Do not publish until the live Rules match the reviewed file and the owner approves.');
  }catch(e){console.error('BLOCKED:',e.message);process.exitCode=1;}
 }
}
