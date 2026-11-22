import {existsSync, readdirSync, statSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(Number(process.versions.node.split('.')[0])<22)throw new Error('请使用 Node.js 22 或更新版本');
const root=fileURLToPath(new URL('../platform/',import.meta.url));
if(!existsSync(root+'/package.json'))throw new Error('缺少仓库内的 platform/package.json，请确认已完整克隆自由探索分支。');
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
// ★ 每次启动都重新同步 + 重建，避免 dist 停留在旧版本
//   （之前踩过：改了挑战编号但没重建，工作台报「找不到实验文件」）
run(['scripts/sync-physquest.mjs','..']);
if(!existsSync(root+'/node_modules/markdown-it')||!existsSync(root+'/physquest/apps/web/node_modules')){const r=spawnSync('npm',['run','install:ci'],{cwd:root,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
// 每次启动检查 dist 是否比源码旧，旧了就重建。
// 踩过的坑：改了挑战编号 / 实验文件但没重建，工作台报「找不到实验文件」。
const distFile = root + '/dist/server/index.js';
function newestMtime(dir, exts) {
  let newest = 0;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist', 'physquest', '.local', '.generated'].includes(e.name)) continue;
      const p = dir + '/' + e.name;
      if (e.isDirectory()) newest = Math.max(newest, newestMtime(p, exts));
      else if (exts.some((x) => e.name.endsWith(x))) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  } catch { /* 目录不存在就跳过 */ }
  return newest;
}
const srcTime = Math.max(
  newestMtime(root + '/shared', ['.js']),
  newestMtime(root + '/worker', ['.js']),
  newestMtime(root + '/web', ['.js', '.html', '.css']),
  newestMtime(root + '/experiments', ['.json']),
);
const distTime = existsSync(distFile) ? statSync(distFile).mtimeMs : 0;
if (!distTime || srcTime > distTime) {
  console.log('源码或实验文件比 dist 新，重新构建…');
  run(['scripts/build.mjs']);
} else {
  console.log('dist 是最新的，跳过构建');
}
const child=spawn(process.execPath,['scripts/dev.mjs'],{cwd:root,stdio:'inherit',env:{...process.env,PORT:process.env.PORT||'4317'}});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>child.kill(sig));
child.on('exit',code=>process.exit(code||0));
