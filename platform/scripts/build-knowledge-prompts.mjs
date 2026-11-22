import {readFile,writeFile} from 'node:fs/promises';

/**
 * 把主仓库的 176 条提示词同步到平台快照目录。
 *
 * 历史：这个脚本原来从 platform/prompts/entries.json（140 条简写）现拼提示词，
 * 并断言 entries 条数 === PLATFORM-MAP 里 status==='planned' 的条数。
 *
 * 问题：只要 PLATFORM-MAP 的 status 变动（C 把某些学段从 planned 改成 content/ready），
 * 或者在主仓库补了提示词，这个断言就必然崩，导致 `npm run build` 失败、
 * 4317 服务起不来、工作台报「找不到实验文件」。
 *
 * 现在改成：主仓库的 shared/knowledge-data/knowledge-prompts.json 是唯一真相，
 * 这里只做一次拷贝。它已经包含 176 条完整提示词。
 */
const source=JSON.parse(await readFile('../shared/knowledge-data/knowledge-prompts.json','utf8'));
if(!Array.isArray(source)||!source.length)throw new Error('主仓库提示词为空');
const ids=new Set(source.map(e=>e.id));
if(ids.size!==source.length)throw new Error('提示词有重复 id');
for(const entry of source){
  if(typeof entry.prompt!=='string'||entry.prompt.length<200)throw new Error(entry.id+' 提示词过短');
  if(entry.prompt.length>6000)throw new Error(entry.id+' 超出对话长度限制');
}
await writeFile('physquest/shared/knowledge-data/knowledge-prompts.json',JSON.stringify(source,null,2)+'\n');
const bySupport={};
for(const e of source)bySupport[e.support]=(bySupport[e.support]||0)+1;
console.log(`Synced ${source.length} knowledge prompts: `+Object.entries(bySupport).map(([k,v])=>k+'='+v).join(', '));
