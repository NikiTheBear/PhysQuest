import {saveArchive,listArchives,loadArchive,deleteArchive} from './archives.js';
import { CATALOG, DOMAINS, COUPLINGS, blankWorkspace, activeExperiment, uid, RIGID_KINDS, ENDPOINT_KINDS, LINK_KINDS, CIRCUIT_KINDS, SOUND_KINDS } from '../shared/catalog.js';
import { runTool } from '../worker/operations.js';
import { EXPERIMENT_FILES } from '../shared/experiment-library.js';
import { mutate, validateExperiment, exportExperimentFile } from '../shared/workspace.js';
import { Simulation, DT } from '../shared/physics.js';
import { LabScene } from './scene.js';
import { icon, hydrateIcons } from './icons.js';
import { setupWorkshop } from './workshop.js';
import { setupAssistant } from './assistant.js';
import {sliderTarget} from '../shared/sliders.js';
import { parameterPreview } from './parameter-preview.js';
import {colliderConfig,colliderOf,supportsCollider} from '../shared/colliders.js';

const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localServer=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const offline=location.protocol==='file:'||new URLSearchParams(location.search).get('offline')==='1';
const embedded=new URLSearchParams(location.search).get('embed')==='1'&&parent!==window;
let bridgeReady=false,workbenchVisible=true;
if(embedded)document.body.classList.add('embedded');
let pendingWire=null,aiBusy=false,sliderPreview=null,inspectorContext='';const undoStack=[],redoStack=[];
function updateHistory(){ $('undo-btn').disabled=!undoStack.length||pending>0;$('redo-btn').disabled=!redoStack.length||pending>0;}
function remember(before){undoStack.push(structuredClone(before));if(undoStack.length>20)undoStack.shift();redoStack.length=0;}
async function travelHistory(redo=false){if(pending)return;const source=redo?redoStack:undoStack,target=redo?undoStack:redoStack,entry=source.at(-1);if(!entry)return;const current=structuredClone(workspace),result=await command('restore_workspace',{workspace:entry},{noHistory:true});if(result){source.pop();target.push(current);selected=null;render();toast(redo?'已重做':'已撤销');}updateHistory();}
let workspace=blankWorkspace(),selected=null,category='all',inspectorTab='properties',chartMode='signal',channel='',online=false,pending=0,queue=Promise.resolve(),physicsSignature='',toastTimer,audioContext,audioNodes=[],audioEnabled=false,aiTools=[];
let sim=new Simulation(activeExperiment(workspace));
const scene=new LabScene({onSelect:id=>{selected=id;inspectorTab='properties';scene.select(id);$('axis-help').hidden=!id||scene.isBound(doc().components.find(c=>c.id===id));renderInspector();},onMove:(id,position)=>command('update_component',{componentId:id,position}),onDragStart:()=>{if(doc().control.running)command('control_simulation',{running:false});},onPort:(id,port)=>wirePort(id,port),onFallback:()=>setTimeout(()=>{$('mode-3d').disabled=true;toast('当前设备无法启动 WebGL，已启用 2D 画布。');},0)});
const doc=()=>activeExperiment(workspace);
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function download(name,text,type='application/json'){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function saveStatus(text,error=false){$('save-state').classList.toggle('error',error);$('save-state').innerHTML='<i></i>'+esc(text);}
async function command(name,args={},options={}) {
  if(aiBusy){const error=new Error('AI 正在修改实验，请等待本轮完成');if(options.throw)throw error;toast(error.message);return null;}
  pending++;updateHistory();saveStatus('正在保存');let failed=false;
  const promise=queue.then(async()=>{
    if(typeof args==='function')args=args();
    let output;const before=structuredClone(workspace);
    if(online){
      const response=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,arguments:args,revision:workspace.revision})});
      const data=await response.json();
      if(!response.ok){
        if(response.status===409){const draft=mutate(workspace,name,args).workspace;download('Fieldlab-冲突草稿.json',JSON.stringify(activeExperiment(draft),null,2));workspace=await(await fetch('/api/state')).json();render();throw new Error('远端已更新。你的修改已下载为草稿，请重新导入或重试。');}
        throw new Error(data.error||'保存失败');
      }output=data;
    }else output=runTool(workspace,name,args);
    if(!options.noHistory&&!['activate_experiment','control_simulation'].includes(name))remember(before);
    workspace=output.workspace;localStorage.setItem('fieldlab-workspace',JSON.stringify(workspace));
    if(options.selectResult)selected=output.result.id;
    if(options.selectNone)selected=null;
    render();return output.result;
  });
  queue=promise.catch(e=>{failed=true;toast(e.message);}).finally(()=>{pending--;updateHistory();if(!sliderPreview)saveStatus(failed?'保存失败，请重试':online?(localServer?'已保存到本机':'已保存到云端'):'仅保存在本机',failed||!online);});
  try{return await promise;}catch(e){if(options.throw)throw e;return null;}
}
function syncSimulation(d){
  const signature=JSON.stringify({id:d.id,mode:d.mode,components:d.components,connections:d.connections,environment:{...d.environment,speed:1},reset:d.control.reset});
  if(signature!==physicsSignature){physicsSignature=signature;sim.reset(d);scene.setDoc(d);scene.select(selected);syncAudio(d);}else sim.doc=structuredClone(d);
}
function applySliderPreview(){
  if(!sliderPreview)return false;
  const draft=sliderPreview;draft.dirty=false;
  if(draft.experimentId!==doc().id||!draft.element.isConnected){sliderPreview=null;return false;}
  try{syncSimulation(parameterPreview(doc(),draft));draft.element.setCustomValidity('');draft.element.removeAttribute('aria-invalid');chartClock=0;}
  catch(error){draft.element.setCustomValidity(error.message);draft.element.setAttribute('aria-invalid','true');}
  return true;
}
function render(){
  const d=doc();if(selected&&!d.components.some(c=>c.id===selected))selected=null;
  $('objective-text').textContent=d.goal||'尚未设置目标';
  $('observation-text').textContent=d.observation?'观察指引：'+d.observation:'';
  $('observation-text').hidden=!d.observation;
  if(!applySliderPreview())syncSimulation(d);
  $('title-btn').innerHTML=esc(d.title)+' '+icon('chevron');$('space-count').textContent=String(workspace.experiments.length).padStart(2,'0');$('empty-scene').hidden=d.components.length>0;$('object-count').textContent=d.components.length+' 个器具';$('connection-count').textContent=d.connections.length;
  $('mode-2d').classList.toggle('selected',d.mode==='2d');$('mode-3d').classList.toggle('selected',d.mode==='3d');$('speed').value=d.environment.speed;
  $('play-btn').innerHTML=icon(d.control.running?'pause':'play')+`<span>${d.control.running?'暂停':'运行'}</span>`;$('scene-state').textContent=d.control.running?'仿真运行中':'自由构建';$('solver-status').textContent=d.control.running?'求解器运行中':'求解器就绪';$('view-caption').innerHTML=d.mode==='2d'?'正交视图 <span>·</span> 选中后拖动 X/Y 箭头':'透视视图 <span>·</span> 拖动旋转 · 选中后拖动坐标轴';
  if(pendingWire&&!d.components.some(c=>c.id===pendingWire.id)){pendingWire=null;scene.pendingWire=null;}$('axis-help').hidden=!selected||scene.isBound(d.components.find(c=>c.id===selected));updateHistory();renderLibrary();renderInspector();renderVariableSliders();renderChannels();hydrateIcons();
}
function renderLibrary(){
  $('categories').innerHTML=[['all','全部'],...Object.entries(DOMAINS).map(([k,d])=>[k,d.name]),['custom','我的']].map(([key,label])=>`<button data-category="${key}" class="${key===category?'active':''}">${label}</button>`).join('');
  const search=$('search').value.trim().toLowerCase(),groups=[];
  const card=(kind,name,description,design='')=>`<button class="instrument-card" style="--color:${DOMAINS[CATALOG[kind].domain].color}" data-add="${kind}" data-design="${design}" title="${esc(description)}"><span class="instrument-glyph">${icon(CATALOG[kind].icon)}</span><strong>${esc(name)}</strong><span class="add-sign">+</span></button>`;
  if(category!=='custom')for(const [domain,d] of Object.entries(DOMAINS)){
    if(category!=='all'&&category!==domain)continue;const items=Object.entries(CATALOG).filter(([kind,c])=>c.domain===domain&&(!search||(c.name+c.description+kind).toLowerCase().includes(search)));
    if(items.length)groups.push(`<h3 class="library-group-title"><span>${d.name}器具</span><span>${String(items.length).padStart(2,'0')}</span></h3><div class="instrument-grid">${items.map(([kind,c])=>card(kind,c.name,c.description)).join('')}</div>`);
  }
  const designs=workspace.designs.filter(c=>(category==='all'||category==='custom')&&(!search||(c.name+c.description).toLowerCase().includes(search)));
  if(designs.length)groups.push(`<h3 class="library-group-title"><span>我的器具</span><span>${designs.length}</span></h3><div class="instrument-grid">${designs.map(c=>'<div class="design-card-wrap">'+card(c.kind||c.components[0].kind,c.name,(c.type==='assembly'?c.components.length+' 个部件 · ':'')+c.description,c.id)+'<button class="design-manage" data-manage-design="'+c.id+'" aria-label="编辑 '+esc(c.name)+'">⋯</button></div>').join('')}</div>`);
  $('library-items').innerHTML=groups.join('')||'<p class="empty-list">没有找到器具<br>试试其他关键词，或设计自定义器具。</p>';$('catalog-count').textContent=Object.keys(CATALOG).length+workspace.designs.length;
}
function parameter(key,spec,value,environment=false){
  if(spec.type==='expression')return `<label class="section-label">${esc(spec.label)}<input class="component-name" data-expression="${key}" maxlength="160" value="${esc(value)}"></label>`;
  return `<div class="param-row"><label for="num-${key}">${esc(spec.label)}<span>${esc(spec.unit)}</span></label><div class="param-values"><input type="range" data-range="${key}" ${environment?'data-env="true"':''} aria-label="${esc(spec.label)}" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}"><input type="number" id="num-${key}" data-param="${key}" ${environment?'data-env="true"':''} min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${value}" aria-label="${esc(spec.label)}数值"></div></div>`;}
