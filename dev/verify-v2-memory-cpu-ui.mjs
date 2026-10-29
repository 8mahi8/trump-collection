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
const configuredSchoolDraft=process.env.TC_SITES_CONFIGURED==='1';
const testRoomCollision=process.env.TC_TEST_ROOM_COLLISION==='1';
let collisionInjected=false;
const html=readFileSync(resolve(configuredSchoolDraft?
 'dist/v2-room-first-sites-school-trial.html':'dist/v2-room-first-online-lab.html'),'utf8');
if(configuredSchoolDraft)
 assert.ok(html.includes('window.TRUMP_V2_FIREBASE_CONFIG={"databaseURL":"https://mygame-df915-default-rtdb.firebaseio.com"}'),
  'school candidate must embed intended public RTDB URL');
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
if(configuredSchoolDraft){
 // Do NOT override the injected Firebase URL: exercise the exact offline
 // school trial HTML while routing every external request to LOCAL emulator.
 await context.addInitScript(()=>{window.TRUMP_V2_TEST_SEED=98765;});
}else{
 await context.addInitScript(()=>{
  window.TRUMP_V2_FIREBASE_CONFIG={databaseURL:'https://trump-ci-default-rtdb.firebasedatabase.app'};
  window.TRUMP_V2_TEST_SEED=98765;
 });
}
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
 if(testRoomCollision&&!collisionInjected&&req.method()==='PUT'&&
  /\/trumpRoomsV2\/[0-9]{5}\/lobby\.json$/.test(u.pathname)&&
  req.headers()['if-match']==='null_etag'){
  collisionInjected=true;
  await route.fulfill({status:412,headers:cors,body:'null'});
  return;
 }
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
 const host=await launch();
 await host.f.locator('button[data-action="create-room"]').tap();
 await host.f.locator('#shared-code').waitFor({timeout:18000});
 const room=(await host.f.locator('#shared-code').textContent()).match(/[0-9]{5}/)?.[0];
 assert.match(room,/^[0-9]{5}$/);
 if(testRoomCollision)assert.equal(collisionInjected,true,'first occupied code must be retried');
 await host.f.locator('button[data-action="game-shinkei"]').tap();
 await host.f.locator('.v2-roster .v2-player').filter({hasText:'CPU'}).first()
  .waitFor({timeout:16000});
 const lobby=await host.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.room);
 assert.equal(lobby.members.length,1,'Memory CPU match needs only one real browser user');
 assert.equal(lobby.participants.length,2);
 assert.ok(lobby.participants[1].startsWith('cpu-'));
 await host.f.locator('button[data-action="ready"]').tap();
 await host.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'})
  .waitFor({timeout:15000});
 await host.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:15000});
 await host.f.locator('.v2-memory').waitFor({timeout:18000});
 const first=await host.f.locator('body').evaluate(()=>window.TRUMP_V2_ONLINE_LAB.view);
 assert.equal(first.game,'shinkei');assert.equal(first.players.length,2);
 assert.equal(first.players.filter(p=>p.isCpu).length,1);
 assert.equal(first.board.tiles.length,24);
 assert.equal(first.board.tiles.filter(t=>t.card!==null).length,0,'all deck faces hidden');
 assert.equal(await host.f.locator('.v2-memory .v2-card').count(),24);
 for(const size of [{width:800,height:450},{width:667,height:375}]){
  await host.page.setViewportSize(size);
  await host.f.locator('body').evaluate(()=>{
   const t=document.querySelector('.v2-memory');
   if(!t||t.querySelectorAll('.v2-card').length!==24)throw Error('MEMORY_GRID_INVALID');
   const r=t.getBoundingClientRect(),b=document.querySelector('.v2-board').getBoundingClientRect();
   if(document.documentElement.scrollWidth>innerWidth+3||r.width>b.width+2)
    throw Error('MEMORY_GRID_OVERFLOW');
  });
  await host.page.screenshot({path:resolve('dist/v2-screens',
   'memory-cpu-'+engine+'-'+size.width+'x'+size.height+'.png')});
 }
 const known=new Map();
 let flips=0,cpuRevisions=0,lastRev=first.revision,lastMode='match';
 const began=Date.now();
 while(Date.now()-began<135000&&flips<300){
  const state=await host.f.locator('body').evaluate(()=>{
   const lab=window.TRUMP_V2_ONLINE_LAB;
   return {mode:lab.mode,view:lab.view,room:lab.room,pending:lab.pending,
    notice:document.querySelector('#notice')?.textContent};
  });
  lastMode=state.mode;
  if(state.mode==='results')break;
  const v=state.view;
  if(!v||v.game!=='shinkei'||state.pending){
   await new Promise(r=>setTimeout(r,110));continue;
  }
  for(const tile of v.board.tiles){
   if(tile.taken)known.delete(tile.index);
   else if(tile.card)known.set(tile.index,tile.card.rank);
  }
  if(v.revision>lastRev&&!v.isMyTurn)cpuRevisions+=v.revision-lastRev;
  lastRev=v.revision;
  if(!v.isMyTurn){
   await new Promise(r=>setTimeout(r,140));continue;
  }
  const legal=v.legal.flipIndices;
  assert.ok(legal.length>0,'human must be able to flip');
  const already=v.board.tiles.find(tile=>tile.flipped)?.index;
  let choice;
  if(already!==undefined){
   const rank=known.get(already);
   if(rank!==undefined)choice=legal.find(index=>known.get(index)===rank);
  }else{
   for(const a of legal){
    const rank=known.get(a);
    if(rank!==undefined&&legal.some(b=>b!==a&&known.get(b)===rank)){
     choice=a;break;
    }
   }
  }
  if(choice===undefined)choice=legal.find(i=>!known.has(i))??legal[0];
  await host.f.locator('.v2-memory button[data-action="flip"][data-index="'+choice+'"]:not([disabled])')
   .tap({timeout:8000});
  flips++;
  const old=v.revision;
  await host.f.locator('body').evaluate((body,rev)=>new Promise((resolve,reject)=>{
   const start=Date.now(),id=setInterval(()=>{
    const lab=window.TRUMP_V2_ONLINE_LAB;
    if(lab.mode==='results'||(lab.view?.revision>rev&&!lab.pending)){
     clearInterval(id);resolve();
    }else if(Date.now()-start>15000){
     clearInterval(id);reject(Error('MEMORY_CPU_HUMAN_FLIP_STALLED '+rev+
      ' '+document.querySelector('#notice')?.textContent));
    }
   },100);
  }),old);
 }
 const atEnd=await host.f.locator('body').evaluate(()=>{
  const lab=window.TRUMP_V2_ONLINE_LAB;
  return {mode:lab.mode,room:lab.room,view:lab.view,
   notice:document.querySelector('#notice')?.textContent};
 });
 assert.equal(atEnd.mode,'results','full game must reach results: '+JSON.stringify({
  lastMode,flips,cpuRevisions,elapsed:Date.now()-began,notice:atEnd.notice,
  rev:atEnd.view?.revision,phase:atEnd.room?.phase
 }));
 assert.ok(flips>=8,'human must actually flip cards');
 assert.ok(cpuRevisions>=2,'host CPU must actually take turns');
 await host.f.locator('button[data-action="back-lobby"]').tap();
 await host.f.locator('#shared-code').waitFor({timeout:16000});
 assert.ok((await host.f.locator('#shared-code').textContent()).includes(room));
 assert.equal(traffic.auth,0,'Firebase anonymous sign-in MUST NOT be used');
 assert.deepEqual(errors,[],'no rejected remote traffic or browser errors');
 console.log('V2 MEMORY ONE HUMAN PLUS CPU FULL UI PASS '+engine+
  ' humanFlips='+flips+' cpuRevisionSteps='+cpuRevisions+
  ' durationMs='+(Date.now()-began)+' sameRoom='+room+
  ' configuredDraft='+configuredSchoolDraft+' collisionRetry='+collisionInjected+
  ' traffic='+JSON.stringify(traffic));
}finally{
 for(const page of pages)await page.close();
 await context.close();await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
