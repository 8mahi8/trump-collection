import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFirebaseAnonymousAuth,createFirebaseRoomStore,FirebaseRoomError} from '../online/firebase-room-store.mjs';
const ROOT='https://cards-qa-default-rtdb.asia-northeast1.firebasedatabase.app';
const IDS=['hostPlayer001','guestPlayer001','guestPlayer002','guestPlayer003'];
const respond=(code,data)=>new Response(JSON.stringify(data),{status:code,headers:{'Content-Type':'application/json'}});
function fakeDb(){
 const map=new Map(),calls=[];
 async function fetchImpl(raw,opts={}){
  const u=new URL(raw),method=opts.method||'GET',path=u.pathname.slice(1).replace(/\.json$/,'');
  const parts=path.split('/'),room=parts[1],kind=parts[2],owner=parts[3];
  const uid=(u.searchParams.get('auth')||'').replace(/^token-/,'');
  const value=opts.body?JSON.parse(opts.body):undefined;
  calls.push({path,method,uid,headers:opts.headers,value});
  if(parts[0]!=='trumpRoomsV1'||!uid||!/^[0-9]{5}$/.test(room))return respond(401,{error:'denied'});
  const base=parts.slice(0,2).join('/'),host=map.get(base+'/meta')?.hostUid;
  const isHost=uid===host,member=map.get(base+'/seats/'+uid)===true;
  let allow=false;
  if(kind==='meta')allow=method==='GET'||(method==='PUT'&&!host&&value?.hostUid===uid);
  if(kind==='joinRequests')allow=method==='GET'?isHost:method==='PUT'&&uid===owner&&value===true&&!!host;
  if(kind==='seats')allow=method==='GET'?owner===uid||isHost:method==='PUT'&&isHost&&value===true;
  if(kind==='public')allow=method==='GET'?member:method==='PUT'&&isHost;
  if(kind==='private')allow=method==='GET'?member&&owner===uid:method==='PUT'&&isHost;
  if(kind==='commands')allow=method==='GET'?isHost:
    (method==='PUT'&&uid===owner&&member&&value?.actor===uid)||(method==='DELETE'&&isHost);
  if(kind==='receipts')allow=method==='GET'?owner===uid:method==='PUT'&&isHost;
  if(!allow)return respond(401,{error:'denied'});
  if(opts.headers?.['if-match']==='null_etag'&&map.has(path))return respond(412,{error:'collision'});
  if(method==='PUT')map.set(path,value);
  if(method==='DELETE')map.delete(path);
  if(method==='GET'){
   if(map.has(path))return respond(200,map.get(path));
   const children=[...map.entries()].filter(([k])=>k.startsWith(path+'/'));
   if(!children.length)return respond(200,null);
   const result={};
   for(const [k,v] of children){
    const keys=k.slice(path.length+1).split('/');let cursor=result;
    for(let i=0;i<keys.length-1;i++)cursor=cursor[keys[i]]??={};
    cursor[keys.at(-1)]=v;
   }
   return respond(200,result);
  }
  return respond(200,value??null);
 }
 return {fetchImpl,map,calls};
}
const store=(db,uid)=>createFirebaseRoomStore({databaseURL:ROOT,auth:{uid,token:async()=>('token-'+uid)},fetchImpl:db.fetchImpl});
test('Firebase Anonymous Auth: sign-up JSON, refresh token URL-encoded',async()=>{
 let now=100000,index=0;const calls=[];
 const fetchImpl=async(u,opts)=>{
  calls.push({url:u,opts});
  if(index++===0)return respond(200,{localId:IDS[0],idToken:'token1',refreshToken:'refresh1',expiresIn:'3600'});
  return respond(200,{user_id:IDS[0],id_token:'token2',refresh_token:'refresh2',expires_in:'3600'});
 };
 const auth=createFirebaseAnonymousAuth({apiKey:'test-firebase-public-api-key',fetchImpl,now:()=>now});
 assert.equal((await auth.signIn()).uid,IDS[0]);assert.equal(await auth.token(),'token1');
 now+=3500000;assert.equal(await auth.token(),'token2');
 assert.equal(calls.length,2);
 assert.match(calls[0].url,/identitytoolkit/);
 assert.match(calls[1].url,/securetoken/);
 assert.equal(calls[1].opts.headers['Content-Type'],'application/x-www-form-urlencoded');
 assert.match(calls[1].opts.body,/grant_type=refresh_token/);
 auth.clear();await assert.rejects(()=>auth.token(),/NOT_AUTHENTICATED/);
});
test('Firebase RTDB: room creation uses null_etag and cannot overwrite existing room',async()=>{
 const db=fakeDb(),host=store(db,IDS[0]),guest=store(db,IDS[1]);
 await host.reserve('12345','babanuki');
 await assert.rejects(()=>host.reserve('12345','babanuki'),e=>['ALREADY_EXISTS','PERMISSION_DENIED'].includes(e.code));
 await assert.rejects(()=>guest.reserve('12345','daifugo'),e=>e.code==='PERMISSION_DENIED');
 assert.equal((await guest.meta('12345')).hostUid,IDS[0]);
 assert.equal(db.calls.find(x=>x.method==='PUT'&&x.path.endsWith('/meta')).headers['if-match'],'null_etag');
 await assert.rejects(()=>host.reserve('1/345','babanuki'),/INVALID_ROOM_CODE/);
});
test('Firebase RTDB: guest can request a seat but not access room public data until host grants it',async()=>{
 const db=fakeDb(),host=store(db,IDS[0]),guests=IDS.slice(1).map(id=>store(db,id));
 await host.reserve('23456','shichinarabe');
 for(const g of guests){await g.requestSeat('23456');await assert.rejects(()=>g.readPublic('23456'),e=>e.code==='PERMISSION_DENIED');}
 assert.deepEqual(Object.keys(await host.joinRequests('23456')).sort(),IDS.slice(1).sort());
 for(const id of IDS)await host.grantSeat('23456',id);
 const view={protocol:2,roomCode:'23456',round:0,revision:4,phase:'lobby',game:'shichinarabe',seats:[]};
 await host.publishPublic('23456',view);
 for(const g of guests)assert.deepEqual(await g.readPublic('23456'),view);
 await assert.rejects(()=>guests[0].publishPublic('23456',view),e=>e.code==='PERMISSION_DENIED');
});
test('Firebase RTDB: private hands and receipts are UID-specific',async()=>{
 const db=fakeDb(),host=store(db,IDS[0]),a=store(db,IDS[1]),b=store(db,IDS[2]);
 await host.reserve('34567','babanuki');
 for(const id of IDS.slice(0,3))await host.grantSeat('34567',id);
 const handA={protocol:2,roomCode:'34567',round:0,revision:6,seat:1,hand:[{suit:0,rank:13}]};
 const handB={...handA,seat:2,hand:[{joker:true}]};
 await host.publishPrivate('34567',IDS[1],handA);await host.publishPrivate('34567',IDS[2],handB);
 assert.deepEqual(await a.readPrivate('34567'),handA);assert.deepEqual(await b.readPrivate('34567'),handB);
 async function outside(path,token){
  const u=new URL(ROOT+'/'+path+'.json');u.searchParams.set('auth','token-'+token);
  return db.fetchImpl(u.href,{method:'GET'});
 }
 assert.equal((await outside('trumpRoomsV1/34567/private/'+IDS[2],IDS[1])).status,401);
 assert.equal((await outside('trumpRoomsV1/34567/private',IDS[1])).status,401);
 await host.writeReceipt('34567',IDS[1],'cmd000001',{ok:true,reason:'',revision:6});
 assert.equal((await a.receipt('34567','cmd000001')).ok,true);
 assert.equal((await outside('trumpRoomsV1/34567/receipts/'+IDS[1]+'/cmd000001',IDS[2])).status,401);
});
test('Firebase RTDB: only own command is accepted and duplicate action keys rejected',async()=>{
 const db=fakeDb(),host=store(db,IDS[0]),guest=store(db,IDS[1]);
 await host.reserve('45678','daifugo');await host.grantSeat('45678',IDS[1]);
 const cmd={protocol:2,roomCode:'45678',game:'daifugo',actor:IDS[1],actionId:'cmd000002',round:0,expectedRevision:5,type:'pass'};
 await guest.command('45678',cmd);
 await assert.rejects(()=>guest.command('45678',cmd),e=>e.code==='ALREADY_EXISTS');
 assert.throws(()=>guest.command('45678',{...cmd,actor:IDS[0]}),/INVALID_COMMAND/);
 assert.equal((await host.commands('45678'))[IDS[1]].cmd000002.actor,IDS[1]);
 await host.removeCommand('45678',IDS[1],'cmd000002');
 assert.equal(await host.commands('45678'),null);
});
test('Firebase RTDB: writes each private snapshot before public revision',async()=>{
 const db=fakeDb(),host=store(db,IDS[0]);await host.reserve('56789','babanuki');
 for(const id of IDS.slice(0,2))await host.grantSeat('56789',id);
 const auth={privateView(id){return {protocol:2,roomCode:'56789',round:0,revision:8,seat:IDS.indexOf(id),hand:[]}},
  publicView(){return {protocol:2,roomCode:'56789',round:0,revision:8,phase:'playing',seats:[],game:'babanuki'}}};
 await host.publishViews('56789',auth,IDS.slice(0,2));
 assert.deepEqual(db.calls.filter(x=>x.method==='PUT'&&x.path.includes('trumpRoomsV1/56789/')).slice(-3).map(x=>x.path.split('/')[2]),['private','private','public']);
});
test('RTDB Rules: root and ancestors deny reads; private view requires matching authenticated UID',()=>{
 const rules=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8')).rules;
 assert.equal(rules['.read'],false);assert.equal(rules['.write'],false);
 const room=rules.trumpRoomsV1['$room'];
 assert.equal(Object.hasOwn(room,'.read'),false);
 assert.equal(Object.hasOwn(room.private,'.read'),false);
 assert.match(room.private['$uid']['.read'],/auth\.uid === \$uid/);
 assert.match(room.private['$uid']['.read'],/seats/);
 assert.match(room.public['.read'],/seats/);
 assert.match(room.commands['$uid']['$command']['.write'],/newData\.child\('actor'\)/);
});
