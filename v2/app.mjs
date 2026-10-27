import {GAME_REGISTRY} from './games/definitions.mjs';
import {createCpuSession} from './session/cpu-session.mjs';
import {createTableRenderer} from './ui/table-renderer.mjs';

const $=id=>document.getElementById(id);
const main=$('main');
let session=null,renderer=null,unsubscribe=null,botTimer=null;
function destroy(){
 clearTimeout(botTimer);botTimer=null;
 unsubscribe?.();unsubscribe=null;
 renderer?.dispose();renderer=null;
 session?.dispose();session=null;
 main.replaceChildren();
}
function openMenu(){
 destroy();
 const div=document.createElement('div');div.className='v2-menu';
 const title=document.createElement('h2');title.textContent='遊ぶゲームを選択';div.append(title);
 for(const game of GAME_REGISTRY.list()){
  const b=document.createElement('button');b.className='v2-menu-button';
  b.type='button';b.textContent=game.label+'　'+(game.id==='babanuki'?'CPUと遊ぶ':'（次の開発段階）');
  b.disabled=game.id!=='babanuki';
  b.dataset.game=game.id;
  b.addEventListener('click',()=>startCpu(game.id));div.append(b);
 }
 const p=document.createElement('p');
 p.textContent='基盤V2の検証画面。対人接続はまだ実装していません。';div.append(p);
 main.append(div);
}
function scheduleBot(){
 if(botTimer!==null||!session)return;
 const view=session.getView();
 if(view.phase==='finished'||view.isMyTurn)return;
 botTimer=setTimeout(()=>{
  botTimer=null;
  if(!session)return;
  session.stepCpu();
  scheduleBot();
 },100);
}
function startCpu(game){
 destroy();
 const seedParam=new URLSearchParams(location.search).get('seed');
 const seed=seedParam&&/^[0-9]{1,10}$/.test(seedParam)?Number(seedParam):
  crypto.getRandomValues(new Uint32Array(1))[0];
 session=createCpuSession({game,seed,seat:0});
 renderer=createTableRenderer(main,{onAction(action){
  if(session.dispatch(action))scheduleBot();
 }});
 unsubscribe=session.subscribe(view=>{renderer.render(view);scheduleBot();});
 scheduleBot();
}
$('home').addEventListener('click',openMenu);
openMenu();
