// Host-controlled 4-seat Match runner inside a persistent shared Room.
// Match authority remains in host memory in this initial integration phase.
// Future: persist/recover authority before enabling school deployment.
import {createFourPlayerMatch} from './four-player-match.mjs';
import {isCpuSeat} from '../core/shared-room.mjs';

const KEY=/^[A-Za-z0-9_-]{6,60}/;
export function createRoomMatchHost({store,coordinator,roomCode,seedSource,gameConfig}={}){
 if(!store||typeof store.uid!=='string'||!coordinator||
  !['read','publishMatchPublic','publishMatchPrivate','matchCommands',
   'writeMatchReceipt','removeMatchCommand'].every(k=>typeof store[k]==='function'))
  throw Error('INVALID_MATCH_HOST');
 let engine=null,busy=false,pending=null;
 async function readCurrent(){
  const {state:room}=await store.read(roomCode);
  if(!room||room.hostId!==store.uid)throw Error('NOT_ROOM_HOST');
  return room;
 }
 async function publish(){
  if(!engine)throw Error('MATCH_NOT_STARTED');
  const matchId=engine.matchId;
  // Private first; publish the matching public revision LAST. A guest only
  // renders when public and its own private revision/round both match.
  const liveRoom=await readCurrent();
  for(const uid of engine.participants){
   // CPUs are host-side agents. Never upload CPU hands to Firebase.
   if(isCpuSeat(liveRoom,uid))continue;
   await store.publishMatchPrivate(roomCode,matchId,uid,engine.privateSnapshot(uid));
  }
  await store.publishMatchPublic(roomCode,matchId,engine.publicSnapshot());
 }
 async function start(){
  if(engine)throw Error('MATCH_ALREADY_STARTED');
  const room=await readCurrent();
  engine=createFourPlayerMatch({room,seedSource,gameConfig});
  await publish();
  return {matchId:engine.matchId,gameId:engine.gameId,revision:engine.revision};
 }
 async function flushPending(){
  if(!pending)return;
  const job=pending,matchId=engine.matchId;
  if(job.stage==='publish'){
   // A failed REST publish is retried without applying the card move again.
   await publish();job.stage='finish';
  }
  if(job.stage==='finish'){
   if(engine.phase==='finished'){
    const room=await readCurrent();
    if(room.phase==='playing'){
     const done=await coordinator.applyHost({type:'completeMatch',matchId});
     if(!done.ok)throw Error('MATCH_COMPLETION_FAILED_'+done.reason);
     engine.syncRoom(await readCurrent());
    }else if(room.phase!=='results'||room.match?.matchId!==matchId)
     throw Error('MATCH_COMPLETION_OUT_OF_SYNC');
   }
   job.stage='receipt';
  }
  if(job.stage==='receipt'&&job.cpu){pending=null;return}
  if(job.stage==='receipt'){
   await store.writeMatchReceipt(roomCode,matchId,job.actor,job.id,{
    matchId,ok:!!job.result.ok,reason:job.result.reason||'',revision:engine.revision});
   job.stage='remove';
  }
  if(job.stage==='remove'){
   await store.removeMatchCommand(roomCode,matchId,job.actor,job.id);
   pending=null;
  }
 }
 async function tick(){
  if(busy)return {status:'busy'};
  if(!engine)throw Error('MATCH_NOT_STARTED');
  busy=true;
  try{
   const matchId=engine.matchId;
   // Finish an interrupted publish / ACK before reading the command queue.
   await flushPending();
   const commands=await store.matchCommands(roomCode,matchId)||{};
   const room=await readCurrent();
   engine.syncRoom(room);
   let processed=0,accepted=0,rejected=0;
   for(const actor of Object.keys(commands).sort()){
    const queued=commands[actor];
    if(!queued||typeof queued!=='object')continue;
    for(const id of Object.keys(queued).sort()){
     const command=queued[id];
     let result;
     if(!KEY.test(id)||command?.protocol!==3||command?.requestId!==id||
      command?.matchId!==matchId||command?.actor!==actor)
      result={ok:false,reason:'INVALID_MATCH_COMMAND'};
     else result=engine.apply({actor,matchId,actionId:id,
      type:command.type,expectedRevision:command.expectedRevision,
      round:command.round,index:command.index,id:command.id,ids:command.ids});
     pending={actor,id,result,stage:result.ok?'publish':'receipt'};
     await flushPending();
     processed++;
     if(result.ok)accepted++;else rejected++;
    }
   }
   // One bot move per tick: visible pacing, and host never blocks the UI
   // with an unbounded CPU loop. No Firebase request or receipt for a CPU.
   let bots=0;
   if(engine.phase==='playing'&&room.phase==='playing'){
    const outcome=engine.takeCpuTurn();
    if(outcome){
     pending={cpu:true,result:outcome,stage:'publish'};
     await flushPending();bots=1;
    }
   }
   return {status:'ready',processed,accepted,rejected,bots,phase:engine.phase};
  }finally{busy=false;}
 }
 return Object.freeze({start,tick,publish,
  get matchId(){return engine?.matchId||null},
  get phase(){return engine?.phase||'waiting'}});
}
