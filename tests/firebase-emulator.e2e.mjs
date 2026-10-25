// Actual Firebase Local Emulator Suite integration (not a mocked database).
// Use isolated demo-* project only; NEVER connect to production Firebase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseAnonymousAuth,createFirebaseRoomStore} from '../online/firebase-room-store.mjs';
import {createFirebaseRoomHost,createFirebaseRoomGuest} from '../online/firebase-room-controller.mjs';
import {mulberry32} from '../games.mjs';

const PROJECT='demo-trumpcards';
const NS=PROJECT+'-default-rtdb';
const APIKEY='emulator-fake-api-key';
const DB='https://trump-ci-default-rtdb.firebasedatabase.app';
const json=async r=>{let data;try{data=await r.json()}catch{data={}};return {status:r.status,data};};
function emulatedFetch(input,opts){
 const url=new URL(input);
 if(url.hostname==='identitytoolkit.googleapis.com'||url.hostname==='securetoken.googleapis.com'){
  url.protocol='http:';url.port='9099';
  const source=url.hostname;url.hostname='127.0.0.1';
  url.pathname='/'+source+url.pathname;
 }else if(url.hostname.endsWith('.firebasedatabase.app')||url.hostname.endsWith('.firebaseio.com')){
  url.protocol='http:';url.hostname='127.0.0.1';url.port='9000';url.searchParams.set('ns',NS);
 }else throw Error('UNEXPECTED_EXTERNAL_URL');
 return fetch(url,opts);
}
async function account(){
 const auth=createFirebaseAnonymousAuth({apiKey:APIKEY,fetchImpl:emulatedFetch});
 const {uid}=await auth.signIn();
 const store=createFirebaseRoomStore({databaseURL:DB,auth,fetchImpl:emulatedFetch});
 return {uid,auth,store};
}
async function tryRaw(uidToken,room,route,method='GET',body=undefined){
 const url=new URL(DB+'/trumpRoomsV1/'+room+'/'+route+'.json');
 url.searchParams.set('auth',uidToken);
 const r=await emulatedFetch(url.toString(),{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return json(r);
}
function makeSuite(users,roomCode,game,seed){
 const host=createFirebaseRoomHost({store:users[0].store,roomCode,game,seedSource:()=>seed});
 let seq=0;
 const guests=users.map(({store})=>createFirebaseRoomGuest({store,roomCode,game,
  actionIdSource:()=>String(++seq).padStart(6,'0')}));
 return {host,guests};
}
async function ready(suite){
 const {host,guests}=suite;
 await host.bootstrap();
 for(let p=1;p<4;p++)await guests[p].requestJoin();
 const joins=await host.tick();
 assert.equal(joins.accepted,3);
 for(const client of guests)assert.equal((await client.poll()).status,'ready');
 for(let p=0;p<4;p++){
  await guests[p].poll();
  const id=await guests[p].act('ready',{ready:true});
  await host.tick();
  assert.equal((await guests[p].receipt(id)).ok,true);
 }
 await guests[0].poll();
 const id=await guests[0].act('start');
 await host.tick();
 assert.equal((await guests[0].receipt(id)).ok,true);
 assert.equal(host.authority.phase,'playing');
}
test('ACTUAL Firebase Emulator: UID-private hands and three four-player games', {timeout:240000},async()=>{
 const users=await Promise.all([account(),account(),account(),account(),account()]);
 const [hostUser,...others]=users;
 assert.equal(new Set(users.map(u=>u.uid)).size,5);
 const noRoom=await hostUser.store.meta('50000');assert.equal(noRoom,null);

 for(const [game,room,seed] of [['babanuki','58311',18],['shichinarabe','58312',27],['daifugo','58313',36]]){
  const active=users.slice(0,4);
  const suite=makeSuite(active,room,game,seed);
  await suite.host.bootstrap();
  const stranger=users[4];
  const rawPrivate=await tryRaw(await stranger.auth.token(),room,'private/'+active[0].uid);
  assert.ok([401,403].includes(rawPrivate.status),'unseated user read private denied: '+rawPrivate.status);
  await active[1].store.requestSeat(room);
  assert.equal((await suite.guests[1].poll()).status,'waiting_for_host');
  await active[2].store.requestSeat(room);
  await active[3].store.requestSeat(room);
  await suite.host.tick();
  assert.equal(suite.host.members.length,4);
  assert.equal((await suite.guests[1].poll()).status,'ready');
  for(let guestIndex=1;guestIndex<4;guestIndex++){
   const strangerId=active[(guestIndex%3)+1].uid;
   if(strangerId!==active[guestIndex].uid){
    const result=await tryRaw(await active[guestIndex].auth.token(),room,'private/'+strangerId);
    assert.ok([401,403].includes(result.status),'guest cannot read another hand');
   }
  }
  for(const client of suite.guests)assert.equal((await client.poll()).status,'ready');
  for(let p=0;p<4;p++){
   const client=suite.guests[p];
   let id;
   try{id=await client.act('ready',{ready:true});}
   catch(e){
     console.error('EMULATOR READY REJECTED', {game,room,p,uid:active[p].uid,reason:e.code});
     const url='http://127.0.0.1:9000/.inspect/coverage.json?ns='+NS;
     try{
       const debug=await (await fetch(url)).text();
       console.error('RULES COVERAGE',debug.slice(-16000));
     }catch(failure){console.error('COVERAGE UNAVAILABLE',String(failure))}
     throw e;
   }
   await suite.host.tick();assert.equal((await client.receipt(id)).ok,true);
   // Client must fetch fresh revision before its next action.
   await client.poll();
  }
  const start=await suite.guests[0].act('start');await suite.host.tick();
  assert.equal((await suite.guests[0].receipt(start)).ok,true);
  assert.equal(suite.host.authority.phase,'playing');

  let steps=0;const rng=mulberry32(890);
  while(suite.host.authority.phase==='playing'&&steps++<1500){
   const v=suite.host.authority.publicView();
   const p=v.turn,client=suite.guests[p],snap=await client.poll();
   assert.equal(snap.status,'ready',game+' revision '+v.revision);
   const priv=snap.privateView;
   let kind,extra={};
   if(game==='babanuki'){kind='draw';extra.index=Math.floor(rng()*v.counts[v.drawFrom]);}
   else if(game==='shichinarabe'){
    const ids=priv.legalIds||[];kind=ids.length?'play':'pass';
    if(ids.length)extra.id=ids[0];
   }else{
    const moves=priv.legalMoves||[];kind=moves.length?'play':'pass';
    if(moves.length)extra.ids=moves[0];
   }
   const id=await client.act(kind,extra);
   const processed=await suite.host.tick();
   assert.equal(processed.rejected,0,game+' action '+steps);
   assert.equal((await client.receipt(id)).ok,true);
   if(steps%20===0)console.log(game,'moves',steps);
  }
  assert.equal(suite.host.authority.phase,'finished',game+' after moves '+steps);
  assert.deepEqual(Object.values(suite.host.authority.publicView().ranks).sort(),[1,2,3,4]);
  for(const client of suite.guests)assert.equal((await client.poll()).status,'ready');
  await suite.guests[0].poll();
  const rematch=await suite.guests[0].act('rematch');
  await suite.host.tick();
  assert.equal((await suite.guests[0].receipt(rematch)).ok,true);
  assert.equal(suite.host.authority.phase,'lobby');
  console.log('EMULATOR COMPLETED',game,'moves',steps);
 }
});
