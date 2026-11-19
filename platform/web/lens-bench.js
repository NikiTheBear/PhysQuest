import { solve, traceRays } from '../shared/physquest-lens.js';
// A schematic optical bench: internal distances use cm, its outer placement uses world m.
export function benchGraphics(p) {
  const m=solve({...p,maskTop:!!p.maskTop}),s=.1,left=-p.u*s,right=Math.min(100,Math.max(p.screenX+5,p.f*3,m.real?Math.min(m.v*1.2,100):0))*s;
  const lines=[],texts=[],line=(points,color='#8098a8',dashed=false)=>lines.push({points:points.map(([x,y])=>[x,y,0]),color,dashed});
  line([[left-.4,0],[right,0]],'#9eafbb',true);
  for(const ray of traceRays({...p,maskTop:!!p.maskTop})){
    const pts=ray.points.map(a=>[a.x*s,a.y*s]);
    for(let i=1;i<pts.length;i++)if(pts[i][0]>right){const t=(right-pts[i-1][0])/(pts[i][0]-pts[i-1][0]);pts[i]=[right,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t];}
    line(pts,['#bb9047','#4d94a0','#b17a99'][ray.kind-1],ray.dashed);
  }
  line(Array.from({length:41},(_,i)=>[Math.sin(i/40*Math.PI*2)*.08,Math.cos(i/40*Math.PI*2)*p.lensDiameter*s/2]),'#649bb3');
  if(p.maskTop)line([[0,0],[0,p.lensDiameter*s/2]],'#344e61');
  const arrow=(x,h,color)=>{line([[x,0],[x,h],[x-.08,h-Math.sign(h)*.12],[x,h],[x+.08,h-Math.sign(h)*.12]],color);};
  arrow(left,p.h*s,'#b7854b');
  if(p.objectShape===1)line([[left,p.h*s],[left+.2,p.h*s],[left,p.h*s],[left,p.h*s*.55],[left+.15,p.h*s*.55]],'#b7854b');
  if(p.objectShape===2)line([[left-.06,0],[left-.06,p.h*s*.8],[left+.06,p.h*s*.8],[left+.06,0]],'#b7854b');
  line([[p.screenX*s,-.85],[p.screenX*s,.85]],'#7e9b89');
  if(!m.isParallel&&Math.abs(m.v*s)<12&&Math.abs(m.imageY*s)<5)arrow(m.v*s,m.imageY*s,m.real?'#518a74':'#8e81b2');
  for(const [x,label] of [[-p.f*s,'F'],[p.f*s,"F′"]]){line([[x,-.04],[x,.04]],'#8b9aa7');texts.push({x,y:-.18,text:label});}
  texts.push({x:left,y:-.48,text:'物体 '+p.u+' cm'},{x:0,y:1,text:'透镜 f='+p.f+' cm'},{x:p.screenX*s,y:-1.1,text:'光屏 '+p.screenX+' cm'});
  return {lines,texts,description:m.description,metrics:m,left,right};
}
export function drawBench2(ctx,p,scale){
  const g=benchGraphics(p);ctx.save();
  for(const l of g.lines){ctx.strokeStyle=l.color;ctx.lineWidth=l.color==='#344e61'?5:1.7;ctx.setLineDash(l.dashed?[4,4]:[]);ctx.beginPath();l.points.forEach(([x,y],i)=>i?ctx.lineTo(x*scale,-y*scale):ctx.moveTo(x*scale,-y*scale));ctx.stroke();}
  ctx.setLineDash([]);ctx.fillStyle='#617687';ctx.font='12px system-ui';ctx.textAlign='center';for(const t of g.texts)ctx.fillText(t.text,t.x*scale,-t.y*scale);
  ctx.font='13px system-ui';ctx.fillStyle='#397794';ctx.fillText(g.description,0,-1.55*scale);ctx.font='11px system-ui';ctx.fillStyle='#7f909c';ctx.fillText('光具座示意 · 内部参数 cm',0,1.5*scale);ctx.restore();
}
