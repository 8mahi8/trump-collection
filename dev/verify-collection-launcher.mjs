// Smoke test the combined four-game COM/Friends launcher in a real browser.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium,webkit} from 'playwright';
const engine=process.env.TC_BROWSER_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_BROWSER_ENGINE: '+engine);
const browserType=engine==='webkit'?webkit:chromium;
import {buildCollectionLabHtml} from './build-collection-lab.mjs';

const labHtml=buildCollectionLabHtml();
const sitesWrapper=`<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}
iframe{width:100%;height:100%;border:0}</style></head><body>
<iframe id="sites-embed" title="Google Sites mock" sandbox="allow-scripts allow-forms"></iframe>
<script>document.getElementById('sites-embed').srcdoc=${JSON.stringify(labHtml).replace(/</g,'\\u003c')};</`+`script></body></html>`;
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/sites-wrapper'?sitesWrapper:labHtml);
});
await new Promise((resolve,reject)=>server.listen(8877,'127.0.0.1',err=>err?reject(err):resolve()));
const browser=await browserType.launch(engine==='chromium'?{headless:true,args:['--no-sandbox']}:{headless:true});
const page=await browser.newPage({viewport:{width:800,height:450}});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
try{
 await page.goto('http://127.0.0.1:8877');
 await page.locator('#choices .game').first().waitFor();
 const games=['babanuki','shichinarabe','shinkei','daifugo'];
 const names=['ババ抜き','七並べ','神経衰弱','大富豪'];
 for(let i=0;i<games.length;i++){
  await page.locator('[data-game="'+games[i]+'"]').click();
  assert.equal(await page.locator('#selection').innerText(),names[i]);
  await page.locator('#com').click();
  await page.waitForFunction(()=>window.TCCollectionLab?.openMode==='com');
  const frame=page.frameLocator('#play');
  await frame.locator('#gameScreen:not(.hidden)').waitFor({timeout:12000});
  // Memory Match and Daifugo correctly show their original settings modal.
  if(games[i]==='shinkei'||games[i]==='daifugo'){
   await frame.locator('#mStart').waitFor({timeout:12000});
   await frame.locator('#mStart').click();
  }
  await frame.locator('#gameTitle').getByText(names[i],{exact:true}).waitFor({timeout:12000});
  await page.locator('#back').click();
  await page.waitForFunction(()=>window.TCCollectionLab?.openMode===null);
 }
 console.log('COLLECTION BROWSER ['+engine+']: all 4 COM entry points pass');
 for(let i=0;i<games.length;i++){
  await page.locator('[data-game="'+games[i]+'"]').click();
  await page.locator('#friends').click();
  await page.waitForFunction(()=>window.TCCollectionLab?.openMode==='friends');
  const frame=page.frameLocator('#play');
  if(games[i]==='shinkei'){
   await frame.locator('#connect #create').waitFor({timeout:12000});
   assert.match(await frame.locator('header h1').innerText(),/神経衰弱/);
  }else{
   await frame.locator('#create').waitFor({timeout:12000});
   assert.equal(await frame.locator('#game').inputValue(),games[i]);
   // No production Firebase config is embedded; block accidental connections.
   await frame.locator('#create').click();
   await frame.locator('#status').getByText('Firebase接続先が未設定',{exact:false}).waitFor({timeout:12000});
  }
  await page.locator('#back').click();
  await page.waitForFunction(()=>window.TCCollectionLab?.openMode===null);
 }
 console.log('COLLECTION BROWSER ['+engine+']: all 4 friends entry points pass (Supabase memory trial; Firebase config guarded)');

 // Google Sites embeds custom HTML in a sandboxed iframe. Inside the collection
 // is a second srcdoc iframe, which can be cross-origin to its parent.
 // This must never silently launch Babanuki when Seven/Daifugo was selected.
 const sitesPage=await browser.newPage({viewport:{width:800,height:450}});
 sitesPage.on('pageerror',err=>errors.push('Google Sites sandbox: '+err.message));
 // Intercept the Memory Match Supabase socket in Playwright: no production
 // Supabase connection or room traffic is allowed in these browser tests.
 const memoryPackets=[],memorySockets=[];
 await sitesPage.routeWebSocket('**/realtime/v1/websocket**',socket=>{
  const remote={socket,topic:''};
  memorySockets.push(remote);
  socket.onMessage(raw=>{
   let packet;
   try{packet=JSON.parse(raw);}catch{return;}
   if(packet.event==='phx_join'){
    remote.topic=packet.topic;
    socket.send(JSON.stringify({topic:packet.topic,event:'phx_reply',ref:packet.ref,payload:{status:'ok'}}));
   }
   if(packet.event==='heartbeat')
    socket.send(JSON.stringify({topic:'phoenix',event:'phx_reply',ref:packet.ref,payload:{status:'ok'}}));
   if(packet.event==='broadcast')memoryPackets.push(packet.payload?.payload);
  });
 });
 try{
  await sitesPage.goto('http://127.0.0.1:8877/sites-wrapper');
  const sites=sitesPage.frameLocator('#sites-embed');
  await sites.locator('#choices').waitFor({timeout:12000});
  // Record child acknowledgements before Back destroys the iframe.
  // An ACK proves the launcher waited for the room-exit handshake.
  await sites.locator('#choices').evaluate(()=>{
   window.__returnAcks=0;
   window.addEventListener('message',e=>{
    if(e.data?.type==='tc:leave-ack'&&e.source===document.getElementById('play').contentWindow)
     window.__returnAcks++;
   });
  });
  let expectedAcks=0;
  for(const game of ['shichinarabe','daifugo','babanuki']){
   await sites.locator('[data-game="'+game+'"]').click();
   await sites.locator('#friends').click();
   const inner=sites.frameLocator('#play');
   await inner.locator('#game').waitFor({timeout:12000});
   assert.equal(await inner.locator('#game').inputValue(),game,
    'Nested sandbox must open the requested game: '+game);
   await inner.locator('#create').click();
   await inner.locator('#status').getByText('Firebase接続先が未設定',{exact:false}).waitFor({timeout:12000});
   await sites.locator('#back').click();
   await sites.locator('#viewer:not(.open)').waitFor({state:'attached',timeout:12000});
   expectedAcks++;
   assert.equal(await sites.locator('#choices').evaluate(()=>window.__returnAcks),expectedAcks,
    'Back must receive a graceful-exit ACK from the selected friend game');
  }
  // A blocked/crashed child might never ACK. Back must still finish quickly.
  await sites.locator('[data-game="daifugo"]').click();
  await sites.locator('#friends').click();
  await sites.frameLocator('#play').locator('#game').waitFor({timeout:12000});
  await sites.locator('#play').evaluate(frame=>{
   frame.srcdoc='<!doctype html><html><body><p id="no-ack">Child unresponsive</p></body></html>';
  });
  await sites.frameLocator('#play').locator('#no-ack').waitFor({timeout:12000});
  const beforeFallback=Date.now();
  await sites.locator('#back').click();
  await sites.locator('#viewer:not(.open)').waitFor({state:'attached',timeout:4500});
  assert.ok(Date.now()-beforeFallback<4000,'Back should recover even when child ignores leave');
  assert.equal(await sites.locator('#back').isDisabled(),false);
  assert.equal(await sites.locator('#choices').evaluate(()=>window.__returnAcks),expectedAcks,
   'Timed-out exit must not invent a child acknowledgement');

  // Memory Match uses an independent Supabase Broadcast prototype.
  // Verify that Back closes its socket *after* a best-effort departure packet.
  await sites.locator('[data-game="shinkei"]').click();
  await sites.locator('#friends').click();
  let memory=sites.frameLocator('#play');
  await memory.locator('#create').click();
  await memory.locator('#status').getByText('通信接続OK',{exact:false}).waitFor({timeout:12000});
  await sites.locator('#back').click();
  await sites.locator('#viewer:not(.open)').waitFor({state:'attached',timeout:12000});
  expectedAcks++;
  assert.equal(await sites.locator('#choices').evaluate(()=>window.__returnAcks),expectedAcks);
  assert.ok(memoryPackets.some(p=>p?.kind==='room_closed'),
    'Supabase host must announce room closure before leaving the iframe');

  // Guest exit should send a different packet without asking for auth.
  await sites.locator('[data-game="shinkei"]').click();
  await sites.locator('#friends').click();
  memory=sites.frameLocator('#play');
  await memory.locator('#code').fill('54321');
  await memory.locator('#join').click();
  await memory.locator('#status').getByText('通信接続OK',{exact:false}).waitFor({timeout:12000});
  await sites.locator('#back').click();
  await sites.locator('#viewer:not(.open)').waitFor({state:'attached',timeout:12000});
  expectedAcks++;
  assert.equal(await sites.locator('#choices').evaluate(()=>window.__returnAcks),expectedAcks);
  assert.ok(memoryPackets.some(p=>p?.kind==='player_left'&&p.roomCode==='54321'),
    'Supabase guest must announce departure before leaving the iframe');

  // The friend must also see a useful message if the host terminates play.
  await sites.locator('[data-game="shinkei"]').click();
  await sites.locator('#friends').click();
  memory=sites.frameLocator('#play');
  await memory.locator('#code').fill('54321');
  await memory.locator('#join').click();
  await memory.locator('#status').getByText('通信接続OK',{exact:false}).waitFor({timeout:12000});
  const remote=memorySockets.at(-1);
  assert.match(remote?.topic||'',/trump-memory-friends-v1-54321$/);
  remote.socket.send(JSON.stringify({topic:remote.topic,event:'broadcast',
    payload:{event:'trump-memory-event-v1',
      payload:{kind:'room_closed',protocol:1,roomCode:'54321',actor:'mock-host'}}}));
  await memory.locator('#status').getByText('ホストが部屋を終了しました',{exact:false}).waitFor({timeout:12000});
  assert.equal(await memory.locator('#lobby').isVisible(),false);
  await sites.locator('#back').click();
  await sites.locator('#viewer:not(.open)').waitFor({state:'attached',timeout:12000});

  await sites.locator('[data-game="shichinarabe"]').click();
  await sites.locator('#com').click();
  await sites.frameLocator('#play').locator('#gameTitle').getByText('七並べ',{exact:true}).waitFor({timeout:12000});
  await sites.locator('#back').click();
  console.log('GOOGLE SITES NESTED SANDBOX ['+engine+']: correct friend-game routing + COM launch pass');
 }finally{await sitesPage.close();}
 assert.deepEqual(errors,[]);
}finally{
 await page.close();await browser.close();server.close();
}
