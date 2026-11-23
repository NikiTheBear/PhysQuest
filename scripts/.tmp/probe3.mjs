import { Simulation } from '../../platform/shared/physics.js';
const env = { gravity:0, damping:0, speed:1, collisions:false, temperature:20 };
const doc = (components) => ({ mode:'2d', environment:{...env}, components, connections:[], control:{running:false,reset:0} });
const src = (id,name,x,y,params={}) => ({id,kind:'heat_source',name,position:[x,y,0],params:{temperature:100,power:0,radius:.6,...params},refs:{},fixed:true});
const meter = (id,name,x,y,params={}) => ({id,kind:'thermometer',name,position:[x,y,0],params:{responseTime:1,...params},refs:{},fixed:true});
const rod = (id,name,x,y,params={},refs={}) => ({id,kind:'conductor',name,position:[x,y,0],params:{conductivity:200,length:1,area:.01,heatCapacity:100,...params},refs,fixed:true});

const pick = (sim, keys) => Object.fromEntries(keys.map(k=>[k, +(sim.readings.channels[k]?.value ?? NaN).toFixed(2)]));
function run(label, d, times, keys) {
  const sim=new Simulation(d); let t=0;
  console.log('=== '+label);
  for(const T of times){sim.advance(T-t);t=T;console.log('  t='+String(T).padStart(4), JSON.stringify(pick(sim,keys)));}
}

// Exp4 保温
run('T1-04 walls', doc([
  src('hot1','杯中热水 90 ℃',-3,4,{temperature:90,radius:.5}),
  rod('wall-cu','铜壁',-2,4,{conductivity:400,area:.01,length:.1,heatCapacity:100},{a:'hot1',b:'m-cu'}),
  meter('m-cu','壁外温度计（铜）',-1,4),
  src('hot2','杯中热水 90 ℃',-3,2,{temperature:90,radius:.5}),
  rod('wall-in','保温壁',-2,2,{conductivity:.04,area:.01,length:.2,heatCapacity:100},{a:'hot2',b:'m-in'}),
  meter('m-in','壁外温度计（保温）',-1,2),
]), [1,2,5,10,30,60], ['wall-cu','wall-cu:heatFlow','m-cu','m-cu:target','wall-in','wall-in:heatFlow','m-in','m-in:target']);

// Exp5 T2-01 mass
run('T2-01 mass', doc([
  src('s1','热源 80 ℃',-3,4,{temperature:80,radius:.5}),
  rod('small','小样品',-2,4,{heatCapacity:100},{a:'s1',b:'m-small'}),
  meter('m-small','小样品温度计',-1,4),
  src('s2','热源 80 ℃',-3,2,{temperature:80,radius:.5}),
  rod('big','大样品',-2,2,{heatCapacity:1000},{a:'s2',b:'m-big'}),
  meter('m-big','大样品温度计',-1,2),
]), [1,2,5,10,20,40], ['small','m-small','m-small:target','big','m-big','m-big:target']);

// Exp6 T2-03 specific heat
run('T2-03 c', doc([
  src('s1','热源 90 ℃',-3,4,{temperature:90,radius:.5}),
  rod('copper','铜样品',-2,4,{heatCapacity:390},{a:'s1',b:'m-cu'}),
  meter('m-cu','铜样品温度计',-1,4),
  src('s2','热源 90 ℃',-3,2,{temperature:90,radius:.5}),
  rod('water','水样品',-2,2,{heatCapacity:4200},{a:'s2',b:'m-wa'}),
  meter('m-wa','水样品温度计',-1,2),
]), [1,2,5,10,20,40], ['copper','m-cu','m-cu:target','water','m-wa','m-wa:target']);
