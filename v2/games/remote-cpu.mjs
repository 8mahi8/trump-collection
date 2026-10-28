// Online CPU moves are policies, not transport switches. Every policy
// receives only PUBLIC state and its own PRIVATE hand, never opponents' cards.
// To add a new remote bot, define a policy and register it on its game plugin.
import * as G from '../../games.mjs';
const key=ids=>[...ids].sort().join(',');
const asCards=hand=>(hand||[]).map(c=>c?.joker?{joker:true}:{suit:c.suit,rank:c.rank});

export function babanukiRemoteCpu({publicView}){
 const count=publicView.counts?.[publicView.drawFrom]??0;
 if(!Number.isInteger(count)||count<1)throw Error('CPU_DRAW_UNAVAILABLE');
 return {type:'draw',index:Math.floor(Math.random()*count)};
}
export function shichinarabeRemoteCpu({publicView,privateView}){
 const seat=privateView.seat;
 const hands=Array.from({length:4},()=>[]);
 hands[seat]=asCards(privateView.hand);
 const decision=G.botShichinarabe({turn:seat,hands,placed:publicView.placed});
 if(decision.type==='play'&&!privateView.legalIds.includes(decision.id))
  throw Error('CPU_ILLEGAL_SEVEN');
 return decision;
}
export function daifugoRemoteCpu({publicView,privateView}){
 const seat=privateView.seat;
 const hands=Array.from({length:4},(_,i)=>i===seat?asCards(privateView.hand):
  Array.from({length:publicView.counts?.[i]||0},()=>null));
 const field=publicView.field?{...publicView.field,
  suits:new Set(publicView.field.suits||[]),
  lockSuits:publicView.field.lockSuits?new Set(publicView.field.lockSuits):null}:null;
 const state={turn:seat,hands,field,finished:[...(publicView.finished||[])],
  cfg:publicView.cfg||G.DAIFUGO_DEFAULTS,revolution:!!publicView.revolution};
 const decision=G.botDaifugo(state,seat);
 if(decision.type==='pass'){
  if(!field)throw Error('CPU_ILLEGAL_PASS');
  return {type:'pass'};
 }
 const ids=decision.cards.map(G.cardId);
 if(!privateView.legalMoves?.some(move=>key(move)===key(ids)))
  throw Error('CPU_ILLEGAL_DAIFUGO');
 return {type:'play',ids};
}
