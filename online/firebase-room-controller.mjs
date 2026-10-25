// Host/guest coordination over a FirebaseRoomStore.
// Does not depend on the Firebase SDK, DOM, or timers. Call tick() from a
// controlled poll loop. The host alone owns game rules and private hands.
import {createFourSeatAuthority,makeFourSeatCommand} from './four-seat-authority.mjs';

export function createFirebaseRoomHost({store,roomCode,game,seedSource,config}){
  if(!store||!store.uid)throw Error('AUTH_REQUIRED');
  const authority=createFourSeatAuthority({
    roomCode,game,hostId:store.uid,seedSource,config
  });
  const members=new Set([store.uid]);
  let initialized=false,working=false,publishedRevision=-1;
  async function publish(){
    await store.publishViews(roomCode,authority,[...members]);
    publishedRevision=authority.revision; // only commit after private+public both succeed
  }
  async function bootstrap(){
    if(initialized)throw Error('ROOM_ALREADY_INITIALIZED');
    // Fail on collision; never join and overwrite another host's state.
    await store.reserve(roomCode,game);
    await store.grantSeat(roomCode,store.uid);
    initialized=true;
    await publish();
  }
  async function tick(){
    if(!initialized)throw Error('ROOM_NOT_INITIALIZED');
    if(working)return {busy:true};
    working=true;
    let accepted=0,rejected=0;
    try{
      const joins=await store.joinRequests(roomCode)||{};
      for(const uid of Object.keys(joins).sort()){
        if(joins[uid]!==true||uid===store.uid||!/^[A-Za-z0-9_-]{8,100}$/.test(uid))continue;
        if(authority.seatOf(uid)<0){
          const action={protocol:2,roomCode,game,actor:uid,
            actionId:'join-'+uid,round:authority.round,
            expectedRevision:authority.revision,type:'join'};
          const result=authority.apply(action);
          if(!result.ok){rejected++;continue;}
          accepted++;
        }
        // Retry a failed grant, but avoid needless Firebase writes each tick.
        if(!members.has(uid)){
          await store.grantSeat(roomCode,uid);
          members.add(uid);
        }
      }
      if(accepted||publishedRevision!==authority.revision)await publish();
      const pending=await store.commands(roomCode)||{};
      for(const uid of Object.keys(pending).sort()){
        const entries=pending[uid];
        if(!entries||typeof entries!=='object')continue;
        for(const actionId of Object.keys(entries).sort()){
          const cmd=entries[actionId];
          let result;
          if(!members.has(uid)||!cmd||cmd.actor!==uid||cmd.actionId!==actionId){
            result={ok:false,reason:'INVALID_ACTOR',revision:authority.revision};
          }else{
            result=authority.apply(cmd);
            if(result.ok||result.reason==='DUPLICATE'){
              // A previously applied command may be retried after a lost write.
              // Republish state before ACK. Avoid acknowledging absent private data.
              await publish();
            }
          }
          await store.writeReceipt(roomCode,uid,actionId,{
            ok:result.ok||result.reason==='DUPLICATE',
            reason:result.reason==='DUPLICATE'?'REPLAY_SYNCED':result.reason||'',
            revision:authority.revision
          });
          await store.removeCommand(roomCode,uid,actionId);
          if(!result.ok&&result.reason!=='DUPLICATE')rejected++;
          if(result.ok)accepted++;
        }
      }
      return {accepted,rejected,revision:authority.revision,phase:authority.phase};
    }finally{working=false;}
  }
  return {bootstrap,tick,get roomCode(){return roomCode},
    get authority(){return authority},get members(){return [...members]}};
}

export function createFirebaseRoomGuest({store,roomCode,game,actionIdSource}){
  if(!store?.uid)throw Error('AUTH_REQUIRED');
  if(typeof actionIdSource!=='function')throw Error('ACTION_ID_SOURCE_REQUIRED');
  let lastSnapshot=null;
  async function requestJoin(){
    const meta=await store.meta(roomCode);
    if(!meta||meta.game!==game||meta.protocol!==2)throw Error('ROOM_NOT_FOUND_OR_WRONG_GAME');
    try{await store.requestSeat(roomCode);}catch(e){
      if(e.code!=='ALREADY_EXISTS'&&e.code!=='PERMISSION_DENIED')throw e;
      // A denial is only an idempotent retry if the request was already
      // recorded or this UID already owns a seat. Never mask real rule errors.
      if(await store.seat(roomCode)===true)return;
      if(await store.ownJoinRequest(roomCode)===true)return;
      throw e;
    }
  }
  async function poll(){
    if(await store.seat(roomCode)!==true){lastSnapshot=null;return {status:'waiting_for_host'};}
    const [publicView,privateView]=await Promise.all([store.readPublic(roomCode),store.readPrivate(roomCode)]);
    if(!publicView||!privateView||publicView.roomCode!==roomCode||privateView.roomCode!==roomCode||
      publicView.game!==game||privateView.game!==game||
      publicView.revision!==privateView.revision||publicView.round!==privateView.round){
      lastSnapshot=null;return {status:'syncing'};
    }
    if(lastSnapshot&&(publicView.round<lastSnapshot.publicView.round||
      (publicView.round===lastSnapshot.publicView.round&&publicView.revision<lastSnapshot.publicView.revision))){
      lastSnapshot=null;return {status:'stale'};
    }
    lastSnapshot={publicView,privateView};
    return {status:'ready',...lastSnapshot};
  }
  async function act(type,extra={}){
    if(!lastSnapshot)throw Error('NO_SYNCED_VIEW');
    const suffix=actionIdSource();
    const id=store.uid+'-'+suffix; // room-global deduplication across all participants
    if(typeof suffix!=='string'||!/^[A-Za-z0-9_-]{6,60}$/.test(suffix)||id.length>120)throw Error('INVALID_ACTION_ID');
    const cmd=makeFourSeatCommand(lastSnapshot.publicView,store.uid,type,id,extra);
    await store.command(roomCode,cmd);
    return id;
  }
  async function receipt(actionId){return store.receipt(roomCode,actionId);}
  return {requestJoin,poll,act,receipt,get snapshot(){return lastSnapshot}};
}
