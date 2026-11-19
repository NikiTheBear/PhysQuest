import {RIGID_KINDS,LINK_KINDS} from './catalog.js';
const excluded=[...LINK_KINDS,'force','harmonic_force','field','electric_field','coil','distance_sensor','motion_sensor'];
export const supportsCollider=c=>!excluded.includes(c.kind);
export function colliderRotation(c){
  if(c.kind==='bar_magnet')return c.params.axis===1?[0,0,Math.PI/2]:c.params.axis===2?[0,Math.PI/2,0]:[0,0,0];
  return [0,0,(c.params.angle||0)*Math.PI/180];
}
export function colliderOf(c){
  const p=c.params;let type='box',size=[.8,.6,.6];
  if(['body','charge'].includes(c.kind)){type='sphere';size=[p.radius*2,p.radius*2,p.radius*2];}
  else if(c.kind==='cylinder'){type='cylinder';size=[p.radius*2,p.radius*2,p.height];}
  else if(c.kind==='box')size=[p.width,p.height,p.depth];
  else if(c.kind==='ramp')size=[p.length,.16,p.width];
  else if(c.kind==='anchor')size=[.3,.3,.3];
  else if(['lens','diverging_lens','mirror','aperture','optical_filter','detector'].includes(c.kind))size=[.12,p.radius*2,p.radius*2];
  else if(c.kind==='lens_bench')size=[2,1,.6];
  else if(c.kind==='bar_magnet')size=[1,.3,.3];
  else if(['speaker','directional_speaker'].includes(c.kind))size=[.65,.85,.45];
  const custom=c.collider?.shape==='box';
  return {enabled:supportsCollider(c)&&(c.collider?.enabled??([...RIGID_KINDS,'ramp'].includes(c.kind))),shape:custom?'box':'auto',type:custom?'box':type,size:custom?[...c.collider.size]:size,offset:[...(c.collider?.offset||[0,0,0])]};
}
export function colliderConfig(c){const {enabled,shape,size,offset}=colliderOf(c);return {enabled,shape,size,offset};}
export function validateCollider(c){
  const v=c.collider;if(v===undefined)return;
  if(!v||typeof v!=='object'||Array.isArray(v)||!supportsCollider(c))throw new Error('此器具不支持独立碰撞范围');
  if(Object.keys(v).some(k=>!['enabled','shape','size','offset'].includes(k))||typeof v.enabled!=='boolean'||!['auto','box'].includes(v.shape))throw new Error('碰撞范围需要 enabled 和 auto / box 形状');
  for(const [key,min,max]of[['size',.02,60],['offset',-30,30]]){
    if(!Array.isArray(v[key])||v[key].length!==3||v[key].some(n=>!Number.isFinite(n)||n<min||n>max))throw new Error('碰撞范围 '+key+' 必须为三个 '+min+'–'+max+' 的数值');
  }
}
