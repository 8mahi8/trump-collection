// Visual card adapter derived from the existing v1.5.x card appearance.
// DOM and data-action belong to the V2 shared renderer; rules and transport
// remain entirely independent of these decorative card details.
const SUITS=['♠','♥','♦','♣'];
const RANKS={1:'A',11:'J',12:'Q',13:'K'};
const PIPS={
 2:[[50,20,0],[50,79,1]],
 3:[[50,20,0],[50,50,0],[50,79,1]],
 4:[[31,20,0],[67,20,0],[31,79,1],[67,79,1]],
 5:[[31,20,0],[67,20,0],[50,50,0],[31,79,1],[67,79,1]],
 6:[[31,20,0],[67,20,0],[31,50,0],[67,50,0],[31,79,1],[67,79,1]],
 7:[[31,20,0],[67,20,0],[50,35,0],[31,50,0],[67,50,0],[31,79,1],[67,79,1]],
 8:[[31,20,0],[67,20,0],[50,35,0],[31,50,0],[67,50,0],[50,65,1],[31,79,1],[67,79,1]],
 9:[[31,20,0],[67,20,0],[31,36,0],[67,36,0],[50,50,0],[31,64,1],[67,64,1],[31,79,1],[67,79,1]],
 10:[[31,20,0],[67,20,0],[50,28,0],[31,36,0],[67,36,0],[31,64,1],[67,64,1],[50,72,1],[31,79,1],[67,79,1]]
};
const make=(cls,text)=>{const el=document.createElement('span');el.className=cls;if(text)el.textContent=text;return el;};
export function cardLabel(card){
 if(!card)return '裏向きのカード';
 if(card.joker)return 'ジョーカー';
 return SUITS[card.suit]+(RANKS[card.rank]||card.rank);
}
export function makeCardFace(card,{back=false,tiny=false,small=false,button=false}={}){
 const el=document.createElement(button?'button':'span');
 const face=!back&&card;
 el.className='v2-card'+(back?' v2-back':'')+(tiny?' v2-tiny':'')+
  (small?' v2-small':'')+(face&&((card.suit===1||card.suit===2))?' v2-red':'')+
  (face&&card.joker?' v2-joker':'');
 if(button)el.type='button';
 el.setAttribute('aria-label',back?'裏向きのカード':cardLabel(card));
 if(back){
  el.append(make('v2-back-symbol','♠'));
  return el;
 }
 if(!card)return el;
 if(card.joker){
  el.append(make('v2-card-joker','JOKER'),make('v2-card-joker-art','🃏'));
  return el;
 }
 const suit=SUITS[card.suit],rank=String(RANKS[card.rank]||card.rank);
 const corner=cls=>{const node=make('v2-card-corner '+cls);
  node.append(make('v2-card-rank',rank),make('v2-card-suit',suit));
  return node;
 };
 el.append(corner('v2-corner-tl'));
 if(!tiny)el.append(corner('v2-corner-br'));
 if(tiny||small)el.append(make('v2-card-center-suit',suit));
 else if(card.rank===1)el.append(make('v2-card-ace',suit));
 else if(card.rank>=11){
  const court=make('v2-card-faceart');
  court.append(make('v2-court-suit',suit),make('v2-court-rank',rank),make('v2-court-suit v2-court-flip',suit));
  el.append(court);
 }else{
  for(const [x,y,flip] of PIPS[card.rank]||[]){
   const node=make('v2-card-pip'+(flip?' v2-pip-flip':''),suit);
   node.style.left=x+'%';node.style.top=y+'%';
   el.append(node);
  }
 }
 return el;
}