function hero(kind,title,subtitle){return `<div class="inspector-hero"><span class="hero-icon">${icon(kind)}</span><div class="hero-text"><h3>${esc(title)}</h3><span>${esc(subtitle)}</span></div></div>`;}
function colliderEditor(c){
  if(!supportsCollider(c))return '<p class="input-hint">此器具是场、驱动器或两端连接，不使用独立碰撞箱。</p>';
  const hull=colliderOf(c);
  return `<details class="collision-details" open><summary>碰撞范围 <span>${hull.enabled?'已启用':'未启用'}</span></summary><label class="toggle-row">参与机械碰撞<input type="checkbox" class="toggle" id="collider-enabled" ${hull.enabled?'checked':''}></label><label class="section-label" for="collider-shape">碰撞形状</label><select id="collider-shape" class="field-select"><option value="auto" ${hull.shape==='auto'?'selected':''}>随器具形状</option><option value="box" ${hull.shape==='box'?'selected':''}>自定义长方体</option></select>${hull.shape==='box'?hull.size.map((v,i)=>parameter('collider-size-'+i,{label:['碰撞宽度 X','碰撞高度 Y','碰撞深度 Z'][i],unit:'m',min:.02,max:60,step:.02},v).replace('data-range="collider-size-'+i+'"','data-collider-range="'+i+'"').replace('data-param="collider-size-'+i+'"','data-collider-size="'+i+'"')).join(''):'<p class="input-hint">范围：'+hull.size.map(v=>Number(v.toFixed(3))).join(' × ')+' m，随物理尺寸更新。</p>'}<label class="section-label">局部中心偏移 / m</label><div class="position-grid">${hull.offset.map((v,i)=>'<label><span>'+['X','Y','Z'][i]+'</span><input type="number" data-collider-offset="'+i+'" value="'+v+'" min="-30" max="30" step=".1" aria-label="碰撞中心偏移 '+['X','Y','Z'][i]+'"></label>').join('')}</div><button class="text-button" id="reset-collider">恢复默认范围</button>${!doc().environment.collisions?'<p class="warning-note">环境碰撞已关闭。<button id="enable-collisions" class="text-button">开启全局碰撞</button></p>':''}<p class="input-hint">蓝色线框参与碰撞，灰色为停用。编辑时可自由摆放，运行后发生阻挡。${RIGID_KINDS.includes(c.kind)?'':'此器具作为固定障碍物。'} 碰撞范围不改变外观和光路。</p></details>`;
}
function renderInspector(){
  const experiment=doc();
  const focus=experiment.components.find(component=>component.id===selected);
  $('agent-context').textContent=[
    experiment.title+' · '+experiment.mode.toUpperCase(),
    '目标：'+(experiment.goal||'尚未设置'),
    experiment.components.length+' 个器具 · '+experiment.connections.length+' 条连接',
    '当前选中：'+(focus?.name||'无')
  ].join(' ｜ ');

  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===inspectorTab));const d=doc(),c=d.components.find(c=>c.id===selected),el=$('inspector-content');
  if(sliderPreview?.element.isConnected&&sliderPreview.experimentId===d.id&&sliderPreview.componentId===selected&&sliderPreview.environment===(inspectorTab==='environment'))return;
  const context=d.id+':'+selected+':'+inspectorTab,focused=document.activeElement;
  if(inspectorContext===context&&el.contains(focused)&&focused.matches('input[type=number],textarea')&&focused.value!==focused.dataset.committed)return;
  inspectorContext=context;if(!sliderPreview?.element.closest('#experiment-sliders'))sliderPreview=null;
  if(inspectorTab==='objects'){
    el.innerHTML=hero('cube','场景对象',d.components.length+' 个器具 · 点击选中，F 聚焦')+d.components.map(c=>'<div class="object-row '+(c.id===selected?'active':'')+'"><button data-select-object="'+c.id+'">'+esc(c.name)+'<small>'+esc(CATALOG[c.kind].name)+'</small></button><button class="icon-button small" data-focus-object="'+c.id+'" aria-label="聚焦 '+esc(c.name)+'">'+icon('focus')+'</button></div>').join('')+(!d.components.length?'<p class="empty-list">添加器具后在此快速定位。</p>':'');return;
  }
  if(inspectorTab==='environment'){
    el.innerHTML=hero('sliders','环境设置','所有器具共享的物理空间')+`<div class="section-label">物理环境</div>${parameter('gravity',{label:'重力加速度',unit:'m/s²',min:0,max:25,step:.01},d.environment.gravity,true)}${parameter('damping',{label:'线性环境阻尼',unit:'kg/s',min:0,max:5,step:.01},d.environment.damping,true)}<label class="toggle-row">地面与刚体碰撞<input class="toggle" type="checkbox" id="collisions" ${d.environment.collisions?'checked':''}></label><hr class="section-rule"><div class="section-label">数值计算</div><div class="overview-row"><span>基础步长</span><strong>1/480 s</strong></div><div class="overview-row"><span>刚体 / 音圈 / 电路</span><strong>Cannon / RK4 / 节点法</strong></div><div class="overview-row"><span>空间边界</span><strong>${d.components.some(c=>c.kind==='floor_slab')?'有限地面器具':'默认地面 y = 0'}</strong></div><div class="concept-box"><span class="eyebrow">CONTROL THE CONDITIONS</span><p>默认无重力。你可以添加重力、阻尼和碰撞，逐步构建需要的实验条件。</p></div><p class="input-hint" style="margin-top:18px">更改物理参数后，仿真将从初始条件重新计时。时间倍率只改变播放速度。</p>`;return;
  }
  if(inspectorTab==='connections'){
    el.innerHTML=hero('link','物理过程连接','把不同领域的器具联系起来')+`<button class="outline-button full" id="connect-btn">${icon('plus')}添加连接</button>`+d.connections.map(l=>`<div class="connection-card"><h4>${esc(COUPLINGS[l.kind].name)}<button class="icon-button small" data-remove-link="${l.id}" aria-label="删除连接">${icon('close')}</button></h4><p>${esc(d.components.find(c=>c.id===l.source)?.name)} ${l.kind==='wire'?l.sourcePort.toUpperCase():''}<br><span style="color:#c6a485">↓</span> ${esc(d.components.find(c=>c.id===l.target)?.name)} ${l.kind==='wire'?l.targetPort.toUpperCase():''}</p>${l.kind==='wire'?'<div class="gain">IDEAL WIRE · 理想导线</div>':'<div class="gain">GAIN '+l.gain.toFixed(2)+'</div>'}</div>`).join('')+(!d.connections.length?'<div class="empty-selection"><span>'+icon('link')+'</span><p>让物理发生联系</p><small>点击电路器具的 A/B 端子接线，或在这里选择连接。</small></div>':'')+`<hr class="section-rule"><div class="section-label">可用连接</div>${Object.values(COUPLINGS).map(k=>`<div class="connection-card"><h4>${k.name}</h4><p>${esc(k.description)}</p></div>`).join('')}<p class="input-hint">机械连接器具的两端在属性中设置。电路导线直接连接 A/B 端子，参考地定义零电位。电场和磁场通过空间位置自动作用，不需要接线。换能连接采用单向线性模型。</p>`;return;
  }
  if(!c){
    const domains=new Set(d.components.map(c=>CATALOG[c.kind].domain));
    el.innerHTML=hero('cube','实验空间',d.mode==='3d'?'三维 · 自由构建':'二维 · 自由构建')+`<label class="section-label" for="goal-input">${icon('target')}实验目标</label><textarea class="goal-input" id="goal-input" placeholder="你想研究什么？\n写下问题、变量或想观测的现象…">${esc(d.goal)}</textarea><p class="input-hint">离开输入框时自动保存，AI 也可以读取和修改。</p>${d.learning?'<details class="learning-details"><summary>原版实验说明</summary><p>'+esc(d.learning.hint||'')+'</p><p>'+esc(d.learning.prediction?.prompt||'')+'</p>'+(d.learning.prediction?.options||[]).map((o,i)=>'<p>'+String.fromCharCode(65+i)+'. '+esc(o)+'</p>').join('')+'<button id="edit-learning">编辑实验说明</button></details>':''}<hr class="section-rule"><div class="section-label">空间概览</div><div class="overview-row"><span>器具数量</span><strong>${String(d.components.length).padStart(2,'0')}</strong></div><div class="overview-row"><span>跨物理过程连接</span><strong>${String(d.connections.length).padStart(2,'0')}</strong></div><div class="overview-row"><span>涉及领域</span><div class="domain-dots">${domains.size?[...domains].map(key=>`<i style="background:${DOMAINS[key].color}" title="${DOMAINS[key].name}"></i>`).join(''):'<span>—</span>'}</div></div><div class="empty-selection"><span>${icon('cursor')}</span><p>选择一个器具</p><small>在场景中点击器具，<br>查看并编辑它的物理属性。</small></div><div class="concept-box"><span class="eyebrow">BUILT BY YOU</span><p>器具、连接和目标，<br>都可以由你和 AI 编辑。</p></div>`;return;
  }
  const def=CATALOG[c.kind];
  el.innerHTML=hero(def.icon,c.name,DOMAINS[def.domain].name+' · '+def.description)+`<label class="section-label" for="component-name">器具名称</label><input class="component-name" id="component-name" value="${esc(c.name)}" maxlength="60"><hr class="section-rule"><div class="section-label">初始位置 <span class="muted">/ m</span></div>${scene.isBound(c)?'<p class="bound-hint">此器具的位置由两端决定。移动端点即可调整它的位置。</p>':''}<div class="position-grid">${['X','Y','Z'].map((axis,i)=>`<label><span>${axis}</span><input type="number" data-axis="${i}" value="${c.position[i]}" min="-30" max="30" step="0.1" aria-label="${axis} 位置" ${scene.isBound(c)||d.mode==='2d'&&i===2?'disabled':''}></label>`).join('')}</div>${RIGID_KINDS.includes(c.kind)?`<label class="toggle-row">固定在空间中<input class="toggle" id="fixed" type="checkbox" ${c.fixed?'checked':''}></label>`:''}${(LINK_KINDS.includes(c.kind)||c.kind==='distance_sensor')?'<hr class="section-rule"><div class="section-label">连接端点</div>'+['a','b'].map(key=>`<label class="section-label">端点 ${key.toUpperCase()}</label><select class="field-select" data-ref="${key}"><option value="">请选择器具</option>${d.components.filter(o=>o.id!==c.id&&(c.kind==='distance_sensor'||ENDPOINT_KINDS.includes(o.kind))).map(o=>`<option value="${o.id}" ${o.id===c.refs[key]?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`).join('')+(!c.refs.a||!c.refs.b?'<p class="warning-note">选择两个端点后，连接器具才会施加作用。</p>':''):''}${['force','drag','expression_force','harmonic_force','motion_sensor'].includes(c.kind)?'<hr class="section-rule"><label class="section-label">目标刚体</label><select class="field-select" data-ref="target"><option value="">请选择目标</option>'+d.components.filter(o=>RIGID_KINDS.includes(o.kind)).map(o=>'<option value="'+o.id+'" '+(o.id===c.refs.target?'selected':'')+'>'+esc(o.name)+'</option>').join('')+'</select>':''}${CIRCUIT_KINDS.includes(c.kind)?'<hr class="section-rule"><div class="section-label">电路端子 · 点击接线</div><div class="port-actions">'+def.terminals.map(port=>'<button data-wire-port="'+port+'">端子 '+port.toUpperCase()+(c.kind==='battery'?(port==='a'?' +':' −'):'')+'</button>').join('')+'</div><p class="input-hint">选中端子，再选中另一器具的端子建立导线。</p><div class="circuit-live" id="circuit-live"></div>':''}${colliderEditor(c)}<hr class="section-rule"><div class="section-label">物理参数</div>${Object.entries(def.params).map(([key,spec])=>parameter(key,spec,c.params[key])).join('')||'<p class="input-hint">此器具无额外参数，改变位置即可。</p>'}${c.kind==='coil'?'<p class="warning-note">音圈需置于 Z 方向磁场范围内，并通过「连接」接入信号电源，才能受到电磁驱动。</p>':''}<hr class="section-rule"><div class="inspector-actions"><button id="save-design">${icon('save')}保存为器具</button><button id="duplicate-component">${icon('copy')}复制</button><button id="delete-component" class="danger" aria-label="删除器具">${icon('trash')}</button></div>`;
}
function renderVariableSliders(){
  const panel=$('experiment-sliders'),sliders=doc().sliders||[];
  if(sliderPreview?.experimentId===doc().id&&panel.contains(sliderPreview.element))return;
  panel.hidden=!sliders.length;
  panel.innerHTML=sliders.length?'<strong>实验变量</strong>'+sliders.map((s,i)=>{
    const {spec,value}=sliderTarget(doc(),s);
    return `<label>${esc(s.label)} <output>${esc(value)}</output> ${esc(spec.unit)}<input type="range" data-slider="${i}" min="${s.min}" max="${s.max}" step="${s.step}" value="${value}"></label>`;
  }).join(''):'';
}
$('experiment-sliders').oninput=e=>{
  const el=e.target,s=doc().sliders?.[el.dataset.slider];if(!s)return;
  el.previousElementSibling.textContent=el.value;
  sliderPreview={element:el,experimentId:doc().id,componentId:s.componentId,key:s.parameter,value:Number(el.value),environment:s.componentId==null,dirty:true};
  saveStatus('实时预览 · 松开滑块保存');
};
$('experiment-sliders').onchange=async e=>{
  const s=doc().sliders?.[e.target.dataset.slider];if(!s)return;
  const value=Number(e.target.value),experimentId=doc().id;
  sliderPreview=null;
  const result=s.componentId==null?await command('update_experiment',{experimentId,environment:{[s.parameter]:value}}):await command('update_component',{experimentId,componentId:s.componentId,params:{[s.parameter]:value}});
  if(!result)render();
};
let displayedChart=null;
function renderChannels(){
  const snapshot=doc().chart,tab=$('ai-chart-tab');
  tab.hidden=!snapshot;
  if((snapshot?.id||null)!==displayedChart){
    displayedChart=snapshot?.id||null;
    if(snapshot)tab.click();else if(chartMode==='snapshot')document.querySelector('[data-chart="signal"]').click();
  }
  const measurable=Object.entries(sim.readings.channels).filter(([id,c])=>c.unit).sort(([a],[b])=>Number(a.includes(':'))-Number(b.includes(':'))).map(([id,c])=>({id,name:c.label}));if(!measurable.some(c=>c.id===channel))channel=measurable[0]?.id||'';
  $('channel-select').innerHTML=measurable.length?measurable.map(c=>`<option value="${c.id}" ${c.id===channel?'selected':''}>${esc(c.name)}</option>`).join(''):'<option value="">选择通道</option>';
}
function showModal(title,body,footer=''){const modal=$('modal');$('modal-content').innerHTML=`<div class="modal-header"><h2>${title}</h2><button data-close class="icon-button" aria-label="关闭">${icon('close')}</button></div><div class="modal-body">${body}<div id="modal-error" class="modal-error"></div></div>${footer?'<div class="modal-footer">'+footer+'</div>':''}`;if(!modal.open)modal.showModal();$('modal-content').querySelector('[data-close]').onclick=()=>modal.close();}
function errorInModal(error){$('modal-error').textContent=error.message||error;}
function editTitle(){showModal('命名你的实验空间','<p>一个问题，也可以成为一个实验的名字。</p><label for="new-title">名称</label><input id="new-title" maxlength="100" value="'+esc(doc().title)+'">','<button class="primary-button" id="title-save">保存名称</button>');$('title-save').onclick=async()=>{const value=$('new-title').value.trim();if(!value)return errorInModal('请输入名称');await command('update_experiment',{title:value});$('modal').close();};$('new-title').focus();$('new-title').select();}
function archiveModal(){
  showModal('实验存档','<label for="archive-name">存档名称</label><input id="archive-name" maxlength="100"><button class="primary-button" id="archive-save">保存当前实验</button><p>存档保存在此浏览器，包含器具、参数、连线、滑块和图表。加载后会从初始条件打开一个独立副本。</p><h3>我的存档</h3><div id="archive-list"></div>','<button id="archive-import">从 JSON 文件加载</button>');
  $('archive-name').value=doc().title;
  function refresh(){
    const entries=listArchives(localStorage);
    $('archive-list').innerHTML=entries.map(({id,name,savedAt})=>`<div class="archive-row"><span><strong>${esc(name)}</strong><small>${esc(new Date(savedAt).toLocaleString())}</small></span><button data-load="${esc(id)}">加载</button><button data-download="${esc(id)}">下载</button><button data-delete="${esc(id)}" aria-label="删除存档 ${esc(name)}">删除</button></div>`).join('')||'<p>尚无存档</p>';
  }
  try{refresh();}catch{errorInModal('浏览器存储不可用，可使用工具栏的导出实验。');}
  $('archive-save').onclick=async e=>{
    const button=e.currentTarget;button.disabled=true;
    try{await queue;saveArchive(localStorage,$('archive-name').value,doc());refresh();errorInModal('');toast('实验已存档');}
    catch(err){errorInModal(err.name==='QuotaExceededError'?'浏览器空间不足，请下载或移除旧存档。':err.message);}
    finally{button.disabled=false;}
  };
  $('archive-import').onclick=()=>$('import-file').click();
  $('archive-list').onclick=async e=>{
    const button=e.target.closest('button');if(!button)return;
    button.disabled=true;
    try{
      if(button.dataset.load){
        await command('import_experiment',{file:loadArchive(localStorage,button.dataset.load)},{throw:true,selectNone:true});
        $('modal').close();scene.fit();toast('已加载存档副本');
      }else if(button.dataset.download){
        const file=loadArchive(localStorage,button.dataset.download);
        download(file.experiment.title+'.pqexp.json',JSON.stringify(file));toast('存档已下载');
      }else if(button.dataset.delete&&confirm('删除这份本机存档？')){
        deleteArchive(localStorage,button.dataset.delete);refresh();
      }
    }catch(err){errorInModal(err.message);}finally{button.disabled=false;}
  };
}
$('archives-btn').onclick=archiveModal;
$('edit-objective').onclick=()=>{
  const d=doc();
  showModal('实验目标','<label for="objective-edit">研究问题</label><textarea id="objective-edit" maxlength="2000"></textarea><label for="observation-edit">观察指引</label><textarea id="observation-edit" maxlength="1200" placeholder="改变什么变量？观察哪个物体或仪表？"></textarea>','<button class="primary-button" id="objective-save">保存</button>');
  $('objective-edit').value=d.goal;$('observation-edit').value=d.observation||'';
  $('objective-save').onclick=async()=>{
    const saved=await command('update_experiment',{experimentId:d.id,goal:$('objective-edit').value.trim(),observation:$('observation-edit').value.trim()});
    if(saved)$('modal').close();
  };
};
function spacesModal(){
  showModal('实验文件与我的空间','<button id="open-archives" class="outline-button">存档与加载</button><p>原版实验以 .pqexp.json 保存。点击即载入可编辑副本；现有空间会保留。</p><h3>PhysQuest 原版实验</h3>'+EXPERIMENT_FILES.map(f=>`<div class="experiment-file-row"><button class="space-card" data-load-file="${f.experiment.source.challengeId}"><span><strong>${esc(f.experiment.title)}</strong><small>${esc(f.experiment.goal)}</small></span></button><button class="text-button" data-download-file="${f.experiment.source.challengeId}" aria-label="下载 ${esc(f.experiment.title)}">JSON</button></div>`).join('')+'<h3>我的空间</h3>'+workspace.experiments.map(e=>`<button class="space-card ${e.id===workspace.activeId?'active':''}" data-open-space="${e.id}"><span><strong>${esc(e.title)}</strong><small>${e.mode.toUpperCase()} · ${e.components.length} 个器具 · ${e.connections.length} 个连接</small></span>${icon('chevron')}</button>`).join(''),'<button class="primary-button" id="modal-new-space">新建空白空间</button>');
  document.querySelectorAll('[data-download-file]').forEach(b=>b.onclick=()=>{const file=EXPERIMENT_FILES.find(f=>f.experiment.source.challengeId===b.dataset.downloadFile);download(b.dataset.downloadFile+'.pqexp.json',JSON.stringify(file,null,2));});
  $('open-archives').onclick=archiveModal;
  document.querySelectorAll('[data-open-space]').forEach(b=>b.onclick=async()=>{const result=await command('activate_experiment',{experimentId:b.dataset.openSpace},{selectNone:true});if(result){$('modal').close();scene.fit();}});
  document.querySelectorAll('[data-load-file]').forEach(b=>b.onclick=async()=>{b.disabled=true;const result=await command('load_experiment_file',{fileId:b.dataset.loadFile},{selectNone:true});if(result){$('modal').close();scene.fit();toast('已载入可编辑副本');}else b.disabled=false;});
  $('modal-new-space').onclick=async()=>{const result=await command('create_experiment',{title:'未命名实验'},{selectNone:true});if(result){$('modal').close();scene.fit();}};
}
function designModal(source=null){
  showModal('设计自定义器具','<label for="design-color">器具主色</label><input class="color-field" id="design-color" type="color" value="'+(source?.appearance?.color||'#d4a375')+'"><p>基于物理模型保存你自己的参数组合。器具不会自动加入实验空间。</p><label for="design-name">器具名称</label><input id="design-name" maxlength="60" value="'+esc(source?source.name+' · 自定义':'我的器具')+'"><label for="design-kind">基础物理模型</label><select id="design-kind">'+Object.entries(CATALOG).map(([k,d])=>`<option value="${k}" ${source?.kind===k?'selected':''}>${d.name} · ${DOMAINS[d.domain].name}</option>`).join('')+'</select><label for="design-params">参数（JSON，可修改；单位与器具库相同）</label><textarea id="design-params" rows="9" spellcheck="false"></textarea><p class="input-hint" style="margin-top:10px">使用基础模型中已有的参数。位置、连接端点与其他器具的关系在加入场景后设置。</p>','<button id="design-save" class="primary-button">保存到我的器具</button>');
  const updateParams=()=>$('design-params').value=JSON.stringify(Object.fromEntries(Object.entries(CATALOG[$('design-kind').value].params).map(([k,v])=>[k,v.value])),null,2);updateParams();if(source)$('design-params').value=JSON.stringify(source.params,null,2);$('design-kind').onchange=updateParams;
  $('design-save').onclick=async()=>{try{const params=JSON.parse($('design-params').value),name=$('design-name').value.trim();if(!name)throw new Error('请输入器具名称');await command('design_component',{kind:$('design-kind').value,name,params,appearance:{...(source?.kind===$('design-kind').value?source.appearance:{}),color:$('design-color').value},fixed:source?.fixed||false,...(source?.kind===$('design-kind').value&&source?.collider?{collider:source.collider}:{})},{throw:true});$('modal').close();category='custom';renderLibrary();toast('自定义器具已保存');}catch(e){errorInModal(e);}};
}
function wirePort(id,port){
  if(!pendingWire){pendingWire={id,port};scene.pendingWire=pendingWire;toast('已选择端子 '+port.toUpperCase()+'。点击另一器具的端子完成接线；Esc 取消。');return;}
  if(pendingWire.id===id&&pendingWire.port===port){pendingWire=null;scene.pendingWire=null;toast('已取消接线');return;}
  const source=pendingWire;pendingWire=null;scene.pendingWire=null;command('connect_components',{kind:'wire',source:source.id,sourcePort:source.port,target:id,targetPort:port,gain:1}).then(result=>{if(result)toast('电路导线已连接');});
}
function connectionModal(){
  showModal('连接器具','<p>电路导线连接端子；换能连接将电路、力学、声学与光学联系起来。</p><label for="link-kind">连接方式</label><select id="link-kind">'+Object.entries(COUPLINGS).map(([k,d])=>`<option value="${k}">${d.name}</option>`).join('')+'</select><label for="link-source">源器具</label><select id="link-source"></select><div id="source-port-wrap"><label for="link-source-port">源端子</label><select id="link-source-port"></select></div><label for="link-target">目标器具</label><select id="link-target"></select><div id="target-port-wrap"><label for="link-target-port">目标端子</label><select id="link-target-port"></select></div><div id="gain-wrap"><label for="link-gain">比例增益（−20 到 20）</label><input id="link-gain" type="number" min="-20" max="20" step="0.1" value="1"></div><p id="link-hint" class="input-hint" style="margin-top:12px"></p>','<button id="link-save" class="primary-button">建立连接</button>');
  const ports=()=>{for(const side of ['source','target']){const c=doc().components.find(c=>c.id===$('link-'+side).value);$('link-'+side+'-port').innerHTML=(CATALOG[c?.kind]?.terminals||[]).map(p=>'<option value="'+p+'">'+p.toUpperCase()+'</option>').join('');}};
  const update=()=>{const kind=$('link-kind').value,k=COUPLINGS[kind];for(const [id,kinds] of [['link-source',k.from],['link-target',k.to]]){const list=doc().components.filter(c=>kinds.includes(c.kind));$(id).innerHTML=list.length?list.map((c,i)=>`<option value="${c.id}" ${id==='link-target'&&i===1?'selected':''}>${esc(c.name)}</option>`).join(''):'<option value="">请先添加兼容器具</option>';}$('link-hint').textContent=k.description;$('source-port-wrap').hidden=$('target-port-wrap').hidden=kind!=='wire';$('gain-wrap').hidden=kind==='wire';ports();};$('link-kind').onchange=update;$('link-source').onchange=$('link-target').onchange=ports;update();
  $('link-save').onclick=async()=>{try{if(!$('link-source').value||!$('link-target').value)throw new Error('请先添加此连接所需的器具');await command('connect_components',{kind:$('link-kind').value,source:$('link-source').value,target:$('link-target').value,gain:Number($('link-gain').value),sourcePort:$('link-source-port').value,targetPort:$('link-target-port').value},{throw:true});$('modal').close();toast('连接已建立');}catch(e){errorInModal(e);}};
}
function modelModal(){showModal('物理模型与计算说明',`<p>Fieldlab 是可组合的教学与探索平台。测量值来自模型计算，图形用于解释模型；不替代工程级有限元、全波电磁或流体求解。</p><h3>力学</h3><p>Cannon-es 刚体求解：球体、长方体、圆柱滚轮、可调斜面、地面碰撞、接触摩擦、转动惯量、恒力与力矩。弹簧遵循 F = −kΔx − cv，柔性绳索只受拉，连杆限制两端中心距离，阻尼器抵抗相对速度。连接作用于中心，不包含偏置铰链、柔体或材料形变。</p><h3>电路与电磁</h3><p>电路采用节点电压法，导线合并节点，电源和仪表有内阻。电容、电感使用后向 Euler 求解暂态。浮置网络自动选取零电位参考；开关用高低电阻近似，灯泡为定值电阻，亮度随功率变化。交流源输出正弦电压，恒流源有有限输出电阻；滑动变阻器为两端电阻模型。不包含半导体、温度非线性或寄生参数。</p><p>带电粒子使用库仑场及 q(E + v × B)，库仑距离以 0.04 m 软化。匀强电场和磁场在球形区域内作用。条形磁铁为带软化半径的磁偶极子近似，不模拟磁铁间机械吸引力。</p><h3>声学与光学</h3><p>声学为自由场球面波线性叠加，参考声压在 1 m 内保持，超过 1 m 按 1/r 衰减。麦克风可测相位干涉；指向性声源采用前向余弦幂次方向图。无反射或介质非线性。3D 波环是慢速传播示意，2D 色场按实时相位采样。高频信号的低速图表存在混叠；试听通过 Web Audio 的音频采样率生成。</p><p>几何光学每束 5 条采样光线；薄透镜为近轴斜率变换，平面镜为理想反射，探测器接收命中的光功率。凹透镜使用负焦距；光阑按孔径遮挡，滤光片按透过率衰减。不计算衍射、色散、厚透镜与偏振。光线在光源的 XY 平面传播，支持器具的 Z 位置与孔径判定。</p><h3>PhysQuest 光具座</h3><p>沿用原版近轴薄透镜成像求解器，内部参数以 cm 表示。整套光具座为一个可编辑器具，图中光线和器具按示意比例绘制，其外部 X/Y/Z 坐标只控制整体放置。可修改物距、焦距、物高、光屏、口径与上半遮挡。该模型独立计算，不与外部激光器混合追迹；预测与参考条件只作学习说明，不锁定编辑。</p><h3>多物理过程耦合</h3><p>音圈：m x″ + c x′ + kx = B L I，以 RK4 积分；有效导线沿 Y 轴、运动限制在 X 轴，驱动力取带符号的 Bz 分量。振动发声把速度幅值映射为声源幅值；光强调制把 X 位移映射为相对功率。耦合为单向线性近似，不包含反向能量回馈。电路支路电流可以驱动音圈，音圈不会反向加载电路。</p><h3>边界与采样</h3><p>固定步长 1/480 s；实时测量以 60 Hz 记录最近 15 秒。机械能包含平动与转动动能、重力势能和线性弹性势能，不包含电磁能。改变器具或物理环境将重置计时；2D 模式将 Z 运动投影到 0，切回 3D 恢复配置中的初始 Z 值。最多 64 个器具、128 个连接。</p><h3>工具与文档</h3><p><a href="https://threejs.org/docs/" target="_blank" rel="noopener">Three.js 文档 ↗</a> · <a href="https://modelcontextprotocol.io/specification/2026-07-28" target="_blank" rel="noopener">MCP 协议 ↗</a></p>`);}
function helpModal(){showModal('从空白空间开始',`<p>这里提供器具和物理规则。实验由你设计，也可以交给已连接的 AI 操作。</p><div class="help-grid"><div><strong>01 · 放入器具</strong>点击左侧器具卡片。不同领域的器具可以同时存在。</div><div><strong>02 · 调整条件</strong>选中器具修改位置、参数。选中后拖动 X/Y/Z 箭头移动；2D 显示 X/Y 箭头。</div><div><strong>03 · 建立联系</strong>电路点击 A/B 端子接线。弹簧、绳索、连杆、阻尼器在属性中选端点；力源选受力刚体。跨领域换能在「连接」中设置。</div><div><strong>04 · 运行与测量</strong>运行、暂停、单步；选择测量通道，导出 JSON 或 CSV。</div></div><h3>快捷键</h3><p>空格：运行 / 暂停<br>Delete / Backspace：删除选中器具<br>Esc：取消接线 / 选择<br>Ctrl / ⌘ Z：撤销，Shift Z：重做<br>方向键：移动 0.1 m；Shift：1 m；Alt：移动 Z<br>F：聚焦；Ctrl / ⌘ D：复制<br>/：搜索器具</p><h3>与 AI 协作</h3><p>在右侧「AI 对话」的连接设置中填写 DeepSeek API Key，再直接发送消息；也可以通过 MCP 连接外部 AI。AI 可以读写同一空间，并调用数值求解器检查结果。</p>`);}
function switchSidebar(chat){$('ai-drawer').hidden=!chat;$('property-panel').hidden=chat;for(const [id,on]of[['sidebar-chat',chat],['sidebar-properties',!chat]]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}if(!chat)renderInspector();}
async function showAI(){ switchSidebar(true);if(offline){$('mcp-endpoint').textContent='本地服务地址 /mcp';$('mcp-detail').textContent='静态版需要本地或在线服务连接 AI';$('mcp-tools').textContent='启动完整平台后即可使用 MCP 与 DeepSeek。';return;}$('mcp-endpoint').textContent=location.protocol==='file:'?'离线 HTML：MCP 需要在线版或本地服务器':location.origin+'/mcp';try{const r=await fetch('/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})}),data=await r.json();if(!r.ok||!data.result?.tools)throw new Error('unavailable');aiTools=data.result.tools;$('mcp-detail').textContent='MCP 服务可用';$('mcp-tools').innerHTML=aiTools.map(t=>`<div class="tool-entry"><code>${esc(t.name)}</code><p>${esc(t.description)}</p></div>`).join('');}catch{$('mcp-detail').textContent='MCP 暂不可用';$('mcp-tools').textContent='连接服务器后可使用远程工具。';}}
async function copy(text,message){try{await navigator.clipboard.writeText(text);toast(message||'已复制');}catch{showModal('复制文本','<textarea id="copy-fallback" rows="9" readonly>'+esc(text)+'</textarea>');$('copy-fallback').select();}}
function syncAudio(d=doc()){for(const node of audioNodes){try{node.osc.stop();}catch{}node.osc.disconnect();node.gain.disconnect();}audioNodes=[];if(!audioEnabled||!audioContext)return;for(const c of d.components.filter(c=>SOUND_KINDS.includes(c.kind))){const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.frequency.value=c.params.frequency;gain.gain.value=0;osc.connect(gain).connect(audioContext.destination);osc.start();audioNodes.push({id:c.id,osc,gain});}}
function drawSnapshot(ctx,w,h,chart){
  const colors=['#16766c','#b04b20','#554caa','#206f9c'];
  const values=chart.lines.flatMap(line=>line.values.filter(Number.isFinite));
  let lo=Math.min(...values),hi=Math.max(...values);
  if(!values.length){lo=0;hi=1;}else if(hi===lo){const pad=Math.abs(hi)*.05||1;lo-=pad;hi+=pad;}
  const left=53,right=w-18,top=40,bottom=h-25,end=chart.times.at(-1);
  if(bottom<=top||right<=left)return;
  ctx.font='10px sans-serif';ctx.lineWidth=1;ctx.textAlign='right';
  for(let i=0;i<=3;i++){
    const y=top+i*(bottom-top)/3;
    ctx.strokeStyle='#dbe4ea';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    ctx.fillStyle='#466473';ctx.fillText(Number((hi+(lo-hi)*i/3).toPrecision(3)).toString(),left-4,y+3);
  }
  ctx.textAlign='center';
  for(let i=0;i<=4;i++)ctx.fillText(Number((end*i/4).toPrecision(3)).toString(),left+(right-left)*i/4,bottom+13);
  chart.lines.forEach((line,j)=>{
    ctx.fillStyle=ctx.strokeStyle=colors[j];ctx.textAlign='left';ctx.lineWidth=2;
    ctx.fillText(line.label,left+(right-left)*j/chart.lines.length,29,(right-left)/chart.lines.length-4);
    ctx.beginPath();let joined=false;
    line.values.forEach((v,i)=>{
      if(v===null){joined=false;return;}
      const x=left+chart.times[i]/end*(right-left),y=bottom-(v-lo)/(hi-lo)*(bottom-top);
      if(joined)ctx.lineTo(x,y);else ctx.moveTo(x,y);joined=true;
    });ctx.stroke();
  });
}
function drawChart(){
  const canvas=$('chart'),r=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(r.width*ratio)||canvas.height!==Math.round(r.height*ratio)){canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);}const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);
  const live=$('circuit-live');if(live){const r=sim.circuit.readings[selected];live.innerHTML=r?[['电压',r.voltage,'V'],['电流 A → B',r.current,'A'],['功率',r.power,'W']].map(([label,value,unit])=>'<div><span>'+label+'</span><code>'+value.toPrecision(5)+' '+unit+'</code></div>').join(''):'<p class="input-hint">参考地 · 0 V</p>';}
  const readings=sim.readings,has=doc().components.length>0;$('chart-placeholder').hidden=has;$('readings-table').hidden=chartMode!=='readings';canvas.hidden=chartMode==='readings';
  const snapshot=chartMode==='snapshot'?doc().chart:null;
  $('channel-select').hidden=Boolean(snapshot);$('csv-btn').hidden=Boolean(snapshot);
  if(snapshot){
    $('chart-placeholder').hidden=true;
    $('chart-unit').textContent=snapshot.title+' · '+snapshot.lines[0].unit;
    drawSnapshot(ctx,w,h,snapshot);return;
  }
  if(chartMode==='readings'){const entries=Object.entries(readings.channels).filter(([id,v])=>v.unit);$('readings-table').innerHTML=entries.length?entries.map(([id,v])=>`<div class="reading-row"><span>${esc(v.label)}</span><code>${v.valid===false?'无有限值':v.value.toFixed(5)} <span class="muted">${v.unit}</span></code></div>`).join(''):'<div class="empty-list">添加可测量器具后显示数值</div>';return;}
  const left=42,right=w-17,top=24,bottom=h-24;ctx.strokeStyle='#dfe8ef';ctx.lineWidth=1;ctx.setLineDash([3,5]);for(let i=0;i<4;i++){const y=top+(bottom-top)*i/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}for(let i=0;i<7;i++){const x=left+(right-left)*i/6;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}ctx.setLineDash([]);
  const values=sim.samples.map(s=>({t:s.t,v:chartMode==='energy'?s.energy:(s.channels[channel]?.value||0)})),max=Math.max(.001,...values.map(s=>Math.abs(s.v)))*1.15;const tmax=Math.max(5,sim.time),tmin=Math.max(0,tmax-10),min=chartMode==='energy'?0:-max;
  ctx.font='8px monospace';ctx.fillStyle='#9bafbd';ctx.textAlign='right';for(let i=0;i<4;i++){const value=max-(max-min)*i/3;ctx.fillText(Math.abs(value)<.001?value.toExponential(0):value.toFixed(max<.1?3:2),left-6,top+(bottom-top)*i/3+3);}ctx.textAlign='center';for(let i=0;i<6;i++)ctx.fillText((tmin+(tmax-tmin)*i/6).toFixed(1),left+(right-left)*i/6,bottom+13);
  const unit=chartMode==='energy'?'J':readings.channels[channel]?.unit||'幅值';$('chart-unit').textContent=unit;
  if(values.length){ctx.beginPath();let first=true;for(const s of values){if(s.t<tmin)continue;const x=left+(s.t-tmin)/(tmax-tmin)*(right-left),y=bottom-(s.v-min)/(max-min)*(bottom-top);if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);}ctx.strokeStyle='#74a49a';ctx.lineWidth=1.5;ctx.stroke();}
}
let last=performance.now(),accumulator=0,chartClock=0;
function frame(now){const elapsed=Math.min(.1,(now-last)/1000);last=now;if(!workbenchVisible){accumulator=0;requestAnimationFrame(frame);return;}if(sliderPreview?.dirty)applySliderPreview();const d=sim.doc;if(d.control.running&&d.components.length){accumulator+=elapsed*d.environment.speed;let count=0;while(accumulator>=DT&&count<200){sim.step();accumulator-=DT;count++;}if(count===200)accumulator=0;}else accumulator=0;scene.draw(sim);if(sim.circuit.error)$('solver-status').textContent='电路：'+sim.circuit.error;$('time-value').innerHTML=sim.time.toFixed(3)+' <small>s</small>';if(now-chartClock>80){drawChart();chartClock=now;for(const n of audioNodes){const c=d.components.find(c=>c.id===n.id);n.gain.gain.setTargetAtTime(d.control.running&&c?Math.min(.06,c.params.amplitude*sim.modulation(c.id,'acoustic')*.02):0,audioContext.currentTime,.03);}}requestAnimationFrame(frame);}

$('categories').onclick=e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;renderLibrary();}};
$('search').oninput=renderLibrary;
$('library-items').onclick=async e=>{const manage=e.target.closest('[data-manage-design]');if(manage)return workshop.manage(manage.dataset.manageDesign);const b=e.target.closest('[data-add]');if(!b)return;const kind=b.dataset.add,design=workspace.designs.find(d=>d.id===b.dataset.design),index=doc().components.length;let position=[((index%5)-2)*1.3,1,Math.floor(index/5)*1.2];if(doc().mode==='2d'){position[2]=0;position[1]+=Math.floor(index/5)*1.2;}if(kind==='floor_slab'&&!design)position=[0,-.08,0];inspectorTab='properties';let result;
  if(design)result=await command('instantiate_design',{designId:design.id,position},{selectResult:true});
  else {const name=CATALOG[kind].name+' '+(doc().components.filter(c=>c.kind===kind).length+1);result=await command('add_component',{kind,name,position},{selectResult:true});}
  if(result)toast('已添加 '+(design?.name||CATALOG[kind].name));};
$('start-btn').onclick=()=>{$('library').classList.remove('flash');void $('library').offsetWidth;$('library').classList.add('flash');if(innerWidth<560)$('library').scrollIntoView({behavior:'smooth'});$('search').focus({preventScroll:true});};
$('title-btn').onclick=editTitle;$('my-experiments').onclick=spacesModal;$('workspace-nav').onclick=()=>{selected=null;scene.select(null);$('axis-help').hidden=true;inspectorTab='properties';renderInspector();};
$('new-btn').onclick=async()=>{await command('create_experiment',{title:'未命名实验'},{selectNone:true});scene.fit();toast('已创建空白实验空间');};
$('export-btn').onclick=()=>{download(doc().title+'.pqexp.json',JSON.stringify(exportExperimentFile(doc()),null,2));toast('实验配置已导出');};
$('import-btn').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>512000)throw new Error('实验文件不能超过 500 KB');await command('import_experiment',{file:JSON.parse(await file.text())},{throw:true,selectNone:true});if($('modal').open&&$('archive-list'))$('modal').close();toast('已导入到新的可编辑空间');scene.fit();}catch(error){toast('导入失败：'+error.message);}e.target.value='';};
$('design-btn').onclick=()=>designModal();
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>command('update_experiment',{mode:b.dataset.mode}));
for(const [id,key]of[['grid-btn','showGrid'],['fields-btn','showFields'],['trails-btn','showTrails'],['colliders-btn','showColliders']])$(id).onclick=()=>{scene[key]=!scene[key];$(id).classList.toggle('active',scene[key]);};
$('fit-btn').onclick=()=>scene.fit();$('fullscreen-btn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.viewport').requestFullscreen();}catch{toast('当前浏览器不支持全屏');}};
function togglePlay(){if(!doc().components.length)return toast('先从器具库添加一个器具');const experimentId=doc().id;command('control_simulation',()=>({experimentId,running:!workspace.experiments.find(d=>d.id===experimentId).control.running}));}
$('slow-play').onclick=()=>command('control_simulation',{running:true,speed:.25});$('play-btn').onclick=togglePlay;$('reset-btn').onclick=()=>command('control_simulation',{running:false,reset:true});$('step-btn').onclick=async()=>{if(!doc().components.length)return toast('先添加器具，再开始计算');if(doc().control.running)await command('control_simulation',{running:false});sim.advance(1/60);};$('speed').onchange=e=>command('update_experiment',{environment:{speed:Number(e.target.value)}});
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{inspectorTab=b.dataset.tab;renderInspector();});
$('inspector-content').addEventListener('input',e=>{
  const el=e.target,ci=el.dataset.colliderRange??el.dataset.colliderSize,oi=el.dataset.colliderOffset;
  if(ci!==undefined||oi!==undefined){const c=doc().components.find(c=>c.id===selected);if(!c)return;el.setCustomValidity('');if(!el.checkValidity())return;const collider=colliderConfig(c);collider[ci!==undefined?'size':'offset'][Number(ci??oi)]=Number(el.value);if(ci!==undefined){$('num-collider-size-'+ci).value=el.value;const range=$('inspector-content').querySelector('[data-collider-range="'+ci+'"]');if(range)range.value=el.value;}sliderPreview={element:el,experimentId:doc().id,componentId:selected,collider,environment:false,dirty:true};saveStatus('实时预览 · 完成输入后保存');return;}
  const key=el.dataset.range;if(!key)return;
  $('num-'+key).value=el.value;el.setCustomValidity('');
  if(!el.checkValidity())return;
  sliderPreview={element:el,experimentId:doc().id,componentId:selected,key,value:Number(el.value),environment:!!el.dataset.env,dirty:true};
  saveStatus('实时预览 · 松开滑块保存');
});
function changeCollider(c,edit){const experimentId=doc().id,componentId=c.id;return command('update_component',()=>{const current=workspace.experiments.find(d=>d.id===experimentId)?.components.find(c=>c.id===componentId);if(!current)throw new Error('器具已被移除');const collider=colliderConfig(current);edit(collider,current);return {experimentId,componentId,collider};}).then(result=>{if(!result)render();});}
function commitInspectorInput(e){const el=e.target,c=doc().components.find(c=>c.id===selected);
  if(sliderPreview?.element===el){applySliderPreview();sliderPreview=null;}
  if(!el.matches('input,textarea,select')||el.disabled)return;const valueKey=el.type==='checkbox'?String(el.checked):el.value;if(el.dataset.committed===valueKey)return;el.dataset.committed=valueKey;
  if(el.id==='goal-input'&&el.value!==doc().goal)return command('update_experiment',{goal:el.value});
  if(el.id==='collisions'&&el.checked!==doc().environment.collisions)return command('update_experiment',{environment:{collisions:el.checked}});
  if(c&&(el.id==='collider-enabled'||el.id==='collider-shape'||el.dataset.colliderRange!==undefined||el.dataset.colliderSize!==undefined||el.dataset.colliderOffset!==undefined)){
    if(!el.checkValidity()){toast(el.validationMessage);render();return;}
    if(el.id==='collider-enabled')return changeCollider(c,h=>{h.enabled=el.checked;});
    if(el.id==='collider-shape')return changeCollider(c,h=>{h.shape=el.value;});
    const axis=Number(el.dataset.colliderRange??el.dataset.colliderSize??el.dataset.colliderOffset),field=el.dataset.colliderOffset!==undefined?'offset':'size',value=Number(el.value);
    if(!pending&&colliderConfig(c)[field][axis]===value){syncSimulation(doc());saveStatus(localServer?'已保存到本机':'已保存');return;}
    return changeCollider(c,h=>{h[field][axis]=value;});
  }
  const key=el.dataset.param||el.dataset.range;if(key){const value=Number(el.value);if(!pending&&value===(el.dataset.env?doc().environment[key]:c?.params[key])){if(el.dataset.range){syncSimulation(doc());saveStatus(online?(localServer?'已保存到本机':'已保存到云端'):'仅保存在本机',!online);}return;}if(!el.checkValidity()||!Number.isFinite(value)){toast(el.validationMessage||'请输入参数范围内的数值');render();return;}const saving=el.dataset.env?command('update_experiment',{environment:{[key]:value}}):command('update_component',{componentId:c.id,params:{[key]:value}});return saving.then(result=>{if(!result)render();});}
  if(!c)return;
  if(el.dataset.expression)return command('update_component',{componentId:c.id,params:{[el.dataset.expression]:el.value}});
  if(el.id==='component-name'&&el.value!==c.name)return command('update_component',{componentId:c.id,name:el.value});
  if(el.id==='fixed'&&el.checked!==c.fixed)return command('update_component',{componentId:c.id,fixed:el.checked});
  if(el.dataset.axis){const position=[...c.position];position[Number(el.dataset.axis)]=Number(el.value);if(position[Number(el.dataset.axis)]===c.position[Number(el.dataset.axis)])return;return command('update_component',{componentId:c.id,position});}
  if(el.dataset.ref&&el.value!==c.refs[el.dataset.ref])return command('update_component',{componentId:c.id,refs:{...c.refs,[el.dataset.ref]:el.value}});
}
$('inspector-content').addEventListener('change',commitInspectorInput);
$('inspector-content').addEventListener('focusout',commitInspectorInput);
$('inspector-content').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const c=doc().components.find(c=>c.id===selected);
  if(button.id==='reset-collider'&&c)return changeCollider(c,(h,current)=>Object.assign(h,colliderConfig({...current,collider:undefined})));
  if(button.id==='enable-collisions')return command('update_experiment',{environment:{collisions:true}});
  if(button.id==='edit-learning'){showModal('编辑实验说明','<p>问题、提示与参考条件供人和 AI 阅读，不限制操作。</p><label for="learning-json">教学说明 JSON</label><textarea id="learning-json" rows="16">'+esc(JSON.stringify(doc().learning,null,2))+'</textarea>','<button class="primary-button" id="save-learning">保存说明</button>');$('save-learning').onclick=async()=>{try{await command('update_experiment',{learning:JSON.parse($('learning-json').value)},{throw:true});$('modal').close();}catch(e){errorInModal(e);}};return;}
  if(button.dataset.selectObject){selected=button.dataset.selectObject;inspectorTab='properties';scene.select(selected);$('axis-help').hidden=false;renderInspector();return;}if(button.dataset.focusObject){selected=button.dataset.focusObject;scene.select(selected);scene.focus(selected);renderInspector();return;}
  if(button.id==='connect-btn')connectionModal();if(button.dataset.wirePort&&c)wirePort(c.id,button.dataset.wirePort);
  if(button.dataset.removeLink)command('disconnect_components',{connectionId:button.dataset.removeLink});
  if(button.id==='save-design'&&c)designModal(c);
  if(button.id==='delete-component'&&c)command('remove_component',{componentId:c.id},{selectNone:true});
  if(button.id==='duplicate-component'&&c)command('add_component',{kind:c.kind,name:c.name+' 副本',params:c.params,position:c.position.map((v,i)=>i===0?Math.min(30,v+.6):v),fixed:c.fixed,refs:c.refs,...(c.collider?{collider:c.collider}:{}),...(c.appearance?{appearance:c.appearance}:{})},{selectResult:true});
});
document.querySelectorAll('[data-chart]').forEach(b=>b.onclick=()=>{chartMode=b.dataset.chart;document.querySelectorAll('[data-chart]').forEach(x=>x.classList.toggle('active',x===b));drawChart();});$('channel-select').onchange=e=>channel=e.target.value;
$('csv-btn').onclick=()=>{if(!sim.samples.length)return toast('请先运行仿真以采集数据');const ids=Object.keys(sim.readings.channels).filter(id=>sim.readings.channels[id].unit),quote=v=>'"'+String(v).replace(/"/g,'""')+'"',header=['time_s','mechanical_energy_J',...ids.map(id=>{const c=sim.readings.channels[id];return c.label+'_'+c.unit;})].map(quote).join(','),rows=sim.samples.map(s=>[s.t,s.energy,...ids.map(id=>s.channels[id]?.value??0)].join(','));download(doc().title+'-采样.csv','\ufeff'+[header,...rows].join('\r\n'),'text/csv;charset=utf-8');toast('已导出最近 '+sim.samples.length+' 个样本');};
$('audio-btn').onclick=async()=>{if(!doc().components.some(c=>SOUND_KINDS.includes(c.kind)))return toast('添加点声源后可试听');audioEnabled=!audioEnabled;if(audioEnabled){audioContext||=new AudioContext();await audioContext.resume();}syncAudio();$('audio-btn').style.color=audioEnabled?'#e9a66b':'';toast(audioEnabled?'试听已开启，运行时发声':'试听已关闭');};
$('ai-btn').onclick=()=>{assistant.showChat();void showAI();};$('mcp-status').onclick=()=>{$('chat-tools').open=true;void showAI();};$('sidebar-chat').onclick=()=>{assistant.showChat();void showAI();};$('sidebar-properties').onclick=()=>switchSidebar(false);
$('copy-endpoint').onclick=()=>copy(location.origin+'/mcp','MCP 端点已复制');
$('model-btn').onclick=modelModal;$('help-btn').onclick=helpModal;
window.addEventListener('keydown',e=>{if(aiBusy)return;if(e.code==='Space'&&document.activeElement?.closest('button,summary,a'))return;if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||$('modal').open||$('assistant-preferences').open||$('ai-drawer').contains(document.activeElement))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travelHistory(e.shiftKey);return;}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='y'){e.preventDefault();travelHistory(true);return;}if(e.key.toLowerCase()==='f'&&selected){e.preventDefault();scene.focus(selected);}if(e.key.toLowerCase()==='d'&&(e.metaKey||e.ctrlKey)&&selected){e.preventDefault();$('duplicate-component')?.click();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected){const c=doc().components.find(c=>c.id===selected);if(c&&!scene.isBound(c)){e.preventDefault();const componentId=c.id,experimentId=doc().id,axis=e.altKey&&doc().mode==='3d'?2:['ArrowLeft','ArrowRight'].includes(e.key)?0:1,delta=(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?1:.1);command('update_component',()=>{const current=workspace.experiments.find(d=>d.id===experimentId)?.components.find(c=>c.id===componentId);if(!current)throw new Error('器具已被移除');const position=[...current.position];position[axis]=Math.max(-30,Math.min(30,Math.round((position[axis]+delta)*100)/100));return {experimentId,componentId,position};});}}if(e.code==='Space'){e.preventDefault();togglePlay();}if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();command('remove_component',{componentId:selected},{selectNone:true});}if(e.key==='Escape'){pendingWire=null;scene.pendingWire=null;selected=null;scene.select(null);$('axis-help').hidden=true;renderInspector();}if(e.key==='/'){e.preventDefault();$('search').focus();}});
window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
async function initialize(){
  try{if(offline)throw new Error('standalone');const r=await fetch('/api/state');if(!r.ok)throw new Error('API unavailable');workspace=await r.json();online=true;saveStatus(localServer?'已保存到本机':'已保存到云端');$('mcp-status').textContent='MCP · 服务可用';}
  catch{try{const cached=localStorage.getItem('fieldlab-workspace');if(cached)workspace=JSON.parse(cached);}catch{}saveStatus('仅保存在本机',true);$('mcp-status').textContent='MCP · 离线';if(!offline)toast('服务器暂不可用，当前以本机模式运行');}
  if(new URLSearchParams(location.search).get('autoload')==='physquest')await command('bootstrap_physquest',{}, {noHistory:true});
  render();scene.fit();bridgeReady=true;bridgePost('ready');requestAnimationFrame(frame);
  setInterval(async()=>{if(!online||pending||document.hidden||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||$('modal').open)return;try{if(offline)throw new Error('standalone');const r=await fetch('/api/state');if(!r.ok)return;const remote=await r.json();if(remote.revision>workspace.revision){undoStack.length=redoStack.length=0;workspace=remote;localStorage.setItem('fieldlab-workspace',JSON.stringify(workspace));render();saveStatus('已同步 AI / 其他窗口');toast('实验空间已同步');}}catch{saveStatus('同步暂时中断',true);}},2500);
}
$('undo-btn').onclick=()=>travelHistory();$('redo-btn').onclick=()=>travelHistory(true);$('snap-btn').onclick=()=>{scene.setSnap(!scene.snap);$('snap-btn').classList.toggle('active',scene.snap);toast(scene.snap?'网格吸附开启 · 0.1 m':'网格吸附关闭');};
const workshop=setupWorkshop({getWorkspace:()=>workspace,getDoc:doc,command,showModal,errorInModal,esc,download,toast,onCategory:value=>{category=value;renderLibrary();}});
const assistant=setupAssistant({openAssistant:showAI,getWorkspace:()=>workspace,getSelectedId:()=>selected,isOnline:()=>online,beforeRequest:()=>queue,setBusy:value=>{aiBusy=value;pending+=value?1:-1;for(const region of document.querySelectorAll('.library,.center-column,#property-panel'))region.inert=value;for(const button of document.querySelectorAll('.workspace-bar button'))button.disabled=value;updateHistory();},toast,applyResult:async(result,before)=>{if(!result.changed)return;remember(before);workspace=result.workspace;selected=null;localStorage.setItem('fieldlab-workspace',JSON.stringify(workspace));render();scene.fit();saveStatus(localServer?'AI 修改已保存到本机':'AI 修改已保存到云端');}});
function bridgePost(type,data={}){if(embedded)parent.postMessage({source:'fieldlab',type,...data},location.origin);}
window.addEventListener('message',async event=>{
  if(!embedded||event.origin!==location.origin||event.source!==parent||event.data?.source!=='physquest')return;
  const {action,domain,requestId,value}=event.data;
  if(action==='hello'){if(bridgeReady)bridgePost('ready');return;}
  if(!bridgeReady)return;
  if(action==='filter-library'&&(domain==='all'||Object.hasOwn(DOMAINS,domain))){category=domain;$('search').value='';renderLibrary();}
  if(action==='prepare-optics-card'){
    await showAI();assistant.prepareCard(event.data);return;
  }
  if(action==='build-knowledge'){try{await showAI();assistant.startKnowledgeBuild({knowledgeId:event.data.knowledgeId,prompt:event.data.prompt});}catch(e){toast(e.message);}return;}
  // 顶栏配的 Key 同步过来（用户不用在工作台里再填一遍）
  if(action==='set-credentials'){
    const keyInput=$('deepseek-key');
    if(keyInput&&event.data.apiKey){keyInput.value=event.data.apiKey;keyInput.oninput?.();}
    const modelSel=$('deepseek-model');
    if(modelSel&&event.data.model){const opt=[...modelSel.options].find(o=>o.value===event.data.model);if(opt)modelSel.value=event.data.model;}
    return;
  }
  if(action==='spaces')spacesModal();if(action==='help')helpModal();if(action==='open-ai')showAI();
  if(action==='visibility'){workbenchVisible=value!=='hidden';if(audioContext){if(workbenchVisible&&audioEnabled)audioContext.resume().catch(()=>{});else audioContext.suspend().catch(()=>{});}if(workbenchVisible)scene.resize();}
  if(action==='capture'&&typeof requestId==='string'){await queue;sim.measure();bridgePost('capture',{requestId,snapshot:{experiment:structuredClone(doc()),time:sim.time,readings:structuredClone(sim.readings),circuitError:sim.circuit.error||null}});}
  // 从 PhysQuest 实验台一键把参数搬过来
  if(action==='import-experiment'){
    try{
      const payload=typeof event.data.experiment==='string'?JSON.parse(event.data.experiment):event.data.experiment;
      if(!payload||typeof payload!=='object')throw new Error('实验数据无效');
      await command('import_experiment',{file:payload},{throw:true,selectNone:true});
      scene.fit();
      bridgePost('import-done',{title:payload.title||''});
      toast('已导入「'+(payload.title||'实验')+'」，可以继续加器具');
    }catch(error){
      toast('导入失败：'+error.message);
      bridgePost('import-failed',{message:error.message});
    }
    return;
  }
});
hydrateIcons();initialize();
