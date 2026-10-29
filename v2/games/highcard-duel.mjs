// Experimental fifth game: "High Card Duel". No public school release.
// 2 players, six face-down cards each. Alternate one pick; higher card wins
// the round. Aces high; ties score zero. No player sees hidden cards.
const DECK=Array.from({length:52},(_,i)=>({suit:Math.floor(i/13),rank:i%13+1}));
const score=card=>card.rank===1?14:card.rank;
export function createHighcard(seed=1){
 let n=(Number(seed)>>>0)||1;
 const rand=()=>{n=(n+0x6D2B79F5)>>>0;let t=n;t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
 const deck=DECK.map(c=>({...c}));
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));
  [deck[i],deck[j]]=[deck[j],deck[i]];}
 return {phase:'play',turn:0,round:0,scores:[0,0],
  tiles:deck.slice(0,12).map((card,i)=>({card,owner:i<6?0:1,flipped:false})),
  picks:[null,null],lastResult:null};
}
export function highcardLegal(state,seat){
 if(state.phase!=='play'||state.turn!==seat)return [];
 return state.tiles.map((tile,index)=>tile.owner===seat&&!tile.flipped?index:-1)
  .filter(index=>index>=0);
}
export function flipHighcard(state,seat,index){
 if(state.phase!=='play'||state.turn!==seat||
  !Number.isInteger(index)||!highcardLegal(state,seat).includes(index))return false;
 state.tiles[index].flipped=true;
 state.picks[seat]=index;
 if(seat===0){state.turn=1;return true;}
 const left=state.tiles[state.picks[0]].card,right=state.tiles[index].card;
 const winner=score(left)===score(right)?null:score(left)>score(right)?0:1;
 if(winner!==null)state.scores[winner]++;
 state.lastResult={left:state.picks[0],right:index,winner,round:state.round+1};
 state.round++;
 state.picks=[null,null];
 state.turn=0;
 if(state.round===6)state.phase='end';
 return true;
}
export function highcardPublic(state){
 return {turn:state.turn,scores:[...state.scores],
  roundNumber:state.round,lastResult:state.lastResult?{...state.lastResult}:null,
  tiles:state.tiles.map((tile,index)=>({
   index,owner:tile.owner,flipped:tile.flipped,taken:false,
   card:tile.flipped?{...tile.card}:null
  }))};
}
export function highcardRanks(state){
 const [a,b]=state.scores;
 return {0:a>=b?1:2,1:b>=a?1:2};
}
export function highcardCpu(state){
 const indices=highcardLegal(state,state.turn);
 return indices.length?{type:'flip',index:indices[0]}:null;
}
