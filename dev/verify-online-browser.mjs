// Chromium smoke checks for the standalone Google Sites-ready online lab.
// Optional TC_BROWSER_EMULATOR=1 exercises 4 independent Chromium pages
// against Firebase Local Auth/RTDB emulators using localhost-only test fetch.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {chromium,webkit} from 'playwright';
const engine=process.env.TC_BROWSER_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_BROWSER_ENGINE: '+engine);
const browserType=engine==='webkit'?webkit:chromium;

const html=readFileSync(resolve('dist/trump-collection-online-lab.html'),'utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(html);
});
await new Promise((resolve,reject)=>server.listen(8765,'127.0.0.1',error=>error?reject(error):resolve()));
const errors=[];
const browser=await browserType.launch(engine==='chromium'?{headless:true,args:['--no-sandbox']}:{headless:true});
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
 assert.ok(await page.locator('button#chatToggle').count());
 assert.equal(await page.locator('#chatPanel').isVisible(),false);
 if(!emulator){
  await page.locator('#create').click();
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Firebase接続先が未設定'));
  assert.equal(await page.locator('#create').isDisabled(),false);
  console.log('BROWSER SMOKE PASS ['+engine+']: 800×450 UI + missing-config guard');
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
   if(game==='babanuki'){
    // Chat is a room-scoped independent interaction, not a turn/action.
    await owner.locator('#chatToggle').click();
    await owner.locator('#chatInput').fill('<img src=x onerror=alert(1)> こんにちは');
    await owner.locator('#chatSend').click();
    await participants[1].locator('#chatToggle').click();
    await participants[1].locator('#chatList').getByText('<img src=x onerror=alert(1)> こんにちは',{exact:false}).waitFor({timeout:18000});
    assert.equal(await participants[1].locator('#chatList img').count(),0,'chat must render as text, not HTML');
    assert.equal(await owner.locator('#chatInput').inputValue(),'');
    await owner.locator('#chatClose').click();
    await participants[1].locator('#chatClose').click();
    console.log('FIREBASE EMULATOR CHAT UI ['+engine+']: remote peer received escaped room message');
   }
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
    if(priv.legalIds?.length){
     // Regression: tapping a card selects it; only the confirmation button plays it.
     await actor.evaluate(id=>{
      const hand=TCFourRemote.privateView.hand;
      const n=hand.findIndex(c=>(c.joker?'JK':c.suit+'-'+c.rank)===id);
      if(n<0)throw Error('Missing legal card: '+id);
      document.querySelectorAll('.hand-cards button.card')[n].click();
     },priv.legalIds[0]);
     const confirm=actor.locator('#actions button').filter({hasText:'選択カードを出す'});
     assert.equal(await confirm.isDisabled(),false);
     await actor.waitForTimeout(250);
     assert.equal(await actor.evaluate(()=>TCFourRemote.view.revision),before,
      'Seven must not advance from card selection alone');
     await confirm.click();
    }else await actor.locator('#actions button').filter({hasText:'パス'}).click();
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
   console.log('FIREBASE EMULATOR BROWSER PASS ['+engine+']:',game,'4 pages, unique seats, READY, first synced move');
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
   if(game==='babanuki'||game==='shichinarabe'){
    // Exercise the same cross-frame leave message used by Google Sites Back.
    // This top-level harness posts to self; in the collection the parent
    // frame posts the identical message to its sandboxed game child.
    await quitter.evaluate(()=>new Promise((resolve,reject)=>{
     const requestId='back-123';
     const timeout=setTimeout(()=>{window.removeEventListener('message',onReply);reject(Error('NO_LEAVE_ACK'));},12000);
     const onReply=event=>{
      if(event.data?.type!=='tc:leave-ack'||event.data.requestId!==requestId)return;
      clearTimeout(timeout);window.removeEventListener('message',onReply);resolve();
     };
     window.addEventListener('message',onReply);
     window.postMessage({type:'tc:leave-room',requestId},'*');
    }));
   }else await quitter.locator('#leave').click();
   await quitter.waitForFunction(
     ()=>document.getElementById('lobby').hidden&&
          !document.getElementById('create').disabled,null,{timeout:20000});
   const others=participants.filter(p=>p!==quitter);
   await Promise.all(others.map(p=>p.waitForFunction(
     ()=>document.getElementById('lobby').hidden&&
          document.getElementById('status').textContent.includes('部屋'),
     null,{timeout:25000})));
   for(const p of others)assert.equal(await p.locator('#create').isDisabled(),false);
   console.log('FIREBASE EMULATOR BROWSER PASS ['+engine+']:',game,
     'friend/host leaves, all browsers return to create/join menu');
  }
 }
 if(errors.length)throw Error('Uncaught browser errors:\n'+errors.join('\n'));
}finally{
 for(const p of testPages)await p.context().close();
 await browser.close();server.close();
}
