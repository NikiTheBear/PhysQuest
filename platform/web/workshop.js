import { CATALOG, DOMAINS } from '../shared/catalog.js';
import { normalizeDesign } from '../shared/workspace.js';
export function setupWorkshop({getWorkspace,getDoc,command,showModal,errorInModal,esc,download,toast,onCategory}){
  const $=id=>document.getElementById(id);
  function factory(){
    const list=getDoc().components;
    showModal('组合器具工坊','<p>把场景中的部件封装为可复用器具。保存部件的相对位置、内部导线和机械连接；不会创建实验模板。</p><label for="assembly-name">器具名称</label><input id="assembly-name" maxlength="60" placeholder="为这套器具命名"><label for="assembly-description">说明</label><input id="assembly-description" maxlength="300" placeholder="用途、物理结构或注意事项"><div class="assembly-picker">'+list.map(c=>'<label><input type="checkbox" data-assembly-part="'+c.id+'"><span>'+esc(c.name)+' <small>· '+esc(CATALOG[c.kind].name)+'</small></span></label>').join('')+'</div>'+(!list.length?'<p class="warning-note">先在空白空间中添加部件，再回来组装。</p>':'')+'<p class="input-hint">勾选 1–24 个部件。对未勾选器具的引用将被留空；电路端子会公开以便外部接线。复杂参数映射也可通过 MCP 或 DeepSeek 设计。</p>','<button id="assembly-save" class="primary-button">保存组合器具</button>');
    $('assembly-save').onclick=async()=>{try{
      const ids=[...document.querySelectorAll('[data-assembly-part]:checked')].map(e=>e.dataset.assemblyPart),name=$('assembly-name').value.trim();if(!ids.length||ids.length>24)throw new Error('请选择 1–24 个部件');if(!name)throw new Error('请输入器具名称');
      const parts=getDoc().components.filter(c=>ids.includes(c.id)),origin=parts[0].position;
      const components=parts.map(c=>({...structuredClone(c),position:c.position.map((v,i)=>v-origin[i]),refs:Object.fromEntries(Object.entries(c.refs).filter(([,id])=>ids.includes(id)))}));
      const connections=getDoc().connections.filter(l=>ids.includes(l.source)&&ids.includes(l.target));
      const ports=components.flatMap((c,i)=>(CATALOG[c.kind].terminals||[]).map(port=>({name:(i+1)+'_'+port.toUpperCase(),componentId:c.id,port})));
      await command('design_assembly',{name,description:$('assembly-description').value,components,connections,ports},{throw:true});$('modal').close();onCategory('custom');toast('组合器具已保存，可在「我的」中再次放置');
    }catch(e){errorInModal(e);}};
  }
  function manage(designId){
    const d=getWorkspace().designs.find(x=>x.id===designId);if(!d)return;
    const assembly=d.type==='assembly';
    showModal('编辑器具设计','<label for="edit-design-name">器具名称</label><input id="edit-design-name" maxlength="60" value="'+esc(d.name)+'"><label for="edit-design-description">说明</label><input id="edit-design-description" maxlength="300" value="'+esc(d.description)+'"><div class="design-info">'+(assembly?d.components.length+' 个部件 · '+d.connections.length+' 个内部连接<br>公开端子：'+esc(d.ports.map(p=>p.name).join('、')||'无')+'<br>公开参数：'+esc(Object.keys(d.bindings).join('、')||'无'):esc(CATALOG[d.kind].name)+' · '+esc(DOMAINS[CATALOG[d.kind].domain].name))+'</div><label for="edit-design-json">'+(assembly?'结构定义':'物理参数')+'（JSON）</label><textarea id="edit-design-json" rows="8" spellcheck="false">'+esc(JSON.stringify(assembly?{components:d.components,connections:d.connections,ports:d.ports,bindings:d.bindings}:d.params,null,2))+'</textarea><p class="input-hint">编辑影响以后放置的副本，已有场景保持原状。</p>','<div class="workshop-actions"><button id="export-design" class="outline-button">导出器具</button><button id="remove-design" class="text-button">移出器具库</button><button id="edit-design-save" class="primary-button">保存设计</button></div>');
    $('export-design').onclick=()=>download(d.name+'-器具.json',JSON.stringify({format:'fieldlab-instrument',version:1,design:d},null,2));
    $('remove-design').onclick=async()=>{const result=await command('remove_design',{designId},{throw:true});if(result)$('modal').close();};
    $('edit-design-save').onclick=async()=>{try{const parsed=JSON.parse($('edit-design-json').value);await command('update_design',{designId,name:$('edit-design-name').value.trim(),description:$('edit-design-description').value,...(assembly?parsed:{params:parsed})},{throw:true});$('modal').close();toast('器具设计已更新');}catch(e){errorInModal(e);}};
  }
  $('assembly-btn').onclick=factory;$('import-design-btn').onclick=()=>$('import-design-file').click();
  $('import-design-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>200000)throw new Error('器具文件不得超过 200 KB');const input=JSON.parse(await file.text());if(input.format!=='fieldlab-instrument')throw new Error('请选择 Fieldlab 器具设计文件');const d=normalizeDesign(input.design);await command(d.type==='assembly'?'design_assembly':'design_component',d,{throw:true});onCategory('custom');toast('器具已导入');}catch(e){toast('导入失败：'+e.message);}finally{e.target.value='';}};
  return {manage,factory};
}
