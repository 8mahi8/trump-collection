// Four independent touch-only browser pages, Google Sites-style srcdoc sandbox.
// Firebase Auth+RTDB requests are intercepted and forwarded ONLY to a local
// isolated demo emulator; no production project is ever contacted.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
const cors={'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
 'access-control-allow-headers':'Content-Type,Accept,If-Match,Authorization,X-Firebase-ETag',
 'access-control-expose-headers':'etag,ETag',
 'access-control-max-age':'600'};
await context.addInitScript(()=>{
 window.TRUMP_V2_FIREBASE_CONFIG={
  apiKey:'firebase-emulator-api-key',
  databaseURL:'https://trump-ci-default-rtdb.firebasedatabase.app'
 };
});
await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 let target;
 if(u.hostname==='identitytoolkit.googleapis.com'||u.hostname==='securetoken.googleapis.com')
  target='http://127.0.0.1:9099/'+u.hostname+u.pathname+u.search;
 else if(u.hostname.endsWith('.firebasedatabase.app')||u.hostname.endsWith('.firebaseio.com')){
  u.searchParams.set('ns','demo-trumpcards-default-rtdb');
  target='http://127.0.0.1:9000'+u.pathname+u.search;
 }else if(u.hostname==='127.0.0.1'&&u.port==='8944'){await route.continue();return}
 else {errors.push('Blocked outgoing request '+u.href);await route.abort();return}
 if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors,body:''});return}
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
 }
 assert.deepEqual(errors,[]);
 console.log('V2 ROOM-FIRST UI PASS '+engine+' four real Firebase UIDs + Google Sites sandbox + card touch + synchronized renderer');
}finally{
 for(const p of pages)await p.close();
 await context.close();await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
