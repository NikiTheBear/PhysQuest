// Normalize the compact teaching files only when opening a built-in challenge.
import {CATALOG,CIRCUIT_KINDS,RIGID_KINDS,LINK_KINDS,component} from './catalog.js';
import {validateExperiment} from './workspace.js';

export function challengeScene(file,id){
  const d=structuredClone(file.experiment);
  d.control={running:false,reset:0};
  d.source={...d.source,challengeId:id};
  d.observation ||= d.learning?.steps?.join('；') || d.goal;
  d.components=d.components.map(c=>component(c.kind,{...c,name:c.name===c.kind?CATALOG[c.kind].name:c.name,params:{...component(c.kind).params,...c.params}}));
  const rigid=d.components.find(c=>RIGID_KINDS.includes(c.kind));
  const anchor=d.components.find(c=>c.kind==='anchor');
  for(const c of d.components){
    if(rigid&&CATALOG[c.kind].refs?.includes('target'))c.refs.target ||= rigid.id;
    if(rigid&&anchor&&LINK_KINDS.includes(c.kind)){c.refs.a ||= anchor.id;c.refs.b ||= rigid.id;}
  }
  if(d.components.length&&d.components.every(c=>CIRCUIT_KINDS.includes(c.kind))){
    d.plane2d='xz';
    if(!d.connections.length)wireCircuit(d);
  }else if(d.components.some(c=>['speaker','directional_speaker'].includes(c.kind))){
    d.plane2d='xz';
    d.components.forEach(c=>{c.position=[c.position[0],0,c.position[1]-1];});
  }
  return validateExperiment(d);
}

function wireCircuit(d){
  const source=d.components.find(c=>['battery','ac_source'].includes(c.kind))||d.components[0];
  const meter=d.components.find(c=>c.kind==='voltmeter');
  const chain=d.components.filter(c=>c!==source&&c!==meter&&c.kind!=='ground');
  if(!chain.length)return;
  const load=chain.find(c=>['resistor','lamp','rheostat'].includes(c.kind))||chain[0];
  if(load.kind==='resistor'&&/并联|串联/.test(d.title)&&chain.filter(c=>c.kind==='resistor').length===1){
    const second=component('resistor',{name:'电阻 R₂'});d.components.push(second);
    if(d.title.includes('串联'))chain.splice(chain.indexOf(load)+1,0,second);
    else{second.position=[0,0,0];wire(load,'a',second,'a');wire(load,'b',second,'b');}
  }
  function wire(a,ap,b,bp){
    d.connections.push({id:crypto.randomUUID(),kind:'wire',source:a.id,sourcePort:ap,target:b.id,targetPort:bp,gain:1});
  }
  source.position=[0,0,-1.3];
  chain.forEach((c,i)=>{c.position=[(i-(chain.length-1)/2)*2.1,0,1.2];});
  let prev=source,port='a';
  for(const c of chain){wire(prev,port,c,'a');prev=c;port='b';}
  wire(prev,port,source,'b');
  if(meter){
    const measured=chain.find(c=>c.kind==='capacitor')||load;
    meter.position=[measured.position[0],0,2.7];
    wire(measured,'a',meter,'a');wire(measured,'b',meter,'b');
  }
  if(source.kind==='capacitor')source.params.initialVoltage ||= 3;
}
