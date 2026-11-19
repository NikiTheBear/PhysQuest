import data from '@knowledge/knowledge-prompts.json';
export interface KnowledgePrompt {
  id:string;title:string;domain:string;domainLabel:string;stage:string;stageLabel:string;version:number;
  support:'direct'|'approximation'|'conceptual';supportLabel:string;objective:string;construction:string;
  variables:string[];observations:string[];limitations:string;models:string[];formula?:string;prompt:string;
}
export const KNOWLEDGE_PROMPTS=data as KnowledgePrompt[];
export const promptById=(id:string)=>KNOWLEDGE_PROMPTS.find(p=>p.id===id);
