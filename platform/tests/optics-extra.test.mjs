import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, component, blankExperiment } from '../shared/catalog.js';
import { validateExperiment } from '../shared/workspace.js';
import { colliderOf } from '../shared/colliders.js';
import { Simulation } from '../shared/physics.js';
const part=(kind,over={})=>component(kind,{...over,params:{...component(kind).params,...over.params}});
const scene=(...components)=>({...blankExperiment(),components,environment:{gravity:0,damping:0,speed:1,collisions:false}});
const running=doc=>new Simulation(validateExperiment(doc));
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} ≈ ${b}`);
const deg=a=>a*180/Math.PI;
function refracted(normal,n1,n2){
  const source=part('laser',{position:[-2,1,0]}),plane=part('refract_plane',{position:[0,1,0],params:{angle:normal,n1,n2}});
  const sim=running(scene(source,plane)),rays=sim.rays();
  const hit=rays.findIndex(r=>r.hit===plane.id),next=rays[hit+1];
  assert.ok(hit>=0&&next,`法线 ${normal}° 的光线应击中界面`);
  const d=[next.to[0]-next.from[0],next.to[1]-next.from[1]],len=Math.hypot(...d),dir=d.map(v=>v/len);
  const a=normal*Math.PI/180,n=[Math.cos(a),Math.sin(a),0];
  // 入射光沿 +X；dot(dir, n) 的符号说明光线留在界面哪一侧
  return {dir,n,side:dir[0]*n[0]+dir[1]*n[1],tilt:deg(Math.acos(Math.min(1,Math.abs(dir[0]*n[0]+dir[1]*n[1]))))};
}

test('refraction at a plane interface obeys Snell (45° into n=1.5 gives 28.1°)',()=>{
  const {dir,side,tilt}=refracted(45,1,1.5);
  near(tilt,28.13,1);
  near(tilt,deg(Math.asin(Math.sin(Math.PI/4)/1.5)),1e-6);
  assert.ok(side>0,'折射光线应穿过界面继续向前');
  // 光从空气进入介质：更靠近法线
  assert.ok(Math.abs(dir[1])<Math.sin(Math.PI/4));
});

test('beyond the critical angle the interface total-internally reflects',()=>{
  const angle=50,{dir,n,side,tilt}=refracted(angle,1.5,1);
  // 临界角 sin⁻¹(1/1.5) ≈ 41.8°，所以 50° 不折射：反射角等于入射角
  near(tilt,angle,1e-6);
  assert.ok(side<0,'全反射后光线退回入射侧，法向分量反向');
  // 反射律：把入射方向 [1,0,0] 沿法线镜像
  near(dir[0],1-2*n[0]**2,1e-9);
  near(dir[1],-2*n[0]*n[1],1e-9);
});

test('pinhole image height follows h′ = h·(hole distance / object distance)',()=>{
  const hole=part('pinhole_screen',{params:{objectHeight:1,objectDistance:2,holeDistance:1}});
  const sim=running(scene(hole)),channels=sim.readings.channels;
  near(channels[hole.id+':imageHeight'].value,.5,1e-12);
  near(channels[hole.id+':blur'].value,.005*(1+1/2),1e-12);
  assert.ok(channels[hole.id+':brightness'].value>0);
  assert.equal(channels[hole.id].value,channels[hole.id+':imageHeight'].value);
});

test('a wider pinhole is brighter but blurrier',()=>{
  const sharp=part('pinhole_screen',{params:{holeDiameter:.005}}),blurry=part('pinhole_screen',{params:{holeDiameter:.05}});
  const sim=running(scene(sharp,blurry)),channels=sim.readings.channels;
  assert.ok(channels[blurry.id+':sharpness'].value<channels[sharp.id+':sharpness'].value);
  assert.ok(channels[blurry.id+':blur'].value>channels[sharp.id+':blur'].value);
  assert.ok(channels[blurry.id+':brightness'].value>channels[sharp.id+':brightness'].value);
  assert.ok(channels[sharp.id+':sharpness'].value>0&&channels[sharp.id+':sharpness'].value<=1);
});

test('an emmetropic eye focuses a 5 m object on the retina',()=>{
  // 薄透镜 1/u+1/v=1/f：u=5 m、视网膜 24 mm 需要 f≈23.9 mm。
  // 默认 focal=0.017 m 是任务书的原始默认值，在这个“空气薄透镜 + 固定屏”模型里它把像落在 17 mm 处（即 -7 mm 近视），所以正视眼需把 focal 调到 23.9 mm。
  const eye=part('eye_model',{params:{focal:.0239,axialLength:.024,objectDistance:5,correction:0}});
  const channels=running(scene(eye)).readings.channels;
  near(channels[eye.id+':v'].value,.024,1e-4);
  assert.equal(channels[eye.id+':inFocus'].value,1);
  assert.ok(Math.abs(channels[eye.id+':focusError'].value)<.0005);
  const relaxed=part('eye_model',{params:{focal:.017,axialLength:.024,objectDistance:5}});
  assert.ok(running(scene(relaxed)).readings.channels[relaxed.id+':focusError'].value<0,'17 mm 晶状体把像落在视网膜之前');
});

test('a negative lens corrects a long myopic eye and the sign matters',()=>{
  const base={focal:.0246,axialLength:.026,objectDistance:5};
  const naked=part('eye_model',{params:{...base,correction:0}}),glasses=part('eye_model',{params:{...base,correction:-2}});
  const channels=running(scene(naked,glasses)).readings.channels;
  assert.equal(channels[naked.id+':inFocus'].value,0);
  assert.ok(channels[naked.id+':focusError'].value<0,'近视：像落在视网膜前');
  assert.equal(channels[glasses.id+':inFocus'].value,1);
  assert.ok(Math.abs(channels[glasses.id+':focusError'].value)<Math.abs(channels[naked.id+':focusError'].value));
  assert.ok(channels[naked.id+':retinaBlur'].value>channels[glasses.id+':retinaBlur'].value);
  // 换成同度数的正镜只会更糟
  const worse=part('eye_model',{params:{...base,correction:2}});
  assert.ok(Math.abs(running(scene(worse)).readings.channels[worse.id+':focusError'].value)>Math.abs(channels[naked.id+':focusError'].value));
});

test('the three optics additions have legal defaults and finite readings',()=>{
  // refract_plane 与 mirror 一样只参与光线追踪，只有底层一个通道；针孔与眼球各 4 个读数 + 1 个底层通道。
  const expected={refract_plane:1,pinhole_screen:5,eye_model:5};
  for(const kind of ['refract_plane','pinhole_screen','eye_model']){
    assert.equal(CATALOG[kind].domain,'optics');
    const c=part(kind),doc=scene(c);
    validateExperiment(structuredClone(doc));
    const sim=new Simulation(doc);
    sim.advance(.02);
    assert.equal(Object.keys(sim.readings.channels).length,expected[kind],kind);
    assert.ok(Object.values(sim.readings.channels).every(ch=>Number.isFinite(ch.value)),kind);
    assert.ok(Object.values(c.params).every(v=>Number.isFinite(v)),kind);
    assert.equal(colliderOf(c).enabled,false,kind+' 不参与碰撞');
  }
});

test('workspace rejects a non-positive eye axis or pinhole distance and out-of-range parameters',()=>{
  assert.throws(()=>validateExperiment(scene(part('eye_model',{params:{axialLength:0}}))),/眼轴/);
  assert.throws(()=>validateExperiment(scene(part('pinhole_screen',{params:{holeDistance:0}}))),/孔到屏/);
  assert.throws(()=>validateExperiment(scene(part('pinhole_screen',{params:{holeDiameter:.5}}))));
  assert.throws(()=>validateExperiment(scene(part('refract_plane',{params:{n2:0}}))));
});

test('a spectacle correction that cancels the lens still returns finite readings',()=>{
  const eye=part('eye_model',{params:{focal:.05,correction:-20}});
  const channels=running(scene(eye)).readings.channels;
  assert.ok(Object.values(channels).every(ch=>Number.isFinite(ch.value)));
  assert.equal(channels[eye.id+':inFocus'].value,0);
});
