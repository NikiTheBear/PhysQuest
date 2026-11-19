import prompts from '../physquest/shared/knowledge-data/knowledge-prompts.json' with {type:'json'};
export const KNOWLEDGE_PROMPTS=prompts;
export function getKnowledgePrompt(knowledgeId){
  const prompt=prompts.find(p=>p.id===knowledgeId);if(!prompt)throw new Error('找不到该知识点的实验提示词');return structuredClone(prompt);
}
export function listKnowledgePrompts({query='',domain,stage,support,offset=0,limit=25}={}){
  if(typeof query!=='string'||query.length>200)throw new Error('搜索文字最多 200 字');
  if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>50)throw new Error('offset 为非负整数；limit 为 1–50');
  for(const [key,value] of Object.entries({domain,stage,support}))if(value!==undefined&&!prompts.some(p=>p[key]===value))throw new Error('未知筛选 '+key);
  const search=query.trim().toLowerCase();
  const filtered=prompts.filter(p=>(!domain||p.domain===domain)&&(!stage||p.stage===stage)&&(!support||p.support===support)&&(!search||(p.id+' '+p.title+' '+p.objective).toLowerCase().includes(search)));
  const items=filtered.slice(offset,offset+limit).map(({id,title,domain,domainLabel,stage,stageLabel,support,supportLabel,objective})=>({id,title,domain,domainLabel,stage,stageLabel,support,supportLabel,objective}));
  return {total:filtered.length,offset,items,nextOffset:offset+items.length<filtered.length?offset+items.length:null};
}
