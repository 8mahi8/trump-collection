import {GAME_REGISTRY} from '../games/definitions.mjs';
import {createBoardSurface,DEFAULT_BOARD_SURFACES} from './board-surfaces.mjs';
import {makeCardFace} from './card-face.mjs';
import {sortHandForGame} from './card-order.mjs';
import {describeDaifugoSelection} from './turn-guidance.mjs';
import {gamePresentation,turnHeading,turnPrompt} from './game-presentation.mjs';

// Full render is reserved for NEW authoritative state. A local card tap must
// not tear down the board, 52-card Sevens grid, player rows, or hand DOM.
// This matters on iPad Safari, where rebuilding intricate faces can cause jank.
export function createTableRenderer(root,{onAction=()=>{},registry=GAME_REGISTRY,surfaces=DEFAULT_BOARD_SURFACES}={}){
 if(!root||typeof root.replaceChildren!=='function')throw Error('INVALID_TABLE_ROOT');
 const wrapper=document.createElement('section');wrapper.className='v2-table';
 wrapper.innerHTML='<header class="v2-status" aria-live="polite"></header><div class="v2-players"></div><div class="v2-board"></div><div class="v2-foot"><div class="v2-hand-tools"><div class="v2-hand-label"></div><button class="v2-sort-button" type="button" data-action="sort" aria-label="手札の並べ方を切り替える">並べ替え</button><button class="v2-clear-button" type="button" data-action="clear" aria-label="選択中のカードをすべて解除" hidden>選択解除</button></div><div class="v2-selection-help" aria-live="polite"></div><div class="v2-hand" aria-label="自分の手札"></div><div class="v2-actions"></div></div>';
 root.replaceChildren(wrapper);
 const $=cls=>wrapper.querySelector('.'+cls);
 let current=null,last='',selected=new Set(),lastRevision=null,paints=0,selectionUpdates=0;
 let playable=new Set(),legalMoves=new Set(),guidanceMoves=[],spec=null,sortBySuit=false,lastGame=null;
 const cardKey=c=>c?.joker?'JK':c.suit+'-'+c.rank;
 const elem=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
 const selectionSignature=()=>[...selected].sort().join(',');
 const canSubmit=()=>{
  if(!current?.isMyTurn||current.phase!=='playing')return false;
  if(spec.interaction==='pick-one')return selected.size===1&&
   current.legal.playIds.includes([...selected][0]);
  if(spec.interaction==='pick-multi')return selected.size>0&&
   legalMoves.has(selectionSignature());
  return false;
 };
 function updateSelection(){
  if(!current)return;
  // No createElement / replaceChildren / JSON.stringify / Firebase requests.
  // Reuse the exact DOM nodes so taps keep their scroll and their card animation.
  const advice=spec.interaction==='pick-multi'&&current.isMyTurn&&current.phase==='playing'?
   describeDaifugoSelection(guidanceMoves,[...selected]):null;
  const followups=new Set(advice?.followups||[]);
  for(const b of $('v2-hand').children){
   const active=selected.has(b.dataset.card);
   b.classList.toggle('v2-selected',active);
   b.classList.toggle('v2-extension',!!advice&&selected.size>0&&!active&&followups.has(b.dataset.card));
   b.setAttribute('aria-pressed',String(active));
  }
  const submit=$('v2-actions').querySelector('[data-action="submit"]');
  if(submit){
   submit.disabled=!canSubmit();
   if(spec.interaction==='pick-multi')submit.textContent=selected.size?selected.size+'枚を出す':'カードを出す';
  }
  const count=selected.size;
  const clear=$('v2-hand-tools').querySelector('[data-action="clear"]');
  clear.hidden=count===0;clear.disabled=count===0;
  const hint=$('v2-selection-help');
  // The draw board already names the target player. Do not repeat a generic
  // instruction underneath it, especially in short Google Sites embeds.
  hint.textContent=spec.interaction==='draw'?'':turnPrompt(current,spec,
   {selected:[...selected],valid:canSubmit(),combo:advice});
  hint.classList.toggle('v2-feedback-warn',!!advice&&count>0&&!advice.possible);
  const handCount=current.hand?.length||0;
  $('v2-hand-label').textContent=handCount?
   '手札 '+handCount+'枚'+(count?' · 選択 '+count+'枚':'')+
   (handCount>=12?' · ↔ 横に動かせます':''):'';
  wrapper.dataset.selectionVersion=String(++selectionUpdates);
 }
 function render(view){
  if(!view||!view.game||!view.board)throw Error('INVALID_TABLE_VIEW');
  const revisionKey=[view.game,view.seat,view.turn,view.phase,view.revision].join('/');
  if(revisionKey!==lastRevision){selected.clear();lastRevision=revisionKey;}
  if(view.game!==lastGame){sortBySuit=false;lastGame=view.game;}
  current=view;
  const hash=JSON.stringify(view);
  if(last===hash)return false;
  last=hash;
  spec=registry.get(view.game);
  wrapper.dataset.game=view.game;
  $('v2-status').textContent=turnHeading(view,spec);
  const players=document.createDocumentFragment();
  for(const p of view.players){
   const tag=elem('span','v2-player'+(p.isYou?' v2-you':'')+(p.seat===view.turn?' v2-turn':''));
   const avatar=elem('span','v2-avatar',p.isYou?'🙂':p.isCpu?'🦊':'👤');
   const label=elem('span','v2-player-info',
    (p.seat===view.turn&&view.phase==='playing'?'▶ ':'')+
    (p.isYou?'自分':p.isCpu?'CPU'+(p.seat+1):'P'+(p.seat+1))+
    (p.cardCount===null?'':' · '+p.cardCount+'枚')+
    (p.score===null?'':' · '+p.score+'点'));
   tag.append(avatar,label);players.append(tag);
  }
  $('v2-players').replaceChildren(players);
  $('v2-board').replaceChildren(createBoardSurface(view,surfaces));
  playable=new Set();
  legalMoves=new Set();
  guidanceMoves=[];
  if(spec.interaction==='pick-one'){
   for(const id of view.legal.playIds)playable.add(id);
  }else if(spec.interaction==='pick-multi'){
   for(const move of view.legal.playMoves){
    legalMoves.add([...move].sort().join(','));
    guidanceMoves.push(new Set(move)); // once per authoritative render, not per tap
    for(const id of move)playable.add(id);
   }
  }
  const hand=document.createDocumentFragment();
  const defaultSuit=gamePresentation(spec).handOrder!=='strength';
  const bySuit=defaultSuit!==sortBySuit;
  const sorted=sortHandForGame(view.hand||[],view.game,{bySuit});
  const sortButton=$('v2-hand-tools').querySelector('[data-action="sort"]');
  sortButton.textContent=bySuit?'並び：マーク順 ⇄':'並び：強さ順 ⇄';
  sortButton.disabled=sorted.length<2;
  for(const c of sorted){
   const key=cardKey(c),canPlay=playable.has(key)&&view.isMyTurn;
   const b=makeCardFace(c,{button:true});b.classList.add('v2-handcard');
   if(canPlay)b.classList.add('v2-legal');
   if(view.isMyTurn&&['pick-one','pick-multi'].includes(spec.interaction)&&!canPlay)
    b.classList.add('v2-dimmed');
   b.dataset.action='select';b.dataset.card=key;
   b.disabled=!view.isMyTurn||view.phase!=='playing'||
    !['pick-one','pick-multi'].includes(spec.interaction)||
    (spec.interaction==='pick-one'&&!playable.has(key));
   hand.append(b);
  }
  $('v2-hand').replaceChildren(hand);
  const actions=document.createDocumentFragment();
  const action=(text,type,disabled=false)=>{
   const b=elem('button','v2-action',text);
   b.type='button';b.dataset.action=type;b.disabled=disabled;actions.append(b);
  };
  if(view.phase==='finished')actions.append(elem('span','v2-help','おつかれさま！'));
  else if(!view.isMyTurn)actions.append(elem('span','v2-help','相手の操作を待っています…'));
  else if(spec.interaction==='pick-one'){
   action('選択した札を出す','submit',true);
   action('パス','pass',!view.legal.canPass);
  }else if(spec.interaction==='pick-multi'){
   action('カードを出す','submit',true);
   action('パス','pass',!view.legal.canPass);
  }else if(!['draw','flip'].includes(spec.interaction)){
   actions.append(elem('span','v2-help','カードを選択'));
  }
  // Draw and flip have actionable board cards and their own board/turn hint.
  // Empty actions must collapse; repeated lines waste scarce vertical space.
  $('v2-actions').replaceChildren(actions);
  updateSelection();
  wrapper.dataset.renderVersion=String(++paints);
  return true;
 }
 const click=e=>{
  const b=e.target.closest('button[data-action]');
  if(!b||!wrapper.contains(b)||b.disabled||!current)return;
  const type=b.dataset.action;
  if(type==='sort'){
   sortBySuit=!sortBySuit;
   last='';render(current);return;
  }
  if(type==='clear'){
   if(selected.size){selected.clear();updateSelection();}
   return;
  }
  if(type==='select'){
   const key=b.dataset.card;
   if(!current.isMyTurn||current.phase!=='playing'||
    !current.hand.some(c=>cardKey(c)===key))return;
   if(selected.has(key))selected.delete(key);
   else{
    if(spec.interaction==='pick-one')selected.clear();
    selected.add(key);
   }
   // Deliberately *not* render(current) here.
   updateSelection();return;
  }
  if(!current.isMyTurn||current.phase!=='playing')return;
  if(type==='draw'&&current.legal.drawIndices.includes(Number(b.dataset.index)))
   onAction({type:'draw',index:Number(b.dataset.index)});
  if(type==='flip'&&current.legal.flipIndices.includes(Number(b.dataset.index)))
   onAction({type:'flip',index:Number(b.dataset.index)});
  if(type==='pass'&&current.legal.canPass)onAction({type:'pass'});
  if(type==='submit'&&canSubmit()){
   if(spec.interaction==='pick-one')onAction({type:'play',id:[...selected][0]});
   else if(spec.interaction==='pick-multi')onAction({type:'play',ids:[...selected]});
  }
 };
 wrapper.addEventListener('click',click);
 return Object.freeze({render,dispose(){
  wrapper.removeEventListener('click',click);wrapper.remove();
 },get view(){return current}});
}
