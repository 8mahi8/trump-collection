// Card ordering is owned by the registered game plugin. The same generic
// sorter powers all card games; a fifth game can provide its own rank hook.
import {GAME_REGISTRY} from '../games/definitions.mjs';
export {daifugoStrength} from '../games/card-ranks.mjs';

export const cardSuitOrder = c => c.joker?4:c.suit;
export function sortHandForGame(hand,game,{bySuit=false,registry=GAME_REGISTRY}={}){
 if(!Array.isArray(hand))throw Error('INVALID_HAND');
 const spec=registry.get(game);
 const rank=c=>spec.sortRank?spec.sortRank(c):(c.joker?99:c.rank);
 return [...hand].sort((a,b)=>{
  if(bySuit)return cardSuitOrder(a)-cardSuitOrder(b)||rank(a)-rank(b);
  return rank(a)-rank(b)||cardSuitOrder(a)-cardSuitOrder(b);
 });
}
