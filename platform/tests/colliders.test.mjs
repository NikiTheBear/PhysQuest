import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorkspace,activeExperiment} from '../shared/catalog.js';
import {runTool} from '../worker/operations.js';
import {Simulation} from '../shared/physics.js';
import {colliderOf} from '../shared/colliders.js';
import {TOOLS} from '../worker/tools.js';
const hull=(enabled=true,size=[1,1,1],offset=[0,0,0])=>({enabled,shape:'box',size,offset});
const add=(w,kind,options={})=>runTool(w,'add_component',{kind,...options}).workspace;
test('a fixed instrument with a collision box blocks a moving body, and disabling it permits passage',()=>{
  let w=add(blankWorkspace(),'body',{position:[-1,2,0],params:{radius:.2,vx:2,restitution:0}});
  w=add(w,'laser',{position:[1,2,0],collider:hull()});
  const doc=activeExperiment(w),id=doc.components[0].id,obstacle=doc.components[1].id;
  let sim=new Simulation(doc);sim.advance(2);assert.ok(sim.bodies.get(id).position[0]<.32);assert.deepEqual(sim.bodies.get(obstacle).position,[1,2,0]);
  w=runTool(w,'update_component',{componentId:obstacle,collider:hull(false)}).workspace;
  sim=new Simulation(activeExperiment(w));sim.advance(2);assert.ok(sim.bodies.get(id).position[0]>2.9);
});
test('collision size and local offset determine contact height without changing the visual model',()=>{
  let w=add(blankWorkspace(),'box',{position:[0,4,0],params:{width:.2,height:.2,depth:.2,restitution:0},collider:hull(true,[1,1,1],[0,-.5,0])});
  w=runTool(w,'update_experiment',{environment:{gravity:9.81}}).workspace;
  const doc=activeExperiment(w),sim=new Simulation(doc);sim.advance(2);
  assert.ok(Math.abs(sim.bodies.get(doc.components[0].id).position[1]-1)<.015);assert.equal(doc.components[0].params.height,.2);
});
test('global and per-object collision toggles both control contact',()=>{
  for(const global of [true,false]){let w=add(blankWorkspace(),'body',{position:[0,2,0],collider:hull(false)});w=runTool(w,'update_experiment',{environment:{gravity:10,collisions:global}}).workspace;const doc=activeExperiment(w),sim=new Simulation(doc);sim.advance(1);assert.ok(sim.bodies.get(doc.components[0].id).position[1]<0);}
  assert.equal(colliderOf(activeExperiment(add(blankWorkspace(),'body')).components[0]).type,'sphere');
});
test('collision definitions survive designs and experiment files through the MCP executor',()=>{
  let w=blankWorkspace();const designed=runTool(w,'design_component',{name:'有碰撞范围的电阻',kind:'resistor',collider:hull(true,[2,1,1],[.2,0,0])});
  w=runTool(designed.workspace,'instantiate_design',{designId:designed.result.id}).workspace;
  const file=runTool(w,'export_experiment').result,copy=runTool(w,'import_experiment',{file});
  assert.deepEqual(activeExperiment(copy.workspace).components[0].collider,hull(true,[2,1,1],[.2,0,0]));
  for(const name of ['add_component','update_component','design_component','update_design'])assert.ok(TOOLS.find(t=>t.name===name).inputSchema.properties.collider,name);
});
test('invalid colliders reject atomically, including logical field instruments',()=>{
  const w=blankWorkspace();for(const collider of [hull(true,[-1,1,1]),hull(true,[1,1,1],[NaN,0,0]),{...hull(),shape:'mesh'}])assert.throws(()=>add(w,'box',{collider}));
  assert.throws(()=>add(w,'field',{collider:hull()}),/不支持/);assert.equal(w.revision,0);assert.equal(activeExperiment(w).components.length,0);
});
