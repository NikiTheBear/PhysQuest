import {lensTrain} from './lens-train.js';
import { CATALOG, RIGID_KINDS, CIRCUIT_KINDS, SOUND_KINDS, LENS_KINDS, LINK_KINDS } from './catalog.js';
import { solve as solveLens } from './physquest-lens.js';
import { Circuit } from './circuit.js';
import {compileForce} from './force-expression.js';
import { Mechanics } from './mechanics.js';
export const DT = 1 / 480;
const K = 8.9875517923e9;
const TAU = Math.PI * 2;
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const norm = a => Math.hypot(...a);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, n) => a.map(v => v * n);
const add = (a, b) => a.map((v, i) => v + b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a, 1 / (norm(a) || 1));
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
    this.opticalTrain=lensTrain(doc.components);
    this.doc = structuredClone(doc); this.time = 0; this.steps = 0;
    this.bodies = new Map(doc.components.map(c => [c.id, {
      position: c.position.map((v, i) => doc.mode === '2d' && i === 2 ? 0 : v + (c.kind === 'coil' && i === 0 ? c.params.displacement : 0)),
      velocity: c.fixed ? [0,0,0] : [c.params.vx || 0, c.params.vy || 0, doc.mode === '2d' ? 0 : (c.params.vz || 0)],
      x: c.params.displacement || 0, v: 0, force: [0,0,0], trail: []
    }]));
    this.forceSources=this.doc.components.filter(c=>['drag','expression_force'].includes(c.kind)).map(c=>({
      source:c,target:this.doc.components.find(item=>item.id===c.refs.target),
      axes:c.kind==='expression_force'?['fx','fy','fz'].map(axis=>compileForce(c.params[axis])):null
    }));
    this.mechanics=new Mechanics(this.doc,this.bodies);this.circuit=new Circuit(this.doc);
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
      const relative=sub(point,this.bodies.get(c.id).position),angle=(c.params.angle||0)*Math.PI/180,directivity=c.kind==='directional_speaker'?Math.max(0,(relative[0]*Math.cos(angle)+relative[1]*Math.sin(angle))/d)**c.params.directivity:1;
      sum += directivity*c.params.amplitude * this.modulation(c.id, 'acoustic') / Math.max(1, d) * Math.sin(TAU*c.params.frequency*(t-d/c.params.speed) + c.params.phase*Math.PI/180);
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
    this.circuit.step(dt);
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
      if(doc.mode==='2d')applied[2]=0;
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
      b.position=[c.position[0]+b.x,c.position[1],doc.mode==='2d'?0:c.position[2]];b.velocity=[b.v,0,0];b.force=[B*p.length*this.sourceCurrent(c.id,this.time),0,0];
    }
    this.time+=dt;this.steps++;
    if(this.steps%8===0) {
      for(const c of [...movable,...doc.components.filter(c=>c.kind==='coil')]) { const b=this.bodies.get(c.id);b.trail.push([...b.position]);if(b.trail.length>180)b.trail.shift(); }
      this.measure();this.samples.push({t:this.time,...this.readings});if(this.samples.length>900)this.samples.shift();
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
        for(const c of this.doc.components.filter(c=>[...LENS_KINDS,'mirror','detector','aperture','optical_filter'].includes(c.kind)&&c.id!==lastId)) {
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
        else {
          const axis=mul(best.n,Math.sign(dot(dir,best.n))),normalPart=dot(dir,axis),height=sub(best.hit,best.pos);
          // Paraxial thin-lens slope change: theta_out = theta_in - h/f.
          dir=unit(add(axis,sub(mul(sub(dir,mul(axis,normalPart)),1/Math.max(.001,normalPart)),mul(height,1/best.c.params.focal))));
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
