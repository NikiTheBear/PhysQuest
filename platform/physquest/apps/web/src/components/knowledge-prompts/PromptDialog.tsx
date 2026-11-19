import {useEffect,useRef,useState} from 'react';
import type {KnowledgePrompt} from '../../data/knowledge-prompts';
interface Props {entry:KnowledgePrompt;onClose:()=>void;onBuild:(id:string,title:string,prompt:string)=>void;}
export default function PromptDialog({entry,onClose,onBuild}:Props){
  const key='physquest.knowledge-prompt.v1:'+entry.id;
  const [prompt,setPrompt]=useState(()=>{try{return localStorage.getItem(key)||entry.prompt;}catch{return entry.prompt;}});
  const [notice,setNotice]=useState('');const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
  function edit(value:string){setPrompt(value);try{localStorage.setItem(key,value);}catch{setNotice('草稿暂未保存到浏览器，可先下载提示词。');}}
  async function copy(){try{await navigator.clipboard.writeText(prompt);setNotice('提示词已复制，可交给已连接 MCP 的 AI。');}catch{setNotice('复制不可用，请在下方文本框中选择并复制。');}}
  function download(){const url=URL.createObjectURL(new Blob([prompt],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=entry.id+'-'+entry.title+'.prompt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  return <dialog className="pq-prompt-dialog" ref={dialog} onCancel={onClose} aria-labelledby="prompt-dialog-title">
    <div className="pq-prompt-heading"><div><span className="eyebrow">{entry.id} · {entry.domainLabel} · {entry.stageLabel}</span><h2 id="prompt-dialog-title">{entry.title}</h2></div><button onClick={onClose} className="btn-ghost" aria-label="关闭实验提示词">关闭</button></div>
    <div className="pq-prompt-body"><span className={'pq-support '+entry.support}>{entry.supportLabel}</span><p className="pq-prompt-objective">{entry.objective}</p><p className="pq-prompt-limit">{entry.limitations}</p>
      <details className="pq-prompt-plan"><summary>查看器具与观测计划</summary><p>{entry.construction}</p><p><b>可调变量：</b>{entry.variables.join('；')}</p><p><b>观测量：</b>{entry.observations.join('；')}</p>{entry.formula&&<p><b>理论参考：</b>{entry.formula}</p>}</details>
      <div className="pq-prompt-label"><label htmlFor="knowledge-prompt-text">搭建提示词 · 可直接修改</label><span>{prompt.length} / 6000</span></div><textarea id="knowledge-prompt-text" value={prompt} maxLength={6000} spellCheck={false} onChange={e=>edit(e.target.value)} />
      <div className="pq-prompt-utilities"><button className="btn-ghost" onClick={copy}>复制提示词</button><button className="btn-ghost" onClick={download}>下载提示词</button><button className="btn-ghost" onClick={()=>{edit(entry.prompt);setNotice('已恢复原始提示词。');}}>恢复原文</button></div>
      <p className="pq-prompt-note">在新空间搭建，保留已有实验。已填写 DeepSeek Key 时点击即执行；尚未填写时会打开配置面板。调用使用你的 DeepSeek 额度。</p>{notice&&<p role="status" className="pq-prompt-notice">{notice}</p>}
    </div><div className="pq-prompt-footer"><button className="btn-ghost" onClick={onClose}>返回知识地图</button><button className="btn-primary" disabled={!prompt.trim()} onClick={()=>onBuild(entry.id,entry.title,prompt)}>用 DeepSeek 搭建</button></div>
  </dialog>;
}
