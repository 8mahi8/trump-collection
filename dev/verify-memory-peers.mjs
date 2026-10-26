// Two independent Google Sites sandbox sessions + a deterministic local Phoenix
// websocket relay. No connection to a real Supabase or Firebase service.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium,webkit} from 'playwright';
import {buildCollectionLabHtml} from './build-collection-lab.mjs';
const engine=process.env.TC_BROWSER_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_BROWSER_ENGINE');
const browserType=engine==='webkit'?webkit:chromium;
const lab=buildCollectionLabHtml();
const outer=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
<iframe id="sites-embed" sandbox="allow-scripts allow-forms" style="border:0;width:100vw;height:100vh"></iframe>
<script>document.getElementById('sites-embed').srcdoc=${JSON.stringify(lab).replace(/</g,'\\u003c')};</`+'script></body></html>';
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/sites'?outer:lab);
});
await new Promise((resolve,reject)=>server.listen(8891,'127.0.0.1',e=>e?reject(e):resolve()));
const browser=await browserType.launch(engine==='chromium'?{headless:true,args:['--no-sandbox']}:{headless:true});
const live=[],pages=[],errors=[];
const events=[];
function relay(socket){
 const client={socket,topic:'',active:true};
 live.push(client);
 socket.onClose(()=>{client.active=false;});
 socket.onMessage(raw=>{
  let msg;try{msg=JSON.parse(raw);}catch{return;}
  if(msg.event==='phx_join'){
   client.topic=msg.topic;
   socket.send(JSON.stringify({topic:msg.topic,event:'phx_reply',ref:msg.ref,payload:{status:'ok'}}));
  }else if(msg.event==='heartbeat'){
   socket.send(JSON.stringify({topic:'phoenix',event:'phx_reply',ref:msg.ref,payload:{status:'ok'}}));
  }else if(msg.event==='broadcast'&&client.topic){
   events.push({topic:client.topic,packet:msg.payload?.payload});
   // Mimic Supabase Realtime broadcast self:false, isolated by room topic.
   for(const peer of live){
    if(peer===client||!peer.active||peer.topic!==client.topic)continue;
    try{peer.socket.send(JSON.stringify({topic:client.topic,event:'broadcast',payload:msg.payload}));}
    catch{peer.active=false;}
   }
  }
 });
}
async function openPlayer(){
 const page=await browser.newPage({viewport:{width:800,height:450}});
 pages.push(page);
 page.on('pageerror',e=>errors.push(e.message));
 await page.routeWebSocket('**/realtime/v1/websocket**',relay);
 await page.goto('http://127.0.0.1:8891/sites');
 const sites=page.frameLocator('#sites-embed');
 await sites.locator('[data-game="shinkei"]').click();
 await sites.locator('#friends').click();
 const game=sites.frameLocator('#play');
 await game.locator('#create').waitFor({timeout:12000});
 return {sites,game};
}
try{
 const host=await openPlayer(),guest=await openPlayer();
 await host.game.locator('#create').click();
 await host.game.locator('#status').getByText('通信接続OK',{exact:false}).waitFor({timeout:12000});
 const code=await host.game.locator('#room').textContent();
 assert.match(code,/^[0-9]{5}$/,'host generates a valid room number');
 await guest.game.locator('#code').fill(code);
 await guest.game.locator('#join').click();
 await guest.game.locator('#status').getByText('接続OK。準備して対戦しよう',{exact:false}).waitFor({timeout:12000});
 await host.game.locator('#players').filter({hasText:'2/2人'}).waitFor({timeout:12000});
 await host.game.locator('#ready').click();
 await guest.game.locator('#ready').click();
 await host.game.locator('#start').click({timeout:12000});
 await Promise.all([host,guest].map(p=>p.game.locator('#gameArea').waitFor({state:'visible',timeout:12000})));
 assert.equal(await host.game.locator('#board .tile').count(),24);
 assert.equal(await guest.game.locator('#board .tile').count(),24);
 // Starting host gets the first turn. Peer's visible board must synchronize.
 await host.game.locator('#board .tile:not([disabled])').first().click();
 await guest.game.locator('#board .tile.face').first().waitFor({timeout:12000});
 await host.game.locator('#chatToggle').click();
 await guest.game.locator('#chatToggle').click();
 const phrase='2人対戦のチャット <script>alert(1)</script>';
 await host.game.locator('#chatInput').fill(phrase);
 await host.game.locator('#chatSend').click();
 await guest.game.locator('#chatList').getByText(phrase,{exact:false}).waitFor({timeout:12000});
 assert.equal(await guest.game.locator('#chatList script').count(),0,'chat must remain plain text');
 // No reply is returned to the sending socket (Supabase self:false).
 assert.equal(await host.game.locator('#chatList .chat-msg').count(),1);
 const sent=events.filter(x=>x.topic.endsWith(code)&&x.packet?.kind==='chat');
 assert.equal(sent.length,1,'single chat event on the matching room topic');
 await host.sites.locator('#back').click();
 await guest.game.locator('#status').getByText('ホストが部屋を終了しました',{exact:false}).waitFor({timeout:12000});
 assert.equal(await guest.game.locator('#lobby').isVisible(),false);
 await guest.sites.locator('#back').click();
 await guest.sites.locator('#viewer:not(.open)').waitFor({state:'attached',timeout:12000});
 assert.deepEqual(errors,[]);
 console.log('TWO-DEVICE SITES MEMORY PASS ['+engine+']: room join, both READY, first synced card, peer chat, host exit');
}finally{
 for(const page of pages)await page.close();
 await browser.close();server.close();
}
