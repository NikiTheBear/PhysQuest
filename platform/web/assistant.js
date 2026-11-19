import {readDeepSeekKey} from '../shared/api-key.js';
import { renderMarkdown } from './markdown.js';
import { getKnowledgePrompt } from '../shared/knowledge-prompts.js';
export function setupAssistant({getWorkspace,getSelectedId,isOnline,beforeRequest,applyResult,setBusy,toast,openAssistant}){
  const $=id=>document.getElementById(id);let busy=false,knowledgeTask=null,clock,pendingMessage;const history=[];
  let resumeId=null;
  async function readActivity(response){
    if(!response.ok || !response.headers.get('content-type')?.includes('ndjson')){
      const data=await response.json();if(!response.ok)throw new Error(data.error);return data;
    }
    const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
    const rows=new Map(), log=document.createElement('div');
    log.className='chat-trace';pendingMessage.append(log);
    let buffer='';
    while(true){
      const {value,done}=await reader.read();if(done)throw new Error('连接已中断，请检查实验状态。');
      buffer+=value;
      let end;
      while((end=buffer.indexOf('\n'))>=0){
        const event=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);
        if(event.type==='result')return event.result;
        if(event.type==='error')throw new Error(event.message);
        const caption=pendingMessage.querySelector('.chat-content');
        if(event.type==='planning')caption.textContent='分析下一步 · 第 '+event.round+' 轮';
        if(event.type==='start'){
          const row=document.createElement('div');rows.set(event.index,row);log.append(row);
          row.textContent=event.index+' · '+event.tool+' · 调用中';caption.textContent='正在调用 '+event.tool;
        }
        if(event.type==='end' && rows.has(event.index)){
          rows.get(event.index).textContent=event.index+' · '+event.tool+' · '+(event.ok?'完成':event.error||'失败');
        }
        scrollMessages();
      }
    }
  }
  const emptyMessage=$('chat-messages').firstElementChild.cloneNode(true);
  function resizeComposer(){const input=$('deepseek-prompt');input.style.height='auto';input.style.height=Math.min(144,Math.max(76,input.scrollHeight))+'px';}
  function draft(text){$('deepseek-prompt').value=text;resizeComposer();}
  function status(text){$('chat-status').textContent=text;}
  function scrollMessages(){const log=$('chat-messages');log.scrollTop=log.scrollHeight;}
  function append(role,text,error=false){
    $('chat-messages').querySelector('.chat-empty')?.remove();
    const div=document.createElement('div');div.className='chat-message '+role+(error?' error':'');
    const author=document.createElement('span');author.className='chat-author';author.textContent=error?'发送失败':role==='user'?'你':'AI 助手';
    const content=document.createElement('div');content.className='chat-content';if(error)content.textContent=text;else{content.classList.add('markdown');content.innerHTML=renderMarkdown(text);}
    div.append(author,content);$('chat-messages').append(div);scrollMessages();return div;
  }
  function state(value){
    busy=value;setBusy(value);clearInterval(clock);
    for(const id of ['chat-send','chat-clear','deepseek-prompt','deepseek-model','deepseek-thinking','deepseek-key','clear-key','cancel-knowledge-task'])$(id).disabled=value;
    $('chat-send').textContent=value?'处理中…':knowledgeTask?'搭建实验':'发送';$('chat-messages').setAttribute('aria-busy',String(value));
    if(value){const started=Date.now();clock=setInterval(()=>{$('chat-status').textContent='任务进行中 · '+Math.floor((Date.now()-started)/1000)+' 秒';},1000);}
  }
  function showTask(){const entry=knowledgeTask&&getKnowledgePrompt(knowledgeTask);$('knowledge-task').hidden=!entry;$('knowledge-task-title').textContent=entry?entry.title+' · '+entry.supportLabel:'';$('knowledge-task-description').textContent=entry?['实验目标：'+entry.objective,'搭建方案：'+entry.construction,'可调变量：'+entry.variables.join('、'),'观测量：'+entry.observations.join('、'),'模型范围：'+entry.limitations].join('\n'):'';$('chat-send').textContent=entry?'搭建实验':'发送';$('chat-scope').textContent=entry?'新空间 · '+entry.title:'操作当前实验';}
  function settings(){
    const dialog=$('assistant-preferences');
    if(!dialog.open)dialog.showModal();
    $('deepseek-key').focus();
  }
  $('assistant-settings').onclick=settings;
  $('deepseek-key').oninput=()=>$('ai-key-status').textContent=$('deepseek-key').value?'会话中已填写':'未配置';
  $('clear-key').onclick=()=>{$('deepseek-key').value='';$('deepseek-key').oninput();toast('API Key 已从当前页面清除');};
  $('cancel-knowledge-task').onclick=()=>{resumeId=null;knowledgeTask=null;showTask();draft('');status('已取消知识点搭建任务，当前空间不变。');};
  $('chat-clear').onclick=()=>{history.length=0;$('chat-messages').replaceChildren(emptyMessage.cloneNode(true));status('对话已清空，器具和空间不变。');};
  $('deepseek-prompt').oninput=resizeComposer;
  async function send(){
    if(busy)return;if(!isOnline())return toast('内置 DeepSeek 需要在线站点或本地服务，离线 HTML 无法代理 API 请求');
    const prompt=$('deepseek-prompt').value.trim(),knowledgeId=knowledgeTask;
    if(!prompt)return toast('请描述本次任务');
    let key;
    try{key=readDeepSeekKey($('deepseek-key').value);}
    catch(error){
      status('消息已保留。'+error.message);settings();
      $('ai-key-status').textContent=error.message;return;
    }
    state(true);let sent=false;
    try{
      await beforeRequest();const before=structuredClone(getWorkspace());sent=true;append('user',prompt);draft('');pendingMessage=append('assistant','正在思考并操作实验…');pendingMessage.classList.add('pending');status('DeepSeek 正在通过 MCP 工具搭建、验证，完成后整轮保存…');
      const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json','X-DeepSeek-Key':key,Accept:'application/x-ndjson'},body:JSON.stringify({revision:before.revision,resumeId,selectedId:getSelectedId(),model:$('deepseek-model').value,thinking:$('deepseek-thinking').checked,messages:[...(knowledgeId?[]:history.slice(-18)),{role:'user',content:prompt}],...(knowledgeId?{knowledgeId}:{})})});
      const result=await readActivity(response);resumeId=result.resumeId||null;
      await applyResult(result,before);pendingMessage?.remove();pendingMessage=null;if(knowledgeId)history.length=0;history.push({role:'user',content:prompt},{role:'assistant',content:result.message});const div=append('assistant',result.message);
      if(result.paused){
        const next=document.createElement('button');next.className='text-button';next.textContent='继续任务';
        const checkpoint=result.resumeId||null,space=result.workspace.activeId;
        next.onclick=()=>{
          if(busy)return;
          if(getWorkspace().activeId!==space)return toast('请先切回该实验空间');
          resumeId=checkpoint;knowledgeTask=knowledgeId;showTask();
          draft(knowledgeId?prompt:'继续之前的任务：'+prompt.slice(-5900));void send();
        };
        div.append(next);
      }
      if(result.build){const summary=document.createElement('div');summary.className='chat-build-result';summary.textContent='已搭建：'+result.build.title+' · '+result.build.supportLabel+'。'+result.build.limitations;div.prepend(summary);knowledgeTask=null;showTask();}
      if(result.actions.length){const details=document.createElement('details');details.className='chat-trace';const summary=document.createElement('summary');summary.textContent=result.actions.length+' 次 MCP 工具调用 · '+(result.changed?'已整体保存':'只读查询');details.append(summary);for(const a of result.actions){const row=document.createElement('div');row.textContent=(a.ok?'✓ ':'× ')+a.tool+(a.error?' · '+a.error:'');details.append(row);}div.append(details);}
      const meta=document.createElement('small');meta.textContent=result.model+' · '+result.totalTokens.toLocaleString()+' tokens';div.append(meta);scrollMessages();status(result.changed?'本轮修改已保存，可使用工作台的「撤销」恢复。':'本轮未修改工作区。');
    }catch(error){if(pendingMessage){pendingMessage.classList.remove('pending');pendingMessage.querySelector('.chat-content').textContent='本次执行记录';}pendingMessage=null;if(sent)append('assistant',error.message,true);else toast(error.message);draft(prompt);status('未确认保存成功；消息已保留，可检查工作区后重试。');}
    finally{state(false);if(!$('ai-drawer').hidden&&!$('deepseek-panel').hidden&&document.visibilityState==='visible')$('deepseek-prompt').focus({preventScroll:true});}
  }
  $('chat-send').onclick=send;
  $('deepseek-prompt').onkeydown=e=>{if(!e.isComposing&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  return {showChat:resizeComposer,prepareCard({title,goal,formula,preset}){
    if(busy)return toast('当前任务完成后可载入新卡片');
    resumeId=null;knowledgeTask=null;showTask();
    const task='实验目标：'+title+'。探究：'+goal+(formula?'\n理论参考：'+formula:'')+(preset!=='{}'?'\n光具座参考参数（长度单位 cm）：'+preset:'');
    draft(task+'\n请新建实验，设置上述目标，搭建器具并用仿真检查可观测现象，说明模型范围。');
    status('卡片目标已载入，可编辑后发送。');
  },startKnowledgeBuild({knowledgeId,prompt}){
    if(busy){toast('当前 AI 任务仍在执行，请完成后再发起新的知识点搭建。');return false;}
    const entry=getKnowledgePrompt(knowledgeId);if(typeof prompt!=='string'||!prompt.trim()||prompt.length>6000)throw new Error('搭建提示词须为 1–6000 字');
    resumeId=null;knowledgeTask=entry.id;showTask();draft(prompt);
    if($('deepseek-key').value.trim())send();else{settings();status('提示词已载入。填写 DeepSeek API Key 后点击“搭建实验”。');$('deepseek-key').focus();toast('已载入「'+entry.title+'」提示词，请填写 DeepSeek API Key');}
    return true;
  }};
}
