// One-file Google Sites HTML packager. It performs no network requests or
// Firebase writes. Never embeds auth tokens, secrets, or dev emulator hosts.
import {build} from 'esbuild';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
export function validateV2DatabaseURL(input){
 if(typeof input!=='string')throw Error('V2_DATABASE_URL_REQUIRED');
 if(input!==input.trim())throw Error('V2_DATABASE_URL_INVALID');
 let url;
 try{url=new URL(input);}catch{throw Error('V2_DATABASE_URL_INVALID')}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
  (url.pathname!==''&&url.pathname!=='/')||url.port||
  !/^[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:firebaseio\\.com|firebasedatabase\\.app)$/.test(url.hostname))
  throw Error('V2_DATABASE_URL_INVALID');
 return url.origin;
}
export async function buildV2OnlineLab({databaseURL=null}={}){
 // Optional PUBLIC RTDB endpoint is injected before the game script.
 // The developer emulator's default no-config build remains unchanged.
 const config=databaseURL===null?'':('<script>window.TRUMP_V2_FIREBASE_CONFIG='+
  JSON.stringify({databaseURL:validateV2DatabaseURL(databaseURL)}).replace(/</g,'\\u003c')+
  '</script>');
 const b=await build({entryPoints:[resolve(root,'v2/online-app.mjs')],bundle:true,
  format:'iife',platform:'browser',target:['safari15'],minify:true,
  write:false,logLevel:'silent'});
 if(b.outputFiles?.length!==1)throw Error('EXPECTED_ONE_JS_BUNDLE');
 const html=read('v2/online-lab.html')
  .replace('<link rel="stylesheet" href="./ui/table.css">',
   ()=>'<style>'+read('v2/ui/table.css')+'</style>')
  .replace('<link rel="stylesheet" href="./ui/online-shell.css">',
   ()=>'<style>'+read('v2/ui/online-shell.css')+'</style>')
  .replace('<script type="module" src="./online-app.mjs"></script>',
   ()=>config+'<script>'+b.outputFiles[0].text.replace(/<\\/script/gi,'<\\\\/script')+'</script>');
 if(/<iframe\\b|<script\\b[^>]+src=|<link\\b[^>]+stylesheet|<script\\b[^>]+type="module"/i.test(html))
  throw Error('NOT_A_SELF_CONTAINED_SCHOOL_HTML');
 if(config&&!html.includes('window.TRUMP_V2_FIREBASE_CONFIG='))
  throw Error('CONFIG_NOT_EMBEDDED');
 return html;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const flag=arg=>{const i=args.indexOf(arg);return i>=0?args[i+1]:null};
 const endpoint=flag('--database-url'),out=flag('--out');
 try{
  if((endpoint===null)!==(out===null))throw Error('CONFIGURED_BUILD_REQUIRES_DATABASE_URL_AND_OUT');
  if(out&&!/^v2-room-first-sites-[a-zA-Z0-9_-]+\\.html$/.test(basename(out)))
   throw Error('SITES_OUTPUT_FILENAME_REQUIRED');
  const dest=out?resolve(out):resolve(root,'dist/v2-room-first-online-lab.html');
  if(out&&(!dest.startsWith(resolve(root,'dist')+'/')||existsSync(dest)))
   throw Error('REFUSING_TO_OVERWRITE_OR_WRITE_OUTSIDE_DIST');
  const html=await buildV2OnlineLab({databaseURL:endpoint});
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,html,{encoding:'utf8',flag:out?'wx':'w'});
  console.log('Generated '+dest+' length='+html.length+
   (out?' (OFFLINE CONFIGURED DRAFT; NOT DEPLOYED)':' (developer emulator ONLY)'));
  if(out)console.log('No Firebase Rules deployment or live database test occurred.');
 }catch(e){console.error('BUILD_BLOCKED:',e.message);process.exitCode=1;}
}
