import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {challengeScene} from '../shared/challenge-scene.js';
import {Simulation} from '../shared/physics.js';
import {blankExperiment,component} from '../shared/catalog.js';
import {lensGeometry,wirePath} from '../web/stage-geometry.js';

const folder=new URL('../experiments/',import.meta.url);
async function challenge(id){
  return challengeScene(JSON.parse(await readFile(new URL(id+'.pqexp.json',folder),'utf8')),id);
}

test('each shipped challenge opens in the solver',async()=>{
  for(const file of (await readdir(folder)).filter(n=>n.endsWith('.pqexp.json'))){
    const doc=await challenge(file.split('.')[0]),sim=new Simulation(doc);
    sim.step();
    assert.ok(!sim.circuit.error,doc.title);
    assert.ok(doc.components.length,doc.title);
    assert.ok(doc.observation,doc.title);
  }
});

test('series and parallel challenges have the expected measured branches',async()=>{
  for(const [id,parallel] of [['CH-AUTO-035',false],['CH-AUTO-036',true]]){
    const doc=await challenge(id),sim=new Simulation(doc);
    const resistors=doc.components.filter(c=>c.kind==='resistor'),reading=c=>sim.circuit.readings[c.id];
    const battery=doc.components.find(c=>c.kind==='battery');
    assert.equal(resistors.length,2);assert.equal(doc.plane2d,'xz');
    const [a,b]=resistors.map(reading);
    if(parallel){
      assert.ok(Math.abs(a.voltage-b.voltage)<1e-8);
      assert.ok(Math.abs(a.current+b.current+reading(battery).current)<1e-8);
    }else{
      assert.ok(Math.abs(a.current-b.current)<2e-6);
      assert.ok(Math.abs(a.voltage+b.voltage-reading(battery).voltage)<1e-8);
    }
  }
});

test('top-view dynamics keep Z motion and constrain Y',()=>{
  const doc=blankExperiment();
  doc.mode='2d';doc.plane2d='xz';doc.environment.gravity=9.8;
  const box=component('box',{position:[1,2,3]});box.params.vz=2;doc.components.push(box);
  const sim=new Simulation(doc);sim.advance(.5);
  const state=sim.bodies.get(box.id);
  assert.equal(state.position[1],0);
  assert.ok(Math.abs(state.position[2]-4)<.001);
});

test('wire paths meet both terminals and concave lenses have thinner centres',()=>{
  const a=[-1,0,2],b=[3,0,0];
  const path=wirePath(a,b,'a','b',2);
  assert.deepEqual(path[0],a);assert.deepEqual(path.at(-1),b);
  assert.ok(path.every(p=>p[1]===0));
  for(const concave of [false,true]){
    const mesh=lensGeometry(1,concave),positions=mesh.getAttribute('position');
    let centre=0,rim=0;
    for(let i=0;i<positions.count;i++){
      const radius=Math.hypot(positions.getY(i),positions.getZ(i)),x=Math.abs(positions.getX(i));
      if(radius<.001)centre=Math.max(centre,x);
      if(radius>.999)rim=Math.max(rim,x);
    }
    assert.ok(concave?centre<rim:centre>rim);
    mesh.dispose();
  }
});
