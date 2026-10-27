import {GAME_REGISTRY} from '../games/definitions.mjs';
import {createBoardSurface,glyph,DEFAULT_BOARD_SURFACES} from './board-surfaces.mjs';

// The same DOM and click handler are used for CPU and network sessions.
export function createTableRenderer(root,{onAction=()=>{},registry=GAME_REGISTRY,surfaces=DEFAULT_BOARD_SURFACES}={}){
 if(!root||typeof root.replaceChildren!=='function')throw Error('INVALID_TABLE_ROOT');
 const wrapper=document.createElement('section');wrapper.className='v2-table';
 wrapper.innerHTML='<header class="v2-status" aria-live="polite"></header><div class="v2-players"></div><div class="v2-board"></div><div class="v2-foot"><div class="v2-hand" aria-label="自分の手札"></div><div class="v2-actions"></div></div>';
 root.replaceChildren(wrapper);
 const $=cls=>wrapper.querySelector('.'+cls);
 let current=null,last='',selected=new Set(),lastRevision=null,paints=0;
 const cardKey=c=>c?.joker?'JK':c.suit+'-'+c.rank;
 const elem=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;e.textContent=text;return e;};
 function render(view){
  if(!view||!view.game||!view.board)throw Error('INVALID_TABLE_VIEW');
  const spec=registry.get(view.game);
  const revisionKey=[view.game,view.seat,view.turn,view.phase,view.revision].join('/');
  if(revisionKey!==lastRevision){selected.clear();lastRevision=revisionKey;}
  current=view;
  const hash=JSON.stringify(view)+'#'+[...selected].sort().join('/');
  if(last===hash)return false;last=hash;
  $('v2-status').textContent=spec.label+'　'+(view.phase==='finished'?'試合終了':view.isMyTurn?'あなたの番':'プレイヤー'+((view.turn??0)+1)+' の番')+
   (view.connection?.state==='connected'?'　●オンライン':view.connection?.state==='local'?'　●CPU戦':'');
  const players=document.createDocumentFragment();
  for(const p of view.players){
   const tag=elem('span','v2-player'+(p.isYou?' v2-you':'')+(p.seat===view.turn?' v2-turn':''),
    (p.isYou?'自分':'P'+(p.seat+1))+
    (p.cardCount===null?'':'　'+p.cardCount+'枚')+(p.score===null?'':'　'+p.score+'点'));
   players.append(tag);
  }
  $('v2-players').replaceChildren(players);
  $('v2-board').replaceChildren(createBoardSurface(view,surfaces));
  const hand=document.createDocumentFragment(),handIds=new Set();
  for(const c of view.hand||[]){
   const key=cardKey(c);handIds.add(key);
   const b=elem('button','v2-card v2-handcard'+(c.suit===1||c.suit===2?' v2-red':'')+(selected.has(key)?' v2-selected':''),glyph(c));
   b.type='button';b.dataset.action='select';b.dataset.card=key;b.disabled=!view.isMyTurn||view.phase!=='playing'||!['pick-one','pick-multi'].includes(spec.interaction);
   b.setAttribute('aria-pressed',String(selected.has(key)));
   hand.append(b);
  }
  $('v2-hand').replaceChildren(hand);
  const actions=document.createDocumentFragment();
  const action=(text,type,disabled=false)=>{const b=elem('button','v2-action',text);b.type='button';b.dataset.action=type;b.disabled=disabled;actions.append(b);};
  if(view.phase==='finished')actions.append(elem('span','v2-help','おつかれさま！'));
  else if(!view.isMyTurn)actions.append(elem('span','v2-help','相手の操作を待っています…'));
  else if(spec.interaction==='pick-one'){
   action('選択した札を出す','submit',selected.size!==1||!view.legal.playIds.includes([...selected][0]));
   action('パス','pass',!view.legal.canPass);
  }else if(spec.interaction==='pick-multi'){
   const chosen=[...selected].sort().join(',');
   const canPlay=view.legal.playMoves.some(move=>[...move].sort().join(',')===chosen);
   action('カードを出す','submit',!selected.size||!canPlay);
   action('パス','pass',!view.legal.canPass);
  }else actions.append(elem('span','v2-help',spec.interaction==='draw'?'上の伏せ札を選択':'カードを選択'));
  $('v2-actions').replaceChildren(actions);
  wrapper.dataset.renderVersion=String(++paints);
  return true;
 }
 const click=e=>{
  const b=e.target.closest('button[data-action]');
  if(!b||!wrapper.contains(b)||b.disabled||!current)return;
  const type=b.dataset.action;
  if(type==='select'){
   const key=b.dataset.card;
   if(!current.isMyTurn||!current.hand.some(c=>cardKey(c)===key))return;
   if(selected.has(key))selected.delete(key);else{
    if(registry.get(current.game).interaction==='pick-one')selected.clear();
    selected.add(key);
   }
   render(current);return;
  }
  if(!current.isMyTurn||current.phase!=='playing')return;
  if(type==='draw'&&current.legal.drawIndices.includes(Number(b.dataset.index)))
   onAction({type:'draw',index:Number(b.dataset.index)});
  if(type==='flip'&&current.legal.flipIndices.includes(Number(b.dataset.index)))
   onAction({type:'flip',index:Number(b.dataset.index)});
  if(type==='pass'&&current.legal.canPass)onAction({type:'pass'});
  if(type==='submit'){
   if(registry.get(current.game).interaction==='pick-one'&&selected.size===1){
    const id=[...selected][0];
    if(current.legal.playIds.includes(id))onAction({type:'play',id});
   }else if(registry.get(current.game).interaction==='pick-multi'){
    const ids=[...selected],signature=[...ids].sort().join(',');
    if(current.legal.playMoves.some(move=>[...move].sort().join(',')===signature))
     onAction({type:'play',ids});
   }
  }
 };
 wrapper.addEventListener('click',click);
 return Object.freeze({render,dispose(){wrapper.removeEventListener('click',click);wrapper.remove();},
  get view(){return current}});
}
