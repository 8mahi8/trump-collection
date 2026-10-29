// No game-name checks here: CPU sessions only speak registered game hooks.
import {GAME_REGISTRY} from '../games/definitions.mjs';
import {viewFromCpu} from '../core/unified-view.mjs';

export function createCpuSession({game,seat=0,seed=1,options={},registry=GAME_REGISTRY}={}){
 const plugin=registry.get(game);
 if(typeof plugin.localMove!=='function'||typeof plugin.cpuChoose!=='function')
  throw Error('CPU_PLUGIN_NOT_YET_IMPLEMENTED');
 if(!Number.isInteger(seat)||seat<0||seat>=plugin.seats)throw Error('INVALID_SEAT');
 const state=plugin.createLocal(seed,options);
 if(!state||typeof state!=='object')throw Error('INVALID_INITIAL_GAME_STATE');
 const listeners=new Set();
 let disposed=false;
 const view=()=>viewFromCpu({game,state,seat,registry});
 const notify=()=>{const current=view();for(const fn of listeners)fn(current)};
 function step(action,actingSeat){
  if(disposed)throw Error('SESSION_DISPOSED');
  if(state.phase!=='play'||state.turn!==actingSeat)return false;
  const before=view();
  // Reject actions not legal in the projected public contract; the plugin
  // must recheck too because local input is untrusted.
  if(actingSeat===seat){
   if(action.type==='draw'&&!before.legal.drawIndices.includes(action.index))return false;
   if(action.type==='play'&&!before.legal.playIds.includes(action.id)&&
     !before.legal.playMoves.some(m=>JSON.stringify(m)===JSON.stringify(action.ids)))return false;
   if(action.type==='pass'&&!before.legal.canPass)return false;
   if(action.type==='flip'&&!before.legal.flipIndices.includes(action.index))return false;
  }
  if(!plugin.actions.includes(action.type))return false;
  const accepted=plugin.localMove(state,action);
  if(!accepted)return false;
  notify();
  return true;
 }
 return Object.freeze({
  getView(){if(disposed)throw Error('SESSION_DISPOSED');return view()},
  subscribe(fn){if(disposed)throw Error('SESSION_DISPOSED');
   if(typeof fn!=='function')throw Error('INVALID_LISTENER');
   listeners.add(fn);fn(view());return ()=>listeners.delete(fn);
  },
  dispatch(action){return step(action,seat)},
  stepCpu(){
   if(disposed)throw Error('SESSION_DISPOSED');
   if(state.phase!=='play'||state.turn===seat)return false;
   const action=plugin.cpuChoose(state,view());
   return step(action,state.turn);
  },
  dispose(){disposed=true;listeners.clear()},
  // Used for bounded integration checks; not exposed to browser globals.
  get mode(){return 'cpu'}
 });
}
