import { getKnowledgePrompt } from '../shared/knowledge-prompts.js';
export function setupAssistant({getWorkspace,getSelectedId,isOnline,beforeRequest,applyResult,setBusy,toast,openAssistant}){
  const $=id=>document.getElementById(id);let busy=false,knowledgeTask=null,clock,pendingMessage;const history=[];
  const emptyMessage=$('chat-messages').firstElementChild.cloneNode(true);
  function resizeComposer(){const input=$('deepseek-prompt');input.style.height='auto';input.style.height=Math.min(144,Math.max(76,input.scrollHeight))+'px';}
  function draft(text){$('deepseek-prompt').value=text;resizeComposer();}
  function status(text){$('chat-status').textContent=text;}
  function scrollMessages(){const log=$('chat-messages');log.scrollTop=log.scrollHeight;}
  function append(role,text,error=false){
    $('chat-messages').querySelector('.chat-empty')?.remove();
    const div=document.createElement('div');div.className='chat-message '+role+(error?' error':'');
    const author=document.createElement('span');author.className='chat-author';author.textContent=error?'发送失败':role==='user'?'你':'AI 助手';
    const content=document.createElement('div');content.className='chat-content';content.textContent=text;
    div.append(author,content);$('chat-messages').append(div);scrollMessages();return div;
  }
  function state(value){
    busy=value;setBusy(value);clearInterval(clock);
    for(const id of ['chat-send','chat-clear','deepseek-prompt','deepseek-model','deepseek-thinking','deepseek-key','clear-key','cancel-knowledge-task'])$(id).disabled=value;
    $('chat-send').textContent=value?'处理中…':knowledgeTask?'搭建实验':'发送';$('chat-messages').setAttribute('aria-busy',String(value));
    if(value){const started=Date.now();clock=setInterval(()=>{$('chat-status').textContent='AI 正在操作器具 · '+Math.floor((Date.now()-started)/1000)+' 秒';},1000);}
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
  $('cancel-knowledge-task').onclick=()=>{knowledgeTask=null;showTask();draft('');status('已取消知识点搭建任务，当前空间不变。');};
  $('chat-clear').onclick=()=>{history.length=0;$('chat-messages').replaceChildren(emptyMessage.cloneNode(true));status('对话已清空，器具和空间不变。');};
  $('deepseek-prompt').oninput=resizeComposer;
  async function send(){
    if(busy)return;if(!isOnline())return toast('内置 DeepSeek 需要在线站点或本地服务，离线 HTML 无法代理 API 请求');
    const key=$('deepseek-key').value.trim(),prompt=$('deepseek-prompt').value.trim(),knowledgeId=knowledgeTask;
    if(!prompt)return toast('请描述本次任务');
    if(!key){status('消息已保留，请先填写 DeepSeek API Key。');await settings();return toast('填写 Key 后即可发送，消息已保留');}
    state(true);let sent=false;
    try{
      await beforeRequest();const before=structuredClone(getWorkspace());sent=true;append('user',prompt);draft('');pendingMessage=append('assistant','正在思考并操作实验…');pendingMessage.classList.add('pending');status('DeepSeek 正在通过 MCP 工具搭建、验证，完成后整轮保存…');
      const response=await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json','X-DeepSeek-Key':key},body:JSON.stringify({revision:before.revision,selectedId:getSelectedId(),model:$('deepseek-model').value,thinking:$('deepseek-thinking').checked,messages:[...(knowledgeId?[]:history.slice(-18)),{role:'user',content:prompt}],...(knowledgeId?{knowledgeId}:{})})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'请求失败');
      await applyResult(result,before);pendingMessage?.remove();pendingMessage=null;if(knowledgeId)history.length=0;history.push({role:'user',content:prompt},{role:'assistant',content:result.message});const div=append('assistant',result.message);
      if(result.build){const summary=document.createElement('div');summary.className='chat-build-result';summary.textContent='已搭建：'+result.build.title+' · '+result.build.supportLabel+'。'+result.build.limitations;div.prepend(summary);knowledgeTask=null;showTask();}
      if(result.actions.length){const details=document.createElement('details');details.className='chat-trace';const summary=document.createElement('summary');summary.textContent=result.actions.length+' 次 MCP 工具调用 · '+(result.changed?'已整体保存':'只读查询');details.append(summary);for(const a of result.actions){const row=document.createElement('div');row.textContent=(a.ok?'✓ ':'× ')+a.tool+(a.error?' · '+a.error:'');details.append(row);}div.append(details);}
      const meta=document.createElement('small');meta.textContent=result.model+' · '+result.totalTokens.toLocaleString()+' tokens';div.append(meta);scrollMessages();status(result.changed?'本轮修改已保存，可使用工作台的「撤销」恢复。':'本轮未修改工作区。');
    }catch(error){pendingMessage?.remove();pendingMessage=null;if(sent)append('assistant',error.message,true);else toast(error.message);draft(prompt);status('未确认保存成功；消息已保留，可检查工作区后重试。');}
    finally{state(false);if(!$('ai-drawer').hidden&&!$('deepseek-panel').hidden&&document.visibilityState==='visible')$('deepseek-prompt').focus({preventScroll:true});}
  }
  $('chat-send').onclick=send;
  $('deepseek-prompt').onkeydown=e=>{if(!e.isComposing&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
  return {showChat:resizeComposer,prepareCard({title,goal,formula,preset}){
    if(busy)return toast('当前任务完成后可载入新卡片');
    knowledgeTask=null;showTask();
    const task='实验目标：'+title+'。探究：'+goal+(formula?'\n理论参考：'+formula:'')+(preset!=='{}'?'\n光具座参考参数（长度单位 cm）：'+preset:'');
    draft(task+'\n请新建实验，设置上述目标，搭建器具并用仿真检查可观测现象，说明模型范围。');
    status('卡片目标已载入，可编辑后发送。');
  },startKnowledgeBuild({knowledgeId,prompt}){
    if(busy){toast('当前 AI 任务仍在执行，请完成后再发起新的知识点搭建。');return false;}
    const entry=getKnowledgePrompt(knowledgeId);if(typeof prompt!=='string'||!prompt.trim()||prompt.length>6000)throw new Error('搭建提示词须为 1–6000 字');
    knowledgeTask=entry.id;showTask();draft(prompt);
    if($('deepseek-key').value.trim())send();else{settings();status('提示词已载入。填写 DeepSeek API Key 后点击“搭建实验”。');$('deepseek-key').focus();toast('已载入「'+entry.title+'」提示词，请填写 DeepSeek API Key');}
    return true;
  }};
}
