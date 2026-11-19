import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {KNOWLEDGE_PROMPTS,getKnowledgePrompt,listKnowledgePrompts} from '../shared/knowledge-prompts.js';
import {CATALOG,blankWorkspace,activeExperiment} from '../shared/catalog.js';
import {runTool} from '../worker/operations.js';
import {runDeepSeek} from '../worker/deepseek.js';
const key='sk-test-only-not-a-real-key';
const call=(name,args,id=name)=>({id,type:'function',function:{name,arguments:JSON.stringify(args)}});
const response=(message)=>Response.json({choices:[{message,finish_reason:message.tool_calls?'tool_calls':'stop'}],usage:{total_tokens:12}});
const task=(id='K-M3-04')=>({knowledgeId:id,messages:[{role:'user',content:getKnowledgePrompt(id).prompt}]});
test('every planned topic has a complete, bounded, distinct and model-aware prompt',async()=>{
 const map=JSON.parse(await readFile(new URL('../physquest/shared/knowledge-data/PLATFORM-MAP.json',import.meta.url),'utf8'));
 const planned=map.disciplines.flatMap(d=>d.stages.filter(s=>s.status==='planned').flatMap(s=>s.items.map(i=>i.id)));
 assert.equal(planned.length,140);assert.deepEqual(KNOWLEDGE_PROMPTS.map(p=>p.id).sort(),planned.sort());
 assert.equal(new Set(KNOWLEDGE_PROMPTS.map(p=>p.objective)).size,planned.length);
 for(const p of KNOWLEDGE_PROMPTS){assert.ok(p.prompt.length<=6000&&p.prompt.length>600,p.id);assert.ok(p.prompt.includes(p.id)&&p.prompt.includes(p.title));assert.match(p.prompt,/create_experiment/);assert.match(p.prompt,/simulate_experiment/);assert.ok(p.variables.length&&p.observations.length&&p.limitations.length>8);for(const model of p.models)assert.ok(CATALOG[model],p.id+' '+model);assert.ok(['direct','approximation','conceptual'].includes(p.support));}
 assert.equal(getKnowledgePrompt('K-N4-03').support,'conceptual');assert.equal(getKnowledgePrompt('K-M3-04').support,'direct');
});
test('MCP prompt discovery paginates and filters without changing workspace data',()=>{
 const w=blankWorkspace(),result=runTool(w,'list_knowledge_prompts',{limit:20});assert.equal(result.workspace,w);assert.equal(result.result.total,140);assert.equal(result.result.nextOffset,20);
 const ids=[];let offset=0;do{const page=listKnowledgePrompts({offset,limit:50});ids.push(...page.items.map(p=>p.id));offset=page.nextOffset;}while(offset!==null);assert.equal(new Set(ids).size,140);
 const q=listKnowledgePrompts({query:'牛顿第二',domain:'mechanics',stage:'senior',support:'direct'});assert.equal(q.items[0].id,'K-M3-04');assert.equal(q.total,1);
 assert.throws(()=>listKnowledgePrompts({limit:100}),/limit/);assert.throws(()=>getKnowledgePrompt('missing'));
 const p=runTool(w,'get_knowledge_prompt',{knowledgeId:'K-M3-04'}).result;p.prompt='modified';assert.notEqual(getKnowledgePrompt(p.id).prompt,p.prompt);assert.equal(w.revision,0);
});
test('DeepSeek knowledge flow invokes MCP tools, instantiates a design and verifies before committing',async()=>{
 const original=blankWorkspace(),prior=structuredClone(activeExperiment(original));let n=0;
 const r=await runDeepSeek({workspace:original,body:task(),key,fetcher:async(_,init)=>{
  const p=JSON.parse(init.body);assert.ok(p.tools.some(t=>t.function.name==='get_knowledge_prompt'));
  switch(n++){
   case 0:return response({tool_calls:[call('get_workspace',{}),call('list_instruments',{}),call('get_knowledge_prompt',{knowledgeId:'K-M3-04'})]});
   case 1:return response({tool_calls:[call('create_experiment',{title:'牛顿第二定律',goal:'比较恒力下的加速度',mode:'2d'})]});
   case 2:return response({tool_calls:[call('design_assembly',{name:'恒力装置',components:[{id:'b',kind:'body',position:[0,2,0]},{id:'f',kind:'force',refs:{target:'b'},params:{fx:1}}]})]});
   case 3:{const design=JSON.parse(p.messages.at(-1).content);return response({tool_calls:[call('instantiate_design',{designId:design.id})]});}
   case 4:return response({tool_calls:[call('simulate_experiment',{duration:.1,sampleRate:5})]});
   default:return response({content:'已通过器具工具搭建并计算，物体与恒力源可编辑。'});
  }
 }});
 assert.equal(r.changed,true);assert.equal(r.toolTransport,'mcp-tool-bridge');assert.equal(r.build.knowledgeId,'K-M3-04');assert.equal(r.actions.length,7);
 assert.equal(activeExperiment(r.workspace).components.length,2);assert.equal(activeExperiment(r.workspace).learning.knowledgePrompt.prompt,task().messages[0].content);
 assert.deepEqual(r.workspace.experiments[0],prior);assert.deepEqual(activeExperiment(original),prior);assert.equal(original.experiments.length,1);
});
test('knowledge build rejects modification of existing spaces and cannot finish with prose only',async()=>{
 const original=blankWorkspace();let n=0;
 await assert.rejects(()=>runDeepSeek({workspace:original,body:task(),key,fetcher:async(_,init)=>{
  if(n++===0)return response({tool_calls:[call('update_experiment',{title:'应拒绝'})]});
  const p=JSON.parse(init.body);if(n===2)assert.match(p.messages.at(-1).content,/create_experiment/);
  return response({content:'已完成。'});
 }}),/尚未完成|拆分任务/);
 assert.equal(original.revision,0);
});
test('post-simulation edits require another simulation and conceptual builds keep a clear label',async()=>{
 let n=0;
 const result=await runDeepSeek({workspace:blankWorkspace(),body:task('K-N4-03'),key,fetcher:async(_,init)=>{
  const p=JSON.parse(init.body);
  switch(n++){
   case 0:return response({tool_calls:[call('create_experiment',{title:'量子隧穿',mode:'2d'})]});
   case 1:return response({tool_calls:[call('add_component',{kind:'box',fixed:true,name:'势垒示意'})]});
   case 2:return response({tool_calls:[call('simulate_experiment',{duration:.1})]});
   case 3:return response({tool_calls:[call('update_experiment',{environment:{gravity:0}})]});
   case 4:return response({content:'示意搭好了。'});
   case 5:assert.match(p.messages.at(-1).content,/simulate_experiment/);return response({tool_calls:[call('simulate_experiment',{duration:.1})]});
   default:return response({content:'只搭建了势垒概念示意；没有计算量子穿透率。'});
  }
 }});
 assert.equal(result.build.support,'conceptual');assert.match(activeExperiment(result.workspace).title,/概念示意/);assert.match(activeExperiment(result.workspace).goal,/模型范围/);
});
test('unknown prompt IDs never send a paid provider request',async()=>{
 let called=false;await assert.rejects(()=>runDeepSeek({workspace:blankWorkspace(),body:{knowledgeId:'invalid',messages:[{role:'user',content:'搭建'}]},key,fetcher:async()=>{called=true;return response({content:'none'});}}),/提示词/);assert.equal(called,false);
});

