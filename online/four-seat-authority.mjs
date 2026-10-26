// Four-seat card-game authority. Transport-independent, host-only authoritative state.
// publicView() is permitted on shared transport. privateView(actor) MUST NOT be sent on
// public Broadcast or an unprotected Firebase path (private routing requires auth/rules).
import * as G from '../games.mjs';

export const FOUR_ROOM_PROTOCOL=2;
export const FOUR_GAMES=Object.freeze(['babanuki','shichinarabe','daifugo']);
const validRoom=x=>typeof x==='string'&&/^[0-9]{5}$/.test(x);
const validActor=x=>typeof x==='string'&&x.length>=8&&x.length<=100;
const copyCard=c=>c.joker?{joker:true}:{suit:c.suit,rank:c.rank};
const copyCards=a=>a.map(copyCard);
const cardKey=a=>a.slice().sort().join(',');
const safeCfg=cfg=>Object.fromEntries(Object.keys(G.DAIFUGO_DEFAULTS).map(k=>[k,cfg?.[k]===undefined?G.DAIFUGO_DEFAULTS[k]:cfg[k]===true]));
const adapters={
  babanuki:{
    start:(seed)=>G.createBabanuki(seed,4),
    public(st){
      const last=st.lastDraw;
      return {turn:st.turn,drawFrom:st.phase==='play'?G.babanukiNextWithCards(st,st.turn):null,
        counts:st.hands.map(h=>h.length),ranks:{...st.ranks},finishedOrder:[...st.finishedOrder],
        loser:st.phase==='end'?st.loser:null,
        lastAction:last?{by:last.by,from:last.from,paired:last.paired}:null};
    },
    private(st,p){
      const last=st.lastDraw;
      return {hand:copyCards(st.hands[p]),lastDraw:last?.by===p?{card:copyCard(last.card),from:last.from,paired:last.paired}:null};
    },
    move(st,p,a){
      if(a.type!=='draw'||st.turn!==p||!Number.isInteger(a.index))return false;
      const from=G.babanukiNextWithCards(st,p);
      if(from===p||a.index<0||a.index>=st.hands[from].length)return false;
      G.babanukiDraw(st,a.index);return true;
    }
  },
  shichinarabe:{
    start:seed=>G.createShichinarabe(seed,4),
    public(st){return {turn:st.turn,counts:st.hands.map(h=>h.length),
      placed:st.placed.map(p=>({low:p.low,high:p.high})),
      pendingCount:st.pending.length,passes:[...st.passes],out:[...st.out],
      ranks:{...st.ranks},
      lastAction:st.lastAction?{player:st.lastAction.player,type:st.lastAction.type,
        card:st.lastAction.card?copyCard(st.lastAction.card):null,count:st.lastAction.count??null}:null};},
    private(st,p){return {hand:copyCards(st.hands[p]),
      legalIds:G.shichinarabeLegal(st.hands[p],st.placed).map(G.cardId)};},
    move(st,p,a){
      if(st.turn!==p)return false;
      if(a.type==='pass'){G.shichinarabePass(st);return true;}
      if(a.type!=='play'||typeof a.id!=='string'||!G.shichinarabeLegal(st.hands[p],st.placed).some(c=>G.cardId(c)===a.id))return false;
      G.shichinarabePlay(st,a.id);return true;
    }
  },
  daifugo:{
    start:(seed,prior,cfg)=>G.createDaifugo(seed,cfg,prior?.ranks||null),
    public(st){
      const f=st.field;
      return {turn:st.turn,counts:st.hands.map(h=>h.length),
        field:f?{cards:copyCards(f.cards),count:f.count,value:f.value,suits:[...f.suits],
          lockSuits:f.lockSuits?[...f.lockSuits]:null,isJokerSingle:f.isJokerSingle,
          tempReverse:!!f.tempReverse,lastPlayer:f.lastPlayer}:null,
        revolution:st.revolution,ranks:{...st.ranks},finished:[...st.finished],
        fouls:[...st.fouls],cfg:{...st.cfg},lastEvent:st.lastEvent,
        tributeLog:[...st.tributeLog]};
    },
    private(st,p){return {hand:copyCards(st.hands[p]),
      legalMoves:G.daifugoLegalMoves(st,p).map(m=>m.map(G.cardId))};},
    move(st,p,a){
      if(st.turn!==p)return false;
      if(a.type==='pass'){
        if(!st.field)return false;
        G.daifugoPass(st,p);return true;
      }
      if(a.type!=='play'||!Array.isArray(a.ids)||a.ids.length<1||a.ids.length>5||
        !a.ids.every(x=>typeof x==='string')||new Set(a.ids).size!==a.ids.length)return false;
      const key=cardKey(a.ids);
      const legal=G.daifugoLegalMoves(st,p).find(m=>cardKey(m.map(G.cardId))===key);
      if(!legal)return false;
      G.daifugoPlay(st,p,legal);return true;
    }
  }
};

