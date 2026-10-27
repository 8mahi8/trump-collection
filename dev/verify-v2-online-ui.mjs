// Four independent touch-only browser pages, Google Sites-style srcdoc sandbox.
// Firebase RTDB requests go ONLY to local no-auth friend-only emulator.
// Any Firebase Authentication API request is a test FAILURE.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {chromium,webkit} from 'playwright';

const engine=process.env.TC_BROWSER_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_ENGINE');
const html=readFileSync(resolve('dist/v2-room-first-online-lab.html'),'utf8');
assert.ok(!/<iframe\b|<script\b[^>]+src=|<link\b[^>]+stylesheet/i.test(html));
const esc=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const wrapper='<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
 '<body style="margin:0"><iframe id="sites" sandbox="allow-scripts allow-forms" style="border:0;width:100vw;height:100vh" srcdoc="'+esc(html)+'"></iframe></body></html>';
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(wrapper);
});
await new Promise((resolve,reject)=>server.listen(8944,'127.0.0.1',e=>e?reject(e):resolve()));
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});
const context=await browser.newContext({viewport:{width:800,height:450},hasTouch:true});
const errors=[],pages=[];
const traffic={auth:0,reads:0,writes:0};
mkdirSync(resolve('dist/v2-screens'),{recursive:true});
const cors={'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
 'access-control-allow-headers':'Content-Type,Accept,If-Match,Authorization,X-Firebase-ETag',
 'access-control-expose-headers':'etag,ETag',
 'access-control-max-age':'600'};
