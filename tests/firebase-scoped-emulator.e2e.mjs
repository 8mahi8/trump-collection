// Explicitly synthetic open-root migration candidate. NEVER production rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseAnonymousAuth} from '../online/firebase-room-store.mjs';
const ns='demo-trumpcards-default-rtdb';
const apiKey='emulator-fake-api-key';
const domain='https://trump-ci-default-rtdb.firebasedatabase.app';
function emulatorFetch(input,options){
 const u=new URL(input);
 if(u.hostname==='identitytoolkit.googleapis.com'||u.hostname==='securetoken.googleapis.com'){
  const oldHost=u.hostname;u.protocol='http:';u.hostname='127.0.0.1';u.port='9099';u.pathname='/'+oldHost+u.pathname;
 }else if(u.hostname.endsWith('.firebasedatabase.app')){
  u.protocol='http:';u.hostname='127.0.0.1';u.port='9000';u.searchParams.set('ns',ns);
 }else throw Error('UNEXPECTED_EXTERNAL_ENDPOINT');
 return fetch(u.href,options);
}
async function req(path,token,method='GET',payload){
 const url=new URL(domain+'/'+(path?path+'.json':'.json'));
 if(token)url.searchParams.set('auth',token);
 const res=await emulatorFetch(url.href,{method,headers:{'Content-Type':'application/json'},
  ...(payload===undefined?{}:{body:JSON.stringify(payload)})});
 return {status:res.status,body:await res.json()};
}
const denied=out=>assert.ok([401,403].includes(out.status),'expected denial; got '+out.status);
test('Synthetic scoped open-root migration: old public paths still work; private hands not public',{timeout:30000},async()=>{
 const a=createFirebaseAnonymousAuth({apiKey,fetchImpl:emulatorFetch});
 const b=createFirebaseAnonymousAuth({apiKey,fetchImpl:emulatorFetch});
 const uidA=(await a.signIn()).uid,uidB=(await b.signIn()).uid;
 assert.notEqual(uidA,uidB);
 const tokenA=await a.token(),tokenB=await b.token();
 denied(await req('',null));denied(await req('',tokenA));
 const oldRoots=['rooms','rooms2v2','shokokuRooms1v1','lemonClashRoomsV1'];
 for(const path of oldRoots){
  assert.equal((await req(path+'/81002',null,'PUT',{stillPublic:true})).status,200,path+' legacy write');
  assert.deepEqual((await req(path+'/81002',null)).body,{stillPublic:true},path+' legacy read');
 }
 denied(await req('unknownOtherGame/81002',null,'PUT',{foo:1}));
 denied(await req('trumpRoomsV1',tokenA));
 denied(await req('trumpRoomsV1/81002/private/'+uidB,tokenA));
 denied(await req('trumpRoomsV1/81002/private/'+uidA,null));
 console.log('SCOPED OPEN ROOT EMULATOR PASS: isolated legacy roots, denied parent and stranger hands');
});
