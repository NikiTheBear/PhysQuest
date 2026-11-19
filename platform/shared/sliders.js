import {CATALOG} from './catalog.js';

const environment={
  gravity:{label:'重力加速度',min:0,max:25,step:.01,unit:'m/s²'},
  damping:{label:'环境阻尼',min:0,max:5,step:.01,unit:'kg/s'},
  speed:{label:'时间倍率',min:.05,max:4,step:.05,unit:'×'}
};
export function sliderTarget(doc,{componentId,parameter}){
  const component=componentId==null?null:doc.components.find(c=>c.id===componentId);
  if(componentId!=null&&!component)throw new Error('滑块绑定的器具不存在');
  const specs=component?CATALOG[component.kind].params:environment;
  const spec=Object.hasOwn(specs,parameter)&&specs[parameter];
  if(!spec||!Number.isFinite(spec.min))throw new Error('滑块必须绑定数值型物理参数');
  return {spec,value:(component?component.params:doc.environment)[parameter]};
}
export function validateSliders(doc){
  if(doc.sliders===undefined)return;
  if(!Array.isArray(doc.sliders)||doc.sliders.length>16)throw new Error('每个实验最多 16 个滑块');
  const bindings=new Set();
  for(const slider of doc.sliders){
    const {spec}=sliderTarget(doc,slider),{label,min,max,step}=slider;
    if(typeof label!=='string'||!label.trim()||label.length>60)throw new Error('滑块名称须为 1–60 个字符');
    if(![min,max,step].every(Number.isFinite)||min<spec.min||max>spec.max||min>=max||step<=0||step>max-min)throw new Error('滑块范围或步长超出参数允许范围');
    if(['axis','closed','directivity','maskTop','objectShape'].includes(slider.parameter)&&![min,max,step].every(Number.isInteger))throw new Error('离散参数需要整数范围与步长');
    const binding=JSON.stringify([slider.componentId??null,slider.parameter]);
    if(bindings.has(binding))throw new Error('参数重复绑定');bindings.add(binding);
  }
}