await context.addInitScript(()=>{
 window.TRUMP_V2_FIREBASE_CONFIG={databaseURL:'https://trump-ci-default-rtdb.firebasedatabase.app'};
 // Fixed game shuffle in CI. Real friend games still use crypto randomness.
 window.TRUMP_V2_TEST_SEED=98765;
});
await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 let target;
 if(u.hostname==='identitytoolkit.googleapis.com'||u.hostname==='securetoken.googleapis.com'){
  traffic.auth++;
  errors.push('FORBIDDEN_FIREBASE_AUTH_CALL '+u.href);
  await route.abort();return;
 }else if(u.hostname.endsWith('.firebasedatabase.app')||u.hostname.endsWith('.firebaseio.com')){
  if(u.searchParams.has('auth'))errors.push('FORBIDDEN_AUTH_QUERY_TOKEN');
  u.searchParams.set('ns','demo-trumpcards-default-rtdb');
  target='http://127.0.0.1:9000'+u.pathname+u.search;
 }else if(u.hostname==='127.0.0.1'&&u.port==='8944'){await route.continue();return}
 else {errors.push('Blocked outgoing request '+u.href);await route.abort();return}
 if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors,body:''});return}
 if(req.method()==='GET')traffic.reads++;
 else traffic.writes++;
 try{
  const incoming=req.headers(),headers={};
  for(const k of ['content-type','accept','if-match','x-firebase-etag'])
   if(incoming[k])headers[k]=incoming[k];
  const response=await fetch(target,{method:req.method(),headers,body:req.postData()||undefined});
  await route.fulfill({status:response.status,headers:{...cors,'content-type':'application/json',
   ...Object.fromEntries(['etag'].filter(k=>response.headers.has(k)).map(k=>[k,response.headers.get(k)]))},
   body:await response.text()});
 }catch(e){errors.push(String(e));await route.abort()}
});
async function launch(){
 const page=await context.newPage();
 pages.push(page);page.on('pageerror',e=>errors.push('Page error '+e.message));
 await page.goto('http://127.0.0.1:8944/');
 const f=page.frameLocator('#sites');
 await f.locator('button[data-action="friends"]').tap();
 await f.locator('button[data-action="create-room"]').waitFor();
 return {page,f};
}
async function waitForView(p,check,timeout=28000){
 await p.f.locator('body').evaluate((body,params)=>new Promise((resolve,reject)=>{
  const {condition,maxMs}=params;
  const started=Date.now();
  const timer=setInterval(()=>{
   const lab=window.TRUMP_V2_ONLINE_LAB;
   const yes=condition==='match'?lab?.mode==='match'&&lab?.view?.game==='babanuki':
    condition==='lobby'?lab?.mode==='lobby':Boolean(lab?.view);
   if(yes){clearInterval(timer);resolve(true)}
   else if(Date.now()-started>maxMs){clearInterval(timer);reject(Error('WAIT_'+condition+'_TIMEOUT'))}
  },120);
 }),{condition:check,maxMs:timeout});
}
try{
 const owner=await launch(),group=[owner];
 await owner.f.locator('button[data-action="create-room"]').tap();
 await owner.f.locator('#shared-code').waitFor({timeout:18000});
 const label=await owner.f.locator('#shared-code').textContent();
 const room=label.match(/\d{5}/)?.[0];
 assert.match(room,/^[0-9]{5}$/);
 for(let i=0;i<3;i++){
  const guest=await launch();group.push(guest);
  await guest.f.locator('#room-code').fill(room);
  await guest.f.locator('button[data-action="join-room"]').tap();
 }
 await Promise.all(group.map(p=>p.f.locator('.v2-roster .v2-player').nth(3).waitFor({timeout:28000})));
 await owner.f.locator('button[data-action="game-babanuki"]').tap();
 await owner.f.locator('button[data-action="ready"]').waitFor();
 for(const p of group){
  await p.f.locator('button[data-action="ready"]').tap();
  await p.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'}).waitFor({timeout:28000});
 }
 await owner.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:28000});
 await Promise.all(group.map(p=>waitForView(p,'match')));
 for(const p of group){
  assert.equal(await p.f.locator('.v2-player').count(),4);
  assert.equal(await p.f.locator('.v2-table').count(),1);
  assert.equal(await p.f.locator('iframe').count(),0,'no nested iframe inside Google Sites embed');
 }
 const pub=await owner.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.view);
 const active=group.findIndex(async ()=>false); // resolved below by UID-to-seat map
 const actingUid=await owner.f.locator('body').evaluate(()=>{
  const lab=window.TRUMP_V2_ONLINE_LAB;return lab.room.match.participants[lab.view.turn]});
 const actorData=await Promise.all(group.map(async p=>p.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.uid)));
 const index=actorData.indexOf(actingUid);
 assert.ok(index>=0,'active UID exists in four clients');
 const acting=group[index];
 const beforeAction=Date.now();
 await acting.f.locator('.v2-backrow button:not([disabled])').first().tap({timeout:22000});
 const oldRev=pub.revision;
 await Promise.all(group.map(async p=>{
  await p.f.locator('body').evaluate((b,revision)=>new Promise((resolve,reject)=>{
   const start=Date.now(),interval=setInterval(()=>{
    if(window.TRUMP_V2_ONLINE_LAB?.view?.revision>revision){
     clearInterval(interval);resolve(true)
    }else if(Date.now()-start>27000){
     clearInterval(interval);reject(Error('REVISION_NOT_SYNCED'))
    }
   },120)
  }),oldRev);
 }));
 const syncMs=Date.now()-beforeAction;
 console.log('V2 EMULATOR SYNC '+engine+' '+syncMs+'ms '+JSON.stringify(traffic));
 for(const p of group){
  const view=await p.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.view);
  assert.ok(view.hand.length>=0);
  assert.ok(!('hands' in view),'other hands must never enter renderer view');
  assert.ok(view.revision>oldRev);
 }
 for(const size of [{width:800,height:450},{width:667,height:375}]){
  await Promise.all(group.map(p=>p.page.setViewportSize(size)));
  for(const p of group){
   const layout=await p.f.locator('body').evaluate(()=>{
    const pos=s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:b.top,bottom:b.bottom,height:b.height}};
    return {screenH:innerHeight,screenW:innerWidth,scrollW:document.documentElement.scrollWidth,
     board:pos('.v2-board'),hand:pos('.v2-hand'),actions:pos('.v2-actions')};
   });
   assert.ok(layout.scrollW<=layout.screenW+3,'width '+JSON.stringify(layout));
   assert.ok(layout.board.bottom<=layout.hand.top+3,'overlap '+JSON.stringify(layout));
   assert.ok(layout.actions.bottom<=layout.screenH+4,'bottom '+JSON.stringify(layout));
  }
  await owner.page.screenshot({path:resolve('dist/v2-screens',
   'online-'+engine+'-'+size.width+'x'+size.height+'.png')});
 }

 // A room with only two friends must be able to play four-seat Daifugo:
 // the two unused seats become host-operated CPUs, not extra auth clients.
 const duoOwner=await launch();
 await duoOwner.f.locator('button[data-action="create-room"]').tap();
 await duoOwner.f.locator('#shared-code').waitFor({timeout:18000});
 const duoRoom=(await duoOwner.f.locator('#shared-code').textContent()).match(/[0-9]{5}/)?.[0];
 assert.match(duoRoom,/^[0-9]{5}$/);
 const duoFriend=await launch();
 await duoFriend.f.locator('#room-code').fill(duoRoom);
 await duoFriend.f.locator('button[data-action="join-room"]').tap();
 await duoOwner.f.locator('.v2-roster .v2-player').nth(1).waitFor({timeout:26000});
 await duoOwner.f.locator('button[data-action="game-daifugo"]').tap();
 for(const page of [duoOwner,duoFriend]){
  await page.f.locator('.v2-roster .v2-player').filter({hasText:'CPU'}).first().waitFor({timeout:26000});
 }
 const lineup=await duoOwner.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.room.participants);
 assert.equal(lineup.length,4);
 assert.equal(lineup.filter(id=>id.startsWith('cpu-')).length,2);
 await duoOwner.f.locator('button[data-action="ready"]').tap();
 await duoOwner.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'}).waitFor({timeout:26000});
 await duoFriend.f.locator('button[data-action="ready"]').tap();
 await duoFriend.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'}).waitFor({timeout:26000});
 await duoOwner.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:26000});
 await Promise.all([duoOwner,duoFriend].map(p=>p.f.locator('.v2-table').waitFor({timeout:26000})));
 await Promise.all([duoOwner,duoFriend].map(p=>p.f.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
  const begin=Date.now(),id=setInterval(()=>{
   if(window.TRUMP_V2_ONLINE_LAB.view?.game==='daifugo'){
    clearInterval(id);resolve();
   }else if(Date.now()-begin>26000){clearInterval(id);reject(Error('CPU_DAIFUGO_NO_VIEW'))}
  },120)
 }))));
 for(const page of [duoOwner,duoFriend]){
  const players=await page.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.view.players);
  assert.equal(players.filter(p=>p.isCpu).length,2);
  assert.equal(await page.f.locator('.v2-players .v2-player').filter({hasText:'CPU'}).count(),2);
 }
 console.log('V2 ROOM-FIRST CPU AUTOFILL PASS '+engine+' two humans + two CPUs in Daifugo, no Firebase Auth');

 // Drive the WHOLE mixed Daifugo match through actual tap/click controls.
 // Never mutate engine state, make backend requests, or bypass the renderer.
 // CPU seats act solely through the host GameShell's ordinary tick.
 const duel=[duoOwner,duoFriend];
 const uidList=await Promise.all(duel.map(p=>p.f.locator('body').evaluate(()=>
  window.TRUMP_V2_ONLINE_LAB.uid)));
 const wallStart=Date.now(),humanClicks=0;
 let humanTurns=0,observedCpuTurns=0,turns=0,lastSeenRev=-1;
 while(Date.now()-wallStart<270000&&turns<240){
  const current=await duoOwner.f.locator('body').evaluate(()=>{
   const lab=window.TRUMP_V2_ONLINE_LAB;
   return {mode:lab.mode,room:lab.room,view:lab.view};
  });
  if(current.mode==='results')break;
  const v=current.view;
  if(!v||v.game!=='daifugo'||!current.room||v.revision===null){
   await new Promise(resolve=>setTimeout(resolve,200));continue;
  }
  if(v.revision===lastSeenRev){
   await new Promise(resolve=>setTimeout(resolve,180));continue;
  }
  lastSeenRev=v.revision;
  const actor=current.room.match.participants[v.turn];
  const humanIndex=uidList.indexOf(actor);
  if(humanIndex<0){observedCpuTurns++;await new Promise(resolve=>setTimeout(resolve,180));continue;}
  const page=duel[humanIndex];
  await page.f.locator('body').evaluate((body,params)=>new Promise((resolve,reject)=>{
   const start=Date.now(),timer=setInterval(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    if(lab.mode==='results'||(lab.view?.revision>=params.revision&&
      lab.view?.isMyTurn&&!lab.pending)){
     clearInterval(timer);resolve();
    }else if(Date.now()-start>12000){
     clearInterval(timer);reject(Error('MIXED_TURN_NOT_READY seat='+params.seat));
    }
   },100);
  }),{revision:v.revision,seat:humanIndex});
  const actual=await page.f.locator('body').evaluate(()=>({
   mode:window.TRUMP_V2_ONLINE_LAB.mode,
   view:window.TRUMP_V2_ONLINE_LAB.view
  }));
  if(actual.mode==='results')break;
  const move=actual.view.legal.playMoves[0];
  if(move&&move.length){
   for(const id of move){
    const card=page.f.locator('.v2-handcard[data-card="'+id+'"]');
    await card.tap({timeout:9000});
   }
   await page.f.locator('.v2-action[data-action="submit"]:not([disabled])').tap({timeout:9000});
  }else{
   await page.f.locator('.v2-action[data-action="pass"]:not([disabled])').tap({timeout:9000});
  }
  humanTurns++;turns++;
  const earlier=actual.view.revision;
  await page.f.locator('body').evaluate((body,rev)=>new Promise((resolve,reject)=>{
   const start=Date.now(),timer=setInterval(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    if(lab.mode==='results'||(lab.view?.revision>rev&&!lab.pending)){
     clearInterval(timer);resolve();
    }else if(Date.now()-start>18000){
     clearInterval(timer);reject(Error('MIXED_MOVE_NOT_ACKNOWLEDGED rev='+rev+
      ' status='+document.getElementById('notice')?.textContent));
    }
   },120);
  }),earlier);
 }
 assert.ok(humanTurns>0,'mixed Daifugo needs real tapped human turns');
 assert.ok(observedCpuTurns>0,'mixed Daifugo needs observed CPU turns');
 await duoOwner.f.locator('button[data-action="back-lobby"]').waitFor({timeout:15000});
 await duoFriend.f.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
  const start=Date.now(),timer=setInterval(()=>{
   if(window.TRUMP_V2_ONLINE_LAB.mode==='results'){
    clearInterval(timer);resolve();
   }else if(Date.now()-start>14000){
    clearInterval(timer);reject(Error('GUEST_DID_NOT_RECEIVE_DAIFUGO_RESULTS'));
   }
  },120);
 }));
 await duoOwner.f.locator('button[data-action="back-lobby"]').tap();
 await Promise.all(duel.map(p=>p.f.locator('#shared-code').waitFor({timeout:15000})));
 for(const page of duel){
  assert.ok((await page.f.locator('#shared-code').textContent()).includes(duoRoom),
   'same room retained after a full mixed match');
 }
 console.log('V2 MIXED DAIFUGO FULL UI PASS '+engine+' humanMoves='+humanTurns+
  ' cpuTurnsObserved='+observedCpuTurns+' gameDurationMs='+(Date.now()-wallStart));



 // Continue in the SAME two-human room after Daifugo, switching games
 // without rejoining. Play two more full games by real UI taps.
 let drawState=20261028;
 const drawIndex=count=>{
  drawState^=drawState<<13;drawState^=drawState>>>17;drawState^=drawState<<5;
  return (drawState>>>0)%count;
 };
 async function completeNextMixedGame(game){
  await duoOwner.f.locator('button[data-action="game-'+game+'"]').tap();
  for(const p of duel){
   await p.f.locator('button[data-action="ready"]').waitFor({timeout:18000});
   await p.f.locator('button[data-action="ready"]').tap();
   await p.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'})
    .waitFor({timeout:16000});
  }
  await duoOwner.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:16000});
  await Promise.all(duel.map(async p=>p.f.locator('body').evaluate((body,g)=>new Promise((resolve,reject)=>{
   const began=Date.now(),interval=setInterval(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    if(lab.mode==='match'&&lab.view?.game===g){clearInterval(interval);resolve();}
    else if(Date.now()-began>18000){clearInterval(interval);reject(Error('MIXED_GAME_NOT_STARTED '+g));}
   },100);
  }),game)));
  let attempts=0,botTurns=0,humanMoves=0,lastRevision=-1;
  const start=Date.now();
  while(Date.now()-start<68000&&attempts<180){
   const current=await duoOwner.f.locator('body').evaluate(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    return {mode:lab.mode,room:lab.room,view:lab.view};
   });
   if(current.mode==='results')break;
   const v=current.view;
   if(!v||v.game!==game||!current.room||!Number.isInteger(v.revision)){
    await new Promise(r=>setTimeout(r,120));continue;
   }
   if(v.revision===lastRevision){await new Promise(r=>setTimeout(r,140));continue;}
   lastRevision=v.revision;
   const actor=current.room.match.participants[v.turn];
   const seat=uidList.indexOf(actor);
   if(seat<0){botTurns++;await new Promise(r=>setTimeout(r,110));continue;}
   const player=duel[seat];
   await player.f.locator('body').evaluate((body,arg)=>new Promise((resolve,reject)=>{
    const began=Date.now(),interval=setInterval(()=>{
     const lab=window.TRUMP_V2_ONLINE_LAB;
     if(lab.mode==='results'||(lab.view?.game===arg.game&&
       lab.view.revision>=arg.revision&&lab.view.isMyTurn&&!lab.pending)){
      clearInterval(interval);resolve();
     }else if(Date.now()-began>15000){
      clearInterval(interval);reject(Error('MIXED_WAIT_HUMAN_'+arg.game+
       '_'+arg.revision+' '+document.getElementById('notice')?.textContent));
     }
    },100);
   }),{game,revision:v.revision});
   const actual=await player.f.locator('body').evaluate(()=>({
    mode:window.TRUMP_V2_ONLINE_LAB.mode,view:window.TRUMP_V2_ONLINE_LAB.view
   }));
   if(actual.mode==='results')break;
   if(game==='babanuki'){
    const choices=actual.view.legal.drawIndices;
    const index=choices[drawIndex(choices.length)];
    assert.ok(Number.isInteger(index), 'Babanuki human must have a legal draw index');
    await player.f.locator('.v2-backrow button[data-action="draw"]:not([disabled])')
     .nth(index).tap({timeout:9000});
   }else if(game==='shichinarabe'){
    const id=actual.view.legal.playIds[0];
    if(id){
     await player.f.locator('.v2-handcard[data-card="'+id+'"]:not([disabled])').tap({timeout:9000});
     await player.f.locator('.v2-action[data-action="submit"]:not([disabled])').tap({timeout:9000});
    }else{
     assert.equal(actual.view.legal.canPass,true);
     await player.f.locator('.v2-action[data-action="pass"]:not([disabled])').tap({timeout:9000});
    }
   }
   humanMoves++;attempts++;
   await player.f.locator('body').evaluate((body,revision)=>new Promise((resolve,reject)=>{
    const began=Date.now(),interval=setInterval(()=>{
     const lab=window.TRUMP_V2_ONLINE_LAB;
     if(lab.mode==='results'||(lab.view?.revision>revision&&!lab.pending)){
      clearInterval(interval);resolve();
     }else if(Date.now()-began>16000){
      clearInterval(interval);reject(Error('MIXED_HUMAN_ACTION_NOT_SYNCED revision='+revision+
       ' notice='+document.getElementById('notice')?.textContent));
     }
    },100);
   }),actual.view.revision);
  }
  const diagnose=await Promise.all(duel.map(p=>p.f.locator('body').evaluate(()=>{
   const lab=window.TRUMP_V2_ONLINE_LAB;
   return {mode:lab.mode,game:lab.view?.game,revision:lab.view?.revision,
    turn:lab.view?.turn,phase:lab.view?.phase,pending:lab.pending,
    roomPhase:lab.room?.phase,roomMatch:lab.room?.match?.matchId,
    notice:document.getElementById('notice')?.textContent};
  })));
  console.log('V2 MIXED DIAGNOSTICS '+game+' '+engine+' '+JSON.stringify({
   humanMoves,botTurns,attempts,lastRevision,elapsed:Date.now()-start,views:diagnose}));
  assert.ok(humanMoves>0&&botTurns>0,game+' needs active human and CPU turns');
  await duoOwner.f.locator('button[data-action="back-lobby"]').waitFor({timeout:14000});
  await duoFriend.f.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
   const began=Date.now(),interval=setInterval(()=>{
    if(window.TRUMP_V2_ONLINE_LAB.mode==='results'){clearInterval(interval);resolve();}
    else if(Date.now()-began>14000){clearInterval(interval);reject(Error('GUEST_RESULTS_NOT_SYNCED'));}
   },100);
  }));
  await duoOwner.f.locator('button[data-action="back-lobby"]').tap();
  await Promise.all(duel.map(p=>p.f.locator('#shared-code').waitFor({timeout:15000})));
  for(const p of duel){
   assert.ok((await p.f.locator('#shared-code').textContent()).includes(duoRoom),
    game+' must retain the room after finishing');
  }
  console.log('V2 MIXED '+game.toUpperCase()+' FULL UI PASS '+engine+
   ' humanMoves='+humanMoves+' cpuTurnsObserved='+botTurns+
   ' durationMs='+(Date.now()-start));
 }
 await completeNextMixedGame('babanuki');
 await completeNextMixedGame('shichinarabe');

 // Real 2-person Memory match, after the 3 four-seat games in the SAME room.
 // The simulated humans remember cards they have actually seen in the public
 // renderer. They do not inspect the hidden deck or mutate the rule engine.
 await duoOwner.f.locator('button[data-action="game-shinkei"]').tap();
 await Promise.all(duel.map(p=>p.f.locator('button[data-action="ready"]').waitFor({timeout:18000})));
 for(const p of duel){
  await p.f.locator('button[data-action="ready"]').tap();
  await p.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'}).waitFor({timeout:18000});
 }
 await duoOwner.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:18000});
 await Promise.all(duel.map(p=>p.f.locator('.v2-memory').waitFor({timeout:18000})));
 const remembered=new Map(),memoryStarted=Date.now();
 let memoryHumanFlips=0;
 for(let steps=0;steps<220;steps++){
  const hostState=await duoOwner.f.locator('body').evaluate(()=>{
   const lab=window.TRUMP_V2_ONLINE_LAB;
   return {mode:lab.mode,room:lab.room,view:lab.view};
  });
  if(hostState.mode==='results')break;
  const v=hostState.view;
  if(!v||v.game!=='shinkei'){await new Promise(r=>setTimeout(r,140));continue}
  for(const tile of v.board.tiles){
   if(tile.card)remembered.set(tile.index,tile.card.rank);
   if(tile.taken)remembered.delete(tile.index);
  }
  const currentUid=hostState.room.match.participants[v.turn];
  const userIndex=uidList.indexOf(currentUid);
  assert.ok(userIndex>=0,'two real humans are the only Memory players');
  const p=duel[userIndex];
  await p.f.locator('body').evaluate((body,revision)=>new Promise((resolve,reject)=>{
   const begun=Date.now(),id=setInterval(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    if(lab.mode==='results'||(lab.view?.game==='shinkei'&&lab.view.revision>=revision&&
     lab.view.isMyTurn&&!lab.pending)){
     clearInterval(id);resolve();
    }else if(Date.now()-begun>15000){
     clearInterval(id);reject(Error('MEMORY_HUMAN_NOT_READY '+revision));
    }
   },90);
  }),v.revision);
  const state=await p.f.locator('body').evaluate(()=>({
   mode:window.TRUMP_V2_ONLINE_LAB.mode,
   view:window.TRUMP_V2_ONLINE_LAB.view
  }));
  if(state.mode==='results')break;
  const mine=state.view,available=mine.legal.flipIndices;
  assert.ok(available.length,'Memory legal flips must be populated');
  const first=mine.board.tiles.find(x=>x.flipped)?.index;
  let candidate=null;
  if(first!==undefined){
   const rank=remembered.get(first);
   if(rank!==undefined)candidate=available.find(i=>remembered.get(i)===rank);
  }else{
   for(const a of available){
    const r=remembered.get(a);
    if(r!==undefined&&available.some(b=>b!==a&&remembered.get(b)===r)){
     candidate=a;break;
    }
   }
  }
  // Explore face-down cards when no matching revealed pair is known.
  if(candidate===null||candidate===undefined)
   candidate=available.find(i=>!remembered.has(i))??available[0];
  const previous=mine.revision;
  await p.f.locator('.v2-memory button[data-action="flip"][data-index="'+candidate+'"]:not([disabled])')
   .tap({timeout:9000});
  memoryHumanFlips++;
  await p.f.locator('body').evaluate((body,revision)=>new Promise((resolve,reject)=>{
   const begun=Date.now(),id=setInterval(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    if(lab.mode==='results'||(lab.view?.revision>revision&&!lab.pending)){
     clearInterval(id);resolve();
    }else if(Date.now()-begun>16000){
     clearInterval(id);reject(Error('MEMORY_FLIP_NOT_APPLIED '+revision+
      ' notice='+document.getElementById('notice')?.textContent));
    }
   },95);
  }),previous);
 }
 await duoOwner.f.locator('button[data-action="back-lobby"]').waitFor({timeout:13000});
 await duoFriend.f.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
  const begun=Date.now(),id=setInterval(()=>{
   if(window.TRUMP_V2_ONLINE_LAB.mode==='results'){clearInterval(id);resolve();}
   else if(Date.now()-begun>13000){clearInterval(id);reject(Error('MEMORY_FRIEND_NO_RESULTS'))}
  },110);
 }));
 assert.ok(memoryHumanFlips>=24,'entire deck must have been explored');
 await duoOwner.f.locator('button[data-action="back-lobby"]').tap();
 await Promise.all(duel.map(p=>p.f.locator('#shared-code').waitFor({timeout:15000})));
 for(const p of duel)assert.ok((await p.f.locator('#shared-code').textContent()).includes(duoRoom));
 console.log('V2 MEMORY TWO HUMAN FULL UI PASS '+engine+' flipped='+memoryHumanFlips+
  ' durationMs='+(Date.now()-memoryStarted));

 // In a four-person lobby selecting Memory requires choosing exactly two.
 const spectatorHost=await launch();
 await spectatorHost.f.locator('button[data-action="create-room"]').tap();
 await spectatorHost.f.locator('#shared-code').waitFor({timeout:18000});
 const spRoom=(await spectatorHost.f.locator('#shared-code').textContent()).match(/[0-9]{5}/)?.[0];
 const others=[await launch(),await launch(),await launch()];
 for(const guest of others){
  await guest.f.locator('#room-code').fill(spRoom);
  await guest.f.locator('button[data-action="join-room"]').tap();
 }
 await spectatorHost.f.locator('.v2-roster .v2-player').nth(3).waitFor({timeout:25000});
 await spectatorHost.f.locator('button[data-action="game-shinkei"]').tap();
 await spectatorHost.f.locator('button[data-action="memory-opponent-3"]').tap();
 const lineup4=await spectatorHost.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.room.participants);
 const chosenUid=await others[1].f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.uid);
 assert.equal(lineup4.length,2);
 assert.equal(lineup4[1],chosenUid);
 for(const page of [spectatorHost,others[1]]){
  await page.f.locator('button[data-action="ready"]').tap();
  await page.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'}).waitFor({timeout:18000});
 }
 await spectatorHost.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:18000});
 await Promise.all([spectatorHost,others[1]].map(p=>p.f.locator('.v2-memory').waitFor({timeout:18000})));
 await Promise.all([others[0],others[2]].map(p=>p.f.locator('body').evaluate(()=>new Promise((resolve,reject)=>{
  const begun=Date.now(),id=setInterval(()=>{
   if(window.TRUMP_V2_ONLINE_LAB.mode==='spectator'){clearInterval(id);resolve();}
   else if(Date.now()-begun>18000){clearInterval(id);reject(Error('MEMORY_SPECTATOR_NOT_WAITING'))}
  },100);
 }))));
 console.log('V2 MEMORY FOUR ROOM SELECT TWO PASS '+engine+' spectators=2');


 assert.equal(traffic.auth,0,'V2 friends must not use anonymous Firebase Auth');
 assert.deepEqual(errors,[]);
 console.log('V2 ROOM-FIRST NO-AUTH UI PASS '+engine+' four local player IDs + Google Sites sandbox + card touch + synchronized renderer');
}finally{
 for(const p of pages)await p.close();
 await context.close();await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
