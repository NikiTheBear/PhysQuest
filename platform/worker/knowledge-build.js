import { getKnowledgePrompt } from '../shared/knowledge-prompts.js';
import { validateExperiment } from '../shared/workspace.js';
const signature=doc=>JSON.stringify({mode:doc.mode,environment:doc.environment,components:doc.components,connections:doc.connections});
export class KnowledgeBuild {
  constructor(knowledgeId,workspace,prompt){
    this.entry=getKnowledgePrompt(knowledgeId);this.prompt=prompt;this.targetId=null;this.verified=null;
    this.originalDesigns=new Set(workspace.designs.map(d=>d.id));
  }
  instruction(){const p=this.entry;return `本轮是知识地图的“用 DeepSeek 搭建”操作：${p.id} ${p.title}。级别：${p.supportLabel}。模型限制：${p.limitations}。必须先 create_experiment 新建一个独立空间，真实放入器具，最后 simulate_experiment 验证最终物理配置；原有空间不允许修改。conceptual 只建概念示意，approximation 标明近似或类比，不得冒称完整理论求解。可以设计新的可复用器具。总计最多 24 次工具调用、最多 24 轮模型回复，优先一次 design_assembly 放置 2–8 个部件；调用结果中的 ID 才能用于后续引用。成功后简洁说明操作方法。`;}
  authorize(name,args,workspace,readOnly){
    if(readOnly)return;
    if(name==='create_experiment'){if(this.targetId)throw new Error('本轮只新建一个空间，请继续编辑已创建的空间');return;}
    if(['import_experiment','load_experiment_file'].includes(name))throw new Error('知识点搭建请先 create_experiment，再使用器具工具组装');
    if(!this.targetId)throw new Error('请先 create_experiment 新建本轮独立空间');
    if(['design_component','design_assembly'].includes(name))return;
    if(['update_design','remove_design'].includes(name)){
      if(this.originalDesigns.has(args.designId))throw new Error('本轮只能编辑新制作的器具设计，原有设计保留');return;
    }
    if((args.experimentId||workspace.activeId)!==this.targetId)throw new Error('本轮只能编辑新创建的实验空间，原有空间保留');
  }
  record(name,args,output){
    if(name==='create_experiment')this.targetId=output.result.id;
    if(name==='simulate_experiment'&&this.targetId&&(args.experimentId||output.workspace.activeId)===this.targetId){const d=output.workspace.experiments.find(d=>d.id===this.targetId);this.verified=signature(d);}
  }
  finish(workspace){
    const original=workspace.experiments.find(d=>d.id===this.targetId);
    if(!original?.components.length)throw new Error('尚未真正创建含器具的新空间，请调用工具完成搭建，不能仅回复方案。');
    const doc=structuredClone(original);
    if(this.verified!==signature(doc))throw new Error('请先调用 simulate_experiment 验证最终器具配置，再报告完成。');
    doc.learning={...doc.learning,knowledgePrompt:{id:this.entry.id,title:this.entry.title,version:this.entry.version,support:this.entry.support,supportLabel:this.entry.supportLabel,limitations:this.entry.limitations,prompt:this.prompt}};
    const needsLabel=this.entry.support==='conceptual'?!doc.title.includes('概念示意'):this.entry.support==='approximation'&&!/近似|类比/.test(doc.title);
    if(needsLabel)doc.title=doc.title.slice(0,80)+' · '+this.entry.supportLabel;
    doc.goal=(doc.goal.trim()||this.entry.objective).slice(0,1500)+'\n模型范围：'+this.entry.supportLabel+'。'+this.entry.limitations;
    validateExperiment(doc);
    workspace.experiments[workspace.experiments.indexOf(original)]=doc;
    workspace.activeId=doc.id;
    return {knowledgeId:this.entry.id,title:this.entry.title,experimentId:doc.id,support:this.entry.support,supportLabel:this.entry.supportLabel,limitations:this.entry.limitations};
  }
}