test('a card can build beyond eight replies and retain its objective',async()=>{
 let round=0;
 const result=await runDeepSeek({workspace:blankWorkspace(),body:task(),key,fetcher:async()=>{
   round++;
   if(round===1)return response({tool_calls:[call('create_experiment',{title:'恒力实验'})]});
   if(round===2)return response({tool_calls:[call('add_component',{kind:'box'})]});
   if(round<9)return response({tool_calls:[call('get_workspace',{})]});
   if(round===9)return response({tool_calls:[call('simulate_experiment',{duration:.1})]});
   return response({content:'搭建完成'});
 }});
 assert.equal(round,10);
 assert.ok(activeExperiment(result.workspace).goal.includes(getKnowledgePrompt(result.build.knowledgeId).objective));
});

test('live tool events survive a paused card and continuation verifies the same draft',async()=>{
 const events=[];let round=0;
 const paused=await runDeepSeek({workspace:blankWorkspace(),body:task(),key,onEvent:event=>events.push(event),fetcher:async()=>{
   round++;
   const calls=round===1?[call('create_experiment',{title:'草稿'})]:round===2?[call('add_component',{kind:'box'})]:[call('get_workspace',{})];
   return response({tool_calls:calls});
 }});
 assert.equal(paused.paused,true);
 assert.equal(events.filter(e=>e.type==='end').length,24);
 assert.deepEqual(events.slice(0,3).map(e=>e.type),['planning','start','end']);
 let verified=false;
 const resumed=await runDeepSeek({workspace:paused.workspace,body:{...task(),resumeId:paused.resumeId},key,fetcher:async()=>{
   if(verified)return response({content:'已验证'});
   verified=true;return response({tool_calls:[call('simulate_experiment',{duration:.1})]});
 }});
 assert.equal(resumed.build.experimentId,paused.resumeId);
 assert.equal(resumed.workspace.experiments.length,2);
 assert.equal(activeExperiment(resumed.workspace).learning.pendingCard,undefined);
});
