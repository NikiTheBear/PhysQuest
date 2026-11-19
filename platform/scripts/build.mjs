import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
execFileSync(process.execPath,['scripts/build-knowledge-prompts.mjs'],{stdio:'inherit'});
execFileSync('npm',['--prefix','physquest/apps/web','run','build'],{stdio:'inherit'});
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
await mkdir('.generated',{recursive:true});
const browser=await build({entryPoints:['web/app.js'],bundle:true,minify:true,format:'esm',target:'es2022',write:false});
const assets={'/app.js':{body:browser.outputFiles[0].text,type:'text/javascript; charset=utf-8'}};
for(const [file,type] of [['index.html','text/html; charset=utf-8'],['style.css','text/css; charset=utf-8'],['light.css','text/css; charset=utf-8'],['favicon.svg','image/svg+xml']])assets['/'+file]={body:await readFile('web/'+file,'utf8'),type};
assets['/physquest.html']={body:await readFile('physquest/apps/web/dist/index.html','utf8'),type:'text/html; charset=utf-8'};
for(const file of await readdir('physquest/apps/web/dist/physquest-assets'))assets['/physquest-assets/'+file]={body:await readFile('physquest/apps/web/dist/physquest-assets/'+file,'utf8'),type:file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'};
for(const file of await readdir('experiments'))if(file.endsWith('.json'))assets['/experiments/'+file]={body:await readFile('experiments/'+file,'utf8'),type:'application/json; charset=utf-8'};
assets['/prompts/knowledge-prompts.json']={body:await readFile('physquest/shared/knowledge-data/knowledge-prompts.json','utf8'),type:'application/json; charset=utf-8'};
await writeFile('.generated/assets.js','export const ASSETS = '+JSON.stringify(assets)+';');
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['worker/index.js'],bundle:true,minify:true,format:'esm',target:'es2022',platform:'browser',outfile:'dist/server/index.js'});
try{await copyFile('.openai/hosting.json','dist/.openai/hosting.json');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir('standalone',{recursive:true});
const standalone=assets['/index.html'].body
  .replace('<link rel="stylesheet" href="/style.css">',()=>'<style>'+assets['/style.css'].body+'</style>')
  .replace('<link rel="stylesheet" href="/light.css">',()=>'<style>'+assets['/light.css'].body+'</style>')
  .replace('href="/favicon.svg"',()=>'href="data:image/svg+xml,'+encodeURIComponent(assets['/favicon.svg'].body)+'"')
  .replace('<script type="module" src="/app.js"></script>',()=>'<script type="module">'+assets['/app.js'].body.replaceAll('</script','<\\/script')+'</script>');
await writeFile('standalone/fieldlab.html',standalone);
console.log('Built standalone Worker with embedded HTML, CSS, Three.js and MCP.');
