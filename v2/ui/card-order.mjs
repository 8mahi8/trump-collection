// Sort cards for actual player decisions, not plain numeric 1..13 order.
// Daifugo: 3 < 4 < ... < K < A < 2 < Joker (matches games.mjs rankValue).
// Alternate suit order intentionally groups the suits for small iPad hands.
export const daifugoStrength = c => c.joker?13:
 c.rank===1?11:c.rank===2?12:c.rank-3;
export const cardSuitOrder = c => c.joker?4:c.suit;
export function sortHandForGame(hand,game,{bySuit=false}={}){
 if(!Array.isArray(hand))throw Error('INVALID_HAND');
 const strength=game==='daifugo';
 const rank=c=>c.joker?99:strength?daifugoStrength(c):c.rank;
 return [...hand].sort((a,b)=>{
  if(bySuit||game==='shichinarabe'||game==='babanuki'){
   return cardSuitOrder(a)-cardSuitOrder(b)||rank(a)-rank(b);
  }
  return rank(a)-rank(b)||cardSuitOrder(a)-cardSuitOrder(b);
 });
}
