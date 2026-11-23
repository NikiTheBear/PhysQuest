import {choiceSpec,choiceValue,createChoice,updateChoice} from './choice-controls.js';
import {CATALOG} from '../shared/catalog.js';
import {sliderTarget} from '../shared/sliders.js';

const primary={
  lens_bench:['u','f','screenX'],speaker:['frequency','amplitude'],directional_speaker:['frequency','angle'],
  rheostat:['ratio'],battery:['voltage'],body:['mass','vx'],box:['mass','vx'],ramp:['angle'],
  ac_source:['amplitude','frequency'],harmonic_force:['frequency','amplitude'],
  refract_plane:['angle','n1','n2'],
  pinhole_screen:['holeDiameter','holeDistance'],
  eye_model:['focal','axialLength','correction'],
  thermometer:['responseTime'],heat_source:['temperature','power'],conductor:['conductivity','length']
};
const environmentKeys=['gravity','damping','speed'];

function numericKeys(component){
  return Object.keys(CATALOG[component.kind].params).filter(key=>Number.isFinite(CATALOG[component.kind].params[key].min));
}

export function tuningSliders(doc,group){
  function binding(component,parameter){
    const componentId=component?.id??null;
    const {spec}=sliderTarget(doc,{componentId,parameter});
    return {...spec,componentId,parameter};
  }
  const environment=()=>environmentKeys.map(key=>binding(null,key));
  if(group==='environment')return environment();
  if(group.startsWith('component:')){
    const component=doc.components.find(c=>'component:'+c.id===group);
    return component?numericKeys(component).map(key=>binding(component,key)):[];
  }
  if(doc.sliders?.length)return doc.sliders;
  const candidates=doc.components.map(c=>(primary[c.kind]||numericKeys(c).slice(0,1)).map(key=>binding(c,key)));
  const common=[];
  for(let rank=0;rank<3;rank++){
    for(const list of candidates)if(list[rank]&&common.length<8)common.push(list[rank]);
  }
  return common.length?common:environment();
}

// Keep small resistance changes reachable even when the model spans several decades.
function logarithmic(s){return s.min>0&&s.max/s.min>=10000&&(s.max-s.min)/s.step>=100000;}
export function trackPosition(s,value){
  if(!logarithmic(s))return value;
  const v=Math.max(s.min,Math.min(s.max,value));
  return Math.round(1000*Math.log(v/s.min)/Math.log(s.max/s.min));
}
export function physicalValue(s,position){
  if(!logarithmic(s))return position;
  const raw=s.min*(s.max/s.min)**(position/1000);
  const snapped=s.min+Math.round((raw-s.min)/s.step)*s.step;
  return Number(Math.min(s.max,Math.max(s.min,snapped)).toPrecision(12));
}

export function setupTuning({getDoc,onPreview,onCommit,onCancel}){
  const group=document.getElementById('tuning-group'),rows=document.getElementById('tuning-rows');
  let experimentId,optionSignature,rowSignature,editingRow=null,bindings=[];
  function update(row,s,value){
    const choice=row.querySelector('.parameter-choice');
    if(choice){updateChoice(choice,value);return;}
    const input=row.querySelector('[type=number]'),range=row.querySelector('[type=range]');
    input.value=value;
    range.value=trackPosition(s,value);
    range.setAttribute('aria-valuetext',value+' '+row.querySelector('.tuning-unit').textContent);
  }
  function render(){
    const doc=getDoc();
    if(doc.id!==experimentId){experimentId=doc.id;group.value='common';editingRow=null;}
    const choices=[['common',doc.sliders?.length?'实验变量':'常用参数'],['environment','环境'],
      ...doc.components.filter(c=>numericKeys(c).length).map(c=>['component:'+c.id,c.name])];
    const opts=JSON.stringify(choices);
    if(opts!==optionSignature){
      const current=group.value;
      group.replaceChildren(...choices.map(([id,label])=>new Option(label,id)));
      group.value=choices.some(([id])=>id===current)?current:'common';
      optionSignature=opts;
    }
    bindings=tuningSliders(doc,group.value);
    const signature=JSON.stringify([doc.id,group.value,choices,bindings]);
    if(signature!==rowSignature){
      editingRow=null;
      const controls=bindings.map((s,i)=>{
        const row=document.createElement('div');row.className='tuning-row';row.dataset.index=i;
        const {spec,value}=sliderTarget(doc,s),component=doc.components.find(c=>c.id===s.componentId);
        const discrete=choiceSpec(s.parameter);
        const title=discrete&&s.label===spec.label?discrete.label:s.label;
        const caption=group.value==='common'&&component?component.name+' · '+title:title;
        if(discrete){
          row.append(createChoice(s.parameter,s,caption,value,'tuning-choice-'+i));
          return row;
        }
        row.innerHTML='<div class="tuning-line"><label></label><input type="number"><span class="tuning-unit"></span></div><input type="range"><div class="tuning-limits"><span></span><span></span></div>';
        const label=row.querySelector('label'),number=row.querySelector('[type=number]'),range=row.querySelector('[type=range]');
        label.textContent=caption;
        label.htmlFor=range.id='tuning-range-'+i;
        number.setAttribute('aria-label',label.textContent+'数值');
        row.querySelector('.tuning-unit').textContent=spec.unit;
        Object.assign(number,{min:s.min,max:s.max,step:s.step,required:true});
        Object.assign(range,logarithmic(s)?{min:0,max:1000,step:1}:{min:s.min,max:s.max,step:s.step});
        const limits=row.querySelector('.tuning-limits');
        limits.firstElementChild.textContent=s.min;
        limits.lastElementChild.textContent=s.max;
        return row;
      });
      rows.replaceChildren(...controls);rowSignature=signature;
    }
    Array.from(rows.children).forEach((row,i)=>{
      if(editingRow!==row)update(row,bindings[i],sliderTarget(doc,bindings[i]).value);
    });
  }
  group.onchange=()=>{onCancel();editingRow=null;render();};
  rows.oninput=e=>{
    const el=e.target,row=el.closest('.tuning-row');if(!row||el.closest('.parameter-choice'))return;
    const s=bindings[row.dataset.index],value=el.type==='range'?physicalValue(s,el.valueAsNumber):el.valueAsNumber;
    editingRow=row;
    if(!el.validity.valid)return;
    if(el.type==='range')update(row,s,value);
    else row.querySelector('[type=range]').value=trackPosition(s,value);
    onPreview(el,s,value);
  };
  rows.onchange=e=>{
    const el=e.target,row=el.closest('.tuning-row');if(!row||experimentId!==getDoc().id)return;
    const s=bindings[row.dataset.index];
    editingRow=null;
    if(el.closest('.parameter-choice')){onCommit(experimentId,s,choiceValue(el));return;}
    if(!el.validity.valid){el.reportValidity();onCancel();render();return;}
    const value=el.type==='range'?physicalValue(s,el.valueAsNumber):el.valueAsNumber;
    onCommit(experimentId,s,value);
  };
  rows.onpointercancel=()=>{editingRow=null;onCancel();render();};
  rows.onfocusout=()=>{if(editingRow){editingRow=null;onCancel();render();}};
  return {render};
}
