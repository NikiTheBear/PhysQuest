import { Simulation } from '../../platform/shared/physics.js';
const env = { gravity:0, damping:0, speed:1, collisions:false, temperature:20 };
const doc = (components) => ({ mode:'2d', plane2d:'xy', environment:{...env}, components, connections:[], control:{running:false,reset:0} });
const src = (id,name,x,y,params={}) => ({id,kind:'heat_source',name,position:[x,y,0],params:{temperature:100,power:0,radius:.5,...params},refs:{},fixed:true});
const meter = (id,name,x,y,params={}) => ({id,kind:'thermometer',name,position:[x,y,0],params:{responseTime:2,...params},refs:{},fixed:true});
const rod = (id,name,x,y,params={},refs={}) => ({id,kind:'conductor',name,position:[x,y,0],params:{conductivity:200,length:1,area:.01,heatCapacity:100,...params},refs,fixed:true});

function trace(d, times) {
  const sim=new Simulation(d); let t=0; const rows=[];
  for(const T of times){sim.advance(T-t);t=T;const ch=sim.readings.channels||{};rows.push([T,Object.fromEntries(Object.entries(ch).filter(([k])=>/^(m|rod|r)/.test(k)||/:(target|heatFlow)$/.test(k)).map(([k,v])=>[k,+v.value.toFixed(2)]))]);}
  return rows;
}
const pr=(label,rows)=>{console.log('=== '+label);for(const [t,ch] of rows)console.log(' '+String(t).padStart(4),JSON.stringify(ch));};

// A: rod between hot source and thermometer — does the thermometer warm up?
for (const C of [100, 400, 1600]) {
  pr('rod C='+C+' hot100@A, meter@B',
   trace(doc([src('s','热源',-1.5,2), rod('r','棒',0,2,{heatCapacity:C},{a:'s',b:'m'}), meter('m','温度计',1.5,2)]),[1,2,5,10,20,40]));
}
// B: same but different conductivity
for (const lam of [20, 200, 1000]) {
  pr('rod λ='+lam,
   trace(doc([src('s','热源',-1.5,2), rod('r','棒',0,2,{conductivity:lam},{a:'s',b:'m'}), meter('m','温度计',1.5,2)]),[1,2,5,10,20,40]));
}
