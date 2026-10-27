// The shell sees only a ViewModel. CPU/network/game-specific branching is
// delegated to registered definitions, not copied into each renderer.
import {GAME_REGISTRY,GAME_SPECS} from '../games/definitions.mjs';
export {GAME_SPECS};

const validSeat=(seat,seats)=>{
 if(!Number.isInteger(seat)||seat<0||seat>=seats)throw Error('INVALID_SEAT');
 return seat;
};
const cloneCards=cards=>(cards||[]).map(c=>c?.joker?{joker:true}:{suit:c.suit,rank:c.rank});
const normalizeRanks=r=>r?{...r}:{};
const statusPhase=phase=>phase==='end'||phase==='finished'?'finished':phase==='lobby'?'lobby':'playing';
const blankLegal=()=>({drawIndices:[],playIds:[],playMoves:[],flipIndices:[],canPass:false});

export function viewFromCpu({game,state,seat=0,registry=GAME_REGISTRY}){
 const spec=registry.get(game);
 validSeat(seat,spec.seats);
 if(!state||typeof state!=='object')throw Error('INVALID_LOCAL_STATE');
 const phase=statusPhase(state.phase);
 const turn=phase==='finished'?null:state.turn;
 const counts=spec.localCounts(state);
 const players=Array.from({length:spec.seats},(_,i)=>({
  seat:i,isYou:i===seat,cardCount:counts?.[i]??null,
  score:spec.score?.(state,i)??null,rank:spec.ranks?.(state)?.[i]??null
 }));
 const legal=phase==='playing'&&turn===seat?spec.localLegal(state,seat):blankLegal();
 return {game,phase,seat,turn,isMyTurn:phase==='playing'&&turn===seat,
  players,hand:cloneCards(spec.localHand(state,seat)),
  board:spec.localBoard(state),legal,
  result:phase==='finished'?{
   ranks:normalizeRanks(spec.ranks?.(state)),
   scores:spec.scores?.(state)??null
  }:null,connection:{state:'local'},revision:null};
}

export function viewFromFourPlayerRoom({game,publicView,privateView,registry=GAME_REGISTRY}){
 const spec=registry.get(game);
 if(![2,4].includes(spec.seats)||!spec.remoteBoard||!spec.remoteLegal)
  throw Error('REMOTE_GAME_UNSUPPORTED');
 if(!publicView||!privateView||publicView.game!==game||privateView.game!==game)
  throw Error('INVALID_REMOTE_VIEW');
 if(publicView.revision!==privateView.revision||
  publicView.round!==privateView.round)throw Error('OUT_OF_SYNC_VIEW');
 const seat=validSeat(privateView.seat,spec.seats),phase=statusPhase(publicView.phase);
 const turn=phase==='playing'?publicView.turn:null;
 const legal=phase==='playing'&&turn===seat?
  spec.remoteLegal(publicView,privateView,seat):blankLegal();
 const players=Array.from({length:spec.seats},(_,i)=>({
  seat:i,isYou:i===seat,isCpu:!!publicView.seats?.[i]?.cpu,
  cardCount:publicView.counts?.[i]??null,
  score:publicView.scores?.[i]??null,rank:publicView.ranks?.[i]??null
 }));
 return {game,phase,seat,turn,isMyTurn:phase==='playing'&&turn===seat,
  players,hand:cloneCards(privateView.hand||[]),
  board:spec.remoteBoard(publicView),legal,
  result:phase==='finished'?{
   ranks:normalizeRanks(publicView.ranks),scores:publicView.scores?[...publicView.scores]:null
  }:null,
  connection:{state:'connected'},revision:publicView.revision};
}
