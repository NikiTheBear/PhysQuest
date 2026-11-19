import {LENS_KINDS} from './catalog.js';

// Air on both sides, ray vector [height, slope]. Lengths are in metres.
// The first lens normal defines positive propagation; sort by axial position.
export function lensTrain(components){
  const lenses=components.filter(c=>LENS_KINDS.includes(c.kind));
  if(lenses.length<2)return null;
  const origin=lenses[0].position,angle=lenses[0].params.angle*Math.PI/180;
  const nx=Math.cos(angle),ny=Math.sin(angle),planes=[];
  for(const lens of lenses){
    const [x,y,z]=lens.position.map((v,i)=>v-origin[i]);
    if(Math.abs(z)>1e-7||Math.abs(y*nx-x*ny)>1e-7||Math.abs(Math.sin(lens.params.angle*Math.PI/180-angle))>1e-7)return null;
    planes.push({s:x*nx+y*ny,f:lens.params.focal,id:lens.id});
  }
  planes.sort((a,b)=>a.s-b.s);
  let A=1,B=0,C=0,D=1,previous=planes[0].s;
  for(const [i,plane] of planes.entries()){
    const gap=plane.s-previous;
    if(i&&gap<=1e-7)return null;
    A+=gap*C;B+=gap*D; // translation to this lens
    C-=A/plane.f;D-=B/plane.f; // refraction at its principal plane
    previous=plane.s;
  }
  const afocal=Math.abs(C)<1e-10;
  return {lensIds:planes.map(p=>p.id),matrix:[A,B,C,D],afocal,
    effectiveFocal:afocal?null:-1/C,backFocal:afocal?null:-A/C};
}