export function createFourSeatAuthority({roomCode,hostId,game,seedSource=()=>{
  if(!globalThis.crypto?.getRandomValues)throw Error('Secure random unavailable');
  const u=new Uint32Array(1);globalThis.crypto.getRandomValues(u);return u[0];
},config=null}){
  if(!validRoom(roomCode)||!validActor(hostId)||!FOUR_GAMES.includes(game))throw Error('Invalid four-seat room setup');
  const adapter=adapters[game],seats=[{id:hostId,ready:false},null,null,null];
  const cfg=game==='daifugo'?safeCfg(config):null;
  let phase='lobby',round=0,revision=0,state=null,previous=null;
  const seen=new Set();
  const seatOf=actor=>seats.findIndex(s=>s?.id===actor);
  const answer=(ok,reason='')=>({ok,reason,revision,round});
  const advance=()=>{revision++;return answer(true)};
  function publicView(){
    return {protocol:FOUR_ROOM_PROTOCOL,roomCode,game,round,revision,phase,
      seats:seats.map(s=>({present:!!s,ready:!!s?.ready})),
      ...(state?adapter.public(state):{})};
  }
  function privateView(actor){
    const p=seatOf(actor);
    if(p<0)return null;
    return {protocol:FOUR_ROOM_PROTOCOL,roomCode,game,round,revision,seat:p,
      ...(state?adapter.private(state,p):{hand:[]})};
  }
  function apply(a){
    if(!a||a.protocol!==FOUR_ROOM_PROTOCOL||a.roomCode!==roomCode||a.game!==game||
      !validActor(a.actor)||typeof a.actionId!=='string'||a.actionId.length<4||a.actionId.length>120)return answer(false,'INVALID');
    const p=seatOf(a.actor);
    if(seen.has(a.actionId))return answer(false,'DUPLICATE');
    if(a.type==='join'){
      if(p>=0)return answer(true,'ALREADY_JOINED');
      if(phase!=='lobby')return answer(false,'MATCH_STARTED');
      const n=seats.findIndex(s=>s===null);
      if(n<0)return answer(false,'ROOM_FULL');
      seats[n]={id:a.actor,ready:false};seen.add(a.actionId);return advance();
    }
    if(p<0)return answer(false,'NOT_IN_ROOM');
    if(a.expectedRevision!==revision||a.round!==round)return answer(false,'STALE');
    let ok=false;
    if(a.type==='ready'&&phase==='lobby'){
      if(typeof a.ready!=='boolean'||seats[p].ready===a.ready)return answer(false,'INVALID_READY');
      seats[p].ready=a.ready;ok=true;
    } else if(a.type==='start'&&p===0&&phase==='lobby'&&seats.every(s=>s?.ready)){
      state=adapter.start(seedSource(),previous,cfg);phase=state.phase==='end'?'finished':'playing';ok=true;
    } else if(phase==='playing'&&adapter.move(state,p,a)){
      if(state.phase==='end')phase='finished';
      ok=true;
    } else if(a.type==='rematch'&&phase==='finished'&&p===0){
      previous=state;state=null;phase='lobby';round++;
      for(const s of seats)if(s)s.ready=false;
      ok=true;
    }
    if(!ok)return answer(false,'NOT_ALLOWED');
    seen.add(a.actionId);return advance();
  }
  return {apply,publicView,privateView,seatOf,
    get phase(){return phase},get round(){return round},get revision(){return revision}};
}
export function makeFourSeatCommand(view,actor,type,actionId,extra={}){
  return {protocol:FOUR_ROOM_PROTOCOL,roomCode:view.roomCode,game:view.game,
    expectedRevision:view.revision,round:view.round,actor,type,actionId,...extra};
}
