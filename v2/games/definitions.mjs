// Per-game extension points: rules, legal actions and board projection only.
// They are deliberately transport/UI agnostic. A new game registers one object
// instead of copying the CPU and online applications.
import * as G from '../../games.mjs';
import {createGameRegistry} from '../core/game-registry.mjs';

const cards=hand=>(hand||[]).map(c=>c?.joker?{joker:true}:{suit:c.suit,rank:c.rank});
const legal=()=>({drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:false});
const ranks=state=>state.ranks??null;
const defaultHand=(state,seat)=>cards(state.hands[seat]);
const defaultCounts=state=>state.hands.map(h=>h.length);
const fieldBoard=s=>({
 kind:'field',field:s.field?{cards:cards(s.field.cards),
  count:s.field.count,lastPlayer:s.field.lastPlayer}:null,
 revolution:!!s.revolution,lastEvent:s.lastEvent||''
});

const babanuki={
 id:'babanuki',label:'ババ抜き',seats:4,boardKind:'draw',interaction:'draw',actions:['draw','rematch'],
 createLocal:(seed)=>G.createBabanuki(seed,4),
 localHand:defaultHand,localCounts:defaultCounts,ranks,
 localMove:(state,action)=>{
  if(action?.type!=='draw'||!Number.isInteger(action.index))return false;
  const target=G.babanukiNextWithCards(state,state.turn);
  if(target===state.turn||action.index<0||action.index>=state.hands[target].length)return false;
  G.babanukiDraw(state,action.index);
  return true;
 },
 cpuChoose:state=>({type:'draw',index:G.botBabanuki(state)}),
 localBoard:s=>({kind:'draw',drawFrom:s.phase==='play'?G.babanukiNextWithCards(s,s.turn):null,
  lastAction:s.lastDraw?{by:s.lastDraw.by,paired:s.lastDraw.paired}:null}),
 localLegal:(s,seat)=>{
  const out=legal(),target=G.babanukiNextWithCards(s,seat);
  if(target!==seat)out.drawIndices=s.hands[target].map((_,i)=>i);
  return out;
 },
 remoteBoard:s=>({kind:'draw',drawFrom:s.drawFrom??null,
  lastAction:s.lastAction?{...s.lastAction}:null}),
 remoteLegal:(pub,priv,seat)=>{
  const out=legal(),target=pub.drawFrom;
  if(target!==seat)out.drawIndices=Array.from({length:pub.counts?.[target]||0},(_,i)=>i);
  return out;
 }
};
const shichinarabe={
 id:'shichinarabe',label:'七並べ',seats:4,boardKind:'seven',interaction:'pick-one',actions:['play','pass','rematch'],
 createLocal:(seed)=>G.createShichinarabe(seed,4),
 localHand:defaultHand,localCounts:defaultCounts,ranks,
 localBoard:s=>({kind:'seven',placed:(s.placed||[]).map(x=>({low:x.low,high:x.high})),
  passes:[...(s.passes||[])],lastAction:s.lastAction?{...s.lastAction}:null}),
 localLegal:(s,seat)=>({...legal(),playIds:G.shichinarabeLegal(s.hands[seat],s.placed).map(G.cardId),canPass:true}),
 remoteBoard:s=>({kind:'seven',placed:(s.placed||[]).map(x=>({low:x.low,high:x.high})),
  passes:[...(s.passes||[])],lastAction:s.lastAction?{...s.lastAction}:null}),
 remoteLegal:(pub,priv)=>({...legal(),playIds:[...(priv.legalIds||[])],canPass:true})
};
const shinkei={
 id:'shinkei',label:'神経衰弱',seats:2,boardKind:'memory',interaction:'flip',actions:['flip','rematch'],
 createLocal:(seed,options={})=>G.createShinkei(seed,options.difficulty??1),
 localHand:()=>[],localCounts:()=>null,
 score:(state,seat)=>state.scores?.[seat]??0,
 scores:state=>state.scores?[...state.scores]:[],
 localBoard:s=>({kind:'memory',tiles:(s.board||[]).map((tile,i)=>{
  const taken=!!tile.taken,flipped=!!s.flipped.includes(i);
  return {index:i,taken,flipped,card:taken||flipped?cards([tile.card])[0]:null};
 })}),
 localLegal:s=>({...legal(),flipIndices:s.board.map((tile,i)=>({tile,i}))
  .filter(({tile,i})=>!tile.taken&&!s.flipped.includes(i)).map(({i})=>i)})
};
const daifugo={
 id:'daifugo',label:'大富豪',seats:4,boardKind:'field',interaction:'pick-multi',actions:['play','pass','rematch'],
 createLocal:(seed,options={})=>G.createDaifugo(seed,options.rules||G.DAIFUGO_DEFAULTS),
 localHand:defaultHand,localCounts:defaultCounts,ranks,
 localBoard:fieldBoard,
 localLegal:(s,seat)=>({...legal(),playMoves:G.daifugoLegalMoves(s,seat).map(h=>h.map(G.cardId)),
  canPass:!!s.field}),
 remoteBoard:fieldBoard,
 remoteLegal:(pub,priv)=>({...legal(),playMoves:(priv.legalMoves||[]).map(m=>[...m]),canPass:!!pub.field})
};

export const BUILTIN_GAMES=Object.freeze([babanuki,shichinarabe,shinkei,daifugo]);
export const GAME_REGISTRY=createGameRegistry(BUILTIN_GAMES);
export const GAME_SPECS=Object.freeze(Object.fromEntries(
 GAME_REGISTRY.list().map(({id,label,seats,boardKind,actions})=>[
  id,Object.freeze({label,seats,boardKind,actions})
 ])
));
