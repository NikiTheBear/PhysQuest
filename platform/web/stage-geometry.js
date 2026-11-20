import {LatheGeometry, Vector2} from 'three';

// Rotate the meridian about the optical (X) axis. Both faces share an edge ring.
export function lensGeometry(radius, diverging=false){
  const profile=[];
  for(const side of [-1,1]){
    for(let i=0;i<=24;i++){
      const t=side<0?i/24:1-i/24;
      const depth=radius*(.045+.2*(diverging?t*t:1-t*t));
      profile.push(new Vector2(t*radius,side*depth));
    }
  }
  return new LatheGeometry(profile,64).rotateZ(-Math.PI/2);
}

// Short terminal leads keep bends outside each component. A separate lane
// carries return wires when the two terminals face away from one another.
export function wirePath(a,b,sourcePort,targetPort,vertical){
  const start=[...a],end=[...b];
  const left=sourcePort==='a'?-1:1,right=targetPort==='a'?-1:1;
  start[0]+=.27*left;
  end[0]+=.27*right;
  const facing=(end[0]-start[0])*left>=0&&left===-right;
  if(facing){
    const x=(start[0]+end[0])/2;
    return [a,start,[x,...start.slice(1)],[x,...end.slice(1)],end,b];
  }
  const lane=Math.abs(start[vertical]-end[vertical])>.8
    ?(start[vertical]+end[vertical])/2:Math.min(start[vertical],end[vertical])-.65;
  const u=[...start],v=[...end];
  u[vertical]=v[vertical]=lane;
  return [a,start,u,v,end,b];
}
