import { Simulation } from '../../platform/shared/physics.js';

const env = { gravity:0, damping:0, speed:1, collisions:false, temperature:20 };
const doc = (components) => ({ mode:'2d', plane2d:'xy', environment:{...env}, components, connections:[], control:{running:false,reset:0} });

const src = (id,name,x,y,params={}) => ({id,kind:'heat_source',name,position:[x,y,0],params:{temperature:100,power:0,radius:.5,...params},refs:{},fixed:true});
const meter = (id,name,x,y,params={}) => ({id,kind:'thermometer',name,position:[x,y,0],params:{responseTime:2,...params},refs:{},fixed:true});
const rod = (id,name,x,y,params={},refs={}) => ({id,kind:'conductor',name,position:[x,y,0],params:{conductivity:200,length:1,area:.01,heatCapacity:100,...params},refs,fixed:true});

function run(doc, times=[.5,1,2,5,10,30]) {
  const sim = new Simulation(doc);
  let t=0;
  const out=[];
  for (const T of times){ sim.advance(T-t); t=T; out.push([T, Object.fromEntries(Object.entries(sim.readings.channels||{}).map(([k,v])=>[k, +v.value.toFixed(2)]))]); }
  return out;
}
function show(doc, label){ console.log('=== '+label); for(const [t,ch] of run(doc)) console.log('t='+t, JSON.stringify(ch)); }

// (a) T1-01
show(doc([
  src('s-hot','热源 100 ℃',2,2,{temperature:100}),
  meter('m-hot','温度计',2.2,2),
  src('s-mid','热源 50 ℃',0,2,{temperature:50}),
  meter('m-mid','温度计',0.2,2),
  src('s-cold','热源 0 ℃',-2,2,{temperature:0}),
  meter('m-cold','温度计',-2.2,2),
  meter('m-room','室温温度计',6,2),
]), 'T1-01 three sources');

// (c) T1-03 rod between sources
show(doc([
  src('s1','热源 100 ℃',-1.5,2,{temperature:100}),
  src('s2','热源 0 ℃',1.5,2,{temperature:0}),
  rod('rod1','导热棒',0,2,{}, {a:'s1',b:'s2'}),
  rod('rod2','只接一端的导热棒',0,1,{}, {a:'s1'}),
]), 'T1-03 rods');
