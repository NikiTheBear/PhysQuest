import test from 'node:test';
import assert from 'node:assert/strict';
import {blankExperiment,component} from '../shared/catalog.js';
import {tuningSliders,trackPosition,physicalValue} from '../web/tuning.js';

test('parallel branches expose independent sliders in existing experiments',()=>{
  const d=blankExperiment();
  d.components=['battery','resistor','ammeter','resistor'].map(kind=>component(kind));
  const bindings=tuningSliders(d,'common');
  assert.deepEqual(bindings.map(s=>s.parameter),['voltage','resistance','resistance']);
  assert.deepEqual(bindings.map(s=>s.componentId),[0,1,3].map(i=>d.components[i].id));
  const saved={componentId:d.components[1].id,parameter:'resistance',min:10,max:150,step:1,label:'支路一'};
  d.sliders=[saved];
  assert.deepEqual(tuningSliders(d,'common'),[saved]);
  assert.ok(tuningSliders(d,'component:'+d.components[0].id).some(s=>s.parameter==='resistance'));
});

test('empty spaces and expression-only instruments still expose environment sliders',()=>{
  const d=blankExperiment();d.components=[component('expression_force')];
  assert.deepEqual(tuningSliders(d,'common').map(s=>s.parameter),['gravity','damping','speed']);
  assert.equal(tuningSliders(d,'component:'+d.components[0].id).length,0);
});

test('resistance uses an accessible lower range and snaps to physical increments',()=>{
  const s={min:.01,max:1e7,step:.01};
  assert.equal(physicalValue(s,0),s.min);assert.equal(physicalValue(s,1000),s.max);
  const position=trackPosition(s,100);
  assert.ok(position>400&&position<500);
  const value=physicalValue(s,position);
  assert.ok(Math.abs(value-100)<1);
  assert.equal(Number(value.toFixed(2)),value);
  assert.equal(physicalValue({min:-10,max:10,step:.1},-.3),-.3);
});

test('choice controls respect saved MCP limits and use physical option labels',async()=>{
  const {choiceSpec,allowedChoices}=await import('../web/choice-controls.js');
  assert.equal(choiceSpec('closed').type,'switch');
  assert.equal(choiceSpec('maskTop').type,'switch');
  assert.deepEqual(allowedChoices('axis',{min:0,max:2,step:2}),[{label:'X',value:0},{label:'Z',value:2}]);
  assert.deepEqual(allowedChoices('objectShape',{min:1,max:2,step:1}).map(c=>c.label),['字母 F','蜡烛']);
  assert.deepEqual(allowedChoices('directivity',{min:2,max:8,step:3}).map(c=>c.value),[2,5,8]);
  assert.equal(choiceSpec('resistance'),null);
});
