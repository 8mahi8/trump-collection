import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirebaseRoomLobbyRest} from '../v2/net/firebase-room-lobby-rest.mjs';
import {createSharedRoom,applySharedRoomAction} from '../v2/core/shared-room.mjs';
const USER='hostUser123';
const registry={has:id=>id==='babanuki',get:id=>({id,seats:4})};
const original=createSharedRoom({roomCode:'12345',hostId:USER});
const auth={uid:USER,async token(){return 'test-secure-token'}};
const step=(state,type,actor=USER,extra={})=>applySharedRoomAction(state,{type,actor,expectedRevision:state.revision,...extra},{registry});
function remoteFake(){
 let value=null,revision=0;
 const calls=[];
 async function fetchImpl(url,options){
  const parsed=new URL(url),etag='"etag-'+revision+'"';
  calls.push({method:options.method,url:parsed.pathname,headers:options.headers});
  assert.equal(parsed.searchParams.get('auth'),'test-secure-token');
  assert.equal(parsed.pathname,'/trumpRoomsV2/12345/lobby.json');
  if(options.method==='GET'){
   assert.equal(options.headers['X-Firebase-ETag'],'true');
   return new Response(JSON.stringify(value),{status:200,headers:{etag}});
  }
  assert.equal(options.method,'PUT');
  if(options.headers['if-match']!==(value===null?'null_etag':etag))
   return new Response(JSON.stringify(value),{status:412});
  value=JSON.parse(options.body);revision++;
  return new Response(JSON.stringify(value),{status:200});
 }
 return {fetchImpl,calls,get value(){return value}};
}
test('GET ETag, reserve null_etag, CAS commit, reject stale writer, no game data in lobby',async()=>{
 const fake=remoteFake();
 const store=createFirebaseRoomLobbyRest({databaseURL:'https://example-default-rtdb.firebaseio.com',auth,fetchImpl:fake.fetchImpl});
 const empty=await store.read('12345');
 assert.equal(empty.state,null);
 await store.reserve(original);
 await assert.rejects(store.reserve(original),e=>e.code==='ROOM_CONFLICT');
 const first=await store.read('12345');
 const state=step(first.state,'join','guestUser456');
 await store.commit(state,first.etag);
 assert.deepEqual(fake.value.members,[USER,'guestUser456']);
 await assert.rejects(store.commit(step(first.state,'join','anotherUser9'),first.etag),e=>e.code==='ROOM_CONFLICT');
 const second=await store.read('12345');
 assert.equal(second.state.revision,1);
 assert.equal(second.state.match,null);
 assert.deepEqual(second.state.ready,[]);
 assert.equal(fake.calls.filter(c=>c.method==='GET').length,3);
});
test('missing or public trial auth cannot reach room lobby, invalid URLs/code rejected',async()=>{
 assert.throws(()=>createFirebaseRoomLobbyRest({databaseURL:'http://insecure.firebaseio.com',auth}),e=>e.code==='INVALID_DATABASE_URL');
 assert.throws(()=>createFirebaseRoomLobbyRest({databaseURL:'https://example.firebaseio.com'}),e=>e.code==='AUTH_REQUIRED');
 const store=createFirebaseRoomLobbyRest({databaseURL:'https://example.firebaseio.com',auth:{uid:USER,token:async()=>null},fetchImpl:()=>{throw Error('should not fetch')}});
 await assert.rejects(store.read('12345'),e=>e.code==='AUTH_REQUIRED');
 await assert.rejects(store.read('bad'),e=>e.code==='INVALID_ROOM_CODE');
});

test('friend-only mode uses Firebase RTDB REST without any authentication request',async()=>{
 let requests=0;
 const identity={uid:'tc1234567890abcdef901234'};
 const store=createFirebaseRoomLobbyRest({
  databaseURL:'https://example-default-rtdb.firebaseio.com',
  identity,friendOnlyNoAuth:true,
  async fetchImpl(url,options){
   requests++;
   const parsed=new URL(url);
   assert.equal(parsed.hostname,'example-default-rtdb.firebaseio.com');
   assert.equal(parsed.searchParams.has('auth'),false,
    'friend-only mode must not transmit Firebase Auth token');
   assert.equal(options.method,'GET');
   return new Response(JSON.stringify(null),{status:200,headers:{etag:'"null"'}});
  }
 });
 assert.equal(store.uid,identity.uid);
 const result=await store.read('12345');
 assert.equal(result.state,null);
 assert.equal(result.etag,'"null"');
 assert.equal(requests,1);
 assert.throws(()=>createFirebaseRoomLobbyRest({
  databaseURL:'https://example-default-rtdb.firebaseio.com',
  friendOnlyNoAuth:true
 }),e=>e.code==='IDENTITY_REQUIRED');
});
