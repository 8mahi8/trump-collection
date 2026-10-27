// Foundation V2: one data contract for CPU and online table views.
// DOM and transport must NEVER depend on the source session type.
import {
 cardId, babanukiNextWithCards, shichinarabeLegal, daifugoLegalMoves
} from '../../games.mjs';

export const GAME_SPECS=Object.freeze({
 babanuki:{label:'ババ抜き',seats:4},
 shichinarabe:{label:'七並べ',seats:4},
 shinkei:{label:'神経衰弱',seats:2},
 daifugo:{label:'大富豪',seats:4}
});

const validGame=game=>{
 if(!Object.hasOwn(GAME_SPECS,game))throw Error('UNSUPPORTED_GAME');
 return GAME_SPECS[game];
};
const validSeat=(seat,seats)=>{
 if(!Number.isInteger(seat)||seat<0||seat>=seats)throw Error('INVALID_SEAT');
 return seat;
};
const cloneCard=c=>c?.joker?{joker:true}:{suit:c.suit,rank:c.rank};
const cloneCards=cards=>(cards||[]).map(cloneCard);
const emptyLegal=()=>({drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:false});
const statusPhase=phase=>phase==='end'||phase==='finished'?'finished':phase==='lobby'?'lobby':'playing';
const normalizeRanks=r=>r?{...r}:{};
const boardFor=(game,source,isLocal)=>{
 if(game==='babanuki')return {kind:'draw',drawFrom:source.drawFrom??null,
  lastAction:source.lastAction?{...source.lastAction}:null};
 if(game==='shichinarabe')return {kind:'seven',
  placed:(source.placed||[]).map(p=>({low:p.low,high:p.high})),
  passes:[...(source.passes||[])],lastAction:source.lastAction?{...source.lastAction}:null};
 if(game==='daifugo'){
  const f=source.field;
  return {kind:'field',field:f?{cards:cloneCards(f.cards),count:f.count,
    lastPlayer:f.lastPlayer}:null,revolution:!!source.revolution,
    lastEvent:source.lastEvent||''};
 }
 if(game==='shinkei')return {kind:'memory',tiles:(source.board||[]).map((tile,i)=>{
  // Only face-up tiles and already-collected tiles may reveal card identity.
  const taken=!!tile.taken,flipped=!!(source.flipped||[]).includes(i);
  return {index:i,taken,flipped,card:taken||flipped?cloneCard(tile.card):null};
 })};
 throw Error('UNSUPPORTED_GAME');
};

export function viewFromCpu({game,state,seat=0}){
 const spec=validGame(game);validSeat(seat,spec.seats);
 if(!state||!Array.isArray(game==='shinkei'?state.board:state.hands))
  throw Error('INVALID_LOCAL_STATE');
 const phase=statusPhase(state.phase);
 const turn=phase==='finished'?null:state.turn;
 const localHand=game==='shinkei'?[]:cloneCards(state.hands[seat]);
 const counts=game==='shinkei'?null:state.hands.map(h=>h.length);
 const players=Array.from({length:spec.seats},(_,i)=>({
  seat:i,isYou:i===seat,cardCount:counts?.[i]??null,
  score:game==='shinkei'?(state.scores?.[i]??0):null,
  rank:state.ranks?.[i]??null
 }));
 const source=game==='babanuki'?
  {drawFrom:phase==='playing'?babanukiNextWithCards(state,turn):null,
   lastAction:state.lastDraw?{by:state.lastDraw.by,paired:state.lastDraw.paired}:null}
  :state;
 const legal=emptyLegal();
 if(phase==='playing'&&turn===seat){
  if(game==='babanuki'){
   const target=babanukiNextWithCards(state,seat);
   if(target!==seat)legal.drawIndices=state.hands[target].map((_,i)=>i);
  }else if(game==='shichinarabe'){
   legal.playIds=shichinarabeLegal(state.hands[seat],state.placed).map(cardId);
   legal.canPass=true;
  }else if(game==='daifugo'){
   legal.playMoves=daifugoLegalMoves(state,seat).map(cards=>cards.map(cardId));
   legal.canPass=!!state.field;
  }else if(game==='shinkei'){
   legal.flipIndices=state.board.map((tile,i)=>({tile,i}))
    .filter(({tile,i})=>!tile.taken&&!state.flipped.includes(i)).map(({i})=>i);
  }
 }
 return {game,phase,seat,turn,isMyTurn:phase==='playing'&&turn===seat,
  players,hand:localHand,board:boardFor(game,source,true),legal,
  result:phase==='finished'?{ranks:normalizeRanks(state.ranks),
   scores:game==='shinkei'?[...state.scores]:null}:null,
  connection:{state:'local'},revision:null};
}

export function viewFromFourPlayerRoom({game,publicView,privateView}){
 const spec=validGame(game);
 if(spec.seats!==4)throw Error('REMOTE_FOUR_SEAT_ONLY');
 if(!publicView||!privateView||publicView.game!==game||privateView.game!==game)
  throw Error('INVALID_REMOTE_VIEW');
 if(publicView.revision!==privateView.revision||
   publicView.round!==privateView.round)throw Error('OUT_OF_SYNC_VIEW');
 const seat=validSeat(privateView.seat,4),phase=statusPhase(publicView.phase);
 const turn=phase==='playing'?publicView.turn:null;
 const legal=emptyLegal();
 if(phase==='playing'&&turn===seat){
  if(game==='babanuki'){
   const target=publicView.drawFrom;
   legal.drawIndices=target===seat?[]:Array.from({length:publicView.counts?.[target]||0},(_,i)=>i);
  }else if(game==='shichinarabe'){
   legal.playIds=[...(privateView.legalIds||[])];
   legal.canPass=true;
  }else{
   legal.playMoves=(privateView.legalMoves||[]).map(move=>[...move]);
   legal.canPass=!!publicView.field;
  }
 }
 const players=Array.from({length:4},(_,i)=>({
  seat:i,isYou:i===seat,cardCount:publicView.counts?.[i]??null,
  score:null,rank:publicView.ranks?.[i]??null
 }));
 return {game,phase,seat,turn,isMyTurn:phase==='playing'&&turn===seat,
  players,hand:cloneCards(privateView.hand||[]),
  board:boardFor(game,publicView,false),legal,
  result:phase==='finished'?{ranks:normalizeRanks(publicView.ranks),scores:null}:null,
  connection:{state:'connected'},revision:publicView.revision};
}
