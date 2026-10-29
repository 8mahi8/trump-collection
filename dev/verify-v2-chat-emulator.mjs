// Isolated friend-only RTDB rules check; never calls real Firebase.
import assert from 'node:assert/strict';
import {createFirebaseRoomLobbyRest} from '../v2/net/firebase-room-lobby-rest.mjs';
import {createSharedRoom} from '../v2/core/shared-room.mjs';
const DB='https://trump-ci-default-rtdb.firebasedatabase.app';
const NS='demo-trumpcards-default-rtdb';
const ROOM='56432';
const HOST='testChatHost00001',FRIEND='testChatFriend002';
const emulatorFetch=(input,opts)=>{
 const u=new URL(input);
 assert.ok(u.hostname.endsWith('.firebasedatabase.app'));
 assert.ok(!u.searchParams.has('auth'));
 u.protocol='http:';u.hostname='127.0.0.1';u.port='9000';u.searchParams.set('ns',NS);
 return fetch(u,opts);
};
const make=uid=>createFirebaseRoomLobbyRest({databaseURL:DB,identity:{uid},
 friendOnlyNoAuth:true,fetchImpl:emulatorFetch});
const host=make(HOST),friend=make(FRIEND);
await host.reserve(createSharedRoom({roomCode:ROOM,hostId:HOST}));
const chatPayload='<img src=x onerror=alert(1)>';
await host.sendChat(ROOM,chatPayload,0,'chatCase001');
const result=await friend.chat(ROOM);
assert.equal(result[HOST][0].text,chatPayload);
assert.equal(result[HOST][0].actor,HOST);
await friend.sendChat(ROOM,'こんにちは',0,'chatCase002');
const result2=await host.chat(ROOM);
assert.equal(result2[FRIEND][0].text,'こんにちは');
await host.sendChat(ROOM,'上書き',0,'chatCase003');
assert.equal((await friend.chat(ROOM))[HOST][0].text,'上書き');
for(const bad of ['','a'.repeat(121)]){
 assert.throws(()=>host.sendChat(ROOM,bad,1,'chatCase004'),
  e=>e.code==='INVALID_CHAT_TEXT');
}
console.log('V2 NO-AUTH CHAT FIREBASE EMULATOR PASS twoUID=true slots=bounded escaped=literal noAuth=true');
