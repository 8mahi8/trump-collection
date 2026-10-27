import test from 'node:test';
import assert from 'node:assert/strict';
import {createSharedRoom,applySharedRoomAction,matchSeatForAction,ROOM_CAPACITY} from '../v2/core/shared-room.mjs';

const A='playerAAA1',B='playerBBB2',C='playerCCC3',D='playerDDD4',E='playerEEE5';
const games={babanuki:{id:'babanuki',seats:4},shichinarabe:{id:'shichinarabe',seats:4},shinkei:{id:'shinkei',seats:2}};
const registry={has:id=>Object.hasOwn(games,id),get:id=>games[id]};
const step=(room,type,actor=A,args={})=>applySharedRoomAction(room,{type,actor,expectedRevision:room.revision,...args},{registry});
const add=(room,...ids)=>ids.reduce((s,id)=>step(s,'join',id),room);
const chosen=(room,gameId)=>step(room,'selectGame',A,{gameId});
const ready=(room,...ids)=>ids.reduce((s,id)=>step(s,'setReady',id,{ready:true}),room);
const start=room=>step(room,'startMatch');
const err=(fn,code)=>assert.throws(fn,e=>e?.code===code,code);

test('room creation precedes game selection and contains no match/game secret',()=>{
 const room=createSharedRoom({roomCode:'12345',hostId:A});
 assert.equal(room.protocol,3);assert.equal(room.roomCode,'12345');
 assert.equal(room.selectedGame,null);assert.equal(room.match,null);
 assert.deepEqual(room.members,[A]);assert.equal(room.revision,0);
 assert.equal(ROOM_CAPACITY,4);
 err(()=>createSharedRoom({roomCode:'1234',hostId:A}),'INVALID_ROOM_CODE');
 err(()=>createSharedRoom({roomCode:'12345',hostId:'x'}),'INVALID_HOST_ID');
});

test('four players join without choosing game; full room and stale CAS rejected',()=>{
 const base=createSharedRoom({roomCode:'23456',hostId:A});
 const four=add(base,B,C,D);
 assert.equal(four.members.length,4);assert.equal(four.selectedGame,null);
 assert.equal(base.members.length,1,'reducer must not mutate input');
 err(()=>step(four,'join',E),'ROOM_FULL');
 err(()=>step(four,'join',A),'ALREADY_JOINED');
 err(()=>applySharedRoomAction(four,{type:'join',actor:E,expectedRevision:0},{registry}),'STALE_ROOM_REVISION');
});

test('only host selects game; everybody automatically selected only at matching seat count',()=>{
 const room=add(createSharedRoom({roomCode:'34567',hostId:A}),B,C,D);
 err(()=>step(room,'selectGame',B,{gameId:'babanuki'}),'HOST_ONLY');
 err(()=>step(room,'selectGame',A,{gameId:'bogus'}),'UNSUPPORTED_GAME');
 const four=chosen(room,'babanuki');
 assert.deepEqual(four.participants,[A,B,C,D]);
 const two=chosen(four,'shinkei');
 assert.deepEqual(two.participants,[],'two-player game in four-member room needs explicit selection');
});

test('ready gate and match-scoped seat mapping for four players',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'45678',hostId:A}),B,C,D),'babanuki');
 err(()=>start(room),'PLAYERS_NOT_READY');
 room=ready(room,A,B,C,D);
 const match=start(room);
 assert.equal(match.phase,'playing');assert.equal(match.match.gameId,'babanuki');
 assert.deepEqual(match.match.participants,[A,B,C,D]);
 assert.deepEqual(matchSeatForAction(match,{actor:C,matchId:match.match.matchId}),
  {seat:2,gameId:'babanuki',matchId:match.match.matchId});
 err(()=>step(match,'selectGame',A,{gameId:'shichinarabe'}),'NOT_IN_LOBBY');
 err(()=>matchSeatForAction(match,{actor:E,matchId:match.match.matchId}),'NOT_A_MEMBER');
});

test('same friends: babanuki -> results -> lobby -> shichinarabe without new room code',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'56789',hostId:A}),B,C,D),'babanuki');
 room=start(ready(room,A,B,C,D));
 const firstMatch=room.match.matchId;
 err(()=>step(room,'completeMatch',B,{matchId:firstMatch}),'HOST_ONLY');
 err(()=>step(room,'completeMatch',A,{matchId:'old-match'}),'STALE_MATCH');
 room=step(room,'completeMatch',A,{matchId:firstMatch});
 err(()=>matchSeatForAction(room,{actor:A,matchId:firstMatch}),'MATCH_NOT_PLAYING');
 room=step(room,'returnToLobby',A,{matchId:firstMatch});
 assert.deepEqual(room.members,[A,B,C,D]);assert.equal(room.roomCode,'56789');
 assert.equal(room.selectedGame,null);assert.equal(room.match,null);
 room=start(ready(chosen(room,'shichinarabe'),A,B,C,D));
 assert.equal(room.match.gameId,'shichinarabe');
 assert.notEqual(room.match.matchId,firstMatch);
 err(()=>matchSeatForAction(room,{actor:A,matchId:firstMatch}),'STALE_MATCH');
});

