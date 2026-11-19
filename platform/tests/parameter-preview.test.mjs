import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorkspace,activeExperiment} from '../shared/catalog.js';
import {mutate} from '../shared/workspace.js';
import {Simulation} from '../shared/physics.js';
import {parameterPreview} from '../web/parameter-preview.js';

test('lens slider previews recompute the image before any saved command',()=>{
  const workspace=mutate(blankWorkspace(),'add_component',{kind:'lens_bench',params:{u:30,f:10}}).workspace;
  const initial=structuredClone(workspace),doc=activeExperiment(workspace),id=doc.components[0].id;
  const sim=new Simulation(doc);
  assert.equal(sim.readings.channels[id+':v'].value,15);
  for(const [u,v] of [[20,20],[15,30],[5,-10]]){
    sim.reset(parameterPreview(doc,{componentId:id,key:'u',value:u}));
    assert.ok(Math.abs(sim.readings.channels[id+':v'].value-v)<1e-10);
    assert.deepEqual(workspace,initial);
  }
  const saved=mutate(workspace,'update_component',{componentId:id,params:{u:5}}).workspace;
  assert.equal(saved.revision,initial.revision+1);
  assert.equal(activeExperiment(saved).components[0].params.u,5);
});

test('gravity preview changes motion while the saved environment stays unchanged',()=>{
  const workspace=mutate(blankWorkspace(),'add_component',{kind:'body',position:[0,10,0]}).workspace;
  const doc=activeExperiment(workspace),before=structuredClone(doc),id=doc.components[0].id;
  const preview=parameterPreview(doc,{environment:true,key:'gravity',value:10});
  const sim=new Simulation(preview);sim.advance(.5);
  assert.ok(Math.abs(sim.bodies.get(id).velocity[1]+5)<.01);
  assert.deepEqual(doc,before);
});

test('invalid slider combinations cannot mutate the saved apparatus',()=>{
  const workspace=mutate(blankWorkspace(),'add_component',{kind:'aperture',params:{radius:1,opening:.5}}).workspace;
  const doc=activeExperiment(workspace),before=structuredClone(doc);
  assert.throws(()=>parameterPreview(doc,{componentId:doc.components[0].id,key:'radius',value:.2}),/孔径/);
  assert.deepEqual(doc,before);
});
