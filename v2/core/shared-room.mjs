// Foundation V2 Room-first lifecycle. A Room outlives every Match.
// Pure, host-authoritative state transitions. No game rules, HTTP, DOM or secrets.
// Transport must serialize commands with expectedRevision checks. In the
// friend-only no-auth mode, identity cannot be verified by the server.
import {GAME_REGISTRY} from '../games/definitions.mjs';

const ROOM_CODE=/^[0-9]{5}$/;
const MEMBER_ID=/^[A-Za-z0-9_-]{8,100}$/;
export const ROOM_CAPACITY=4;

export class RoomTransitionError extends Error {
 constructor(code){super(code);this.name='RoomTransitionError';this.code=code;}
}
const reject=code=>{throw new RoomTransitionError(code)};
const validMember=id=>typeof id==='string'&&MEMBER_ID.test(id);
const has=(room,id)=>room.members.includes(id);
const lobby=room=>{if(room.phase!=='lobby')reject('NOT_IN_LOBBY')};
const host=(room,actor)=>{if(room.hostId!==actor)reject('HOST_ONLY')};
const selected=(room,actor)=>{if(!room.participants.includes(actor))reject('NOT_SELECTED')};
const next=(room,change)=>({...room,...change,revision:room.revision+1});
const makeMatchId=(room,sequence)=>room.roomCode+'-m'+sequence;
// CPU seats are local host agents, never real room members or Firebase users.
export const cpuSeatId=(code,seat)=>'cpu-'+code+'-'+seat;
export const isCpuSeat=(room,id)=>typeof id==='string'&&
 Array.from({length:ROOM_CAPACITY},(_,seat)=>cpuSeatId(room.roomCode,seat)).includes(id);
const fillCpu=(room,humans,count)=>[...humans,...Array.from({length:count-humans.length},
 (_,index)=>cpuSeatId(room.roomCode,humans.length+index))];

export function createSharedRoom({roomCode,hostId}={}){
 if(typeof roomCode!=='string'||!ROOM_CODE.test(roomCode))reject('INVALID_ROOM_CODE');
 if(!validMember(hostId))reject('INVALID_HOST_ID');
 return {protocol:3,roomCode,hostId,phase:'lobby',members:[hostId],
  selectedGame:null,participants:[],ready:[],match:null,matchSequence:0,selectionEpoch:0,revision:0};
}

