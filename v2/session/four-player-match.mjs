// V2 match bridge: run the existing battle-tested four-seat game engine inside
// a Room-first Match. A match is short-lived; the room survives a match.
// Only the host should hold this object. Never serialize the engine state to
// public Firebase paths or expose all players' hands to guests.
import {createFourSeatAuthority,makeFourSeatCommand,FOUR_GAMES} from '../../online/four-seat-authority.mjs';
import {matchSeatForAction,isCpuSeat,cpuSeatId} from '../core/shared-room.mjs';
import {viewFromFourPlayerRoom} from '../core/unified-view.mjs';

const actionTypes=new Set(['draw','play','pass']);
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{6,60}$/.test(s);

export function createFourPlayerMatch({room,seedSource,gameConfig=null}={}){
 if(room?.phase!=='playing'||room.match?.status!=='playing'||
  !FOUR_GAMES.includes(room.match?.gameId)||room.match.participants?.length!==4)
  throw Error('MATCH_NOT_SUPPORTED');
 const {matchId,gameId,participants}=room.match;
 if(new Set(participants).size!==4||participants.some((id,seat)=>
  !room.members.includes(id)&&(!isCpuSeat(room,id)||id!==cpuSeatId(room.roomCode,seat))))
  throw Error('INVALID_MATCH_PARTICIPANTS');
 const authority=createFourSeatAuthority({roomCode:room.roomCode,hostId:participants[0],
  game:gameId,seedSource,config:gameConfig,
  cpuIds:participants.filter(id=>isCpuSeat(room,id))});
 const init=(actor,type,id,extra={})=>{
  const command=makeFourSeatCommand(authority.publicView(),actor,type,'init'+id,extra);
  const result=authority.apply(command);
  if(!result.ok)throw Error('MATCH_BOOTSTRAP_'+result.reason);
 };
 for(let i=1;i<4;i++)init(participants[i],'join','j'+i+'seed');
 for(let i=0;i<4;i++)init(participants[i],'ready','r'+i+'seed',{ready:true});
 init(participants[0],'start','startseed');
 if(authority.phase!=='playing'&&authority.phase!=='finished')
  throw Error('MATCH_BOOTSTRAP_NOT_STARTED');
 let currentRoom=room;
 const seatOf=actor=>participants.indexOf(actor);
 function assertLive(actor){
  const seat=matchSeatForAction(currentRoom,{actor,matchId});
  if(seat.seat!==seatOf(actor))throw Error('SEAT_MISMATCH');
 }
 function syncRoom(nextRoom){
  if(nextRoom?.roomCode!==room.roomCode||nextRoom.match?.matchId!==matchId||
   nextRoom.match?.gameId!==gameId||nextRoom.match?.participants?.join('|')!==participants.join('|'))
   throw Error('WRONG_MATCH');
  currentRoom=nextRoom;
 }
 function publicSnapshot(){
  return {matchId,gameId,publicView:authority.publicView()};
 }
 function privateSnapshot(actor){
  if(seatOf(actor)<0)throw Error('NOT_A_MATCH_PLAYER');
  return {matchId,gameId,privateView:authority.privateView(actor)};
 }
 function viewFor(actor){
  if(seatOf(actor)<0)throw Error('NOT_A_MATCH_PLAYER');
  return viewFromFourPlayerRoom({game:gameId,publicView:authority.publicView(),
   privateView:authority.privateView(actor)});
 }
 let botCounter=0;
 function takeCpuTurn(){
  if(currentRoom.phase!=='playing'||authority.phase!=='playing')return null;
  const state=authority.publicView(),actor=participants[state.turn];
  if(!isCpuSeat(currentRoom,actor))return null;
  const decision=authority.botDecision(actor);
  if(!decision)throw Error('CPU_DECISION_UNAVAILABLE');
  const cmd=makeFourSeatCommand(state,actor,decision.type,
   'cpu'+matchId.replace(/[^a-zA-Z0-9]/g,'')+String(++botCounter),decision);
  const result=authority.apply(cmd);
  if(!result.ok)throw Error('CPU_MOVE_FAILED_'+result.reason);
  return {...result,actor,action:decision,finished:authority.phase==='finished',matchId};
 }
 function apply({actor,matchId:requestedMatchId,actionId,expectedRevision,
  round,type,index,id,ids}={}){
  if(requestedMatchId!==matchId)return {ok:false,reason:'STALE_MATCH'};
  try{assertLive(actor)}catch(e){return {ok:false,reason:e.code||e.message}}
  if(!validId(actionId)||!actionTypes.has(type))return {ok:false,reason:'INVALID_MATCH_ACTION'};
  const state=authority.publicView();
  if(state.phase!=='playing')return {ok:false,reason:'MATCH_FINISHED'};
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==state.revision||
   round!==state.round)return {ok:false,reason:'STALE_MATCH_REVISION'};
  const move=makeFourSeatCommand(state,actor,type,actionId,{index,id,ids});
  const result=authority.apply(move);
  return {...result,finished:authority.phase==='finished',matchId};
 }
 return Object.freeze({matchId,gameId,participants:[...participants],seatOf,
  syncRoom,publicSnapshot,privateSnapshot,viewFor,apply,takeCpuTurn,
  get phase(){return authority.phase},get revision(){return authority.revision}});
}
