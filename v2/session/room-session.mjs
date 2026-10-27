// Common UI bridge for existing host-authoritative Firebase room guest.
// The transport/controller is injected; this module never fetches, starts
// timers, paints DOM or knows what game is selected.
import {GAME_REGISTRY} from '../games/definitions.mjs';
import {viewFromFourPlayerRoom} from '../core/unified-view.mjs';

function validAction(view,action){
 if(!action||typeof action.type!=='string'||!view.isMyTurn)return false;
 if(action.type==='draw')return Number.isInteger(action.index)&&view.legal.drawIndices.includes(action.index);
 if(action.type==='play'){
  if(typeof action.id==='string')return view.legal.playIds.includes(action.id);
  if(Array.isArray(action.ids)){
   const key=ids=>[...ids].sort().join(',');
   return view.legal.playMoves.some(move=>key(move)===key(action.ids));
  }
  return false;
 }
 if(action.type==='flip')return Number.isInteger(action.index)&&view.legal.flipIndices.includes(action.index);
 if(action.type==='pass')return view.legal.canPass===true;
 return false;
}

export function createRoomSession({game,guest,registry=GAME_REGISTRY}={}){
 const plugin=registry.get(game);
 if(!plugin.remoteBoard||!plugin.remoteLegal||plugin.seats!==4)throw Error('ROOM_GAME_NOT_SUPPORTED');
 if(!guest||typeof guest.poll!=='function'||typeof guest.act!=='function')throw Error('INVALID_REMOTE_GUEST');
 let current=null,disposed=false,pending=false,receiptId=null,revisionKey=null;
 const listeners=new Set();
 function notify(){for(const fn of listeners)fn(current)}
 function ensure(){if(disposed)throw Error('SESSION_DISPOSED')}
 const emptyLegal=()=>({drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:false});
 // An old snapshot must never remain actionable while the network or host is unavailable.
 function suspend(state){
  revisionKey=null; // Even the same authoritative revision must repaint on recovery.
  if(current&&current.connection.state!==state){
   current={...current,isMyTurn:false,legal:emptyLegal(),connection:{state}};
   notify();
  }
 }
 async function refresh(){
  ensure();
  let result;
  try{result=await guest.poll();ensure();}
  catch(e){if(!disposed)suspend('reconnecting');throw e;}
  if(result.status!=='ready'){
   suspend(result.status==='room_closed'?'closed':'reconnecting');
   return result.reason===undefined?{status:result.status}:
    {status:result.status,reason:result.reason};
  }
  let view;
  try{
   view=viewFromFourPlayerRoom({game,publicView:result.publicView,
    privateView:result.privateView,registry});
  }catch(e){suspend('reconnecting');throw e;}
  const key=String(result.publicView.round)+'/'+String(view.revision);
  if(key!==revisionKey){
   revisionKey=key;current=view;notify();
  }
  // A revision may change because another player joined or moved. Only the
  // receipt for THIS command proves acceptance or rejection and unlocks input.
  if(receiptId&&typeof guest.receipt==='function'){
   let rec;
   try{rec=await guest.receipt(receiptId);ensure();}
   catch(e){if(!disposed)suspend('reconnecting');throw e;}
   if(rec){pending=false;receiptId=null;return {status:rec.ok?'ack':'rejected',reason:rec.reason||''};}
  }
  return {status:'ready',revision:view.revision};
 }
 return Object.freeze({
  get mode(){return 'room'},
  getView(){ensure();return current},
  subscribe(fn){ensure();if(typeof fn!=='function')throw Error('INVALID_LISTENER');
   listeners.add(fn);if(current)fn(current);return ()=>listeners.delete(fn);
  },
  refresh,
  async dispatch(action){
   ensure();
   if(pending||!current||current.phase!=='playing'||!validAction(current,action))return false;
   if(!plugin.actions.includes(action.type))return false;
   // The existing guest controller will add room, seat, expected revision,
   // round and deduplication ID to this command.
   const extra={};
   for(const k of ['index','id','ids'])if(Object.hasOwn(action,k))extra[k]=action[k];
   pending=true;
   try{
    const id=await guest.act(action.type,extra);ensure();
    receiptId=id;
    return {submitted:true,actionId:id};
   }catch(e){pending=false;receiptId=null;throw e;}
  },
  get pending(){return pending},
  dispose(){disposed=true;listeners.clear();current=null;receiptId=null;}
 });
}
