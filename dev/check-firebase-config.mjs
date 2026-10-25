// Offline-only config shape checker for dedicated or existing school Firebase.
// Usage: node dev/check-firebase-config.mjs path/to/web-config.json
// No remote reads/writes, logins, deployments or secret printing.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateFirebaseConfig} from '../online/firebase-dedicated-guard.mjs';

export function checkFirebaseConfigFile(file){
 if(!file||typeof file!=='string')throw Error('CONFIG_FILE_REQUIRED');
 const raw=JSON.parse(readFileSync(resolve(file),'utf8'));
 const ok=validateDedicatedFirebaseConfig(raw);
 return {projectId:ok.projectId,dbHost:new URL(ok.databaseURL).hostname,
   hasPublicWebKey:true,networkRequests:0,writes:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const result=checkFirebaseConfigFile(process.argv[2]);
  console.log('PASS: Firebase web-config shape only (OFFLINE; live Rules NOT checked)');
  console.log('Project:',result.projectId,'Database hostname:',result.dbHost);
  console.log('No authentication, database access, rules deployment or billing checks were performed.');
 }catch(e){
  console.error('BLOCKED:',e.message);
  process.exitCode=1;
 }
}
