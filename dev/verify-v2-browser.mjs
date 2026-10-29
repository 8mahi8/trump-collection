// Offline-only V2 prototype: actual taps in a bundled, iframe-free HTML.
// Never connects to production Firebase or Supabase.
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const dist=resolve('dist/v2-babanuki-cpu-lab.html');
const engines={chromium,webkit};
mkdirSync(resolve('dist/v2-screens'),{recursive:true});
for(const [name,engine] of Object.entries(engines)){
 const browser=await engine.launch({headless:true});
 try{
  for(const size of [{width:800,height:450},{width:667,height:375}]){
   const ctx=await browser.newContext({viewport:size,hasTouch:true});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(dist).href+'?seed=42');
   await page.locator('button[data-game="babanuki"]').tap();
   await page.locator('.v2-table').waitFor({state:'visible',timeout:8000});
   await page.locator('.v2-player').first().waitFor({state:'visible'});
   assert.equal(await page.locator('.v2-player').count(),4);
   assert.equal(await page.locator('iframe').count(),0);
   await page.locator('.v2-backrow button:not([disabled])').first().waitFor({timeout:15000});
   const before=Number(await page.locator('.v2-table').getAttribute('data-render-version'));
   await page.locator('.v2-backrow button:not([disabled])').first().tap({timeout:7000});
   await page.waitForFunction(old=>Number(document.querySelector('.v2-table')?.dataset.renderVersion)>old,before,{timeout:7000});
   const layout=await page.evaluate(()=>{
    const b=x=>{const r=document.querySelector(x).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
    return {w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth,
     board:b('.v2-board'),hand:b('.v2-hand'),actions:b('.v2-actions'),table:b('.v2-table')};
   });
   assert.ok(layout.scrollW<=layout.w+2,'horizontal overflow '+JSON.stringify(layout));
   assert.ok(layout.board.bottom<=layout.hand.top+3,'board overlaps hand '+JSON.stringify(layout));
   assert.ok(layout.actions.bottom<=layout.h+2,'buttons outside viewport '+JSON.stringify(layout));
   assert.ok(layout.board.height>50,'board too small '+JSON.stringify(layout));
   assert.deepEqual(errors,[]);
   await page.screenshot({path:resolve('dist/v2-screens',name+'-'+size.width+'x'+size.height+'.png'),fullPage:false});
   await page.locator('#home').tap();
   await page.locator('button[data-game="babanuki"]').waitFor({state:'visible'});
   assert.equal(await page.locator('.v2-table').count(),0);
   console.log('V2 TOUCH UI PASS '+name+' '+size.width+'x'+size.height+' actual draw, UI repaint, no iframe, layout, menu return');
   await ctx.close();
  }
 }finally{await browser.close();}
}
