// ババ抜きオンライン4人用：判定と非公開手札の境界。
// 実通信ではprivateViewをそのまま公共Broadcastに送らないこと！
// 暗号化した個別配送が完成するまで、ゲーム本体の遠隔公開には使用しない。
import {createBabanuki,babanukiNextWithCards,babanukiDraw,cardId} from '../games.mjs';

export const OLDMAID_PROTOCOL = 1;
const ROOM_RE = /^[0-9]{5}$/;
const validId = v => typeof v === 'string' && v.length >= 8 && v.length <= 100;
const cardCopy = c => c.joker ? {joker:true} : {suit:c.suit,rank:c.rank};

export function createOldMaidAuthority({roomCode,hostId,seedSource = () => {
  if (!globalThis.crypto?.getRandomValues) throw Error('Secure random source unavailable');
  const a = new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0];
}}) {
  if (!ROOM_RE.test(roomCode)) throw Error('Invalid five-digit room code');
  if (!validId(hostId)) throw Error('Invalid host ID');
  let phase='lobby',round=0,revision=0,state=null;
  const seats=[{id:hostId,ready:false},null,null,null];
  const handled=new Set();
  const response=(ok,reason='')=>({ok,reason,revision,round});
  const advance=()=>{revision++;return response(true)};
  const seatOf=id=>seats.findIndex(s=>s?.id===id);

  function publicView(){
    const last=state?.lastDraw;
    return {
      protocol:OLDMAID_PROTOCOL,roomCode,round,revision,phase,game:'babanuki',
      seats:seats.map(s=>({present:!!s,ready:!!s?.ready})),
      turn:state?.turn ?? null,
      drawFrom:state?.phase==='play'?babanukiNextWithCards(state,state.turn):null,
      counts:state?state.hands.map(h=>h.length):[0,0,0,0],
      ranks:state?{...state.ranks}:{},
      finishedOrder:state?[...state.finishedOrder]:[],
      loser:phase==='finished'?state.loser:null,
      lastAction:last?{by:last.by,from:last.from,paired:last.paired}:null
    };
  }
  // Host内でのみ呼ぶ。共有チャンネルに平文送信しない。
  function privateView(actor){
    const seat=seatOf(actor);
    if(seat<0)return null;
    const last=state?.lastDraw;
    return {
      roomCode,round,revision,seat,
      hand:state?state.hands[seat].map(cardCopy):[],
      lastDraw:last?.by===seat?{card:cardCopy(last.card),paired:last.paired,from:last.from}:null
    };
  }
  function apply(action) {
    if (!action||action.protocol!==OLDMAID_PROTOCOL||action.roomCode!==roomCode||
        !validId(action.actor)||typeof action.actionId!=='string'||
        action.actionId.length<4||action.actionId.length>120)return response(false,'INVALID');
    if(handled.has(action.actionId))return response(false,'DUPLICATE');
    const p=seatOf(action.actor);
    if(action.type==='join'){
      if(p>=0)return response(true,'ALREADY_JOINED');
      if(phase!=='lobby')return response(false,'MATCH_ALREADY_STARTED');
      const empty=seats.findIndex(s=>!s);
      if(empty<0)return response(false,'ROOM_FULL');
      seats[empty]={id:action.actor,ready:false};
      handled.add(action.actionId);return advance();
    }
    if(p<0)return response(false,'NOT_IN_ROOM');
    if(action.expectedRevision!==revision||action.round!==round)return response(false,'STALE');
    let ok=false;
    if(action.type==='ready'&&phase==='lobby'){
      if(typeof action.ready!=='boolean'||seats[p].ready===action.ready)return response(false,'INVALID_READY');
      seats[p].ready=action.ready;ok=true;
    } else if(action.type==='start'&&p===0&&phase==='lobby'&&seats.every(s=>s?.ready)){
      state=createBabanuki(seedSource(),4);
      phase=state.phase==='end'?'finished':'playing';ok=true;
    } else if(action.type==='draw'&&phase==='playing'&&state.turn===p&&
       Number.isInteger(action.index)&&action.index>=0){
      const from=babanukiNextWithCards(state,p);
      if(from===p||action.index>=state.hands[from].length)return response(false,'INVALID_DRAW');
      const before=state.hands[from].length;
      babanukiDraw(state,action.index);
      if(state.hands[from].length!==before-1)return response(false,'DRAW_NOT_APPLIED');
      if(state.phase==='end')phase='finished';
      ok=true;
    } else if(action.type==='rematch'&&phase==='finished'&&p===0){
      round++;phase='lobby';state=null;seats.forEach(s=>{if(s)s.ready=false;});ok=true;
    }
    if(!ok)return response(false,'NOT_ALLOWED');
    handled.add(action.actionId);return advance();
  }
  return {publicView,privateView,apply,seatOf,get revision(){return revision;},get phase(){return phase;},get round(){return round;}};
}

export function makeOldMaidCommand(view,actor,type,actionId,extra={}) {
  return {protocol:OLDMAID_PROTOCOL,roomCode:view.roomCode,round:view.round,
    expectedRevision:view.revision,actor,type,actionId,...extra};
}
