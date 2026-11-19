import { CATALOG, COUPLINGS, blankExperiment, component, uid, activeExperiment, ENDPOINT_KINDS, RIGID_KINDS, LINK_KINDS } from './catalog.js';
import {sliderTarget,validateSliders} from './sliders.js';
import {sampleChart,validateChart} from './experiment-chart.js';
import {compileForce} from './force-expression.js';
import {validateCollider} from './colliders.js';
const text = (v, max, name) => { if(typeof v !== 'string' || v.length > max) throw new Error(name+'必须是长度不超过 '+max+' 的文本'); return v; };
const number = (v, min, max, name) => { if(typeof v !== 'number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`${name} 必须在 ${min}–${max} 之间`);return v;};
export function validateComponent(c) {
  validateCollider(c);
  const def=Object.hasOwn(CATALOG,c.kind)&&CATALOG[c.kind];if(!def)throw new Error('未知器具类型');
  text(c.id,100,'器具 ID');if(c.appearance&&(!/^#[0-9a-f]{6}$/i.test(c.appearance.color)||Object.keys(c.appearance).some(k=>k!=='color')))throw new Error('外观只支持 #RRGGBB color');text(c.name,60,'器具名称');
  if(!Array.isArray(c.position)||c.position.length!==3)throw new Error('position 必须为 [x,y,z]');
  c.position.forEach(v=>number(v,-30,30,'位置'));
  if(typeof c.fixed!=='boolean')throw new Error('fixed 必须为布尔值');
  if(!c.params||typeof c.params!=='object'||Array.isArray(c.params))throw new Error('params 必须为对象');
  for(const [key,spec] of Object.entries(def.params)){if(spec.type==='expression'){compileForce(c.params[key]);continue;}number(c.params[key],spec.min,spec.max,spec.label);if(['axis','closed','directivity','maskTop','objectShape'].includes(key)&&!Number.isInteger(c.params[key]))throw new Error(spec.label+'必须为整数');}
  for(const key of Object.keys(c.params))if(!Object.hasOwn(def.params,key))throw new Error('未知参数 '+key);
  if(!c.refs||typeof c.refs!=='object'||Array.isArray(c.refs))throw new Error('refs 必须为对象');
  for(const [key,v] of Object.entries(c.refs)){if(!def.refs?.includes(key))throw new Error('未知连接端口');text(v,100,'端点');}
  if(c.kind==='aperture'&&c.params.opening>c.params.radius)throw new Error('通光孔径不能大于遮挡盘半径');
  return c;
}
export function validateExperiment(doc) {
  validateSliders(doc);
  if(doc.chart!==undefined)validateChart(doc.chart);
  text(doc.id,100,'实验 ID');text(doc.title,100,'实验名称');text(doc.goal,2000,'实验目标');
  if(!['2d','3d'].includes(doc.mode))throw new Error('模式只能是 2d 或 3d');
  if(!Array.isArray(doc.components)||doc.components.length>64)throw new Error('最多支持 64 个器具');
  const ids=new Set();for(const c of doc.components){validateComponent(c);if(ids.has(c.id))throw new Error('器具 ID 重复');ids.add(c.id);}
  for(const c of doc.components)for(const ref of Object.values(c.refs))if(ref&&!ids.has(ref))throw new Error('引用的器具不存在');
  for(const c of doc.components.filter(c=>LINK_KINDS.includes(c.kind))) {
    for(const ref of Object.values(c.refs))if(ref&&!ENDPOINT_KINDS.includes(doc.components.find(x=>x.id===ref).kind))throw new Error('机械端点只能连接刚体、粒子或固定支点');
    if(c.refs.a&&c.refs.a===c.refs.b)throw new Error('机械连接需要两个不同端点');
  }
  for(const c of doc.components.filter(c=>['force','drag','expression_force','harmonic_force','motion_sensor'].includes(c.kind)))if(c.refs.target&&!RIGID_KINDS.includes(doc.components.find(x=>x.id===c.refs.target)?.kind))throw new Error('目标必须是刚体');
  if(!Array.isArray(doc.connections)||doc.connections.length>128)throw new Error('最多支持 128 个连接');
  const linkIds=new Set();
  for(const l of doc.connections){const k=COUPLINGS[l.kind],a=doc.components.find(c=>c.id===l.source),b=doc.components.find(c=>c.id===l.target);if(!k||!a||!b||!k.from.includes(a.kind)||!k.to.includes(b.kind))throw new Error('连接的源或目标类型不兼容');text(l.id,100,'连接 ID');if(linkIds.has(l.id))throw new Error('连接 ID 重复');linkIds.add(l.id);number(l.gain,-20,20,'连接增益');if(l.kind==='wire'){if(!CATALOG[a.kind].terminals.includes(l.sourcePort)||!CATALOG[b.kind].terminals.includes(l.targetPort))throw new Error('必须指定有效接线端子 a / b');if(a.id===b.id&&l.sourcePort===l.targetPort)throw new Error('不能将同一端子连接到自身');}}
  const env=doc.environment;if(!env)throw new Error('缺少环境参数');number(env.gravity,0,25,'重力加速度');number(env.damping,0,5,'环境阻尼');number(env.speed,.1,4,'时间倍率');if(typeof env.collisions!=='boolean')throw new Error('collisions 必须为布尔值');
  if(!doc.control||typeof doc.control.running!=='boolean')throw new Error('缺少运行状态');number(doc.control.reset,0,1e9,'重置序号');
  for(const key of ['learning','source'])if(doc[key]!==undefined){if(!doc[key]||typeof doc[key]!=='object'||Array.isArray(doc[key])||JSON.stringify(doc[key]).length>12000)throw new Error(key+' 必须是 12 KB 以内的对象');}
  if(doc.learning?.prediction?.options!==undefined&&(!Array.isArray(doc.learning.prediction.options)||doc.learning.prediction.options.some(o=>typeof o!=='string')))throw new Error('预测选项必须为文本数组');
  return doc;
}
export function mutate(workspace,name,args) {
  const w=structuredClone(workspace),doc=args.experimentId?w.experiments.find(d=>d.id===args.experimentId):activeExperiment(w);
  if(!doc)throw new Error('实验不存在');let result;
  const getComponent=id=>{const c=doc.components.find(c=>c.id===id);if(!c)throw new Error('器具不存在');return c;};
  switch(name) {
    case 'set_variable_slider': {
      const {spec}=sliderTarget(doc,args);
      const componentId=args.componentId??null,parameter=args.parameter;
      const list=doc.sliders??=[],index=list.findIndex(s=>(s.componentId??null)===componentId&&s.parameter===parameter);
      if(args.remove===true){if(index>=0)list.splice(index,1);result={removed:index>=0};break;}
      const previous=list[index];
      const slider={componentId,parameter,label:args.label??previous?.label??spec.label,min:args.min??previous?.min??spec.min,max:args.max??previous?.max??spec.max,step:args.step??previous?.step??spec.step};
      if(index<0)list.push(slider);else list[index]=slider;
      validateSliders(doc);result=slider;break;
    }
    case 'plot_chart': {
      doc.chart=sampleChart(doc,args);
      result={title:doc.chart.title,samples:doc.chart.times.length,curves:doc.chart.lines.map(l=>l.label),location:'实验台下方'};
      break;
    }
    case 'import_experiment': {
      if(w.experiments.length>=30&&!args.bootstrap)throw new Error('最多保存 30 个实验空间');
      if(args.bootstrap&&(w.revision!==0||w.experiments.length!==1||doc.components.length||doc.connections.length))throw new Error('自动载入只适用于未编辑的初始空间');
      const imported=readExperimentFile(args.file),mapping=new Map(imported.components.map(c=>[c.id,uid()]));
      imported.id=uid();imported.control={running:false,reset:0};
      for(const c of imported.components){c.id=mapping.get(c.id);c.refs=Object.fromEntries(Object.entries(c.refs).map(([k,v])=>[k,mapping.get(v)||'']));}
      for(const slider of imported.sliders||[])if(slider.componentId!=null)slider.componentId=mapping.get(slider.componentId);
      for(const link of imported.connections){link.id=uid();link.source=mapping.get(link.source);link.target=mapping.get(link.target);}
      validateExperiment(imported);
      if(args.bootstrap)w.experiments[0]=imported;else w.experiments.push(imported);
      w.activeId=imported.id;result=imported;break;
    }
    case 'create_experiment': {
      if(w.experiments.length>=30)throw new Error('最多保存 30 个实验空间');
      const e=blankExperiment(args.title||'未命名实验');e.goal=args.goal||'';e.mode=args.mode||'3d';validateExperiment(e);w.experiments.push(e);w.activeId=e.id;result=e;break;
    }
    case 'activate_experiment': w.activeId=doc.id;result=doc;break;
    case 'update_experiment': {
      for(const key of ['title','goal','mode','learning'])if(args[key]!==undefined)doc[key]=args[key];
      if(args.environment)Object.assign(doc.environment,args.environment);validateExperiment(doc);result=doc;break;
    }
    case 'replace_experiment': {
      if(!args.experiment||args.experiment.id!==doc.id)throw new Error('导入时请保留目标实验 ID');
      const validated=validateExperiment(structuredClone(args.experiment));w.experiments[w.experiments.indexOf(doc)]=validated;result=validated;break;
    }
    case 'add_component': {
      const c=component(args.kind);if(args.name!==undefined)c.name=args.name;if(args.position)c.position=args.position;if(args.params)Object.assign(c.params,args.params);if(args.fixed!==undefined)c.fixed=args.fixed;if(args.refs)c.refs=args.refs;if(args.appearance)c.appearance=args.appearance;if(args.collider!==undefined)c.collider=args.collider;doc.components.push(c);validateExperiment(doc);result=c;break;
    }
    case 'update_component': {
      const c=getComponent(args.componentId);for(const key of ['name','position','fixed','refs','appearance','collider'])if(args[key]!==undefined)c[key]=args[key];if(args.params)Object.assign(c.params,args.params);validateExperiment(doc);result=c;break;
    }
    case 'remove_component': {
      if(doc.sliders)doc.sliders=doc.sliders.filter(s=>s.componentId!==args.componentId);
      getComponent(args.componentId);doc.components=doc.components.filter(c=>c.id!==args.componentId);doc.connections=doc.connections.filter(l=>l.source!==args.componentId&&l.target!==args.componentId);
      for(const c of doc.components)for(const key of Object.keys(c.refs))if(c.refs[key]===args.componentId)delete c.refs[key];result={removed:args.componentId};break;
    }
    case 'connect_components': {
      const l={id:uid(),kind:args.kind,source:args.source,target:args.target,gain:args.gain??1,...(args.kind==='wire'?{sourcePort:args.sourcePort||'a',targetPort:args.targetPort||'a'}:{})};if(doc.connections.some(x=>x.kind===l.kind&&((x.source===l.source&&x.target===l.target&&(l.kind!=='wire'||x.sourcePort===l.sourcePort&&x.targetPort===l.targetPort))||(l.kind==='wire'&&x.source===l.target&&x.target===l.source&&x.sourcePort===l.targetPort&&x.targetPort===l.sourcePort))))throw new Error('此连接已经存在');doc.connections.push(l);validateExperiment(doc);result=l;break;
    }
    case 'disconnect_components': { if(!doc.connections.some(l=>l.id===args.connectionId))throw new Error('连接不存在');doc.connections=doc.connections.filter(l=>l.id!==args.connectionId);result={removed:args.connectionId};break; }
    case 'control_simulation': { if(args.running!==undefined)doc.control.running=args.running;if(args.reset)doc.control.reset++;validateExperiment(doc);result=doc.control;break; }
    case 'design_component':
    case 'design_assembly': {
      if(w.designs.length>=50)throw new Error('最多保存 50 个自定义器具');
      const design=normalizeDesign({...args,id:uid(),type:name==='design_assembly'?'assembly':'component'});w.designs.push(design);result=design;break;
    }
    case 'update_design': {
      const index=w.designs.findIndex(d=>d.id===args.designId);if(index<0)throw new Error('自定义器具不存在');
      const old=w.designs[index],params=args.params?{...old.params,...args.params}:old.params;
      result=normalizeDesign({...old,...args,id:old.id,type:old.type||'component',kind:old.kind,params});w.designs[index]=result;break;
    }
    case 'remove_design': {
      if(!w.designs.some(d=>d.id===args.designId))throw new Error('自定义器具不存在');w.designs=w.designs.filter(d=>d.id!==args.designId);result={removed:args.designId};break;
    }
    case 'instantiate_design': {
      const design=w.designs.find(d=>d.id===args.designId);if(!design)throw new Error('自定义器具不存在');
      const d=normalizeDesign(design),base=args.position||[0,1,0],created=[],mapping=new Map(),parameters=args.parameters||{};
      if(!Array.isArray(base)||base.length!==3)throw new Error('position 必须为 [x,y,z]');base.forEach(v=>number(v,-30,30,'放置位置'));
      const parts=d.type==='assembly'?structuredClone(d.components):[component(d.kind,{id:'part',name:d.name,position:[0,0,0],params:d.params,fixed:d.fixed,appearance:d.appearance,...(d.collider?{collider:d.collider}:{})})];
      for(const [key,value] of Object.entries(parameters)){const binding=d.type==='assembly'?d.bindings[key]:{componentId:'part',parameter:key};if(!binding)throw new Error('未知公开参数 '+key);const c=parts.find(c=>c.id===binding.componentId);c.params[binding.parameter]=value;}
      for(const c of parts)mapping.set(c.id,uid());
      const occupiedNames=new Set(doc.components.map(c=>c.name));
      for(const c of parts){c.id=mapping.get(c.id);c.position=c.position.map((v,i)=>v+base[i]);c.name=args.name?(parts.length===1?args.name:args.name+' · '+c.name):c.name;c.refs=Object.fromEntries(Object.entries(c.refs).map(([key,id])=>[key,mapping.get(id)||'']));const baseName=c.name;let suffix=1;while(occupiedNames.has(c.name))c.name=baseName.slice(0,52)+' · '+(++suffix);occupiedNames.add(c.name);validateComponent(c);created.push(c);}
      doc.components.push(...created);
      const links=(d.connections||[]).map(l=>({...l,id:uid(),source:mapping.get(l.source),target:mapping.get(l.target)}));doc.connections.push(...links);validateExperiment(doc);
      const ports=Object.fromEntries((d.ports||[]).map(p=>[p.name,{componentId:mapping.get(p.componentId),port:p.port}]));
      result={id:created[0].id,designId:d.id,componentIds:created.map(c=>c.id),connectionIds:links.map(l=>l.id),ports};break;
    }
    case 'restore_workspace': {
      const value=args.workspace;if(!value||!Array.isArray(value.experiments)||!value.experiments.length||value.experiments.length>30||!Array.isArray(value.designs)||value.designs.length>50)throw new Error('无效的工作区历史');
      value.experiments.forEach(validateExperiment);if(new Set(value.experiments.map(e=>e.id)).size!==value.experiments.length||!value.experiments.some(e=>e.id===value.activeId))throw new Error('无效空间 ID');
      w.experiments=structuredClone(value.experiments);w.designs=value.designs.map(normalizeDesign);if(new Set(w.designs.map(d=>d.id)).size!==w.designs.length)throw new Error('设计 ID 重复');w.activeId=value.activeId;for(const e of w.experiments)e.control.running=false;result={restored:true};break;
    }
    default:throw new Error('未知操作：'+name);
  }
  w.revision++;w.updatedAt=new Date().toISOString();w.log.unshift({id:uid(),action:name,at:w.updatedAt});w.log=w.log.slice(0,40);
  return {workspace:w,result};
}

export function normalizeDesign(input){
  const d={id:text(input.id||uid(),100,'设计 ID'),name:text(input.name,60,'器具名称'),description:text(input.description||'自定义器具',300,'描述'),type:input.type||'component'};
  if(!d.name.trim())throw new Error('器具名称不能为空');
  if(d.type==='component'){
    const c=component(input.kind,{name:d.name,fixed:input.fixed??false,...(input.appearance?{appearance:input.appearance}:{}),...(input.collider?{collider:input.collider}:{})});Object.assign(c.params,input.params||{});validateComponent(c);
    Object.assign(d,{kind:c.kind,params:c.params,fixed:c.fixed,...(c.appearance?{appearance:c.appearance}:{}),...(c.collider?{collider:c.collider}:{})});return d;
  }
  if(d.type!=='assembly'||!Array.isArray(input.components)||!input.components.length||input.components.length>24)throw new Error('组合器具需要 1–24 个部件');
  d.components=input.components.map(part=>{const c=component(part.kind,{...part,params:{...component(part.kind).params,...part.params}});return validateComponent(c);});
  d.connections=(input.connections||[]).map(l=>({id:l.id||uid(),gain:l.gain??1,...l}));
  validateExperiment({...blankExperiment(d.name),components:d.components,connections:d.connections});
  d.ports=input.ports||[];d.bindings=input.bindings||{};
  if(!Array.isArray(d.ports)||d.ports.length>24||new Set(d.ports.map(p=>p.name)).size!==d.ports.length)throw new Error('公开端子名称需要唯一，最多 24 个');
  for(const p of d.ports){text(p.name,40,'公开端子名称');const c=d.components.find(c=>c.id===p.componentId);if(!CATALOG[c?.kind]?.terminals?.includes(p.port))throw new Error('公开端子必须引用部件的有效电路端子');}
  if(!d.bindings||typeof d.bindings!=='object'||Array.isArray(d.bindings)||Object.keys(d.bindings).length>24)throw new Error('最多公开 24 个参数');
  for(const [name,b] of Object.entries(d.bindings)){text(name,40,'公开参数名称');const c=d.components.find(c=>c.id===b.componentId);if(!c||!Object.hasOwn(CATALOG[c.kind].params,b.parameter))throw new Error('公开参数必须引用部件的有效物理参数');}
  return d;
}

export function readExperimentFile(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('实验文件必须是 JSON 对象');
  if(JSON.stringify(input).length>500000)throw new Error('实验文件不能超过 500 KB');
  const wrapped=Object.hasOwn(input,'format');
  if(wrapped&&(input.format!=='physquest.experiment'||input.version!==1))throw new Error('不支持的实验文件格式或版本');
  const doc=structuredClone(wrapped?input.experiment:input);
  if(!doc||typeof doc!=='object')throw new Error('缺少 experiment');
  doc.id=doc.id||uid();validateExperiment(doc);
  return doc;
}
export function exportExperimentFile(doc){
  return {format:'physquest.experiment',version:1,metadata:{title:doc.title,description:doc.goal,...(doc.source?{source:doc.source}:{})},experiment:structuredClone(doc)};
}
