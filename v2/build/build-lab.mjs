// Build-time esbuild only. Result contains one HTML, one CSS and one JS;
// no runtime CDN, ESM import or nested iframe. Never deploy automatically.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
export async function buildV2LabHtml(){
 const js=await build({entryPoints:[resolve(root,'v2/app.mjs')],bundle:true,
  format:'iife',platform:'browser',target:['safari15'],write:false,
  minify:true,logLevel:'silent'});
 if(js.outputFiles?.length!==1)throw Error('EXPECTED_ONE_JS_BUNDLE');
 const style=read('v2/ui/table.css');
 const template=read('v2/lab.html');
 const html=template
  .replace('<link rel="stylesheet" href="./ui/table.css">',()=>'<style>'+style+'</style>')
  .replace('<script type="module" src="./app.mjs"></script>',
   ()=>'<script>'+js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>');
 if(html===template||/<script\b[^>]+src=|<link\b[^>]+stylesheet|<iframe\b|<script\b[^>]+type="module"/i.test(html))
  throw Error('NOT_A_SELF_CONTAINED_SCHOOL_HTML');
 return html;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const html=await buildV2LabHtml();
 const output=resolve(root,'dist/v2-babanuki-cpu-lab.html');
 mkdirSync(dirname(output),{recursive:true});
 writeFileSync(output,html);
 console.log('Generated '+output+' ('+html.length+' characters). This is NOT an online game.');
}