test('two-player match chosen from a 4-member room does not grant spectators moves',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'67890',hostId:A}),B,C,D),'shinkei');
 err(()=>start(room),'MATCH_SEATS_NOT_FILLED');
 err(()=>step(room,'setParticipants',B,{memberIds:[A,C]}),'HOST_ONLY');
 err(()=>step(room,'setParticipants',A,{memberIds:[A,A]}),'INVALID_PARTICIPANTS');
 err(()=>step(room,'setParticipants',A,{memberIds:[A,E]}),'INVALID_PARTICIPANTS');
 room=step(room,'setParticipants',A,{memberIds:[A,C]});
 err(()=>step(room,'setReady',B,{ready:true}),'NOT_SELECTED');
 room=start(ready(room,A,C));
 assert.deepEqual(room.members,[A,B,C,D]);
 assert.deepEqual(room.match.participants,[A,C]);
 err(()=>matchSeatForAction(room,{actor:B,matchId:room.match.matchId}),'NOT_A_MATCH_PLAYER');
 assert.equal(matchSeatForAction(room,{actor:C,matchId:room.match.matchId}).seat,1);
});

test('changing lineup or game clears previous ready votes',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'78901',hostId:A}),B,C,D),'babanuki');
 room=ready(room,A,B,C,D);
 room=chosen(room,'shinkei');
 assert.deepEqual(room.ready,[]);assert.deepEqual(room.participants,[]);
 room=step(room,'setParticipants',A,{memberIds:[A,B]});
 room=ready(room,A,B);
 room=step(room,'setParticipants',A,{memberIds:[C,D]});
 assert.deepEqual(room.ready,[]);
 err(()=>start(room),'PLAYERS_NOT_READY');
});

test('guest leaving during game aborts only the match, preserving the remaining room',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'89012',hostId:A}),B,C,D),'babanuki');
 room=start(ready(room,A,B,C,D));
 const matchId=room.match.matchId;
 room=step(room,'leave',B);
 assert.equal(room.phase,'results');assert.equal(room.match.status,'aborted');
 assert.deepEqual(room.members,[A,C,D]);
 room=step(room,'returnToLobby',A,{matchId});
 assert.equal(room.phase,'lobby');
 assert.equal(room.roomCode,'89012');
});

test('spectator departure does not interrupt two-player match',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'90123',hostId:A}),B,C,D),'shinkei');
 room=step(room,'setParticipants',A,{memberIds:[A,C]});
 room=start(ready(room,A,C));
 room=step(room,'leave',B);
 assert.equal(room.phase,'playing');
 assert.deepEqual(room.match.participants,[A,C]);
});

test('host departure closes room and invalidates commands',()=>{
 let room=add(createSharedRoom({roomCode:'01234',hostId:A}),B);
 room=step(room,'leave',A);
 assert.equal(room.phase,'closed');
 err(()=>step(room,'join',C),'ROOM_CLOSED');
 err(()=>step(room,'selectGame',A,{gameId:'shinkei'}),'ROOM_CLOSED');
});

test('duplicate readiness/restart and stale match transitions cannot bypass state',()=>{
 let room=chosen(add(createSharedRoom({roomCode:'12340',hostId:A}),B),'shinkei');
 room=ready(room,A,B);
 room=start(room);
 const id=room.match.matchId;
 err(()=>step(room,'startMatch'),'NOT_IN_LOBBY');
 room=step(room,'completeMatch',A,{matchId:id});
 err(()=>step(room,'completeMatch',A,{matchId:id}),'MATCH_NOT_PLAYING');
 err(()=>step(room,'returnToLobby',A,{matchId:'12340-m999'}),'STALE_MATCH');
 room=step(room,'returnToLobby',A,{matchId:id});
 err(()=>step(room,'returnToLobby',A,{matchId:id}),'MATCH_NOT_FINISHED');
});

test('choosing a four-seat game before friends arrive auto-fills lineup on fourth join',()=>{
 let room=createSharedRoom({roomCode:'33333',hostId:A});
 room=chosen(room,'babanuki');
 assert.deepEqual(room.participants,[]);
 room=add(room,B,C);
 assert.deepEqual(room.participants,[]);
 room=step(room,'join',D);
 assert.deepEqual(room.participants,[A,B,C,D]);
 assert.deepEqual(room.ready,[]);
 room=start(ready(room,A,B,C,D));
 assert.equal(room.phase,'playing');
});

test('default built-in registry supports every current game without special room logic',async()=>{
 const {GAME_REGISTRY}=await import('../v2/games/definitions.mjs');
 for(const plugin of GAME_REGISTRY.list()){
  let room=createSharedRoom({roomCode:'44444',hostId:A});
  room=add(room,B,C,D);
  room=applySharedRoomAction(room,{
   type:'selectGame',actor:A,expectedRevision:room.revision,gameId:plugin.id
  });
  assert.equal(room.selectedGame,plugin.id);
  assert.equal(plugin.seats,plugin.id==='shinkei'?2:4);
  const participants=plugin.seats===2?[A,C]:[A,B,C,D];
  if(plugin.seats===2){
   room=applySharedRoomAction(room,{type:'setParticipants',actor:A,
    expectedRevision:room.revision,memberIds:participants});
  }
  for(const actor of participants)room=applySharedRoomAction(room,{
   type:'setReady',actor,expectedRevision:room.revision,ready:true});
  room=applySharedRoomAction(room,{type:'startMatch',actor:A,expectedRevision:room.revision});
  assert.equal(room.match.gameId,plugin.id);
  assert.equal(room.match.participants.length,plugin.seats);
 }
});
