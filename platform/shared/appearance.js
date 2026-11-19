const vector=(min,max)=>({type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:min,maximum:max}});
const color={type:'string',pattern:'^#[0-9a-fA-F]{6}$'};
const shapes=['box','sphere','cylinder'];
const fields={shape:{type:'string',enum:shapes},size:vector(.01,30),offset:vector(-30,30),angle:{type:'number',minimum:-360,maximum:360},color};
export const appearanceSchema={type:'object',description:'简化外形。size 为 XYZ 全尺寸（米），offset 为局部偏移（米），angle 为绕 Z 轴角度。圆柱默认沿 Y 轴。',properties:{color,parts:{type:'array',minItems:1,maxItems:6,items:{type:'object',properties:fields,required:['shape','size'],additionalProperties:false}}},additionalProperties:false};
export function validateAppearance(a){
  if(a==null)return;
  const rgb=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  const triple=(v,min,max)=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&n>=min&&n<=max);
  if(typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!Object.hasOwn(appearanceSchema.properties,k))||(!a.color&&!a.parts)||(a.color!==undefined&&!rgb(a.color)))throw new Error('外观须提供有效颜色或基础几何体');
  if(a.parts===undefined)return;
  if(!Array.isArray(a.parts)||a.parts.length<1||a.parts.length>6)throw new Error('外形需要 1–6 个基础几何体');
  for(const p of a.parts){
    if(!p||Object.keys(p).some(k=>!Object.hasOwn(fields,k))||!shapes.includes(p.shape)||!triple(p.size,.01,30)||(p.offset!==undefined&&!triple(p.offset,-30,30))||(p.color!==undefined&&!rgb(p.color))||(p.angle!==undefined&&(!Number.isFinite(p.angle)||Math.abs(p.angle)>360)))throw new Error('外形几何体的形状、尺寸、偏移、颜色或角度无效');
  }
}
