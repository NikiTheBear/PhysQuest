import {Simulation,DT} from './physics.js';

export function validateChart(chart){
  if(!chart || typeof chart.title!=='string'||chart.title.length>100||typeof chart.id!=='string'||chart.id.length>100)throw new Error('图表标题或 ID 无效');
  if(!Array.isArray(chart.times)||chart.times.length<2||chart.times.length>241||chart.times.some((t,i)=>!Number.isFinite(t)||t<0||t>20.001||(i&&t<=chart.times[i-1])))throw new Error('图表时间轴无效');
  if(!Array.isArray(chart.lines)||!chart.lines.length||chart.lines.length>4)throw new Error('请选择 1–4 条曲线');
  for(const line of chart.lines){
    if(typeof line.label!=='string'||line.label.length>160||typeof line.unit!=='string'||line.unit.length>40||line.unit!==chart.lines[0].unit||!Array.isArray(line.values)||line.values.length!==chart.times.length||line.values.some(v=>v!==null&&!Number.isFinite(v)))throw new Error('曲线数据无效，请选择相同单位的通道');
  }
}
export function sampleChart(doc,{channels,title='仿真曲线',duration=5}){
  if(!Number.isFinite(duration)||duration<.02||duration>20)throw new Error('绘图时长范围为 0.02–20 秒');
  if(!Array.isArray(channels)||!channels.length||channels.length>4||new Set(channels).size!==channels.length)throw new Error('请选择 1–4 个不同的测量通道');
  const sim=new Simulation(doc);
  const reading=id=>id==='energy'?{label:'机械能',unit:'J',value:sim.readings.energy}:Object.hasOwn(sim.readings.channels,id)?sim.readings.channels[id]:null;
  const lines=channels.map(id=>{
    const r=reading(id);if(!r?.unit)throw new Error('未知通道，请从 simulate_experiment 的 readings.channels 选择 ID，或使用 energy');
    return {label:r.label,unit:r.unit,values:[]};
  });
  const steps=Math.round(duration/DT),stride=Math.ceil(steps/240),times=[];
  for(let i=0;i<=steps;i++){
    if(i)sim.step();
    if(i%stride && i!==steps)continue;
    sim.measure();times.push(sim.time);
    channels.forEach((id,j)=>{const r=reading(id);lines[j].values.push(r?.valid!==false&&Number.isFinite(r?.value)?r.value:null);});
  }
  const chart={id:crypto.randomUUID(),title,times,lines};validateChart(chart);
  if(lines.every(l=>l.values.every(v=>v===null)))throw new Error('所选通道没有有效读数');
  return chart;
}
