// Smoke test the combined four-game COM/Friends launcher in a real browser.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium,webkit} from 'playwright';
const engine=process.env.TC_BROWSER_ENGINE||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('INVALID_BROWSER_ENGINE: '+engine);
const browserType=engine==='webkit'?webkit:chromium;
import {buildCollectionLabHtml} from './build-collection-lab.mjs';

const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(buildCollectionLabHtml());
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
 assert.deepEqual(errors,[]);
}finally{
 await page.close();await browser.close();server.close();
}
