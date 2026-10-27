// Phase V2-1c: Room-first host authority and client command facade.
// Only the authenticated host may run tick/applyHost. Room transitions are
// serialized using RTDB ETag CAS; guests only enqueue identity-scoped commands.
import {createSharedRoom,applySharedRoomAction} from '../core/shared-room.mjs';

const validRequest=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{6,60}$/.test(id);
const validCode=id=>typeof id==='string'&&/^[0-9]{5}$/.test(id);
const recognized=new Set(['join','leave','selectGame','setParticipants',
 'setReady','startMatch','completeMatch','returnToLobby']);
const REPLAY_WINDOW=80;
const MAX_RETRIES=4;

export function createRoomCoordinator({store,roomCode,registry}={}){
 if(!store||typeof store.uid!=='string'||!validCode(roomCode)||
  !['read','reserve','commit','requests','receipt','writeReceipt','removeRequest']
   .every(name=>typeof store[name]==='function'))throw Error('INVALID_COORDINATOR_STORE');
 let busy=false;
 const uid=store.uid;
 async function assertHost(){
  const current=await store.read(roomCode);
  if(!current.state||current.state.hostId!==uid)throw Error('NOT_ROOM_HOST');
  return current;
 }
 async function bootstrap(){
  const state=createSharedRoom({roomCode,hostId:uid});
  await store.reserve(state);
  return state;
 }
 async function apply(action,{requestKey=null}={}){
  if(!action||typeof action.type!=='string'||!recognized.has(action.type))
   return {ok:false,reason:'UNSUPPORTED_ROOM_ACTION'};
  for(let attempt=0;attempt<MAX_RETRIES;attempt++){
   const {state,etag}=await assertHost();
   if(requestKey&&state.processedRequests?.includes(requestKey))
    return {ok:true,replayed:true,revision:state.revision};
   let expectedRevision=action.expectedRevision;
   // Independent guests may join or ready concurrently. Rebase ONLY
   // commutative actions, never start/complete/select or mismatched games.
   if(['join','leave'].includes(action.type))expectedRevision=state.revision;
   if(action.type==='setReady'&&state.phase==='lobby'&&
    action.gameId===state.selectedGame&&action.matchSequence===state.matchSequence&&
    action.selectionEpoch===state.selectionEpoch)
    expectedRevision=state.revision;
   let next;
   try{
    next=applySharedRoomAction(state,{...action,expectedRevision},{registry});
   }catch(e){
    return {ok:false,reason:e.code||e.message||'INVALID_ACTION',revision:state.revision};
   }
   if(requestKey){
    next.processedRequests=[...(state.processedRequests||[]),requestKey].slice(-REPLAY_WINDOW);
   }
   try{
    await store.commit(next,etag);
    return {ok:true,revision:next.revision,matchId:next.match?.matchId||null};
   }catch(e){
    if(e.code!=='ROOM_CONFLICT')throw e;
   }
  }
  return {ok:false,reason:'ROOM_CONFLICT'};
 }
 async function applyHost(action){
  const {state}=await assertHost();
  return apply({...action,actor:uid,expectedRevision:
   action?.expectedRevision??state.revision});
 }
 async function tick(){
  if(busy)return {status:'busy'};
  busy=true;
  try{
   await assertHost();
   const queued=await store.requests(roomCode)||{};
   let processed=0,accepted=0,rejected=0;
   for(const actor of Object.keys(queued).sort()){
    const requests=queued[actor];
    if(!requests||typeof requests!=='object')continue;
    for(const id of Object.keys(requests).sort()){
     const key=actor+':'+id;
     // Path ownership is enforced by RTDB Rules; actor in body is NEVER trusted.
     const source=requests[id];
     const action=source&&typeof source==='object'?
      {type:source.type,expectedRevision:source.expectedRevision,
       gameId:source.gameId,memberIds:source.memberIds,ready:source.ready,
       matchId:source.matchId,matchSequence:source.matchSequence,
       selectionEpoch:source.selectionEpoch,actor}:null;
     const result=validRequest(id)&&source?.protocol===3&&source?.requestId===id?
      await apply(action,{requestKey:key}):
      {ok:false,reason:'INVALID_REQUEST'};
     // Receipt follows CAS: if either write fails, the request remains queued.
     // Repeated ticks observe processedRequests and ACK without reapplying.
     await store.writeReceipt(roomCode,actor,id,{
      ok:!!result.ok,reason:result.reason||'',revision:result.revision??-1});
     await store.removeRequest(roomCode,actor,id);
     processed++;
     if(result.ok)accepted++;else rejected++;
    }
   }
   return {status:'ready',processed,accepted,rejected};
  }finally{busy=false;}
 }
 return Object.freeze({bootstrap,applyHost,tick,get uid(){return uid}});
}

export function createRoomLobbyClient({store,roomCode}={}){
 if(!store||typeof store.uid!=='string'||!validCode(roomCode)||
  !['read','submit','receipt'].every(name=>typeof store[name]==='function'))
  throw Error('INVALID_CLIENT_STORE');
 return Object.freeze({
  get uid(){return store.uid},
  async room(){return (await store.read(roomCode)).state},
  async submit(action,requestId){
   if(!validRequest(requestId))throw Error('INVALID_REQUEST_ID');
   if(!action||!recognized.has(action.type))throw Error('INVALID_ROOM_ACTION');
   if(!Number.isSafeInteger(action.expectedRevision)||action.expectedRevision<0)
    throw Error('INVALID_EXPECTED_REVISION');
   const payload={protocol:3,requestId,type:action.type,
    expectedRevision:action.expectedRevision};
   for(const field of ['gameId','memberIds','ready','matchId','matchSequence','selectionEpoch'])
    if(Object.hasOwn(action,field))payload[field]=action[field];
   await store.submit(roomCode,requestId,payload);
   return requestId;
  },
  receipt:id=>store.receipt(roomCode,store.uid,id)
 });
}
