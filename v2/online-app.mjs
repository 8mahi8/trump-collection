// V2 room-first single-shell online lab. Same table renderer for CPU/online.
// Friend-only / no-auth REST transport: no sign-in and no reload restoration.
// School iPad / real Google Sites compatibility still needs hands-on testing.
import {GAME_REGISTRY} from './games/definitions.mjs';
import {isCpuSeat} from './core/shared-room.mjs';
import {createCpuSession} from './session/cpu-session.mjs';
import {createTableRenderer} from './ui/table-renderer.mjs';
import {createFirebaseRoomLobbyRest} from './net/firebase-room-lobby-rest.mjs';
import {createRoomCoordinator,createRoomLobbyClient} from './session/room-coordinator.mjs';
import {createRoomMatchHost} from './session/room-match-host.mjs';
import {createRoomMatchGuest} from './session/room-match-guest.mjs';
import {createRoomSession} from './session/room-session.mjs';
import {createRoomChat} from './ui/room-chat.mjs';
import {gamePresentation} from './ui/game-presentation.mjs';

const $=id=>document.getElementById(id);
const main=$('main'),notice=$('notice');
// Explicit readiness must be declared only after the game engine, online
// authority, touch UI and Firebase paths pass their integration suite.
const labGames=new Set(GAME_REGISTRY.list()
 .filter(spec=>spec.onlineReady===true).map(spec=>spec.id));
const create=(tag,cls='',label='')=>{
 const x=document.createElement(tag);if(cls)x.className=cls;
 if(label)x.textContent=label;return x;
};
const button=(label,key,onClick,disabled=false)=>{
 const b=create('button','v2-menu-button',label);b.type='button';b.dataset.action=key;
 b.disabled=disabled;b.addEventListener('click',()=>Promise.resolve().then(onClick).catch(showError));
 return b;
};
const msg=content=>{notice.textContent=content;};
const secureId=()=>Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>n.toString(16).padStart(2,'0')).join('');
const requestId=()=> 'r'+secureId();
const randomCode=()=>String(10000+crypto.getRandomValues(new Uint32Array(1))[0]%90000);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const cfg=globalThis.TRUMP_V2_FIREBASE_CONFIG||null;
let store=null,roomCode=null,isHost=false,coordinator=null,client=null;
let room=null,matchHost=null,activeMatchId=null,session=null,renderer=null,unsubscribe=null;
let timer=null,pumping=false,screen='home',lastRoomKey='',botTimer=null,disposed=false;
let needJoin=false,joinId=null,entering=false;
const chat=createRoomChat({top:document.querySelector('.v2-top'),
 app:document.querySelector('.v2-app'),getRoom:()=>room,getStore:()=>store});
