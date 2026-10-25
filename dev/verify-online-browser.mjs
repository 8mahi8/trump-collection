// Chromium smoke checks for the standalone Google Sites-ready online lab.
// Optional TC_BROWSER_EMULATOR=1 exercises 4 independent Chromium pages
// against Firebase Local Auth/RTDB emulators using localhost-only test fetch.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const html=readFileSync(resolve('dist/trump-collection-online-lab.html'),'utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(html);
});
await new Promise((resolve,reject)=>server.listen(8765,'127.0.0.1',error=>error?reject(error):resolve()));
const errors=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const testPages=[];
const URL='http://127.0.0.1:8765/';
const emulator=process.env.TC_BROWSER_EMULATOR==='1';
const setup=async(viewport={width:850,height:560})=>{
 const context=await browser.newContext({viewport});
 if(emulator){
  await context.addInitScript(()=>{
   window.TRUMP_FIREBASE_CONFIG={
    apiKey:'firebase-emulator-api-key',
    databaseURL:'https://trump-ci-default-rtdb.firebasedatabase.app'
   };
   window.TRUMP_FIREBASE_TEST_FETCH=(raw,options)=>{
    const url=new URL(raw);
    if(url.hostname==='identitytoolkit.googleapis.com'||url.hostname==='securetoken.googleapis.com'){
     const path=url.hostname+url.pathname;
     url.protocol='http:';url.hostname='127.0.0.1';url.port='9099';url.pathname='/'+path;
    }else if(url.hostname.endsWith('.firebasedatabase.app')){
     url.protocol='http:';url.hostname='127.0.0.1';url.port='9000';url.searchParams.set('ns','demo-trumpcards-default-rtdb');
    }else throw Error('Unexpected external endpoint: '+url.hostname);
    return fetch(url.href,options);
   };
  });
 }
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(URL);
 await page.locator('#create').waitFor();
 testPages.push(page);
 return page;
};
try{
 const page=await setup({width:800,height:450});
 assert.match(await page.title(),/Firebase/);
 assert.ok(await page.locator('select#game').count());
 assert.ok(await page.locator('button#ready').count());
 assert.ok(await page.locator('button#rematch').count());
 assert.ok(await page.locator('button#leave').count());
 if(!emulator){
  await page.locator('#create').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Firebase接続先が未設定'));
  assert.equal(await page.locator('#create').isDisabled(),false);
  console.log('BROWSER SMOKE PASS: 800×450 UI + missing-config guard');
 }else{
  for(const game of ['babanuki','shichinarabe','daifugo']){
   const owner=game==='babanuki'?page:await setup();
   const participants=[owner];
   await owner.locator('#game').selectOption(game);
   await owner.locator('#create').click();
   await owner.waitForFunction(()=>window.TCFourRemote?.view?.seats?.length===4,null,{timeout:20000});
   const code=await owner.locator('#roomCode').textContent();
   assert.match(code,/^\d{5}$/);
   for(let i=1;i<4;i++){
    const guest=await setup();
    participants.push(guest);
    await guest.locator('#code').fill(code);
    await guest.locator('#join').click();
   }
   await Promise.all(participants.map(p=>p.waitForFunction(()=>window.TCFourRemote?.seat>=0,null,{timeout:20000})));
   const seats=await Promise.all(participants.map(p=>p.evaluate(()=>TCFourRemote.seat)));
   assert.deepEqual([...seats].sort(),[0,1,2,3]);
   for(const p of participants){
    await p.locator('#ready').click();
    await p.waitForFunction(()=>!document.getElementById('ready').disabled,null,{timeout:20000});
   }
   await owner.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:20000});
   await owner.locator('#start').click();
   await owner.waitForFunction(()=>TCFourRemote.phase==='playing',null,{timeout:20000});
   const view=await owner.evaluate(()=>TCFourRemote.view);
   const actor=participants[seats.indexOf(view.turn)];
   await actor.waitForFunction(()=>TCFourRemote.phase==='playing'&&TCFourRemote.view.turn===TCFourRemote.seat,null,{timeout:20000});
   const before=view.revision,priv=await actor.evaluate(()=>TCFourRemote.privateView);
   if(game==='babanuki'){
    await actor.locator('#board button.card.back').first().click();
   }else if(game==='shichinarabe'){
    if(priv.legalIds?.length)await actor.locator('.hand-cards button:not([disabled])').first().click();
    else await actor.locator('#actions button').filter({hasText:'パス'}).click();
   }else{
    const moves=priv.legalMoves||[];
    if(moves.length){
     await actor.evaluate(ids=>{
      const hand=TCFourRemote.privateView.hand;
      for(const id of ids){
       const n=hand.findIndex(c=>(c.joker?'JK':c.suit+'-'+c.rank)===id);
       if(n<0)throw Error('Missing card: '+id);
       document.querySelectorAll('.hand-cards button.card')[n].click();
      }
     },moves[0]);
     await actor.locator('#actions button').filter({hasText:'選択カードを出す'}).click();
    }else await actor.locator('#actions button').filter({hasText:'パス'}).click();
   }
   await Promise.all(participants.map(p=>p.waitForFunction(
     rev=>TCFourRemote.view.revision>rev,before,{timeout:20000})));
   console.log('FIREBASE EMULATOR BROWSER PASS:',game,'4 pages, unique seats, READY, first synced move');
   if(game==='babanuki'){
    // Simulate host connectivity loss while all guest pages stay online.
    await owner.route('**/heartbeat.json*',route=>
      route.request().method()==='PUT'?route.abort('failed'):route.continue());
    const guest=participants[1];
    await guest.waitForFunction(
      ()=>TCFourRemote.status.includes('ホストの応答が止まっています'),null,{timeout:35000});
    await owner.unroute('**/heartbeat.json*');
    await guest.waitForFunction(
      ()=>TCFourRemote.status.includes('通信が復旧したよ'),null,{timeout:25000});
    console.log('FIREBASE EMULATOR BROWSER PASS: host network interruption freezes guests then resumes');
   }
   // A friend or host quits; the remaining pages return to the simple room menu.
   const quitter=game==='babanuki'?owner:participants[1];
   await quitter.locator('#leave').click();
   await quitter.waitForFunction(
     ()=>document.getElementById('lobby').hidden&&
          !document.getElementById('create').disabled,null,{timeout:20000});
   const others=participants.filter(p=>p!==quitter);
   await Promise.all(others.map(p=>p.waitForFunction(
     ()=>document.getElementById('lobby').hidden&&
          document.getElementById('status').textContent.includes('部屋'),
     null,{timeout:25000})));
   for(const p of others)assert.equal(await p.locator('#create').isDisabled(),false);
   console.log('FIREBASE EMULATOR BROWSER PASS:',game,
     'friend/host leaves, all browsers return to create/join menu');
  }
 }
 if(errors.length)throw Error('Uncaught browser errors:\n'+errors.join('\n'));
}finally{
 for(const p of testPages)await p.context().close();
 await browser.close();server.close();
}
