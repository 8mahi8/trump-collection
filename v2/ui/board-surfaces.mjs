// Per-game board shapes remain shared by CPU and multiplayer.
// Cards use the earlier v1.5.x appearance, not the V2 text-only glyphs.
import {makeCardFace,cardLabel} from './card-face.mjs';
const make=(tag,cls,text='')=>{
 const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=text;return el;
};
export const glyph=cardLabel;
function drawSurface(view){
 const seat=view.board.drawFrom;
 const box=make('section','v2-draw');
 if(seat===null||seat===undefined){
  box.append(make('p','v2-help','カードを配っています…'));return box;
 }
 box.append(make('p','v2-help v2-board-hint',
  view.isMyTurn?'相手の伏せ札を1枚タップして引こう':'P'+(seat+1)+'のカードを引く番'));
 const count=view.players[seat]?.cardCount??0;
 const row=make('div','v2-backrow');
 for(let i=0;i<count;i++){
  const el=makeCardFace(null,{back:true,small:true,button:view.isMyTurn});
  if(view.isMyTurn){el.dataset.action='draw';el.dataset.index=i;el.disabled=false;
   el.setAttribute('aria-label','相手のカード '+(i+1)+'枚目を引く');}
  row.append(el);
 }
 box.append(row);
 if(view.board.lastAction?.paired){
  box.append(make('p','v2-result-note','ペア成立！'));
 }
 return box;
}
function sevenSurface(view){
 const box=make('section','v2-seven');
 const placed=view.board.placed||[];
 for(let suit=0;suit<4;suit++){
  const row=make('div','v2-seven-row');
  const label=make('span','v2-suit-label'+(suit===1||suit===2?' v2-red':''), ['♠','♥','♦','♣'][suit]);
  row.append(label);
  for(let rank=1;rank<=13;rank++){
   const pl=placed[suit];
   const active=!!pl&&rank>=pl.low&&rank<=pl.high;
   const next=!!pl&&(rank===pl.low-1||rank===pl.high+1);
   const cell=make('span','v2-seven-cell'+(active?' v2-placed':'')+(next?' v2-next':''));
   if(active)cell.append(makeCardFace({suit,rank},{tiny:true}));
   else cell.textContent=String(rank);
   row.append(cell);
  }
  box.append(row);
 }
 return box;
}
function fieldSurface(view){
 const box=make('section','v2-field');
 const tags=[];
 if(view.board.revolution)tags.push('🔥 革命中');
 if(view.board.lastEvent)tags.push(view.board.lastEvent);
 box.append(make('p','v2-help v2-board-hint',tags.join('　')||'現在の場'));
 const row=make('div','v2-field-row');
 for(const c of view.board.field?.cards||[])row.append(makeCardFace(c,{small:true}));
 if(!row.childElementCount)row.append(make('span','v2-help','場にカードはありません'));
 box.append(row);
 return box;
}
function memorySurface(view){
 const box=make('section','v2-memory');
 for(const tile of view.board.tiles||[]){
  const hidden=!tile.card&&!tile.taken;
  const el=makeCardFace(tile.card,{back:hidden,button:true,small:true});
  el.dataset.action='flip';el.dataset.index=tile.index;
  el.disabled=!view.isMyTurn||tile.taken||tile.flipped||
   !view.legal.flipIndices.includes(tile.index);
  if(tile.taken){
   el.classList.add('v2-taken');el.setAttribute('aria-label','取得済み');
  }else if(tile.flipped)el.classList.add('v2-flipped');
  box.append(el);
 }
 return box;
}
export const DEFAULT_BOARD_SURFACES=Object.freeze({
 draw:drawSurface,seven:sevenSurface,field:fieldSurface,memory:memorySurface
});
export function createBoardSurface(view,surfaces=DEFAULT_BOARD_SURFACES){
 const fn=surfaces[view.board?.kind];
 if(typeof fn!=='function')throw Error('BOARD_SURFACE_NOT_REGISTERED');
 return fn(view);
}
