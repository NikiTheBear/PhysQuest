import test from 'node:test';
import assert from 'node:assert/strict';
import {component,blankExperiment} from '../shared/catalog.js';
import {Simulation} from '../shared/physics.js';
import {lensTrain} from '../shared/lens-train.js';
const lens=(x,f)=>{const c=component(f>0?'lens':'diverging_lens',{position:[x,0,0]});c.params.focal=f;return c;};
test('80 mm pair 32 mm apart has 50 mm EFL and rays focus 30 mm behind the second lens',()=>{
  const a=lens(0,.08),b=lens(.032,.08),laser=component('laser',{position:[-.02,0,0]});laser.params.width=.001;
  const d=blankExperiment();d.components=[b,laser,a];
  const sim=new Simulation(d),channels=sim.readings.channels;
  assert.ok(Math.abs(channels['optics:effectiveFocal'].value-50)<1e-9);
  assert.ok(Math.abs(channels['optics:backFocal'].value-30)<1e-9);
  const rays=sim.rays();assert.equal(rays.filter(r=>r.hit===b.id).length,5);
  const outgoing=rays.find(r=>Math.abs(r.from[0]-.032)<1e-10&&Math.abs(r.from[1])>1e-6);
  const [x,y]=outgoing.from,slope=(outgoing.to[1]-y)/(outgoing.to[0]-x);
  assert.ok(Math.abs(x-y/slope-.062)<1e-9);
  a.params.focal=.1;assert.notEqual(lensTrain(d.components).effectiveFocal,.05);
});
test('afocal pairs and misaligned lenses do not produce a finite system focal length',()=>{
  const a=lens(0,.1),b=lens(.05,-.05);
  assert.equal(lensTrain([a,b]).effectiveFocal,null);
  b.position[1]=.01;assert.equal(lensTrain([a,b]),null);
});
