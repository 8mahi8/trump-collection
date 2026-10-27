// Host-only two-seat Memory authority. The existing game's rules and bot
// are reused unchanged. Only revealed cards are published, never the deck.
import * as G from '../../games.mjs';
import {GAME_REGISTRY} from '../games/definitions.mjs';
import {matchSeatForAction,isCpuSeat,cpuSeatId} from '../core/shared-room.mjs';
import {viewFromFourPlayerRoom} from '../core/unified-view.mjs';

const validActionId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{6,60}$/.test(s);
export function createTwoPlayerMemoryMatch({room,seedSource,gameConfig}={}){
 if(room?.phase!=='playing'||room.match?.status!=='playing'||room.match.gameId!=='shinkei'||
  room.match.participants?.length!==2)throw Error('MEMORY_MATCH_NOT_SUPPORTED');
 const {matchId,participants}=room.match;
 if(new Set(participants).size!==2||participants.some((id,i)=>
  !room.members.includes(id)&&(!isCpuSeat(room,id)||id!==cpuSeatId(room.roomCode,i))))
  throw Error('INVALID_MEMORY_PARTICIPANTS');
 const seed=seedSource?seedSource():crypto.getRandomValues(new Uint32Array(1))[0];
 const state=G.createShinkei(seed,gameConfig?.difficulty??1);
 let revision=1,currentRoom=room,phase='playing',botCounter=0;
 function syncRoom(nextRoom){
  if(nextRoom?.roomCode!==room.roomCode||nextRoom.match?.matchId!==matchId||
   nextRoom.match.gameId!=='shinkei'||nextRoom.match.participants?.join('|')!==participants.join('|'))
   throw Error('WRONG_MATCH');
  currentRoom=nextRoom;
 }
 function publicSnapshot(){
  const visible=new Set([...state.flipped,...(state.lastPair?.positions||[])]);
  const tiles=state.board.map((tile,index)=>{
   const taken=!!tile.taken,flipped=state.flipped.includes(index);
   const revealed=taken||visible.has(index);
   return {index,taken,flipped,card:revealed?{suit:tile.card.suit,rank:tile.card.rank}:null};
  });
  return {matchId,gameId:'shinkei',publicView:{
   protocol:2,roomCode:room.roomCode,game:'shinkei',round:0,revision,phase,
   seats:participants.map(id=>({present:true,ready:true,cpu:isCpuSeat(room,id)})),
   turn:state.turn,scores:[...state.scores],winner:state.winner,
   tiles,lastResult:state.lastResult?{...state.lastResult}:null
  }};
 }
 function privateSnapshot(actor){
  const seat=participants.indexOf(actor);
  if(seat<0)throw Error('NOT_A_MATCH_PLAYER');
  return {matchId,gameId:'shinkei',privateView:{
   protocol:2,roomCode:room.roomCode,game:'shinkei',round:0,
   revision,seat,hand:[]
  }};
 }
 function viewFor(actor){
  return viewFromFourPlayerRoom({game:'shinkei',publicView:publicSnapshot().publicView,
   privateView:privateSnapshot(actor).privateView});
 }
 function performFlip(actor,index){
  if(!Number.isInteger(index)||index<0||index>=state.board.length||
   state.board[index].taken||state.flipped.includes(index))return {ok:false,reason:'ILLEGAL_FLIP'};
  // Previous two-card reveal lasts until the next player's FIRST flip.
  if(state.flipped.length===0)state.lastPair=null;
  G.shinkeiFlip(state,index);
  revision++;
  if(state.phase==='end')phase='finished';
  return {ok:true,revision,round:0,finished:phase==='finished',matchId};
 }
 function apply({actor,matchId:requestedMatchId,actionId,expectedRevision,round,type,index}={}){
  if(requestedMatchId!==matchId)return {ok:false,reason:'STALE_MATCH'};
  try{matchSeatForAction(currentRoom,{actor,matchId});}
  catch(e){return {ok:false,reason:e.code||e.message}}
  if(!validActionId(actionId)||type!=='flip')return {ok:false,reason:'INVALID_MATCH_ACTION'};
  if(phase!=='playing')return {ok:false,reason:'MATCH_FINISHED'};
  if(expectedRevision!==revision||round!==0)return {ok:false,reason:'STALE_MATCH_REVISION'};
  if(participants[state.turn]!==actor)return {ok:false,reason:'NOT_YOUR_TURN'};
  return performFlip(actor,index);
 }
 function takeCpuTurn(){
  if(currentRoom.phase!=='playing'||phase!=='playing')return null;
  const actor=participants[state.turn];
  if(!isCpuSeat(currentRoom,actor))return null;
  const index=G.botShinkei(state);
  botCounter++;
  const result=performFlip(actor,index);
  if(!result.ok)throw Error('CPU_FLIP_FAILED_'+result.reason);
  return {...result,actor,action:{type:'flip',index},cpuSequence:botCounter};
 }
 return Object.freeze({matchId,gameId:'shinkei',participants:[...participants],
  seatOf:actor=>participants.indexOf(actor),syncRoom,publicSnapshot,privateSnapshot,
  viewFor,apply,takeCpuTurn,
  get phase(){return phase},get revision(){return revision}
 });
}
