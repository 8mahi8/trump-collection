// Single HTML for isolated V2 online laboratory. No runtime imports/CDN/iframes.
// Firebase config is runtime-injected only in developer tests. No deployment.
import {build} from 'esbuild';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
export async function buildV2OnlineLab(){
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
   ()=>'<script>'+b.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 if(/<iframe\b|<script\b[^>]+src=|<link\b[^>]+stylesheet|<script\b[^>]+type="module"/i.test(html))
  throw Error('NOT_A_SELF_CONTAINED_SCHOOL_HTML');
 return html;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const html=await buildV2OnlineLab(),path=resolve(root,'dist/v2-room-first-online-lab.html');
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,html);
 console.log('Generated '+path+' length='+html.length+' (developer emulator ONLY)');
}
