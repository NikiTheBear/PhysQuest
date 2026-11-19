import {execFileSync} from 'node:child_process';
import {cp,mkdir,writeFile} from 'node:fs/promises';

// Package a self-contained workbench for static hosts. DeepSeek and remote MCP
// need the full local/Worker service; static hosting keeps experiments local.
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit',env:{...process.env,VITE_STATIC_WORKBENCH:'1'}});
await mkdir('dist/pages',{recursive:true});
await cp('physquest/apps/web/dist','dist/pages',{recursive:true});
await cp('standalone/fieldlab.html','dist/pages/workbench.html');
await cp('experiments','dist/pages/experiments',{recursive:true});
await mkdir('dist/pages/prompts',{recursive:true});
await cp('physquest/shared/knowledge-data/knowledge-prompts.json','dist/pages/prompts/knowledge-prompts.json');
await writeFile('dist/pages/.nojekyll','');
console.log('Static Pages bundle: dist/pages/ (simulation and local editing; no API proxy).');
