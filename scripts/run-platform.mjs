import {existsSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(Number(process.versions.node.split('.')[0])<22)throw new Error('请使用 Node.js 22 或更新版本');
const root=fileURLToPath(new URL('../platform/',import.meta.url));
if(!existsSync(root+'/package.json'))throw new Error('缺少仓库内的 platform/package.json，请确认已完整克隆自由探索分支。');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
run(['scripts/sync-physquest.mjs','..']);
if(!existsSync(root+'/node_modules/markdown-it')||!existsSync(root+'/physquest/apps/web/node_modules')){const r=spawnSync('npm',['run','install:ci'],{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
run(['scripts/build.mjs']);
const child=spawn(process.execPath,['scripts/dev.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,PORT:process.env.PORT||'4317'}});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));
child.on('exit',code=>process.exit(code||0));
