// Only on Firebase Local Emulator, using a SYNTHETIC example of legacy Rules.
// Real school Firebase production Rules have NOT been inspected.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseAnonymousAuth} from '../online/firebase-room-store.mjs';

const ns='demo-trumpcards-default-rtdb';
const apiKey='emulator-fake-api-key';
const domain='https://trump-ci-default-rtdb.firebasedatabase.app';
function emulatedFetch(input,opts){
 const url=new URL(input);
 if(url.hostname==='identitytoolkit.googleapis.com'||url.hostname==='securetoken.googleapis.com'){
  const source=url.hostname;
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9099';url.pathname='/'+source+url.pathname;
 }else if(url.hostname.endsWith('.firebasedatabase.app')){
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9000';url.searchParams.set('ns',ns);
 }else throw Error('UNEXPECTED_EXTERNAL_URL');
 return fetch(url,opts);
}
function url(path,token){
 const u=new URL(domain+'/'+path+'.json');
 u.searchParams.set('ns',ns);
 if(token)u.searchParams.set('auth',token);
 return u.href;
}
async function req(path,token,method='GET',body){
 const res=await emulatedFetch(url(path,token),{
  method,headers:{'Content-Type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 return {status:res.status,body:await res.json()};
}
const denial=res=>assert.ok([401,403].includes(res.status),'expected denial, got '+res.status);
test('ACTUAL shared Firebase emulator: legacy game permissions unchanged and new hands private',{timeout:35000},async()=>{
 const a=createFirebaseAnonymousAuth({apiKey,fetchImpl:emulatedFetch});
 const b=createFirebaseAnonymousAuth({apiKey,fetchImpl:emulatedFetch});
 const uidA=(await a.signIn()).uid,uidB=(await b.signIn()).uid;
 const tokenA=await a.token(),tokenB=await b.token();
 assert.notEqual(uidA,uidB);
 // Legacy public data remains public; legacy room access remains auth-only.
 assert.equal((await req('legacyPublic',null)).status,200);
 denial(await req('rooms/12345',null));
 assert.equal((await req('rooms/12345',tokenA,'PUT',{legacy:true})).status,200);
 assert.deepEqual((await req('rooms/12345',tokenB)).body,{legacy:true});
 assert.equal((await req('rooms2v2/12345',tokenB,'PUT',{legacy:'squad'})).status,200);
 assert.deepEqual((await req('rooms2v2/12345',tokenA)).body,{legacy:'squad'});
 // Legacy private path stays scoped to authenticated owner, not public.
 assert.equal((await req('legacyPrivate/'+uidA,tokenA,'PUT',{self:true})).status,200);
 denial(await req('legacyPrivate/'+uidA,tokenB));
 denial(await req('legacyPrivate/'+uidA,null));
 // Parent/trump-room reads are denied: otherwise every hand would leak.
 denial(await req('',tokenA));
 denial(await req('trumpRoomsV1',tokenA));
 denial(await req('trumpRoomsV1/54321/private/'+uidB,tokenA));
 console.log('SHARED RULES EMULATOR PASS: legacy accesses unchanged, parent and stranger hands denied');
});
