import {normalAxis,verticalAxis} from './planes.js';
import {lensTrain} from './lens-train.js';
import { CATALOG, RIGID_KINDS, CIRCUIT_KINDS, SOUND_KINDS, LENS_KINDS, LINK_KINDS, THERMAL_KINDS } from './catalog.js';
import { solve as solveLens } from './physquest-lens.js';
import { Circuit } from './circuit.js';
import {compileForce} from './force-expression.js';
import { Mechanics } from './mechanics.js';
export const DT = 1 / 480;
const K = 8.9875517923e9;
// 眼球模型固定取明视瞳孔直径 3 mm（参数表里不暴露瞳孔）
const PUPIL_DIAMETER = .003;
const TAU = Math.PI * 2;
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const norm = a => Math.hypot(...a);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, n) => a.map(v => v * n);
const add = (a, b) => a.map((v, i) => v + b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a, 1 / (norm(a) || 1));
// 热学集中参数模型：温度状态夹在绝对零度与模型上限之间，所有交换用精确指数解，不会发散。
const THERMAL_MIN = -273, THERMAL_MAX = 1000;
// 温度计只是探针，热容不开放给参数：它仅在作为导热棒端点时参与一次交换，数值只影响该处的瞬态。
const THERMOMETER_CAPACITY = 10;
const ambientOf = doc => { const t = doc?.environment?.temperature; return Number.isFinite(t) ? clampTemperature(t) : 20; };
const clampTemperature = t => Math.max(THERMAL_MIN, Math.min(THERMAL_MAX, Number.isFinite(t) ? t : 20));
export { ambientOf, clampTemperature };
export function fieldAt(doc, point, bodies = null, exclude = '') {
  let electric = [0,0,0], magnetic = [0,0,0];
  for (const c of doc.components) {
    const pos = bodies?.get(c.id)?.position || c.position;
    if (c.kind === 'field' && norm(sub(point, pos)) <= c.params.radius) magnetic[c.params.axis] += c.params.strength;
    if(c.kind==='electric_field'&&norm(sub(point,pos))<=c.params.radius)electric[c.params.axis]+=c.params.strength;
    if(c.kind==='bar_magnet'){const r=sub(point,pos),d2=dot(r,r)+c.params.core**2,m=[0,0,0];m[c.params.axis]=c.params.moment;magnetic=add(magnetic,mul(sub(mul(r,3*dot(m,r)/d2),m),1e-7/(d2**1.5)));}
    if (c.kind === 'charge' && c.id !== exclude) {
      const r = sub(point, pos), d2 = dot(r,r) + .04 ** 2;
      electric = add(electric, mul(r, K * c.params.charge * 1e-6 / (d2 ** 1.5)));
    }
  }
  return { electric, magnetic };
}
export class Simulation {
  constructor(doc) { this.reset(doc); }
  reset(doc) {
    this.normal=normalAxis(doc);
    this.opticalTrain=lensTrain(doc.components);
    this.doc = structuredClone(doc); this.time = 0; this.steps = 0;
    this.bodies = new Map(doc.components.map(c => [c.id, {
      position: c.position.map((v, i) => doc.mode === '2d' && i === this.normal ? 0 : v + (c.kind === 'coil' && i === 0 ? c.params.displacement : 0)),
      velocity: c.fixed ? [0,0,0] : [c.params.vx || 0, c.params.vy || 0,c.params.vz || 0].map((v,i)=>doc.mode==='2d'&&i===this.normal?0:v),
      x: c.params.displacement || 0, v: 0, force: [0,0,0], trail: []
    }]));
    this.forceSources=this.doc.components.filter(c=>['drag','expression_force'].includes(c.kind)).map(c=>({
      source:c,target:this.doc.components.find(item=>item.id===c.refs.target),
      axes:c.kind==='expression_force'?['fx','fy','fz'].map(axis=>compileForce(c.params[axis])):null
    }));
    this.mechanics=new Mechanics(this.doc,this.bodies);this.circuit=new Circuit(this.doc);
    this.thermal=new Map();
    for(const c of this.doc.components.filter(c=>THERMAL_KINDS.includes(c.kind)))this.thermal.set(c.id,{temperature:clampTemperature(c.params.temperature??ambientOf(this.doc))});
    // 导热棒两端都接上时，杆身初温取两端平均，静止状态下的热流就是傅里叶定律的读数。
    for(const c of this.doc.components.filter(c=>c.kind==='conductor'&&c.refs.a&&c.refs.b)){const a=this.thermal.get(c.refs.a),b=this.thermal.get(c.refs.b);if(a&&b&&a!==b)this.thermal.get(c.id).temperature=clampTemperature((a.temperature+b.temperature)/2);}
    this.samples = []; this.measure();
  }
  sourceCurrent(id, t) {
    let current = 0;
    for (const link of this.doc.connections.filter(l => l.kind === 'electrical' && l.target === id)) {
      const src = this.doc.components.find(c => c.id === link.source);
      if(src?.kind==='power') current += src.params.current * (src.params.frequency === 0 ? 1 : Math.sin(TAU*src.params.frequency*t + src.params.phase*Math.PI/180)) * link.gain;
      else if(src)current+=(this.circuit.readings[src.id]?.current||0)*link.gain*(['battery','ac_source','current_source'].includes(src.kind)?-1:1);
    }
    return current;
  }
  modulation(id, kind) {
    let result = kind === 'optical' ? 1 : null;
    for (const link of this.doc.connections.filter(l => l.kind === kind && l.target === id)) {
      const b = this.bodies.get(link.source), c = this.doc.components.find(c => c.id === link.source);
      if(!b || !c) continue;
      if(kind === 'acoustic') result = (result || 0) + Math.abs(c.kind === 'coil' ? b.v : norm(b.velocity)) * link.gain;
      else result += (c.kind === 'coil' ? b.x : b.position[0]-c.position[0]) * link.gain;
    }
    return result === null ? 1 : Math.max(0, Math.min(result, 10));
  }
  pressure(point, t = this.time) {
    let sum = 0;
    for (const c of this.doc.components.filter(c => SOUND_KINDS.includes(c.kind))) {
      const d = Math.max(.2, norm(sub(point, this.bodies.get(c.id).position)));
      const relative=sub(point,this.bodies.get(c.id).position),angle=(c.params.angle||0)*Math.PI/180,directivity=c.kind==='directional_speaker'?Math.max(0,(relative[0]*Math.cos(angle)+relative[verticalAxis(this.doc)]*Math.sin(angle))/d)**c.params.directivity:1;
      sum += directivity*c.params.amplitude * this.modulation(c.id, 'acoustic') / d * Math.sin(TAU*c.params.frequency*(t-d/c.params.speed) + c.params.phase*Math.PI/180);
    }
    return sum;
  }
  advance(seconds) {
    const n = Math.max(0, Math.round(seconds / DT));
    for(let i=0; i<n; i++) this.step(DT);
    return this.readings;
  }
  step(dt = DT) {
    const doc=this.doc, env=doc.environment, movable=doc.components.filter(c => RIGID_KINDS.includes(c.kind) && !c.fixed);
    this.circuit.step(dt);this.thermalStep(dt);
    for(const b of this.bodies.values()){b.force=[0,0,0];b.torque=[0,0,0];}
    for(const c of movable) {
      const b=this.bodies.get(c.id), m=c.params.mass;
      b.force=[-env.damping*b.velocity[0], -m*env.gravity-env.damping*b.velocity[1], -env.damping*b.velocity[2]];
      if(c.kind==='charge') { const {electric,magnetic}=fieldAt(doc,b.position,this.bodies,c.id); b.force=add(b.force,mul(add(electric,cross(b.velocity,magnetic)),c.params.charge*1e-6)); }
    }
    for(const c of doc.components.filter(c=>['spring','rope','damper','dynamometer'].includes(c.kind))) {
      const a=this.bodies.get(c.refs.a), b=this.bodies.get(c.refs.b);
      if(!a||!b||a===b)continue;
      const r=sub(b.position,a.position), length=norm(r), dir=unit(r);
      const extension=length-(c.params.restLength||0),relative=dot(sub(b.velocity,a.velocity),dir);
      let magnitude=(c.params.stiffness||0)*extension+c.params.damping*relative;
      if(c.kind==='rope')magnitude=extension>0?Math.max(0,magnitude):0;
      const f=mul(dir,magnitude);
      a.force=add(a.force,f); b.force=sub(b.force,f);
    }
    const dragVelocity=new Map();
    for(const {source,target,axes} of this.forceSources){
      if(!target)continue;
      const body=this.bodies.get(target.id),[x,y,z]=body.position,[vx,vy,vz]=body.velocity,speed=norm(body.velocity);
      const values={t:this.time,x,y,z,vx,vy,vz,speed,m:target.params.mass};
      let applied;
      if(axes)applied=axes.map(fn=>{
        const value=fn(values);return Number.isFinite(value)?Math.max(-100,Math.min(100,value)):0;
      });
      else{
        const velocity=dragVelocity.get(target.id)||body.velocity;
        const rate=source.params.linear+source.params.quadratic*norm(velocity);
        const scale=rate/(1+dt*rate/target.params.mass);
        applied=mul(velocity,-scale);
        dragVelocity.set(target.id,add(velocity,mul(applied,dt/target.params.mass)));
      }
      if(doc.mode==='2d')applied[this.normal]=0;
      body.force=add(body.force,applied);this.bodies.get(source.id).appliedForce=applied;
    }
    for(const c of doc.components.filter(c=>c.kind==='force')){const b=this.bodies.get(c.refs.target);if(b){b.force=add(b.force,[c.params.fx,c.params.fy,c.params.fz]);b.torque=add(b.torque,[c.params.tx,c.params.ty,c.params.tz]);}}
    for(const c of doc.components.filter(c=>c.kind==='harmonic_force')){const b=this.bodies.get(c.refs.target);if(b)b.force[c.params.axis]+=c.params.amplitude*Math.sin(TAU*c.params.frequency*this.time+c.params.phase*Math.PI/180);}
    this.mechanics.step(dt,this.bodies);
    for(const c of doc.components.filter(c=>c.kind==='coil')) {
      const b=this.bodies.get(c.id),p=c.params;
      // Wire along +Y, constrained motion along X: (L × B).x = L * Bz.
      const B=fieldAt(doc,b.position,this.bodies).magnetic[2];
      const accel=(t,x,v)=>(B*p.length*this.sourceCurrent(c.id,t)-p.stiffness*x-p.damping*v)/p.mass;
      const a1=accel(this.time,b.x,b.v),v1=b.v,a2=accel(this.time+dt/2,b.x+v1*dt/2,b.v+a1*dt/2),v2=b.v+a1*dt/2,a3=accel(this.time+dt/2,b.x+v2*dt/2,b.v+a2*dt/2),v3=b.v+a2*dt/2,a4=accel(this.time+dt,b.x+v3*dt,b.v+a3*dt),v4=b.v+a3*dt;
      b.x+=dt*(v1+2*v2+2*v3+v4)/6; b.v+=dt*(a1+2*a2+2*a3+a4)/6;
      b.position=[c.position[0]+b.x,c.position[1],c.position[2]].map((v,i)=>doc.mode==='2d'&&i===this.normal?0:v);b.velocity=[b.v,0,0];b.force=[B*p.length*this.sourceCurrent(c.id,this.time),0,0];
    }
    this.time+=dt;this.steps++;
    if(this.steps%8===0) {
      for(const c of [...movable,...doc.components.filter(c=>c.kind==='coil')]) { const b=this.bodies.get(c.id);b.trail.push([...b.position]);if(b.trail.length>180)b.trail.shift(); }
      this.measure();this.samples.push({t:this.time,...this.readings});if(this.samples.length>900)this.samples.shift();
    }
  }
  /** 一段热交换在一步 dt 内让本节点走掉的温差比例：ΔT_本 = (T_另一端 − T_本)·f。
   *  精确解是 1−e^{−G(1/C_本+1/C_对)dt}，再按热容比分配；对端是无限热库时就直接取满。 */
  thermalFraction(capacitySelf, capacityOther, conductance, dt) {
    if(!(conductance>0)||!Number.isFinite(dt)||dt<=0)return 0;
    const freeSelf=Number.isFinite(capacitySelf),freeOther=Number.isFinite(capacityOther);
    const inverse=(freeSelf?1/capacitySelf:0)+(freeOther?1/capacityOther:0);if(!(inverse>0))return 0;
    return (1-Math.exp(-conductance*inverse*dt))*(freeOther?capacityOther/(capacityOther+capacitySelf):1);
  }
  /** 器具的热容；恒温热源是无限大热库（温度由 parameters 锁定），温度计是纯探针、只有固定的等效热容。 */
  heatCapacityOf(c){
    if(c.kind==='heat_source')return Infinity;
    if(c.kind==='thermometer')return THERMOMETER_CAPACITY;
    return Math.max(c.params.heatCapacity,1e-6);
  }
  /** 该位置的温度：相连导热棒的杆身 > 作用半径内的热源 > 环境温度。 */
  localTemperature(c){
    const rods=this.doc.components.filter(x=>x.kind==='conductor'&&(x.refs.a===c.id||x.refs.b===c.id));
    if(rods.length)return rods.reduce((sum,rod)=>sum+this.temperatureOf(rod.id),0)/rods.length;
    const point=this.bodies.get(c.id)?.position||c.position;let best=null,nearest=Infinity;
    for(const source of this.doc.components.filter(x=>x.kind==='heat_source')){
      const distance=norm(sub(point,this.bodies.get(source.id)?.position||source.position));
      if(distance>source.params.radius||distance>=nearest)continue;
      nearest=distance;best=source;
    }
    return best?clampTemperature(best.params.temperature):ambientOf(this.doc);
  }
  temperatureOf(id){const node=this.thermal?.get(id);return node?clampTemperature(node.temperature):ambientOf(this.doc);}
  /** 傅里叶热流 W，正值表示由 A 端流向 B 端。 */
  heatFlowOf(c){const p=c.params;if(!this.thermal?.get(c.refs.a)||!this.thermal?.get(c.refs.b))return 0;return p.conductivity*p.area*(this.temperatureOf(c.refs.a)-this.temperatureOf(c.refs.b))/Math.max(p.length,1e-6);}
  thermalStep(dt) {
    if(!this.thermal?.size)return;
    const doc=this.doc,nodes=doc.components.filter(c=>THERMAL_KINDS.includes(c.kind)&&this.thermal.has(c.id));
    if(!nodes.length)return;
    const capacity=new Map(nodes.map(c=>[c.id,this.heatCapacityOf(c)]));
    const sources=nodes.filter(c=>c.kind==='heat_source');
    for(const source of sources)this.thermal.get(source.id).temperature=clampTemperature(source.params.temperature);
    // 热源 → 作用半径内的导热棒：等效热导 h = 功率 / max(距离, 0.1)，精确指数积分保证不发散。
    for(const source of sources){
      const sp=source.params,origin=this.bodies.get(source.id)?.position||source.position;
      if(!(sp.power>0))continue;
      for(const target of nodes){
        if(target.kind!=='conductor')continue;
        // 半径比较必须用真实距离：夹到 0.1 m 只用在热导上，否则 radius < 0.1 时连正中心的导热棒都落不进作用区。
        const distance=norm(sub(this.bodies.get(target.id)?.position||target.position,origin));
        if(distance>sp.radius)continue;
        const node=this.thermal.get(target.id),gain=1-Math.exp(-dt*(sp.power/Math.max(distance,.1))/capacity.get(target.id));
        node.temperature=clampTemperature(node.temperature+(clampTemperature(sp.temperature)-node.temperature)*gain);
      }
    }
    // 导热棒：两端温差产生热流，每半段热导 2λA/L，稳态通量即 λA(T_A−T_B)/L。
    // 两半段必须基于「本步开始时」的同一份温度快照一起写回。先 A 后 B 的顺序更新是算子分裂：杆身在一步里
    // 被连续拉向 A 又拉向 B，稳态落到后一个端点一侧，G·dt/C 越大偏得越多（极端参数下能从 50 ℃ 偏到 0 ℃），
    // 而且对调 refs.a / refs.b 就换一个答案。
    for(const rod of nodes.filter(c=>c.kind==='conductor')){
      const a=this.thermal.get(rod.refs.a),b=this.thermal.get(rod.refs.b),body=this.thermal.get(rod.id);
      if(!a||!b||a===b)continue;
      const capA=capacity.get(rod.refs.a),capB=capacity.get(rod.refs.b),own=capacity.get(rod.id);
      const half=2*rod.params.conductivity*rod.params.area/Math.max(rod.params.length,1e-6);
      const ta=a.temperature,tb=b.temperature,tm=body.temperature;
      const fA=this.thermalFraction(own,capA,half,dt),fB=this.thermalFraction(own,capB,half,dt);
      // 两半段并联时杆身的合成比例是 1−e^{−(f_A+f_B)}（两端为无限热库时与解析解完全一致）；
      // 用它统一缩放两段增量，极端参数 G·dt/C ≫ 1 也不会在中点两侧来回振荡。
      const sum=fA+fB,mix=sum>0?(1-Math.exp(-sum))/sum:1;
      const fromA=(ta-tm)*fA*mix,fromB=(tb-tm)*fB*mix;
      body.temperature=clampTemperature(tm+fromA+fromB);
      // 有限热容的端点按能量守恒扣掉对应的热量：C_端·ΔT_端 = −C_杆·ΔT_杆(来自该段)。
      if(Number.isFinite(capA))a.temperature=clampTemperature(ta-own/capA*fromA);
      if(Number.isFinite(capB))b.temperature=clampTemperature(tb-own/capB*fromB);
    }
    // 温度计：探针本身不带走热量，读数按一阶滞后趋近局部环境温度。
    for(const meter of nodes.filter(c=>c.kind==='thermometer')){
      const node=this.thermal.get(meter.id),tau=Math.max(meter.params.responseTime,.01);
      node.temperature=clampTemperature(node.temperature+(this.localTemperature(meter)-node.temperature)*(1-Math.exp(-dt/tau)));
    }
  }
  rays() {
    const segments=[];
    for(const source of this.doc.components.filter(c=>c.kind==='laser'))for(let i=-2;i<=2;i++) {
      const a=source.params.angle*Math.PI/180;
      let dir=[Math.cos(a),Math.sin(a),0],origin=add(this.bodies.get(source.id).position,mul([-dir[1],dir[0],0],source.params.width*i/2));
      let power=source.params.power*this.modulation(source.id,'optical')/5;
      let lastId=source.id;
      for(let bounce=0;bounce<Math.min(72,8+this.doc.components.length);bounce++) {
        let best=null;
        for(const c of this.doc.components.filter(c=>[...LENS_KINDS,'mirror','refract_plane','detector','aperture','optical_filter'].includes(c.kind)&&c.id!==lastId)) {
          const pos=this.bodies.get(c.id).position, angle=(c.params.angle||0)*Math.PI/180,n=[Math.cos(angle),Math.sin(angle),0],den=dot(dir,n);
          if(Math.abs(den)<1e-6)continue;
          const distance=dot(sub(pos,origin),n)/den;
          if(distance<=1e-7||distance>30)continue;
          const hit=add(origin,mul(dir,distance));
          if(norm(sub(hit,pos))>c.params.radius)continue;
          if(!best||distance<best.distance)best={c,hit,n,pos,distance};
        }
        const end=best?.hit || add(origin,mul(dir,18));
        segments.push({from:origin,to:end,power,source:source.id,hit:best?.c.id});
        if(!best||best.c.kind==='detector')break;
        if(best.c.kind==='aperture'){if(norm(sub(best.hit,best.pos))>best.c.params.opening)break;}
        else if(best.c.kind==='optical_filter')power*=best.c.params.transmission;
        else if(best.c.kind==='mirror')dir=sub(dir,mul(best.n,2*dot(dir,best.n)));
        else if(best.c.kind==='refract_plane'){
          const p=best.c.params,facing=dot(dir,best.n);
          // 正向入射（沿法线方向）由 n1 进入 n2，反向入射则由 n2 返回 n1，支持玻璃砖等双面折射。
          const eta=facing>=0?p.n1/p.n2:p.n2/p.n1;
          const n=mul(best.n,-(Math.sign(facing)||1)),cosI=-dot(dir,n),k=1-eta*eta*(1-cosI*cosI);
          // 斯涅尔定律 n₁sinθ₁ = n₂sinθ₂；k<0 无实解，发生全反射。
          if(k<0)dir=sub(dir,mul(n,2*dot(dir,n)));
          else dir=unit(add(mul(dir,eta),mul(n,eta*cosI-Math.sqrt(k))));
        }
        else {
          const axis=mul(best.n,Math.sign(dot(dir,best.n))),normalPart=dot(dir,axis),height=sub(best.hit,best.pos);
          const focal=Math.abs(best.c.params.focal)<1e-6?(best.c.params.focal<0?-1e-6:1e-6):best.c.params.focal;
          // Paraxial thin-lens slope change: theta_out = theta_in - h/f.
          dir=unit(add(axis,sub(mul(sub(dir,mul(axis,normalPart)),1/Math.max(.001,normalPart)),mul(height,1/focal))));
        }
        origin=end;lastId=best.c.id;
      }
    }
    return segments;
  }
  measure() {
    const channels={},rays=this.rays();let energy=0,maxSpeed=0,totalPressure=0,light=0;
    for(const c of this.doc.components) {
      const b=this.bodies.get(c.id),p=c.params; let value=0,unitLabel='',label=c.name;
      if(c.kind==='lens_bench'){
        const metrics=solveLens({...p,maskTop:!!p.maskTop});
        for(const [key,label,unitLabel] of [['v','像距','cm'],['m','放大率','倍'],['imageHeight','像高','cm'],['blurDiameter','弥散圆','cm'],['relativeIlluminance','相对照度','比例'],['screenHasImage','光屏可见像','0/1'],['real','实像','0/1']]){
          const value=Number(metrics[key]);channels[c.id+':'+key]={label:c.name+' · '+label,value:Number.isFinite(value)?value:0,unit:unitLabel,valid:Number.isFinite(value)};
        }
        channels[c.id]={label:c.name+' · 放大率',value:Number.isFinite(metrics.m)?metrics.m:0,unit:'倍',valid:Number.isFinite(metrics.m)};
        continue;
      }
      if(c.kind==='pinhole_screen'){
        // 每个物点穿过小孔投出一个斑：倒像高度按相似三角形，斑径 = 孔径 × (1 + 孔屏距/物孔距)。
        const objDist=Math.max(1e-6,p.objectDistance),holeDist=Math.max(1e-6,p.holeDistance);
        const imageHeight=p.objectHeight*holeDist/objDist;
        const blur=p.holeDiameter*(1+holeDist/objDist);
        const sharpness=imageHeight>1e-9?Math.max(0,1-blur/imageHeight):0;
        // 相对亮度取小孔在屏处张开的立体角 Ω = π(d/2)²/L²，单位 sr；孔径变大则亮、L 变大则暗。
        const brightness=Math.PI*(p.holeDiameter/2)**2/(p.holeDistance**2);
        for(const [key,label,unitLabel] of [['imageHeight','像高','m'],['blur','模糊斑直径','m'],['sharpness','清晰度','比例'],['brightness','相对亮度','sr']]){
          const v={imageHeight,blur,sharpness,brightness}[key];channels[c.id+':'+key]={label:c.name+' · '+label,value:Number.isFinite(v)?v:0,unit:unitLabel,valid:Number.isFinite(v)};
        }
        value=imageHeight;unitLabel='m';label=c.name+' · 像高';
        channels[c.id]={value,unit:unitLabel,label,kind:c.kind};
        continue;
      }
      if(c.kind==='eye_model'){
        // 晶状体 + 眼镜先叠加成等效光焦度，再把薄透镜像距与固定视网膜位置比较。
        const power=1/p.focal+p.correction,parallel=Math.abs(power)<1e-6,fEff=parallel?Infinity:1/power;
        // 等效光焦度为零或物距正好等于焦距时不成像，取远端近似（同 lens_bench 的 FAR）。
        const v=parallel||Math.abs(p.objectDistance-fEff)<1e-9?1e6:p.objectDistance*fEff/(p.objectDistance-fEff);
        const focusError=v-p.axialLength;
        const inFocus=Math.abs(focusError)<.0005;
        const retinaBlur=Math.abs(focusError)*(PUPIL_DIAMETER/2)/Math.max(.001,Math.abs(v));
        for(const [key,label,unitLabel] of [['focusError','焦点偏差','m'],['inFocus','是否看得清','0/1'],['retinaBlur','视网膜模糊斑','m'],['v','像距','m']]){
          const v2={focusError,inFocus:Number(inFocus),retinaBlur,v}[key];channels[c.id+':'+key]={label:c.name+' · '+label,value:Number.isFinite(v2)?v2:0,unit:unitLabel,valid:Number.isFinite(v2)};
        }
        value=Number.isFinite(focusError)?focusError:0;unitLabel='m';label=c.name+' · 焦点偏差';
      }
      if(RIGID_KINDS.includes(c.kind)){value=norm(b.velocity);unitLabel='m/s';energy+=.5*p.mass*value**2+p.mass*this.doc.environment.gravity*b.position[1]+this.mechanics.rotationalEnergy(c.id);channels[c.id+':angular']={value:norm(b.angularVelocity||[0,0,0]),unit:'rad/s',label:c.name+' · 角速度',kind:c.kind};maxSpeed=Math.max(maxSpeed,value);}
      if(c.kind==='coil'){value=b.x;unitLabel='m';energy+=.5*p.mass*b.v**2+.5*p.stiffness*b.x**2;maxSpeed=Math.max(maxSpeed,Math.abs(b.v));}
      if(LINK_KINDS.includes(c.kind)) { const a=this.bodies.get(c.refs.a),bb=this.bodies.get(c.refs.b);value=a&&bb?norm(sub(a.position,bb.position))-(p.restLength||0):0;unitLabel='m';energy+=.5*(p.stiffness||0)*(c.kind==='rope'?Math.max(0,value):value)**2; }
      if(c.kind==='power'){value=p.current*(p.frequency===0?1:Math.sin(TAU*p.frequency*this.time+p.phase*Math.PI/180));unitLabel='A';}
      if(SOUND_KINDS.includes(c.kind)){value=p.amplitude*this.modulation(c.id,'acoustic')*Math.sin(TAU*p.frequency*this.time+p.phase*Math.PI/180);unitLabel='Pa';}
      if(c.kind==='microphone'){value=this.pressure(b.position);unitLabel='Pa';totalPressure=value;}
      if(c.kind==='detector'){value=rays.filter(r=>r.hit===c.id).reduce((s,r)=>s+r.power,0);unitLabel='mW';light+=value;}
      if(['field','bar_magnet'].includes(c.kind)){value=norm(fieldAt(this.doc,b.position,this.bodies).magnetic);unitLabel='T';}
      if(c.kind==='probe'){const field=fieldAt(this.doc,b.position,this.bodies);value=norm(field.electric);unitLabel='N/C';label=c.name+' · 电场';channels[c.id+':B']={value:norm(field.magnetic),unit:'T',label:c.name+' · 磁场',kind:c.kind};}
      if(c.kind==='laser'){value=p.power*this.modulation(c.id,'optical');unitLabel='mW';}
      if(c.kind==='dynamometer'){const a=this.bodies.get(c.refs.a),bb=this.bodies.get(c.refs.b);value=a&&bb?p.stiffness*(norm(sub(bb.position,a.position))-p.restLength)+p.damping*dot(sub(bb.velocity,a.velocity),unit(sub(bb.position,a.position))):0;unitLabel='N';}
      if(c.kind==='distance_sensor'){const a=this.bodies.get(c.refs.a),bb=this.bodies.get(c.refs.b);value=a&&bb?norm(sub(a.position,bb.position)):0;unitLabel='m';}
      if(c.kind==='motion_sensor'){const target=this.bodies.get(c.refs.target),cfg=this.doc.components.find(x=>x.id===c.refs.target);value=target?norm(target.velocity):0;unitLabel='m/s';if(target)for(let i=0;i<3;i++){channels[c.id+':'+i]={value:target.position[i],unit:'m',label:c.name+' · '+'XYZ'[i],kind:c.kind};channels[c.id+':v'+i]={value:target.velocity[i],unit:'m/s',label:c.name+' · 速度 '+'XYZ'[i],kind:c.kind};}channels[c.id+':acceleration']={value:target&&cfg?.params.mass?norm(target.force)/cfg.params.mass:0,unit:'m/s²',label:c.name+' · 外力加速度（不含碰撞冲量）',kind:c.kind};}
      if(c.kind==='electric_field'){value=norm(fieldAt(this.doc,b.position,this.bodies).electric);unitLabel='N/C';}
      if(['expression_force','drag'].includes(c.kind)){value=norm(b.appliedForce||[0,0,0]);unitLabel='N';}
      if(c.kind==='harmonic_force'){value=p.amplitude*Math.sin(TAU*p.frequency*this.time+p.phase*Math.PI/180);unitLabel='N';}
      if(c.kind==='force'){value=norm([p.fx,p.fy,p.fz]);unitLabel='N';}
      if(c.kind==='thermometer'){value=this.temperatureOf(c.id);unitLabel='℃';channels[c.id+':target']={value:this.localTemperature(c),unit:'℃',label:c.name+' · 环境温度',kind:c.kind};}
      if(c.kind==='heat_source'){value=clampTemperature(p.temperature);unitLabel='℃';}
      if(c.kind==='conductor'){
        const ta=this.thermal?.get(c.refs.a)?this.temperatureOf(c.refs.a):null,tb=this.thermal?.get(c.refs.b)?this.temperatureOf(c.refs.b):null;
        value=ta===null||tb===null?0:this.heatFlowOf(c);unitLabel='W';
        channels[c.id+':Ta']={value:ta===null?0:ta,unit:'℃',label:c.name+' · A 端',valid:ta!==null,kind:c.kind};
        channels[c.id+':Tb']={value:tb===null?0:tb,unit:'℃',label:c.name+' · B 端',valid:tb!==null,kind:c.kind};
        channels[c.id+':heatFlow']={value,unit:'W',label:c.name+' · 热流（A→B）',valid:ta!==null&&tb!==null,kind:c.kind};
      }
      if(CIRCUIT_KINDS.includes(c.kind)){const r=this.circuit.readings[c.id];if(r){value=['battery','ac_source','capacitor','voltmeter'].includes(c.kind)?r.voltage:r.current;unitLabel=['battery','ac_source','capacitor','voltmeter'].includes(c.kind)?'V':'A';channels[c.id+':V']={value:r.voltage,unit:'V',label:c.name+' · 电压',kind:c.kind};channels[c.id+':I']={value:r.current,unit:'A',label:c.name+' · 电流',kind:c.kind};channels[c.id+':P']={value:r.power,unit:'W',label:c.name+' · 功率',kind:c.kind};}}
      channels[c.id]={value,unit:unitLabel,label,kind:c.kind};
    }
    if(this.opticalTrain){
      for(const [key,label] of [['effectiveFocal','镜组合成焦距'],['backFocal','末片至后焦点']]){
        const distance=this.opticalTrain[key];channels['optics:'+key]={value:distance===null?0:1000*distance,valid:distance!==null,unit:'mm',label};
      }
    }
    this.readings={energy,speed:maxSpeed,pressure:totalPressure,light,channels,circuit:{warnings:this.circuit.warnings,error:this.circuit.error||null,branches:this.circuit.readings}};return this.readings;
  }
}
export function simulate(doc, duration = 5, sampleRate = 60) {
  const sim=new Simulation(doc),series=[],stride=Math.max(1,Math.round(1/(sampleRate*DT))),steps=Math.round(duration/DT);
  for(let i=0;i<steps;i++){sim.step();if(i%stride===0)series.push({t:sim.time,...sim.measure()});}
  sim.measure();
  return {duration:sim.time,dt:DT,model:'educational-lumped-parameter-v3',readings:sim.readings,series,positions:Object.fromEntries([...sim.bodies].map(([id,b])=>[id,b.position])),limitations:['球体、箱体与圆柱采用 Cannon 刚体接触、摩擦与转动；绳索与弹簧采用线性弹性模型。','库仑场使用 0.04 m 软化半径；磁场为有限区域匀强场。','声学为自由场球面波叠加，无房间反射；光学为近轴薄透镜与理想反射。','换能连接为单向、线性近似，不包含完整能量回馈。','电路为集中参数节点电压法，RC/RL 使用后向 Euler；电源与仪表带内阻，不含半导体与温度非线性。']};
}
