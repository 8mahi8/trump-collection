// Combine existing COM mode and independent online transports without modifying
// either implementation or the school's published Google Sites version.
// This is a research build; it does NOT configure a production Firebase database.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildOnlineHtml} from './build-online-html.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(ROOT,p),'utf8');
const strip=s=>s.replace(/^export /gm,'');
const exported=s=>[...s.matchAll(/^export (?:function|const) (\w+)/gm)].map(x=>x[1]);
const drop=(s,needle)=>{
 if(!s.includes(needle))throw Error('Missing bundled import: '+needle);
 return s.replace(needle,'');
};
function comAutoStart(){
 window.addEventListener('message',e=>{
  if(e.source!==window.parent||e.data?.type!=='tc:launch-com')return;
  const game=e.data.game;
  if(!['babanuki','shichinarabe','shinkei','daifugo'].includes(game))return;
  document.querySelector('[data-game="'+game+'"]')?.click();
 });
}
function buildCOM(){
 const games=read('games.mjs');
 const injected=strip(games)+'\nconst G={'+exported(games).join(',')+'};\n';
 let html=read('index.html');
 html=drop(html,"import * as G from './games.mjs';").replace('<script type="module">','<script>');
 if(!html.includes('<script>'))throw Error('COM script missing');
 html=html.replace('<script>',()=>'<script>'+injected);
 return html.replace('</body>',()=>'<script>('+comAutoStart.toString()+')();</'+'script></body>');
}
function buildMemory(){
 const games=read('games.mjs');
 const source=strip(games)+'\n'
  +strip(drop(read('online/memory-authority.mjs'),
    "import {createShinkei, shinkeiFlip} from '../games.mjs';"))
  +'\n'+strip(read('online/realtime-wire.mjs'))+'\n';
 let html=read('online/memory-remote.html');
 const found=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 if(!found)throw Error('Memory match UI script missing');
 const ui=drop(drop(found[1],
  "import {ROOM_PROTOCOL,createMemoryAuthority,makeRoomCommand} from './memory-authority.mjs';"),
  "import {makeRealtimeWire} from './realtime-wire.mjs';");
 const compiled=source+ui;
 new Function(compiled);
 return html.replace(found[0],()=>'<script>'+compiled+'</'+'script>');
}
export function buildCollectionLabHtml(){
 const apps={com:buildCOM(),friends4:buildOnlineHtml(),memory:buildMemory()};
 for(const [name,html] of Object.entries(apps)){
  if(/<script[^>]*\bsrc\s*=|<script[^>]*type="module"/.test(html))
   throw Error(name+' contains an external JavaScript dependency');
 }
 const template=read('online/collection-launcher.template.html');
 const embedded=JSON.stringify(apps).replace(/</g,'\\u003c');
 const result=template.replace('__EMBEDDED_HTML__',()=>embedded);
 const code=result.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 if(!code)throw Error('Launcher script missing');
 new Function(code);
 if(result.includes('__EMBEDDED_HTML__'))throw Error('Template not bundled');
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const built=buildCollectionLabHtml();
 const target=path.join(ROOT,'dist','trump-collection-integrated-lab.html');
 mkdirSync(path.dirname(target),{recursive:true});
 writeFileSync(target,built);
 console.log('Built '+target+' ('+built.length+' characters)');
}
