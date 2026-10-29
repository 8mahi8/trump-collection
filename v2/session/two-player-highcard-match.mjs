// Experimental two-seat authority. Shared Room and REST transport unchanged.
// Hidden cards exist ONLY in this host-local state. No deck in public/private RTDB.
import {createHighcard,flipHighcard,highcardPublic,highcardLegal,highcardRanks,highcardCpu} from '../games/highcard-duel.mjs';
import {matchSeatForAction,isCpuSeat,cpuSeatId} from '../core/shared-room.mjs';
import {viewFromFourPlayerRoom} from '../core/unified-view.mjs';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{6,60}$/.test(x);
export function createTwoPlayerHighcardMatch({room,seedSource}={}){
 if(room?.phase!=='playing'||room.match?.status!=='playing'||
  room.match.gameId!=='highcard'||room.match.participants?.length!==2)
  throw Error('HIGHCARD_MATCH_NOT_SUPPORTED');
 const {matchId,participants}=room.match;
 if(new Set(participants).size!==2||participants.some((id,i)=>
  !room.members.includes(id)&&(!isCpuSeat(room,id)||id!==cpuSeatId(room.roomCode,i))))
  throw Error('INVALID_HIGHCARD_PARTICIPANTS');
 const state=createHighcard(seedSource?seedSource():crypto.getRandomValues(new Uint32Array(1))[0]);
 let revision=1,currentRoom=room,phase='playing',botCount=0;
 function syncRoom(next){
  if(next?.roomCode!==room.roomCode||next.match?.matchId!==matchId||
   next.match.gameId!=='highcard'||next.match.participants?.join('|')!==participants.join('|'))
   throw Error('WRONG_MATCH');
  currentRoom=next;
 }
 function publicSnapshot(){
  return {matchId,gameId:'highcard',publicView:{
   protocol:2,roomCode:room.roomCode,game:'highcard',round:0,revision,phase,
   seats:participants.map(id=>({present:true,ready:true,cpu:isCpuSeat(room,id)})),
   ...highcardPublic(state),
   ...(phase==='finished'?{ranks:highcardRanks(state)}:{})
  }};
 }
 function privateSnapshot(actor){
  const seat=participants.indexOf(actor);
  if(seat<0)throw Error('NOT_A_MATCH_PLAYER');
  return {matchId,gameId:'highcard',privateView:{
   protocol:2,roomCode:room.roomCode,game:'highcard',round:0,revision,seat,hand:[]
  }};
 }
 function viewFor(actor){
  return viewFromFourPlayerRoom({game:'highcard',
   publicView:publicSnapshot().publicView,privateView:privateSnapshot(actor).privateView});
 }
 function perform(seat,index){
  if(!highcardLegal(state,seat).includes(index))return {ok:false,reason:'ILLEGAL_FLIP'};
  if(!flipHighcard(state,seat,index))return {ok:false,reason:'ILLEGAL_FLIP'};
  revision++;
  if(state.phase==='end')phase='finished';
  return {ok:true,revision,round:0,finished:phase==='finished',matchId};
 }
 function apply({actor,matchId:requested,actionId,expectedRevision,round,type,index}={}){
  if(requested!==matchId)return {ok:false,reason:'STALE_MATCH'};
  try{matchSeatForAction(currentRoom,{actor,matchId});}
  catch(e){return {ok:false,reason:e.code||e.message};}
  if(!validId(actionId)||type!=='flip')return {ok:false,reason:'INVALID_MATCH_ACTION'};
  if(phase!=='playing')return {ok:false,reason:'MATCH_FINISHED'};
  if(expectedRevision!==revision||round!==0)return {ok:false,reason:'STALE_MATCH_REVISION'};
  const seat=participants.indexOf(actor);
  if(seat!==state.turn)return {ok:false,reason:'NOT_YOUR_TURN'};
  return perform(seat,index);
 }
 function takeCpuTurn(){
  if(currentRoom.phase!=='playing'||phase!=='playing')return null;
  const actor=participants[state.turn];
  if(!isCpuSeat(currentRoom,actor))return null;
  const decision=highcardCpu(state);
  if(!decision)throw Error('CPU_DECISION_UNAVAILABLE');
  const result=perform(state.turn,decision.index);
  if(!result.ok)throw Error('CPU_FLIP_FAILED_'+result.reason);
  return {...result,actor,action:decision,cpuSequence:++botCount};
 }
 return Object.freeze({matchId,gameId:'highcard',participants:[...participants],
  seatOf:actor=>participants.indexOf(actor),
  syncRoom,publicSnapshot,privateSnapshot,viewFor,apply,takeCpuTurn,
  get phase(){return phase},get revision(){return revision}
 });
}
