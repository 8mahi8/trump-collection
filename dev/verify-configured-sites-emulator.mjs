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
const requestedGame=process.env.TC_SITES_GAME||'babanuki';
if(!['babanuki','shichinarabe','daifugo'].includes(requestedGame))throw Error('INVALID_SITES_GAME');
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
 await sites.locator('[data-game="'+requestedGame+'"]').click();
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
 // Exercise the actual touch-driven move UI, not only the room protocol.
 // The first turn is selected from authoritative room state (UIDs are sorted).
 const info=await host.game.locator('#state').textContent();
 assert.ok(info.includes({babanuki:'ババ抜き',shichinarabe:'七並べ',daifugo:'大富豪'}[requestedGame]),
  'launcher must open the selected game');
 const before=await host.game.evaluate(()=>window.TCFourRemote.view.revision);
 const turn=await host.game.evaluate(()=>window.TCFourRemote.view.turn);
 const acting=async()=>{
  for(const p of players){
   const seat=await p.game.evaluate(()=>window.TCFourRemote.seat);
   if(seat===turn)return p;
  }
  throw Error('NO_ACTIVE_SEAT');
 };
 const player=await acting();
 await player.game.locator('#state').filter({hasText:'あなたの番'}).waitFor({timeout:22000});
 const hand=player.game.locator('#hand .hand-cards button.card');
 const state=await player.game.evaluate(()=>({
  view:window.TCFourRemote.view,privateView:window.TCFourRemote.privateView
 }));
 const cardId=c=>c.joker?'JK':c.suit+'-'+c.rank;
 if(requestedGame==='babanuki'){
  await player.game.locator('#board button.card.back').first().click({timeout:12000});
 }else if(requestedGame==='shichinarabe'){
  const legal=state.privateView?.legalIds||[];
  if(legal.length){
   const i=state.privateView.hand.findIndex(c=>cardId(c)===legal[0]);
   assert.ok(i>=0,'legal 7s card must exist in own hand');
   await hand.nth(i).click({timeout:12000});
   const confirm=player.game.locator('#actions button').filter({hasText:'選択カードを出す'});
   assert.equal(await confirm.isDisabled(),false,'card is selected, submit button enabled');
   assert.equal(await player.game.evaluate(()=>window.TCFourRemote.view.revision),before,
    'touching the card alone must NOT submit the move');
   await confirm.click({timeout:12000});
  }else await player.game.locator('#actions button').filter({hasText:'パス'}).click();
 }else{
  const moves=state.privateView?.legalMoves||[];
  if(moves.length){
   for(const id of moves[0]){
    const i=state.privateView.hand.findIndex(c=>cardId(c)===id);
    assert.ok(i>=0,'legal daifugo card must exist in own hand');
    await hand.nth(i).click({timeout:12000});
   }
   const confirm=player.game.locator('#actions button').filter({hasText:'選択カードを出す'});
   assert.equal(await confirm.isDisabled(),false,'legal daifugo combination accepted');
   assert.equal(await player.game.evaluate(()=>window.TCFourRemote.view.revision),before,
    'selecting a hand must NOT submit the move');
   await confirm.click({timeout:12000});
  }else{
   assert.ok(state.view.field,'cannot pass empty Daifugo field without a move');
   await player.game.locator('#actions button').filter({hasText:'パス'}).click();
  }
 }
 await Promise.all(players.map(p=>p.game.locator('#state').filter({hasText:'通信 OK'}).waitFor({timeout:22000})));
 // Revision must propagate to every client, including players not on turn.
 await Promise.all(players.map(async p=>{
  await p.game.locator('#state').waitFor({state:'visible',timeout:22000});
  const deadline=Date.now()+22000;
  while(Date.now()<deadline){
   if(await p.game.evaluate(rev=>window.TCFourRemote?.view?.revision>rev,before))return;
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('MOVE_NOT_SYNCED_TO_EVERY_SEAT '+requestedGame);
 }));
 // Assert screen has no horizontal overflow at school iPad landscape viewport.
 for(const p of players){
  const layout=await p.game.locator('body').evaluate(()=>{
   const w=document.documentElement.clientWidth;
   return {width:w,scrollWidth:document.documentElement.scrollWidth,hand:document.querySelector('#hand')?.querySelectorAll('button.card').length};
  });
  assert.ok(layout.scrollWidth<=layout.width+3,
   requestedGame+' horizontal overflow on old school-iPad-like viewport: '+JSON.stringify(layout));
 }
 await host.game.locator('#chatToggle').click();
 await players[1].game.locator('#chatToggle').click();
 await host.game.locator('#chatInput').fill('Google Sites内の4人チャット');
 await host.game.locator('#chatSend').click();
 await players[1].game.locator('#chatList').getByText('Google Sites内の4人チャット').waitFor({timeout:15000});
 await host.sites.locator('#back').click();
 await Promise.all(players.slice(1).map(p=>p.game.locator('#lobby').waitFor({state:'hidden',timeout:25000})));
 assert.deepEqual(errors,[]);
 console.log((openRootTrial?'OPEN-ROOT FRIEND TRIAL':'CONFIGURED SITES FIREBASE')+
  ' EMULATOR PASS ['+engine+']: '+requestedGame+', nested sandbox, four seats, READY, first UI move synced, chat, graceful host exit');
}finally{
 for(const page of pages)await page.close();
 await context.close();await browser.close();server.close();
}