// Applying a room action NEVER modifies an input state. The caller must apply
// the result under compare-and-swap/transaction, not blind last-write-wins.
export function applySharedRoomAction(room,action,{registry=GAME_REGISTRY}={}){
 if(!room||room.protocol!==3||!Array.isArray(room.members))reject('INVALID_ROOM');
 if(!action||typeof action.type!=='string'||!validMember(action.actor))reject('INVALID_ACTION');
 if(!Number.isSafeInteger(action.expectedRevision)||action.expectedRevision!==room.revision)
  reject('STALE_ROOM_REVISION');
 if(room.phase==='closed')reject('ROOM_CLOSED');
 const actor=action.actor;
 if(action.type==='join'){
  lobby(room);
  if(has(room,actor))reject('ALREADY_JOINED');
  if(room.members.length>=ROOM_CAPACITY)reject('ROOM_FULL');
  const members=[...room.members,actor];
  const seats=room.selectedGame?registry.get(room.selectedGame).seats:null;
  // When a new friend arrives before the match, replace a CPU seat. If the
  // game is only two-player and there are already two humans playing, the
  // arriving third/fourth member remains a spectator.
  const automatic=seats!==null&&members.length<=seats&&
   room.participants.length===seats&&
   room.members.every(id=>room.participants.includes(id))&&
   room.participants.every(id=>has(room,id)||isCpuSeat(room,id));
  const participants=automatic?fillCpu(room,members,seats):room.participants;
  return next(room,{members,participants,ready:automatic?[]:room.ready,
   selectionEpoch:automatic?room.selectionEpoch+1:room.selectionEpoch});
 }
 if(!has(room,actor))reject('NOT_A_MEMBER');
 if(action.type==='leave'){
  if(actor===room.hostId)return next(room,{phase:'closed',match:null,selectedGame:null,
   participants:[],ready:[]});
  const members=room.members.filter(id=>id!==actor);
  const currentParticipant=room.match?.participants.includes(actor);
  const interrupted=currentParticipant&&room.phase==='playing';
  const seats=room.selectedGame?registry.get(room.selectedGame).seats:null;
  const automatic=room.phase==='lobby'&&seats!==null&&
   room.participants.length===seats&&
   room.members.filter(id=>room.participants.includes(id)).length===room.members.length&&
   room.participants.every(id=>has(room,id)||isCpuSeat(room,id));
  const participants=automatic?fillCpu(room,members,seats):
   room.participants.filter(id=>id!==actor);
  const ready=automatic?[]:room.ready.filter(id=>id!==actor);
  return next(room,{members,participants,ready,
   selectionEpoch:room.phase==='lobby'?room.selectionEpoch+1:room.selectionEpoch,
   ...(interrupted?{phase:'results',match:{...room.match,status:'aborted'}}:{})});
 }
 if(action.type==='selectGame'){
  lobby(room);host(room,actor);
  if(typeof action.gameId!=='string'||!registry.has(action.gameId))reject('UNSUPPORTED_GAME');
  const spec=registry.get(action.gameId);
  if(!Number.isInteger(spec.seats)||spec.seats<2||spec.seats>ROOM_CAPACITY)
   reject('UNSUPPORTED_SEAT_COUNT');
  // Fill empty seats with host-controlled CPUs. For an overfull 2-player
  // game, the host chooses which humans participate; others can watch.
  const participants=room.members.length<=spec.seats?
   fillCpu(room,room.members,spec.seats):[];
  return next(room,{selectedGame:spec.id,participants,ready:[],selectionEpoch:room.selectionEpoch+1});
 }
 if(action.type==='setParticipants'){
  lobby(room);host(room,actor);
  if(!room.selectedGame)reject('NO_GAME_SELECTED');
  const size=registry.get(room.selectedGame).seats;
  const ids=action.memberIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>size||new Set(ids).size!==ids.length||
   ids.some(id=>!validMember(id)||!has(room,id)))reject('INVALID_PARTICIPANTS');
  return next(room,{participants:fillCpu(room,ids,size),ready:[],
   selectionEpoch:room.selectionEpoch+1});
 }
 if(action.type==='setReady'){
  lobby(room);selected(room,actor);
  if(typeof action.ready!=='boolean')reject('INVALID_READY');
  const ready=action.ready?[...new Set([...room.ready,actor])]:room.ready.filter(id=>id!==actor);
  return next(room,{ready});
 }
 if(action.type==='startMatch'){
  lobby(room);host(room,actor);
  if(!room.selectedGame)reject('NO_GAME_SELECTED');
  const spec=registry.get(room.selectedGame);
  if(room.participants.length!==spec.seats||
   room.participants.some((id,index)=>!has(room,id)&&id!==cpuSeatId(room.roomCode,index)))
   reject('MATCH_SEATS_NOT_FILLED');
  if(room.participants.filter(id=>has(room,id)).some(id=>!room.ready.includes(id)))
   reject('PLAYERS_NOT_READY');
  if(room.matchSequence>=Number.MAX_SAFE_INTEGER)reject('MATCH_SEQUENCE_EXHAUSTED');
  const sequence=room.matchSequence+1;
  const match={matchId:makeMatchId(room,sequence),gameId:room.selectedGame,
   participants:[...room.participants],status:'playing'};
  return next(room,{phase:'playing',match,matchSequence:sequence,ready:[]});
 }
 if(action.type==='completeMatch'){
  host(room,actor);
  if(room.phase!=='playing')reject('MATCH_NOT_PLAYING');
  if(action.matchId!==room.match?.matchId)reject('STALE_MATCH');
  return next(room,{phase:'results',match:{...room.match,status:'finished'}});
 }
 if(action.type==='returnToLobby'){
  host(room,actor);
  if(room.phase!=='results')reject('MATCH_NOT_FINISHED');
  if(action.matchId!==room.match?.matchId)reject('STALE_MATCH');
  // Keep members and room identity but clear match and ready for a fresh game.
  return next(room,{phase:'lobby',match:null,selectedGame:null,participants:[],ready:[],selectionEpoch:room.selectionEpoch+1});
 }
 reject('UNSUPPORTED_ROOM_ACTION');
}

// Gate every move before forwarding to game authority. In particular, a move
// from an earlier match with the same gameId must never act on the next match.
export function matchSeatForAction(room,{actor,matchId}={}){
 if(room?.phase!=='playing'||room.match?.status!=='playing')reject('MATCH_NOT_PLAYING');
 if(matchId!==room.match.matchId)reject('STALE_MATCH');
 if(!validMember(actor)||!has(room,actor))reject('NOT_A_MEMBER');
 const seat=room.match.participants.indexOf(actor);
 if(seat<0)reject('NOT_A_MATCH_PLAYER');
 return {seat,gameId:room.match.gameId,matchId};
}
