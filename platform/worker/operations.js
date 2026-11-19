import { activeExperiment, CATALOG, COUPLINGS } from '../shared/catalog.js';
import { EXPERIMENT_FILES } from '../shared/experiment-library.js';
import { mutate, exportExperimentFile } from '../shared/workspace.js';
import { getKnowledgePrompt, listKnowledgePrompts } from '../shared/knowledge-prompts.js';
import { simulate } from '../shared/physics.js';
export function runTool(workspace,name,args={}){
  if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('工具参数必须为对象');
  if(name==='list_knowledge_prompts')return {workspace,result:listKnowledgePrompts(args)};
  if(name==='get_knowledge_prompt')return {workspace,result:getKnowledgePrompt(args.knowledgeId)};
  if(name==='list_experiment_files')return {workspace,result:EXPERIMENT_FILES.map(f=>({id:f.experiment.source.challengeId,title:f.experiment.title,goal:f.experiment.goal,format:f.format,version:f.version,path:'/experiments/'+f.experiment.source.challengeId+'.pqexp.json'}))};
  if(name==='export_experiment'){const doc=args.experimentId?workspace.experiments.find(d=>d.id===args.experimentId):activeExperiment(workspace);if(!doc)throw new Error('实验不存在');return{workspace,result:exportExperimentFile(doc)};}
  if(name==='load_experiment_file'||name==='bootstrap_physquest'){
    const file=EXPERIMENT_FILES.find(f=>f.experiment.source.challengeId===(args.fileId||'CH-O2-01'));if(!file)throw new Error('实验文件不存在');
    if(name==='bootstrap_physquest'&&(workspace.revision!==0||workspace.experiments.length!==1||activeExperiment(workspace).components.length||activeExperiment(workspace).connections.length))return{workspace,result:{loaded:false}};
    return mutate(workspace,'import_experiment',{file,bootstrap:name==='bootstrap_physquest'});
  }
  if(name==='get_workspace')return {workspace,result:workspace};
  if(name==='list_instruments')return {workspace,result:{catalog:CATALOG,couplings:COUPLINGS,designs:workspace.designs,collisionHelp:"通过 add_component/update_component 的 collider 设置 {enabled,shape:auto|box,size:[宽,高,深],offset:[x,y,z]}；尺寸/偏移单位 m。全局 environment.collisions 也须为 true。刚体参与运动，其他支持器具为固定障碍；场、力源、两端连接与音圈不支持独立碰撞。"}};
  if(name==='simulate_experiment'){
    const doc=args.experimentId?workspace.experiments.find(d=>d.id===args.experimentId):activeExperiment(workspace),duration=args.duration??5,rate=args.sampleRate??30;
    if(!doc)throw new Error('实验不存在');
    if(!Number.isFinite(duration)||duration<.02||duration>20||!Number.isFinite(rate)||rate<1||rate>60)throw new Error('duration: 0.02–20 秒；sampleRate: 1–60 Hz');
    return {workspace,result:simulate(doc,duration,rate)};
  }
  return mutate(workspace,name,args);
}
