import { CATALOG, CIRCUIT_KINDS } from './catalog.js';

function factorLinear(A){
  const n=A.length,LU=A.map(row=>[...row]),permutation=Array.from({length:n},(_,i)=>i);
  for(let col=0;col<n;col++){let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(LU[row][col])>Math.abs(LU[pivot][col]))pivot=row;if(Math.abs(LU[pivot][col])<1e-20)throw new Error('电路节点矩阵奇异，请检查连接和参数');[LU[col],LU[pivot]]=[LU[pivot],LU[col]];[permutation[col],permutation[pivot]]=[permutation[pivot],permutation[col]];for(let row=col+1;row<n;row++){LU[row][col]/=LU[col][col];for(let j=col+1;j<n;j++)LU[row][j]-=LU[row][col]*LU[col][j];}}
  return {LU,permutation};
}
function solveFactored({LU,permutation},b){const n=b.length,x=permutation.map(i=>b[i]);for(let i=0;i<n;i++)for(let j=0;j<i;j++)x[i]-=LU[i][j]*x[j];for(let i=n-1;i>=0;i--){for(let j=i+1;j<n;j++)x[i]-=LU[i][j]*x[j];x[i]/=LU[i][i];if(!Number.isFinite(x[i]))throw new Error('电路求解未收敛');}return x;}
export class Circuit {
  constructor(doc){
    this.components=doc.components.filter(c=>CIRCUIT_KINDS.includes(c.kind));this.dynamic=this.components.some(c=>['capacitor','inductor','ac_source'].includes(c.kind));this.time=0;this.cache=null;this.history=new Map();this.readings={};this.nodeVoltages={};this.warnings=[];
    const parent=new Map(),key=(id,port)=>id+':'+port;
    const root=k=>{let p=parent.get(k);if(p===k)return k;p=root(p);parent.set(k,p);return p;};
    const join=(a,b)=>parent.set(root(a),root(b));
    for(const c of this.components)for(const port of CATALOG[c.kind].terminals)parent.set(key(c.id,port),key(c.id,port));
    for(const l of doc.connections.filter(l=>l.kind==='wire'))join(key(l.source,l.sourcePort),key(l.target,l.targetPort));
    const grounds=this.components.filter(c=>c.kind==='ground');for(let i=1;i<grounds.length;i++)join(key(grounds[0].id,'a'),key(grounds[i].id,'a'));
    this.ports=new Map([...parent.keys()].map(k=>[k,root(k)]));
    const nodes=[...new Set(this.ports.values())],adj=new Map(nodes.map(n=>[n,new Set()]));
    for(const c of this.components.filter(c=>c.kind!=='ground')){const a=this.ports.get(key(c.id,'a')),b=this.ports.get(key(c.id,'b'));adj.get(a).add(b);adj.get(b).add(a);this.history.set(c.id,{voltage:c.params.initialVoltage||0,current:c.params.initialCurrent||0});}
    const grounded=new Set(grounds.map(c=>this.ports.get(key(c.id,'a')))),seen=new Set(),refs=new Set();let floating=0;
    for(const node of nodes){if(seen.has(node))continue;const cluster=[],stack=[node];while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);cluster.push(n);for(const other of adj.get(n))stack.push(other);}const g=cluster.find(n=>grounded.has(n));refs.add(g||cluster[0]);if(!g)floating++;}
    if(floating)this.warnings.push(`${floating} 个网络未放置参考地，已自动选择参考节点；电压差与支路电流仍可求解。`);
    this.indices=new Map(nodes.filter(n=>!refs.has(n)).map((n,i)=>[n,i]));this.refs=refs;this.step(1e-8,false);
  }
  step(dt,commit=true){
    if(!this.components.length||(!this.dynamic&&this.cache))return;
    const time=this.time+(commit?dt:0);const n=this.indices.size,A=Array.from({length:n},()=>Array(n).fill(0)),z=Array(n).fill(0),branches=[];
    const stamp=(a,b,g,j)=>{const i=this.indices.get(a),k=this.indices.get(b);if(i!==undefined){A[i][i]+=g;z[i]-=j;}if(k!==undefined){A[k][k]+=g;z[k]+=j;}if(i!==undefined&&k!==undefined){A[i][k]-=g;A[k][i]-=g;}};
    for(const c of this.components){if(c.kind==='ground')continue;const p=c.params,h=this.history.get(c.id),a=this.ports.get(c.id+':a'),b=this.ports.get(c.id+':b');let g=0,j=0;
      if(['resistor','lamp'].includes(c.kind))g=1/p.resistance;
      if(c.kind==='battery'){g=1/p.resistance;j=-p.voltage*g;}
      if(c.kind==='rheostat')g=1/(p.resistance*p.ratio);
      if(c.kind==='current_source'){g=1/p.resistance;j=-p.current;}
      if(c.kind==='ac_source'){g=1/p.resistance;j=-(p.offset+p.amplitude*Math.sin(2*Math.PI*p.frequency*time+p.phase*Math.PI/180))*g;}
      if(c.kind==='capacitor'){g=p.capacitance*1e-6/dt;j=-g*h.voltage;}
      if(c.kind==='inductor'){g=dt/(p.inductance*1e-3);j=h.current;}
      if(c.kind==='switch')g=p.closed?1/.001:1e-12;
      if(c.kind==='voltmeter')g=1e-7;
      if(c.kind==='ammeter')g=1000;
      stamp(a,b,g,j);branches.push({c,a,b,g,j});
    }
    try{
      if(this.cache?.dt!==dt)this.cache={dt,factor:factorLinear(A)};
      const x=solveFactored(this.cache.factor,z),voltage=node=>this.indices.has(node)?x[this.indices.get(node)]:0;
      this.nodeVoltages=Object.fromEntries([...this.ports].map(([port,node])=>[port,voltage(node)]));
      for(const {c,a,b,g,j} of branches){const v=voltage(a)-voltage(b),current=g*v+j;this.readings[c.id]={voltage:v,current,power:v*current};if(commit)this.history.set(c.id,{voltage:v,current});}
      if(commit)this.time=time;this.error=null;
    }catch(e){this.error=e.message;this.readings={};}
  }
}