function showError(e){
 const code=e?.code||e?.message||String(e);
 const useful={
  ONLINE_CONFIG_NOT_SET:'オンラインの接続先が未設定です。CPU戦はそのまま遊べます。',
  ROOM_PERMISSION_DENIED:'通信先でアクセスが拒否されました。Firebase接続設定を確認してください。',
  ROOM_CONFLICT:'その部屋番号は使用中です。もう一度ルームを作成してください。',
  NETWORK_ERROR:'通信できませんでした。Wi-Fi接続を確認してください。',
  ROOM_NOT_FOUND:'その番号のルームは見つかりませんでした。',
  ROOM_FULL:'このルームは4人で満員です。',
  INVALID_ROOM_CODE:'部屋番号は5桁の数字で入力してください。',
  ROOM_ALREADY_CLOSED:'このルームは終了しています。',
  ROOM_REQUEST_FAILED:'Firebaseとの通信に失敗しました。もう一度試してください。',
  MATCH_INTERRUPTED:'ホストの試合が中断しました。新しい部屋で始めてください。'
 };
 msg(useful[code]||'操作エラー：'+code);
}
function clearSession(){
 unsubscribe?.();unsubscribe=null;
 session?.dispose();session=null;
 renderer?.dispose();renderer=null;
 activeMatchId=null;
}
function stopRoom(){
 chat.reset();
 clearInterval(timer);timer=null;clearSession();
 matchHost=null;coordinator=null;client=null;room=null;roomCode=null;
 isHost=false;needJoin=false;joinId=null;lastRoomKey='';
}
function clearView(){
 if(botTimer!==null)clearTimeout(botTimer);
 botTimer=null;clearSession();main.replaceChildren();
}
function home(){
 stopRoom();clearView();screen='home';msg(cfg?.databaseURL?'トランプコレクション｜友達との対戦はこちらから':'開発用プレビュー。オンライン接続先は未設定です。');
 const view=create('section','v2-menu');
 view.append(create('h2','','トランプコレクション'));
 view.append(button('🃏 CPUとババ抜き','cpu',()=>openCpu()));
 view.append(button('👥 友達と遊ぶ（共通ルーム）','friends',()=>openConnect()));
 view.append(create('p','','ひとつの部屋に集まって、そこからゲームを選ぶ方式です。'));
 main.replaceChildren(view);
}
function scheduleBot(){
 if(botTimer!==null||screen!=='cpu'||!session)return;
 const view=session.getView();
 if(view.phase==='finished'||view.isMyTurn)return;
 botTimer=setTimeout(()=>{
  botTimer=null;
  if(screen!=='cpu'||!session)return;
  session.stepCpu();scheduleBot();
 },100);
}
function openCpu(){
 stopRoom();clearView();screen='cpu';
 const q=new URLSearchParams(location.search),seed=q.get('seed');
 const chosen=seed&&/^[0-9]{1,10}$/.test(seed)?Number(seed):
  crypto.getRandomValues(new Uint32Array(1))[0];
 session=createCpuSession({game:'babanuki',seed:chosen,seat:0});
 renderer=createTableRenderer(main,{onAction:action=>{
  if(session.dispatch(action))scheduleBot();
 }});
 unsubscribe=session.subscribe(view=>{renderer.render(view);scheduleBot()});
 msg('CPUババ抜き｜オンラインと同じ共通テーブル');
 scheduleBot();
}
function openConnect(){
 stopRoom();clearView();screen='connect';
 const form=create('section','v2-menu');
 form.append(create('h2','','友達と遊ぶ'));
 form.append(create('p','','部屋を作ると5桁の番号が発行されます。先にゲームを決める必要はありません。'));
 form.append(button('新しいルームを作る','create-room',()=>enterRoom(true)));
 const line=create('div','v2-room-input');
 const input=create('input');input.id='room-code';input.inputMode='numeric';
 input.maxLength=5;input.placeholder='5桁の部屋番号';input.setAttribute('aria-label','5桁の部屋番号');
 line.append(input,button('参加','join-room',()=>enterRoom(false,input.value.trim())));
 form.append(line);
 main.replaceChildren(form);
 msg(cfg?.databaseURL?'部屋を作るか、友達の5桁の番号を入力してください。':'オンラインの接続先が未設定です。');
}
async function connect(){
 if(store)return;
 if(!cfg?.databaseURL)throw Error('ONLINE_CONFIG_NOT_SET');
 // Device-local random player ID, NOT a Firebase login/token.
 // Reload starts a new session; no rejoin/restoration is promised.
 store=createFirebaseRoomLobbyRest({databaseURL:cfg.databaseURL,
  identity:{uid:'tc'+secureId()},friendOnlyNoAuth:true,
  fetchImpl:globalThis.TRUMP_V2_TEST_FETCH||globalThis.fetch.bind(globalThis)});
}
async function enterRoom(host,code){
 if(screen!=='connect'||entering)return;
 if(!host&&!/^[0-9]{5}$/.test(code))throw Error('INVALID_ROOM_CODE');
 entering=true;
 msg(host?'ルームを作成しています…':'ルームに参加しています…');
 try{
  await connect();
  if(screen!=='connect')return;
  if(host){
   // Room numbers can collide with earlier friends' rooms. Retry a few
   // fresh random codes; never overwrite an existing lobby or join it.
   let reserved=false;
   for(let attempt=0;attempt<6;attempt++){
    const candidate=randomCode();
    const next=createRoomCoordinator({store,roomCode:candidate});
    try{
     await next.bootstrap();
     roomCode=candidate;coordinator=next;reserved=true;
     break;
    }catch(e){if(e?.code!=='ROOM_CONFLICT')throw e;}
   }
   if(!reserved)throw Error('ROOM_CONFLICT');
   isHost=true;
   client=createRoomLobbyClient({store,roomCode});
  }else{
   const pendingClient=createRoomLobbyClient({store,roomCode:code});
   const current=await pendingClient.room();
   if(!current||current.phase==='closed')throw Error('ROOM_NOT_FOUND');
   roomCode=code;isHost=false;client=pendingClient;
   needJoin=true;joinId=requestId();
   await client.submit({type:'join',expectedRevision:current.revision},joinId);
  }
  if(screen!=='connect')return;
  screen='room';lastRoomKey='';
  await pump();
  timer=setInterval(()=>{pump().catch(showError)},700);
 }catch(e){
  // A failed attempt should not poison a second tap with stale room code or
  // a half-initialized coordinator. This is NOT reload/match recovery.
  clearInterval(timer);timer=null;
  coordinator=null;client=null;roomCode=null;room=null;
  isHost=false;needJoin=false;joinId=null;lastRoomKey='';
  if(screen==='room')openConnect();
  throw e;
 }finally{entering=false;}
}
async function leave(){
 if(!client){home();return}
 if(screen==='cpu'){home();return}
 if(room&&room.members.includes(store.uid)){
  if(isHost)await coordinator.applyHost({type:'leave'});
  else await client.submit({type:'leave',expectedRevision:room.revision},requestId());
 }
 home();
}
async function hostAction(type,extras={}){
 if(!isHost||!coordinator)throw Error('HOST_ONLY');
 const result=await coordinator.applyHost({type,...extras});
 if(!result.ok)throw Error(result.reason);
 await pump();
}
async function guestReady(){
 if(!room||!client)throw Error('ROOM_NOT_READY');
 const ready=room.ready.includes(store.uid);
 await client.submit({type:'setReady',expectedRevision:room.revision,ready:!ready,
  gameId:room.selectedGame,matchSequence:room.matchSequence,
  selectionEpoch:room.selectionEpoch},requestId());
 msg('準備の変更を送信しました');
}
function renderLobby(snapshot){
 const key=JSON.stringify([snapshot.phase,snapshot.revision,snapshot.selectedGame,
  snapshot.members,snapshot.ready,snapshot.participants]);
 if(screen==='lobby'&&key===lastRoomKey)return;
 lastRoomKey=key;screen='lobby';clearSession();
 const area=create('section','v2-room-lobby');
 const heading=create('h2','','ルーム '+snapshot.roomCode);
 heading.dataset.roomCode=snapshot.roomCode;heading.id='shared-code';area.append(heading);
 area.append(create('p','v2-help','同じ部屋のまま別ゲームを選べます。'));
 const roster=create('div','v2-roster');
 snapshot.members.forEach((id,index)=>{
  const label=(id===snapshot.hostId?'★ ':'')+'P'+(index+1)+
   (id===store.uid?'（自分）':'')+
   (snapshot.ready.includes(id)?' ✓準備完了':'');
  roster.append(create('span','v2-player',label));
 });
 snapshot.participants.forEach((id,seat)=>{
  if(isCpuSeat(snapshot,id))roster.append(create('span','v2-player','CPU'+(seat+1)));
 });
 area.append(roster);
 if(!snapshot.members.includes(store.uid)){
  area.append(create('p','v2-help','ホストが参加を確認しています…'));
  area.append(button('退出','leave-room',leave));
  main.replaceChildren(area);return;
 }
 if(!snapshot.selectedGame)area.append(create('p','v2-help','ゲームを選択してください'));
 const picker=create('div','v2-game-picker');
 for(const spec of GAME_REGISTRY.list()){
  const visual=gamePresentation(spec);
  const b=button('', 'game-'+spec.id,()=>hostAction('selectGame',{gameId:spec.id}),
   !isHost||!labGames.has(spec.id));
  const name=create('span','v2-game-name',visual.icon+' '+spec.label);
  const detail=create('span','v2-game-tagline',
   labGames.has(spec.id)?visual.tagline:'準備中');
  b.append(name,detail);
  if(spec.id===snapshot.selectedGame)b.classList.add('v2-active');
  picker.append(b);
 }
 area.append(picker);
 // Participant selection depends on seat count, not on a particular game name.
 // The existing data-action stays stable for current browser automation.
 if(snapshot.selectedGame&&GAME_REGISTRY.get(snapshot.selectedGame).seats===2&&
  isHost&&snapshot.members.length>2){
  area.append(create('p','v2-help','対戦する2人を選択（ほかの友達は待機）'));
  for(const other of snapshot.members.filter(id=>id!==snapshot.hostId)){
   const index=snapshot.members.indexOf(other);
   const chosen=snapshot.participants.includes(other);
   const pick=button((chosen?'✓ ':'')+'P'+(index+1)+' と対戦',
    'memory-opponent-'+(index+1),
    ()=>hostAction('setParticipants',{memberIds:[snapshot.hostId,other]}));
   if(chosen)pick.classList.add('v2-active');
   area.append(pick);
  }
 }
 if(snapshot.selectedGame){
  const meInMatch=snapshot.participants.includes(store.uid);
  area.append(create('p','v2-help',
   '人間：'+snapshot.participants.filter(id=>snapshot.members.includes(id)).length+'人 ／ CPU：'+
   snapshot.participants.filter(id=>isCpuSeat(snapshot,id)).length+'人'));
  if(meInMatch)area.append(button(snapshot.ready.includes(store.uid)?'準備を解除':'準備完了',
   'ready',()=>isHost?
    hostAction('setReady',{ready:!snapshot.ready.includes(store.uid)}):guestReady()));
  if(isHost){
   const enough=snapshot.participants.length===GAME_REGISTRY.get(snapshot.selectedGame).seats &&
    snapshot.participants.every(id=>isCpuSeat(snapshot,id)||snapshot.ready.includes(id));
   area.append(button('対局開始','start',()=>hostAction('startMatch'),!enough));
  }
 }
 area.append(button('ルームを退出','leave-room',leave));
 main.replaceChildren(area);
}
async function showMatchSummary(snapshot,area){
 const matchId=snapshot.match?.matchId,code=snapshot.roomCode;
 if(!matchId||!store)return;
 try{
  const report=await store.matchPublic(code,matchId);
  if(screen!=='results'||activeMatchId!==matchId||roomCode!==code||
   !report?.publicView)return;
  const pub=report.publicView,score=Array.isArray(pub.scores)?pub.scores:null;
  const standings=pub.ranks&&typeof pub.ranks==='object'?pub.ranks:null;
  const results=create('div','v2-results-list');
  for(let seat=0;seat<snapshot.match.participants.length;seat++){
   const id=snapshot.match.participants[seat];
   const name=id===store.uid?'自分':isCpuSeat(snapshot,id)?'CPU'+(seat+1):
    'P'+(snapshot.members.indexOf(id)+1);
   const rank=standings?.[seat],points=score?.[seat];
   if(!Number.isFinite(rank)&&!Number.isFinite(points))continue;
   const line=create('div','v2-result-player');
   if(id===store.uid)line.classList.add('v2-result-you');
   const text=(Number.isFinite(rank)?rank+'位 · ':'')+
    name+(Number.isFinite(points)?' · '+points+'ペア':'');
   line.textContent=text;
   results.append(line);
  }
  if(results.childElementCount)area.insertBefore(results,area.querySelector('[data-action="back-lobby"]'));
 }catch{/* Room results stay usable even if optional score GET fails. */}
}
function renderResults(snapshot){
 if(screen==='results'&&snapshot.match?.matchId===activeMatchId)return;
 screen='results';clearSession();activeMatchId=snapshot.match?.matchId||'';
 const area=create('section','v2-menu');
 area.append(create('h2','','試合終了'));
 area.append(create('p','','ルーム '+roomCode+' はそのまま。'));
 if(isHost)area.append(button('ロビーに戻る','back-lobby',
  ()=>hostAction('returnToLobby',{matchId:snapshot.match.matchId})));
 else area.append(create('p','v2-help','ホストがロビーに戻るのを待っています…'));
 main.replaceChildren(area);
 showMatchSummary(snapshot,area);
}
function renderSpectator(snapshot){
 if(screen==='spectator'&&activeMatchId===snapshot.match.matchId)return;
 clearSession();activeMatchId=snapshot.match.matchId;screen='spectator';
 const area=create('section','v2-menu');
 area.append(create('h2','','対戦終了まで待機中'));
 area.append(create('p','','ルーム '+snapshot.roomCode+' はそのままです。'));
 area.append(create('p','v2-help','2人の対戦が終わるとロビーに戻れます。'));
 main.replaceChildren(area);
}
function beginMatch(snapshot){
 const id=snapshot.match.matchId;
 if(activeMatchId===id&&session)return;
 clearSession();
 activeMatchId=id;screen='match';
 const guest=createRoomMatchGuest({store,roomCode,matchId:id});
 session=createRoomSession({game:snapshot.match.gameId,guest});
 renderer=createTableRenderer(main,{onAction:action=>{
  if(!session||session.pending)return;
  session.dispatch(action).then(result=>{
   if(result)msg('操作を送信しました');else msg('入力を受け付けませんでした');
  }).catch(showError);
 }});
 unsubscribe=session.subscribe(view=>renderer?.render(view));
}
async function pump(){
 if(disposed||pumping||!client)return;
 pumping=true;
 try{
  let before=null,matchUpdated=false;
  if(isHost){
   await coordinator.tick();
   before=await client.room();
   if(before?.phase==='playing'&&labGames.has(before.match?.gameId)){
    if(!matchHost||matchHost.matchId!==before.match.matchId){
     const labSeed=globalThis.TRUMP_V2_TEST_SEED;
     matchHost=createRoomMatchHost({store,coordinator,roomCode,
      ...(Number.isSafeInteger(labSeed)?{seedSource:()=>labSeed}:{})});
     // Never silently redeal if an interrupted host still has published state.
     if(await store.matchPublic(roomCode,before.match.matchId))
      throw Error('MATCH_INTERRUPTED');
     await matchHost.start();
    }
    const processed=await matchHost.tick({roomSnapshot:before});
    matchUpdated=processed.processed>0||processed.bots>0;
   }else if(before?.phase==='lobby')matchHost=null;
  }
  const latest=isHost&&before&&!matchUpdated?before:await client.room();
  if(!latest||latest.phase==='closed'){home();msg('ルームが終了しました');return}
  room=latest;
  chat.sync();
  if(needJoin&&!room.members.includes(store.uid)){
   const ack=await client.receipt(joinId);
   if(ack&&!ack.ok){home();msg('入室できませんでした：'+ack.reason);return}
  }else needJoin=false;
  if(!room.members.includes(store.uid)||room.phase==='lobby'){
   renderLobby(room);
  }else if(room.phase==='playing'){
   if(!room.match.participants.includes(store.uid)){
    renderSpectator(room);
   }else{
    beginMatch(room);
    const reply=await session.refresh({roomSnapshot:room});
    if(reply.status==='ready'||reply.status==='ack'){
     msg('オンライン対戦｜部屋 '+roomCode);
    }else if(reply.status==='rejected')msg('入力が拒否されました：'+reply.reason);
    else msg('対戦データの同期中…');
   }
  }else if(room.phase==='results')renderResults(room);
 }finally{pumping=false}
}
$('home').addEventListener('click',()=>{if(roomCode&&client)leave().catch(showError);else home();});
home();
globalThis.TRUMP_V2_ONLINE_LAB={get mode(){return screen},get room(){return room},
 get view(){return session?.getView()||null},get uid(){return store?.uid||null},
 get matchId(){return activeMatchId},get pending(){return session?.pending??false},
 get version(){return 'phase2d-mixed-full-1'}};
