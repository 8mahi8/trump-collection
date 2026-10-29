// School trial RELEASE artifact test, not the development build.
// The real configured Firebase URL is intercepted BEFORE all requests.
// No traffic is permitted to the real database, identitytoolkit or other hosts.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {chromium,webkit} from 'playwright';
const engine=process.env.TC_BROWSER_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_BROWSER_ENGINE');
const school=readFileSync(resolve('dist/v2-room-first-sites-school-trial.html'),'utf8');
const live='https://mygame-df915-default-rtdb.firebaseio.com';
assert.ok(school.includes('"databaseURL":"'+live+'"'));
assert.ok(!/<iframe\b|<script\b[^>]+src=|<link\b[^>]+stylesheet/i.test(school));
const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const wrapper='<!doctype html><html lang="ja"><head><meta name="viewport" '+
 'content="width=device-width,initial-scale=1"></head><body style="margin:0">'+
 '<iframe id="sites" sandbox="allow-scripts allow-forms" '+
 'style="border:0;width:100vw;height:100vh" srcdoc="'+escape(school)+'"></iframe></body></html>';
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(wrapper);
});
await new Promise((ok,no)=>server.listen(8945,'127.0.0.1',e=>e?no(e):ok()));
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});
const ctx=await browser.newContext({viewport:{width:667,height:300},hasTouch:true});
const mistakes=[],traffic={publicDb:0,emulator:0,auth:0},pages=[];
mkdirSync(resolve('dist/v2-screens'),{recursive:true});
const cors={'access-control-allow-origin':'*','access-control-allow-headers':
 'Content-Type,Accept,If-Match,Authorization,X-Firebase-ETag',
 'access-control-allow-methods':'GET,PUT,POST,PATCH,DELETE,OPTIONS',
 'access-control-expose-headers':'etag,ETag'};
await ctx.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.hostname==='127.0.0.1'&&u.port==='8945'){await route.continue();return}
 if(u.hostname==='identitytoolkit.googleapis.com'||u.hostname==='securetoken.googleapis.com'){
  traffic.auth++;mistakes.push('AUTH_API_CALLED');await route.abort();return;
 }
 if(!u.hostname.endsWith('.firebaseio.com')&&!u.hostname.endsWith('.firebasedatabase.app')){
  mistakes.push('UNEXPECTED_OUTBOUND_HOST '+u.hostname);await route.abort();return;
 }
 if(u.searchParams.has('auth')){mistakes.push('SECRET_AUTH_QUERY');await route.abort();return}
 // We recognize the REAL configured address and route ALL actions to emulator.
 // The only network request ever made is node-fetch against local 127.0.0.1:9000.
 traffic.publicDb++;
 u.searchParams.set('ns','demo-trumpcards-default-rtdb');
 const target='http://127.0.0.1:9000'+u.pathname+u.search;
 if(req.method()==='OPTIONS'){
  await route.fulfill({status:204,headers:cors,body:''});return;
 }
 try{
  const reqHeaders=req.headers(),headers={};
  for(const name of ['content-type','accept','if-match','x-firebase-etag'])
   if(reqHeaders[name])headers[name]=reqHeaders[name];
  const response=await fetch(target,{method:req.method(),headers,
   body:req.postData()||undefined});
  traffic.emulator++;
  await route.fulfill({status:response.status,
   headers:{...cors,'content-type':'application/json',
    ...(response.headers.get('etag')?{etag:response.headers.get('etag')}:{})},
   body:await response.text()});
 }catch(e){mistakes.push('EMULATOR_ERROR '+String(e));await route.abort()}
});
async function open(){
 const page=await ctx.newPage();
 page.on('pageerror',e=>mistakes.push('PAGE '+e.message));
 pages.push(page);await page.goto('http://127.0.0.1:8945/');
 const frame=page.frameLocator('#sites');
 await frame.locator('button[data-action="friends"]').tap();
 await frame.locator('button[data-action="create-room"]').waitFor();
 return {page,f:frame};
}
try{
 const host=await open();
 await host.f.locator('button[data-action="create-room"]').tap();
 await host.f.locator('#shared-code').waitFor({timeout:22000});
 const room=(await host.f.locator('#shared-code').textContent()).match(/[0-9]{5}/)?.[0];
 assert.match(room,/^\d{5}$/);
 const gameActions=await host.f.locator('.v2-game-picker button').evaluateAll(
  buttons=>buttons.map(b=>b.dataset.action));
 assert.deepEqual(gameActions,['game-babanuki','game-shichinarabe',
  'game-shinkei','game-daifugo'],'School HTML must expose exactly four games');
 assert.equal(await host.f.locator('button[data-action="game-highcard"]').count(),0);
 await host.f.locator('button[data-action="game-shinkei"]').tap();
 // No two-seat opponent selection is necessary for only 1-2 people.
 const guest=await open();
 await guest.f.locator('#room-code').fill(room);
 await guest.f.locator('button[data-action="join-room"]').tap();
 await host.f.locator('.v2-roster .v2-player').nth(1).waitFor({timeout:22000});
 for(const p of [host,guest]){
  await p.f.locator('button[data-action="ready"]').waitFor({timeout:20000});
 }
 // Check short school embed geometry AFTER a second player joins.
 const geometry=await host.f.locator('.v2-room-lobby').evaluate(lobby=>{
  const box=lobby.getBoundingClientRect();
  const controls=[...lobby.querySelectorAll('.v2-room-actions > button')];
  const exit=lobby.querySelector('button[data-action="leave-room"]').getBoundingClientRect();
  return {buttons:controls.length,
   heights:controls.map(b=>b.getBoundingClientRect().height),
   left:exit.left,right:exit.right,top:exit.top,bottom:exit.bottom,
   lobbyBottom:box.bottom,lobbyTop:box.top};
 });
 assert.ok(geometry.heights.every(h=>h>=43.5)&&
  geometry.bottom<=geometry.lobbyBottom+1&&geometry.top>=geometry.lobbyTop-1,
  'SCHOOL_LOBBY_BUTTONS_CLIPPED '+JSON.stringify(geometry));
 await host.page.screenshot({path:resolve('dist/v2-screens',
  'school-four-game-lobby-'+engine+'-667x300.png')});
 for(const p of [host,guest]){
  await p.f.locator('button[data-action="ready"]').tap();
  await p.f.locator('button[data-action="ready"]').filter({hasText:'準備を解除'})
   .waitFor({timeout:20000});
 }
 await host.f.locator('button[data-action="start"]:not([disabled])').tap({timeout:16000});
 await Promise.all([host,guest].map(p=>
  p.f.locator('.v2-memory').waitFor({timeout:25000})));
 // Both players get their OWN private view, but neither sees the deck.
 for(const p of [host,guest]){
  const state=await p.f.locator('body').evaluate(()=>{
   const lab=window.TRUMP_V2_ONLINE_LAB,v=lab.view;
   return {mode:lab.mode,game:v?.game,players:v?.players?.length,
    hand:v?.hand?.length};
  });
  assert.deepEqual(state,{mode:'match',game:'shinkei',players:2,hand:0});
 }
 assert.equal(traffic.auth,0);
 assert.ok(traffic.emulator>3,'Room must actually use Firebase emulator');
 assert.deepEqual(mistakes,[]);
 console.log('SCHOOL_FOUR_GAME_GOOGLE_SITES_EMBED_PASS '+engine+
  ' games=4 room='+room+' members=2 memoryStarted=true'+
  ' emulatorRequests='+traffic.emulator+' productionRequests=0 noAuth=true');
}finally{
 await Promise.all(pages.map(p=>p.close().catch(()=>{})));
 await ctx.close();await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
