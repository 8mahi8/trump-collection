// Host-controlled 4-seat Match runner inside a persistent shared Room.
// Match authority remains in host memory in this initial integration phase.
// Future: persist/recover authority before enabling school deployment.
import {createFourPlayerMatch} from './four-player-match.mjs';

const KEY=/^[A-Za-z0-9_-]{6,60}/;
export function createRoomMatchHost({store,coordinator,roomCode,seedSource,gameConfig}={}){
 if(!store||typeof store.uid!=='string'||!coordinator||
  !['read','publishMatchPublic','publishMatchPrivate','matchCommands',
   'writeMatchReceipt','removeMatchCommand'].every(k=>typeof store[k]==='function'))
  throw Error('INVALID_MATCH_HOST');
 let engine=null,busy=false;
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
  for(const uid of engine.participants)
   await store.publishMatchPrivate(roomCode,matchId,uid,engine.privateSnapshot(uid));
  await store.publishMatchPublic(roomCode,matchId,engine.publicSnapshot());
 }
 async function start(){
  if(engine)throw Error('MATCH_ALREADY_STARTED');
  const room=await readCurrent();
  engine=createFourPlayerMatch({room,seedSource,gameConfig});
  await publish();
  return {matchId:engine.matchId,gameId:engine.gameId,revision:engine.revision};
 }
 async function tick(){
  if(busy)return {status:'busy'};
  if(!engine)throw Error('MATCH_NOT_STARTED');
  busy=true;
  try{
   const room=await readCurrent();
   engine.syncRoom(room);
   const matchId=engine.matchId;
   const pending=await store.matchCommands(roomCode,matchId)||{};
   let processed=0,accepted=0,rejected=0;
   for(const actor of Object.keys(pending).sort()){
    const queued=pending[actor];
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
     if(result.ok){
      await publish();
      if(engine.phase==='finished'){
       const done=await coordinator.applyHost({type:'completeMatch',matchId});
       if(!done.ok)throw Error('MATCH_COMPLETION_FAILED_'+done.reason);
       engine.syncRoom(await readCurrent());
      }
     }
     await store.writeMatchReceipt(roomCode,matchId,actor,id,{
      matchId,ok:!!result.ok,reason:result.reason||'',
      revision:engine.revision});
     await store.removeMatchCommand(roomCode,matchId,actor,id);
     processed++;
     if(result.ok)accepted++;else rejected++;
    }
   }
   return {status:'ready',processed,accepted,rejected,phase:engine.phase};
  }finally{busy=false;}
 }
 return Object.freeze({start,tick,publish,
  get matchId(){return engine?.matchId||null},
  get phase(){return engine?.phase||'waiting'}});
}
