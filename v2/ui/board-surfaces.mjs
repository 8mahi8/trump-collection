// Only per-board surfaces vary. Shared status, hand, actions and session
// dispatch are rendered once by table-renderer.mjs, in both CPU and online.
const make=(tag,cls,text='')=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 el.textContent=text;
 return el;
};
const glyph=c=>c?.joker?'JOKER':c?['♠','♥','♦','♣'][c.suit]+({1:'A',11:'J',12:'Q',13:'K'}[c.rank]||c.rank):'？';
const card=(c,{back=false,disabled=false,action=null,index=null}={})=>{
 const el=make(action?'button':'span','v2-card'+(back?' v2-back':'')+(!back&&c?.suit===1||!back&&c?.suit===2?' v2-red':''),back?'✦':glyph(c));
 if(action){el.type='button';el.dataset.action=action;el.dataset.index=index;el.disabled=disabled;}
 return el;
};
function drawSurface(view){
 const frag=document.createDocumentFragment();
 const seat=view.board.drawFrom;
 const box=make('section','v2-draw');
 if(seat===null||seat===undefined){
  box.append(make('p','v2-help','カードを配っています…'));return box;
 }
 box.append(make('p','v2-help',view.isMyTurn?'相手の伏せ札を1枚タップして引こう':'プレイヤー'+(seat+1)+' のカード'));
 const count=view.players[seat]?.cardCount??0;
 const backRow=make('div','v2-backrow');
 for(let i=0;i<count;i++)backRow.append(card(null,{back:true,action:view.isMyTurn?'draw':null,index:i,disabled:!view.isMyTurn}));
 box.append(backRow);frag.append(box);return frag;
}
function sevenSurface(view){
 const box=make('section','v2-seven');
 const placed=view.board.placed||[];
 for(let suit=0;suit<4;suit++){
  const row=make('div','v2-seven-row');
  row.append(make('span','v2-suit-label', ['♠','♥','♦','♣'][suit]));
  for(let rank=1;rank<=13;rank++){
   const active=!!placed[suit]&&rank>=placed[suit].low&&rank<=placed[suit].high;
   const cell=make('span','v2-seven-cell'+(active?' v2-placed':''),active?glyph({suit,rank}):'·');
   row.append(cell);
  }
  box.append(row);
 }
 return box;
}
function fieldSurface(view){
 const box=make('section','v2-field');
 box.append(make('p','v2-help',view.board.revolution?'革命中':'現在の場'));
 const row=make('div','v2-field-row');
 for(const c of view.board.field?.cards||[])row.append(card(c));
 if(!row.childElementCount)row.append(make('span','v2-help','場にカードはありません'));
 box.append(row);
 if(view.board.lastEvent)box.append(make('p','v2-help',view.board.lastEvent));
 return box;
}
function memorySurface(view){
 const box=make('section','v2-memory');
 for(const tile of view.board.tiles||[]){
  const cell=card(tile.card,{back:!tile.card&&!tile.taken,action:'flip',index:tile.index,
   disabled:!view.isMyTurn||tile.taken||tile.flipped||!view.legal.flipIndices.includes(tile.index)});
  if(tile.taken){cell.textContent='✓';cell.classList.add('v2-taken');}
  box.append(cell);
 }
 return box;
}
// A fifth game can register a new boardKind without modifying the table UI.
export const DEFAULT_BOARD_SURFACES=Object.freeze({
 draw:drawSurface,seven:sevenSurface,field:fieldSurface,memory:memorySurface
});
export function createBoardSurface(view,surfaces=DEFAULT_BOARD_SURFACES){
 const fn=surfaces[view.board?.kind];
 if(typeof fn!=='function')throw Error('BOARD_SURFACE_NOT_REGISTERED');
 return fn(view);
}
export {glyph};
