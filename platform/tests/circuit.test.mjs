import test from 'node:test';
import assert from 'node:assert/strict';
import {blankExperiment,component,uid} from '../shared/catalog.js';
import {Circuit} from '../shared/circuit.js';
import {Simulation,DT} from '../shared/physics.js';
import {validateExperiment} from '../shared/workspace.js';
function circuit(...components){const d=blankExperiment();d.components=components;return d;}
function wire(d,a,ap,b,bp){d.connections.push({id:uid(),kind:'wire',source:a.id,sourcePort:ap,target:b.id,targetPort:bp,gain:1});}
function series(...parts){const d=circuit(...parts);for(let i=0;i<parts.length;i++)wire(d,parts[i],'b',parts[(i+1)%parts.length],'a');return d;}
test('battery and resistor satisfy Ohm law including source resistance',()=>{const source=component('battery'),r=component('resistor'),d=series(source,r),solver=new Circuit(d);assert.ok(Math.abs(solver.readings[r.id].current+12/100.1)<1e-9);assert.ok(Math.abs(solver.readings[source.id].voltage-12*100/100.1)<1e-9);});
test('series network has equal branch currents and voltage drops add up',()=>{const v=component('battery'),a=component('resistor'),b=component('resistor');b.params.resistance=200;const solver=new Circuit(series(v,a,b));const i=12/300.1;assert.ok(Math.abs(solver.readings[a.id].current+i)<1e-9);assert.ok(Math.abs(solver.readings[b.id].current+i)<1e-9);assert.ok(Math.abs(solver.readings[v.id].voltage+solver.readings[a.id].voltage+solver.readings[b.id].voltage)<1e-9);});
test('parallel network splits current and obeys Kirchhoff current law',()=>{const v=component('battery'),a=component('resistor'),b=component('resistor'),g=component('ground'),d=circuit(v,a,b,g);b.params.resistance=200;for(const r of[a,b]){wire(d,v,'a',r,'a');wire(d,v,'b',r,'b');}wire(d,v,'b',g,'a');const s=new Circuit(d);assert.ok(Math.abs(s.readings[a.id].current/s.readings[b.id].current-2)<1e-10);assert.ok(Math.abs(s.readings[a.id].current+s.readings[b.id].current+s.readings[v.id].current)<1e-10);assert.equal(s.warnings.length,0);});
test('open switch stops current while a closed switch conducts',()=>{const v=component('battery'),r=component('resistor'),sw=component('switch'),d=series(v,r,sw);sw.params.closed=0;let solver=new Circuit(d);assert.ok(Math.abs(solver.readings[r.id].current)<1e-9);sw.params.closed=1;solver=new Circuit(d);assert.ok(Math.abs(solver.readings[r.id].current)>.11);});
test('RC charging follows the analytic time constant within integration error',()=>{const v=component('battery'),r=component('resistor'),c=component('capacitor');v.params.voltage=1;r.params.resistance=10;c.params.capacitance=10000;const d=circuit(v,r,c);wire(d,v,'a',r,'a');wire(d,r,'b',c,'a');wire(d,c,'b',v,'b');const sim=new Simulation(d);sim.advance(.1);const expected=1-Math.exp(-sim.time/((10+.1)*.01));assert.ok(Math.abs(sim.circuit.readings[c.id].voltage-expected)<.005);});
test('RL current follows its analytic step response',()=>{const v=component('battery'),r=component('resistor'),l=component('inductor');v.params.voltage=1;r.params.resistance=10;l.params.inductance=1000;const sim=new Simulation(series(v,r,l));sim.advance(.1);const expected=1/10.1*(1-Math.exp(-10.1*sim.time));assert.ok(Math.abs(Math.abs(sim.circuit.readings[l.id].current)-expected)<.001);});
test('initially charged capacitor discharges into resistor',()=>{const c=component('capacitor'),r=component('resistor');c.params.capacitance=10000;c.params.initialVoltage=5;const sim=new Simulation(series(c,r));sim.advance(1);assert.ok(Math.abs(sim.circuit.readings[c.id].voltage-5/Math.E)<.003);});
test('unconnected instruments remain finite and shorted battery is limited by internal resistance',()=>{const v=component('battery'),r=component('resistor'),c=component('capacitor'),d=circuit(v,r,c);c.params.initialVoltage=3;let s=new Circuit(d);assert.equal(s.error,null);assert.ok(Math.abs(s.readings[v.id].voltage-12)<1e-10);assert.ok(Math.abs(s.readings[v.id].current)<1e-10);wire(d,v,'a',v,'b');s=new Circuit(d);assert.equal(s.readings[v.id].current,-120);});
test('invalid circuit terminals are rejected before solving',()=>{const v=component('battery'),g=component('ground'),d=circuit(v,g);wire(d,v,'a',g,'b');assert.throws(()=>validateExperiment(d),/端子/);});
test('voltmeter and ammeter produce correct loaded circuit readings',()=>{const v=component('battery'),r=component('resistor'),a=component('ammeter'),m=component('voltmeter'),d=series(v,r,a);d.components.push(m);wire(d,r,'a',m,'a');wire(d,r,'b',m,'b');const s=new Circuit(d);assert.ok(Math.abs(s.readings[m.id].voltage-s.readings[r.id].voltage)<1e-10);assert.ok(Math.abs(s.readings[a.id].current-s.readings[r.id].current)<2e-6);});
test('circuit branch current can drive a mechanical coil',()=>{const v=component('battery'),r=component('resistor'),coil=component('coil'),field=component('field'),d=series(v,r);d.components.push(coil,field);d.connections.push({id:uid(),kind:'electrical',source:v.id,target:coil.id,gain:1});const sim=new Simulation(d);sim.advance(.1);assert.ok(sim.bodies.get(coil.id).x>0);});

test('opening an operating switch retains the simulation time and capacitor charge',()=>{
  const source=component('battery'),sw=component('switch'),r=component('resistor'),cap=component('capacitor');
  const d=series(source,sw,r,cap),sim=new Simulation(d);
  sim.advance(.06);
  const t=sim.circuit.time,chargeState={...sim.circuit.history.get(cap.id)};
  assert.ok(Math.abs(chargeState.voltage)>1);
  const changed=structuredClone(d.components);
  changed.find(c=>c.id===sw.id).params.closed=0;
  assert.equal(sim.circuit.updateSwitches(changed),true);
  assert.equal(sim.circuit.time,t);
  assert.deepEqual(sim.circuit.history.get(cap.id),chargeState);
  assert.equal(d.components.find(c=>c.id===sw.id).params.closed,1);
  assert.ok(Math.abs(sim.circuit.readings[r.id].current)<1e-8);
  sim.advance(.02);
  assert.ok(Math.abs(sim.circuit.readings[cap.id].voltage-chargeState.voltage)<1e-6);
  assert.equal(sim.circuit.updateSwitches(d.components),true);
  assert.ok(Math.abs(sim.circuit.readings[r.id].current)>.01);
});
