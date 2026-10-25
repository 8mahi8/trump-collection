// Build a single self-contained HTML file for Google Sites direct code embedding.
// No external JS files/CDN. Firebase REST calls still require a configured backend.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(ROOT,p),'utf8');
function stripExports(text){return text.replace(/^export /gm,'');}
function noImport(text,pattern,label){
 if(!text.includes(pattern))throw Error('Missing import: '+label);
 return text.replace(pattern,'');
}
function bundledScript(){
 const engine=read('games.mjs');
 const exports=[...engine.matchAll(/^export (?:function|const) (\w+)/gm)].map(m=>m[1]);
 if(!exports.includes('createBabanuki')||!exports.includes('daifugoLegalMoves'))throw Error('Engine exports missing');
 const logic=stripExports(engine)+'\nconst G = { '+exports.join(', ')+' };\n';
 const authority=stripExports(noImport(read('online/four-seat-authority.mjs'),
  "import * as G from '../games.mjs';",'authority'));
 const controller=stripExports(noImport(read('online/firebase-room-controller.mjs'),
  "import {createFourSeatAuthority,makeFourSeatCommand} from './four-seat-authority.mjs';",'controller'));
 const store=stripExports(read('online/firebase-room-store.mjs'));
 const guard=stripExports(read('online/firebase-dedicated-guard.mjs'));
 const html=read('online/four-seat-remote.html');
 const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 if(!match)throw Error('Remote script missing');
 let ui=match[1];
 ui=noImport(ui,"import {createFirebaseAnonymousAuth,createFirebaseRoomStore} from './firebase-room-store.mjs';",'firebase store');
 ui=noImport(ui,"import {createFirebaseRoomHost,createFirebaseRoomGuest} from './firebase-room-controller.mjs';",'firebase controller');
 ui=noImport(ui,"import {validateDedicatedFirebaseConfig} from './firebase-dedicated-guard.mjs';",'dedicated Firebase preflight');
 return {html,script:logic+authority+'\n'+controller+'\n'+store+'\n'+guard+'\n'+ui};
}
export function buildOnlineHtml(){
 const {html,script}=bundledScript();
 new Function(script); // no import/export and no variable collision; catch before publish
 const out=html.replace(/<script type="module">[\s\S]*?<\/script>/,
  ()=>'<script>\n'+script+'\n</'+'script>');
 if(/<script[^>]*\bsrc=/.test(out)||/<script\b[^>]*type="module"/.test(out)||/^\s*import /m.test(script)){
  throw Error('Standalone file still references external JavaScript');
 }
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=buildOnlineHtml();
 const target=path.join(ROOT,'dist','trump-collection-online-lab.html');
 mkdirSync(path.dirname(target),{recursive:true});
 writeFileSync(target,result);
 console.log('Built '+target+' ('+result.length+' characters), JavaScript parse OK');
}
