// Exercise the exact release-config injection in a Google Sites-like nested
// sandbox with four independent devices. ALL external Firebase URLs are
// intercepted and forwarded to local emulators, never to production services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {chromium,webkit} from 'playwright';
import {planOpenRootMigration} from './plan-open-root-migration.mjs';
import {buildConfiguredSitesHtml,buildOpenRootTrialSitesHtml} from './build-configured-sites.mjs';

const engine=process.env.TC_BROWSER_ENGINE||'chromium';
const openRootTrial=process.env.TC_OPEN_ROOT_TRIAL==='1';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_ENGINE');
const sample=JSON.parse(readFileSync(new URL('../tests/fixtures/owner-reported-open-root.example.rules.json',import.meta.url),'utf8'));
const trump=JSON.parse(readFileSync(new URL('../firebase/trump-rooms.rules.json',import.meta.url),'utf8'));
const scoped=planOpenRootMigration(sample,trump,
 ['rooms','rooms2v2','shokokuRooms1v1','lemonClashRoomsV1'],
 {legacyExpiryDate:'2026-12-08'}).combinedRules;
const config={projectId:'mygame-df915',apiKey:'firebase-emulator-api-key',
 databaseURL:'https://mygame-df915-default-rtdb.firebaseio.com'};
const configured=openRootTrial
 ?buildOpenRootTrialSitesHtml({databaseURL:config.databaseURL,acknowledgePublicData:true})
 :buildConfiguredSitesHtml({config,reviewedRules:scoped});
const wrapper=`<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0"><iframe id="sites-embed" sandbox="allow-scripts allow-forms"
style="border:0;width:100vw;height:100vh"></iframe>
<script>document.getElementById('sites-embed').srcdoc=${JSON.stringify(configured).replace(/</g,'\\u003c')};</`+'script></body></html>';
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(wrapper);
});
await new Promise((resolve,reject)=>server.listen(8893,'127.0.0.1',e=>e?reject(e):resolve()));
const browserType=engine==='webkit'?webkit:chromium;
const browser=await browserType.launch(engine==='chromium'?{headless:true,args:['--no-sandbox']}:{headless:true});
const context=await browser.newContext({viewport:{width:800,height:450}});
const errors=[],pages=[];
function cors(){
 return {'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type,Accept,If-Match,Authorization',
  'Access-Control-Max-Age':'600'};
}
await context.route('**/*',async route=>{
 const req=route.request(),u=new URL(req.url());
 let target;
 if(u.hostname==='identitytoolkit.googleapis.com'||u.hostname==='securetoken.googleapis.com'){
  if(openRootTrial)errors.push('Trial made an unexpected auth request: '+u.hostname);
  target='http://127.0.0.1:9099/'+u.hostname+u.pathname+u.search;
 }else if(u.hostname.endsWith('.firebasedatabase.app')||u.hostname.endsWith('.firebaseio.com')){
  if(openRootTrial&&u.searchParams.has('auth'))errors.push('Trial must not send Firebase Auth token');
  u.searchParams.set('ns','demo-trumpcards-default-rtdb');
  target='http://127.0.0.1:9000'+u.pathname+u.search;
 }else if(u.hostname==='127.0.0.1'&&u.port==='8893'){
  await route.continue();return;
 }else{
  errors.push('Unexpected external URL: '+u.href);
  await route.abort();return;
 }
 if(req.method()==='OPTIONS'){
  await route.fulfill({status:204,headers:cors(),body:''});return;
 }
 try{
  const body=req.postData()||undefined;
  const rawHeaders=req.headers();
  const headers={};
  for(const key of ['content-type','accept','if-match']){
   if(rawHeaders[key])headers[key]=rawHeaders[key];
  }
  const fetched=await fetch(target,{method:req.method(),headers,body});
  await route.fulfill({status:fetched.status,
   headers:{...cors(),'Content-Type':'application/json'},
   body:await fetched.text()});
 }catch(e){errors.push('Local emulator proxy: '+String(e));await route.abort();}
});
async function launch(){
 const page=await context.newPage();pages.push(page);
 page.on('pageerror',e=>errors.push('page error '+e.message));
 await page.goto('http://127.0.0.1:8893/');
 const sites=page.frameLocator('#sites-embed');
 await sites.locator('[data-game="babanuki"]').click();
 await sites.locator('#friends').click();
 const game=sites.frameLocator('#play');
 await game.locator('#create').waitFor({timeout:15000});
 return {page,sites,game};
}
try{
 const players=[];
 const host=await launch();players.push(host);
 await host.game.locator('#create').click();
 await host.game.locator('#lobby').waitFor({state:'visible',timeout:22000});
 // Lobby visibility happens before the next Firebase poll populates the code.
 await host.game.locator('#roomCode').filter({hasText:/^[0-9]{5}$/}).waitFor({timeout:22000});
 const room=await host.game.locator('#roomCode').textContent();
 assert.match(room,/^[0-9]{5}$/);
 for(let i=1;i<4;i++){
  const guest=await launch();players.push(guest);
  await guest.game.locator('#code').fill(room);
  await guest.game.locator('#join').click();
 }
 await Promise.all(players.map(p=>p.game.locator('#roster').filter({hasText:'4/4人'}).waitFor({timeout:22000})));
 // Give each authenticated command time to be accepted by the host and
 // reflected back to its own seat; do not submit four stale-revision actions.
 for(const p of players){
  await p.game.locator('#ready').click();
  await p.game.locator('#ready').filter({hasText:'準備を解除'}).waitFor({timeout:22000});
  await p.game.locator('#ready:not([disabled])').waitFor({timeout:22000});
 }
 await host.game.locator('#start:not([disabled])').click({timeout:22000});
 await Promise.all(players.map(p=>p.game.locator('#match').waitFor({state:'visible',timeout:22000})));
 await host.game.locator('#chatToggle').click();
 await players[1].game.locator('#chatToggle').click();
 await host.game.locator('#chatInput').fill('Google Sites内の4人チャット');
 await host.game.locator('#chatSend').click();
 await players[1].game.locator('#chatList').getByText('Google Sites内の4人チャット').waitFor({timeout:15000});
 await host.sites.locator('#back').click();
 await Promise.all(players.slice(1).map(p=>p.game.locator('#lobby').waitFor({state:'hidden',timeout:25000})));
 assert.deepEqual(errors,[]);
 console.log((openRootTrial?'OPEN-ROOT FRIEND TRIAL':'CONFIGURED SITES FIREBASE')+
  ' EMULATOR PASS ['+engine+']: nested sandbox, four seats, READY, chat, graceful host exit');
}finally{
 for(const page of pages)await page.close();
 await context.close();await browser.close();server.close();
}
