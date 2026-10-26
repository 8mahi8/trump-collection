import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkFirebaseConfigFile} from '../dev/check-firebase-config.mjs';
const safe={projectId:'mygame-df915',apiKey:'AIzaBrowserOnlyTestKey1234567890',
  databaseURL:'https://mygame-df915-default-rtdb.firebaseio.com'};
test('Shared Firebase offline file-check accepts matching existing project without contacting server',()=>{
 const folder=mkdtempSync(join(tmpdir(),'trump-check-'));
 try{
  const file=join(folder,'firebase.json');writeFileSync(file,JSON.stringify(safe));
  assert.deepEqual(checkFirebaseConfigFile(file),{
   projectId:'mygame-df915',dbHost:'mygame-df915-default-rtdb.firebaseio.com',
   hasPublicWebKey:true,networkRequests:0,writes:0
  });
 }finally{rmSync(folder,{recursive:true,force:true})}
});
test('Shared Firebase offline file-check rejects cross-project DB even with syntactically valid key',()=>{
 const folder=mkdtempSync(join(tmpdir(),'trump-check-'));
 try{
  const file=join(folder,'firebase.json');
  writeFileSync(file,JSON.stringify({...safe,databaseURL:'https://trump-collection-demo-default-rtdb.firebaseio.com'}));
  assert.throws(()=>checkFirebaseConfigFile(file),/FIREBASE_PROJECT_DATABASE_MISMATCH/);
 }finally{rmSync(folder,{recursive:true,force:true})}
});
