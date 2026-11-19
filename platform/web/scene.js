import * as THREE from 'three';
import { benchGraphics, drawBench2 } from './lens-bench.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CATALOG, DOMAINS, CIRCUIT_KINDS, LINK_KINDS, SOUND_KINDS, LENS_KINDS } from '../shared/catalog.js';
import { fieldAt } from '../shared/physics.js';
import {colliderOf,colliderRotation,supportsCollider} from '../shared/colliders.js';
const V=a=>new THREE.Vector3(...a);
export class LabScene {
  constructor({onSelect,onMove,onFallback,onDragStart,onPort}) {
    this.container=document.getElementById('scene-container');this.canvas=document.getElementById('scene');this.canvas2=document.getElementById('scene-2d');this.ctx=this.canvas2.getContext('2d');this.labels=document.getElementById('scene-labels');this.onSelect=onSelect;this.onMove=onMove;this.onDragStart=onDragStart;this.onPort=onPort;this.pendingWire=null;this.ports=document.createElement('div');this.ports.className='port-labels';this.container.append(this.ports);this.ports.addEventListener('click',e=>{const b=e.target.closest('[data-port]');if(b){e.stopPropagation();this.onPort(b.dataset.component,b.dataset.port);}});this.objects=new Map();this.selected=null;this.showGrid=true;this.showFields=true;this.showTrails=true;this.scale2=65;this.pan2=[0,0];this.mode='3d';this.doc=null;this.snap=false;this.labels.addEventListener('click',e=>{const label=e.target.closest('[data-id]');if(label)this.onSelect(label.dataset.id);});
    try {
      this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setClearColor(0,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.scene=new THREE.Scene();this.scene.fog=new THREE.FogExp2('#f8fafc',.035);
      this.camera=new THREE.PerspectiveCamera(40,1,.05,150);this.camera.position.set(8,7,11);
      this.controls=new OrbitControls(this.camera,this.canvas);this.controls.target.set(0,1,0);this.controls.enableDamping=true;this.controls.dampingFactor=.08;this.controls.minDistance=2;this.controls.maxDistance=45;this.controls.maxPolarAngle=Math.PI*.85;
      this.scene.add(new THREE.AmbientLight('#c9d9e6',1.5));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(3,10,6);this.scene.add(light);const rim=new THREE.DirectionalLight('#d8a171',2);rim.position.set(-6,4,-3);this.scene.add(rim);
      this.grid=new THREE.GridHelper(100,100,'#9daebd','#c8d3dd');this.grid.material.transparent=true;this.grid.material.opacity=.6;this.scene.add(this.grid);
      const axisPoints=[[-30,0,0],[30,0,0],[0,0,-30],[0,0,30]];this.axes=this.lines(axisPoints,'#9baebb',.5);this.scene.add(this.axes);
      this.root=new THREE.Group();this.dynamic=new THREE.Group();this.colliderRoot=new THREE.Group();this.colliderObjects=new Map();this.scene.add(this.root,this.dynamic,this.colliderRoot);this.raycaster=new THREE.Raycaster();this.raycaster.params.Line.threshold=.1;this.pointer=new THREE.Vector2();
      this.transform=new TransformControls(this.camera,this.canvas);this.transform.setMode('translate');this.transform.setSpace('world');this.transform.setSize(.85);this.transform.minX=this.transform.minY=this.transform.minZ=-30;this.transform.maxX=this.transform.maxY=this.transform.maxZ=30;this.transform.showXY=this.transform.showXZ=this.transform.showYZ=false;this.scene.add(this.transform.getHelper());
      this.transform.addEventListener('dragging-changed',e=>{this.controls.enabled=!e.value;if(e.value)this.onDragStart?.();else if(this.transform.object){const id=this.selected,position=this.transform.object.position.toArray().map(v=>Math.round(v*100)/100);this.previewMove={id,position};Promise.resolve(this.onMove(id,position)).finally(()=>{this.previewMove=null;});}});
      let down,axisDown=false;this.canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];axisDown=!!this.transform.axis;});this.canvas.addEventListener('pointerup',e=>{if(axisDown||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects([...this.objects.values()],true).find(h=>h.object.userData.id);this.onSelect(hit?.object.userData.id||null);});
    } catch(error){this.renderer=null;this.canvas.hidden=true;this.canvas2.hidden=false;this.mode='2d';onFallback(error);}
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.container);
    this.showColliders=true;
    let drag=null;
    this.canvas2.addEventListener('pointerdown',e=>{const r=this.canvas2.getBoundingClientRect(),p=[e.clientX-r.left,e.clientY-r.top],selected=this.doc?.components.find(c=>c.id===this.selected);let axis=null,hit=null;
      if(selected&&!this.isBound(selected)){const origin=this.project2(this.sim?.bodies.get(selected.id)?.position||selected.position),dx=p[0]-origin[0],dy=p[1]-origin[1];if(dx>9&&dx<94&&Math.abs(dy)<13)axis=0;if(dy<-9&&dy>-94&&Math.abs(dx)<13)axis=1;if(axis!==null)hit=selected;}
      if(!hit){let dist=Infinity;for(const c of this.doc?.components||[]){const b=this.sim?.bodies.get(c.id),q=this.project2(b?.position||c.position),d=Math.hypot(p[0]-q[0],p[1]-q[1]);if(d<dist&&(d<24||this.hitCollider2(p,c,b))){hit=c;dist=d;}}this.onSelect(hit?.id||null);}
      if(hit&&!this.isBound(hit)){const start=[...(this.sim?.bodies.get(hit.id)?.position||hit.position)];drag={id:hit.id,start,pixel:p,axis,active:false};this.canvas2.setPointerCapture(e.pointerId);}});
    this.canvas2.addEventListener('pointermove',e=>{if(!drag)return;const r=this.canvas2.getBoundingClientRect(),dx=(e.clientX-r.left-drag.pixel[0])/this.scale2,dy=-(e.clientY-r.top-drag.pixel[1])/this.scale2;if(!drag.active){if(Math.hypot(dx,dy)*this.scale2<3)return;drag.active=true;drag.start=[...(this.sim?.bodies.get(drag.id)?.position||drag.start)];this.onDragStart?.();}const pos=[...drag.start];if(drag.axis!==1)pos[0]+=dx;if(drag.axis!==0)pos[1]+=dy;pos[2]=0;this.previewMove={id:drag.id,position:pos.map(v=>Math.max(-30,Math.min(30,this.snap?Math.round(v*10)/10:v)))};});
    const endDrag=()=>{if(this.previewMove){const move=this.previewMove;Promise.resolve(this.onMove(move.id,move.position.map(x=>Math.round(x*100)/100))).finally(()=>{this.previewMove=null;});}drag=null;};this.canvas2.addEventListener('pointerup',endDrag);this.canvas2.addEventListener('pointercancel',()=>{this.previewMove=null;drag=null;});
    this.canvas2.addEventListener('wheel',e=>{e.preventDefault();this.scale2=Math.min(180,Math.max(18,this.scale2*Math.exp(-e.deltaY*.001)));},{passive:false});
  }
  material(color,options={}){return new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.43,...options});}
  mesh(geometry,color,options){return new THREE.Mesh(geometry,this.material(color,options));}
  lines(points,color,opacity=1,segments=true){const geo=new THREE.BufferGeometry().setFromPoints(points.map(V));return new (segments?THREE.LineSegments:THREE.Line)(geo,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));}
  disposeGroup(group){for(const c of [...group.children]){c.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});group.remove(c);}}
  create(c) {
    const originalKind=c.kind;const aliases={rheostat:'resistor',ac_source:'battery',current_source:'battery',directional_speaker:'speaker',diverging_lens:'lens',drag:'probe',expression_force:'probe',harmonic_force:'force',motion_sensor:'probe',distance_sensor:'probe'};
    if(c.kind==='harmonic_force'){const f=[0,0,0];f[c.params.axis]=c.params.amplitude;c={...c,params:{...c.params,fx:f[0],fy:f[1],fz:f[2]}};}
    c={...c,kind:aliases[c.kind]||c.kind};
    const group=new THREE.Group(),color=c.appearance?.color||DOMAINS[CATALOG[c.kind].domain].color,p=c.params;
    const add=(geo,col=color,pos=[0,0,0],opts={})=>{const m=this.mesh(geo,col,opts);m.position.copy(V(pos));group.add(m);return m;};
    if(c.appearance?.parts){
      for(const part of c.appearance.parts){
        const geometry=part.shape==='box'?new THREE.BoxGeometry(1,1,1):part.shape==='sphere'?new THREE.SphereGeometry(.5,16,12):new THREE.CylinderGeometry(.5,.5,1,16);
        const mesh=add(geometry,part.color||color,part.offset);mesh.scale.copy(V(part.size));mesh.rotation.z=(part.angle||0)*Math.PI/180;mesh.userData.id=c.id;
      }
      group.position.copy(V(c.position));group.rotation.z=(p.angle||0)*Math.PI/180;return group;
    }
    const stand=()=>{add(new THREE.CylinderGeometry(.23,.3,.12,24),'#434f5d',[0,-.5,0]);add(new THREE.CylinderGeometry(.035,.035,.45,12),'#7c8d9a',[0,-.24,0]);};
    if(c.kind==='lens_bench'){const g=benchGraphics(p);for(const l of g.lines){const obj=this.lines(l.points,l.color,l.dashed?.35:1,false);group.add(obj);}add(new THREE.BoxGeometry(.12,Math.max(.3,p.lensDiameter*.1),.12),'#83afc1');add(new THREE.BoxGeometry(.06,1.7,.6),'#b7cec1',[p.screenX*.1,0,0],{transparent:true,opacity:.4});add(new THREE.CylinderGeometry(.04,.04,p.h*.1,12),'#b7854b',[-p.u*.1,p.h*.05,0]);}
    if(['body','charge'].includes(c.kind)){add(new THREE.SphereGeometry(p.radius,32,24),c.kind==='charge'?(p.charge>=0?'#dd9983':'#72b4d6'):color);const ring=add(new THREE.TorusGeometry(p.radius*1.005,.008,8,50),'#ffffff',undefined,{transparent:true,opacity:.25});ring.rotation.x=Math.PI/2;}
    if(c.kind==='anchor'){add(new THREE.BoxGeometry(.35,.2,.35),'#53606b');add(new THREE.SphereGeometry(.11,16,12),color,[0,.15,0]);}
    if(LINK_KINDS.includes(c.kind)){const points=[];for(let i=0;i<=120;i++)points.push([i/120*1.5-.75,.13*Math.cos(i/120*Math.PI*20),.13*Math.sin(i/120*Math.PI*20)]);group.add(this.lines(points,color,1,false));}
    if(c.kind==='cylinder'){const wheel=add(new THREE.CylinderGeometry(p.radius,p.radius,p.height,32),color);wheel.rotation.x=Math.PI/2;group.add(this.lines([[-p.radius,0,p.height/2],[p.radius,0,p.height/2]],'#ffffff'));}
    if(c.kind==='box')add(new THREE.BoxGeometry(p.width,p.height,p.depth),color);
    if(c.kind==='ramp'){add(new THREE.BoxGeometry(p.length,.16,p.width),'#b6c9d3');group.rotation.z=p.angle*Math.PI/180;}
    if(c.kind==='force'){const dir=new THREE.Vector3(p.fx,p.fy,p.fz);if(dir.length()<.01)dir.set(1,0,0);group.add(new THREE.ArrowHelper(dir.normalize(),new THREE.Vector3(),1,'#d18b55',.2,.12));add(new THREE.SphereGeometry(.1,16,12),'#d18b55');}
    if(CIRCUIT_KINDS.includes(c.kind)){
      if(c.kind==='resistor'){const m=add(new THREE.CylinderGeometry(.13,.13,.65,20),'#d9ba85');m.rotation.z=Math.PI/2;for(let x=-.2;x<=.21;x+=.13){const band=add(new THREE.CylinderGeometry(.135,.135,.04,20),x<0?'#a06b49':'#607c9a',[x,0,0]);band.rotation.z=Math.PI/2;}}
      if(c.kind==='battery'){add(new THREE.BoxGeometry(.75,.45,.45),'#5483a3');add(new THREE.BoxGeometry(.1,.32,.46),'#dec58a',[-.3,0,0]);}
      if(c.kind==='capacitor'){add(new THREE.CylinderGeometry(.22,.22,.55,24),'#5e9fb8');add(new THREE.CylinderGeometry(.2,.2,.015,24),'#cad8dc',[0,.285,0]);}
      if(c.kind==='inductor'){const pts=[];for(let i=0;i<=180;i++)pts.push([(i/180-.5)*.8,Math.cos(i/180*Math.PI*18)*.2,Math.sin(i/180*Math.PI*18)*.2]);group.add(this.lines(pts,'#bc8152',1,false));add(new THREE.BoxGeometry(.8,.12,.4),'#71838b',[0,-.26,0]);}
      if(c.kind==='switch'){add(new THREE.BoxGeometry(.8,.12,.35),'#bccbd2',[0,-.15,0]);const lever=add(new THREE.BoxGeometry(.65,.035,.07),p.closed?'#67a58a':'#c59865',[0,.03,0]);lever.rotation.z=p.closed?0:.5;}
      if(c.kind==='lamp'){const bulb=add(new THREE.SphereGeometry(.27,24,18),'#fff0b6',[0,.1,0],{transparent:true,opacity:.8,emissive:'#ffd770',emissiveIntensity:0});bulb.name='bulb';add(new THREE.CylinderGeometry(.15,.18,.2,20),'#96a5ad',[0,-.25,0]);}
      if(['voltmeter','ammeter'].includes(c.kind)){add(new THREE.BoxGeometry(.7,.55,.3),'#d1e1e7');add(new THREE.BoxGeometry(.5,.28,.015),'#a5c6c8',[0,.03,.16]);}
      if(c.kind==='ground'){group.add(this.lines([[-.3,0,0],[.3,0,0],[-.2,-.12,0],[.2,-.12,0],[-.1,-.24,0],[.1,-.24,0]],'#668495'));}
      group.add(this.lines([[-.55,0,0],[.55,0,0]],'#8ba0ac'));
      for(const x of CATALOG[c.kind].terminals.map(port=>port==='a'?-.55:.55))add(new THREE.SphereGeometry(.045,12,10),'#408bd3',[x,0,0]);
    }
    if(c.kind==='power'){add(new THREE.BoxGeometry(.85,.55,.55),'#596979');add(new THREE.BoxGeometry(.68,.39,.02),'#202d36',[0,0,.29]);add(new THREE.BoxGeometry(.3,.14,.01),'#77b6ae',[-.15,.05,.31],{emissive:'#72b8af',emissiveIntensity:.4});add(new THREE.CylinderGeometry(.07,.07,.05,20),'#b6c1c7',[.2,-.06,.32]).rotation.x=Math.PI/2;for(let i=0;i<2;i++)add(new THREE.SphereGeometry(.035,10,10),i?'#dc9f83':'#71859b',[-.22+i*.15,-.15,.31]);}
    if(c.kind==='coil'){const points=[];for(let i=0;i<=360;i++)points.push([Math.cos(i/360*Math.PI*28)*.3,(i/360-.5)*.8,Math.sin(i/360*Math.PI*28)*.3]);group.add(this.lines(points,'#d99d72',1,false));add(new THREE.CylinderGeometry(.2,.2,.95,24),'#6e7c88',undefined,{metalness:.8,roughness:.3});add(new THREE.BoxGeometry(.8,.1,.8),'#434e59',[0,-.55,0]);}
    if(c.kind==='field'){add(new THREE.BoxGeometry(.45,.85,.4),'#d28b8d',[-.35,0,0]);add(new THREE.BoxGeometry(.45,.85,.4),'#6e9cbb',[.35,0,0]);add(new THREE.BoxGeometry(1.15,.25,.4),'#8d8f98',[0,-.47,0]);}
    if(c.kind==='speaker'){add(new THREE.BoxGeometry(.65,.85,.45),'#4d4b62');const cone=add(new THREE.ConeGeometry(.29,.15,32),'#a39cb8',[0,0,.29]);cone.rotation.x=Math.PI/2;add(new THREE.SphereGeometry(.09,16,12),'#5d566f',[0,0,.38]);}
    if(c.kind==='laser'){const m=add(new THREE.CylinderGeometry(.14,.14,.65,24),'#a8aca5');m.rotation.z=Math.PI/2;const tip=add(new THREE.CylinderGeometry(.1,.1,.03,24),'#d4e296',[.34,0,0],{emissive:'#b9d977',emissiveIntensity:1});tip.rotation.z=Math.PI/2;group.rotation.z=p.angle*Math.PI/180;}
    if(c.kind==='lens'){const m=add(new THREE.SphereGeometry(p.radius,32,24),'#96cbd9',[0,0,0],{transparent:true,opacity:.3,metalness:.1,roughness:.1});m.scale.x=.13;const rim=add(new THREE.TorusGeometry(p.radius,.025,12,64),'#778c98');rim.rotation.y=Math.PI/2;stand();group.rotation.z=p.angle*Math.PI/180;}
    if(c.kind==='mirror'){const m=add(new THREE.CylinderGeometry(p.radius,p.radius,.04,40),'#a7c8d7',undefined,{metalness:.95,roughness:.12});m.rotation.z=Math.PI/2;stand();group.rotation.z=p.angle*Math.PI/180;}
    if(c.kind==='detector'){add(new THREE.BoxGeometry(.12,p.radius*2,p.radius*2),'#506b60');add(new THREE.BoxGeometry(.015,p.radius*1.7,p.radius*1.7),'#a6cdb8',[-.07,0,0],{emissive:'#6e9c86',emissiveIntensity:.3});stand();group.rotation.z=(p.angle||0)*Math.PI/180;}
    if(c.kind==='microphone'){add(new THREE.SphereGeometry(.18,20,16),'#a4c4bb');add(new THREE.CylinderGeometry(.055,.07,.55,16),'#6b8d83',[0,-.3,0]);stand();}
    if(c.kind==='probe'){add(new THREE.CylinderGeometry(.035,.035,.7,12),'#91a8a0',[0,.25,0]);add(new THREE.BoxGeometry(.28,.4,.18),'#547468',[0,-.2,0]);add(new THREE.BoxGeometry(.18,.12,.01),'#a0d1b9',[0,-.15,.1]);}
    if(c.kind==='aperture'){const ring=add(new THREE.RingGeometry(p.opening,p.radius,48),'#667984',[0,0,0],{side:THREE.DoubleSide});ring.rotation.y=Math.PI/2;stand();group.rotation.z=p.angle*Math.PI/180;}
    if(c.kind==='optical_filter'){const filter=add(new THREE.CylinderGeometry(p.radius,p.radius,.04,40),'#8b86a7',[0,0,0],{transparent:true,opacity:Math.max(.15,1-p.transmission),side:THREE.DoubleSide});filter.rotation.z=Math.PI/2;stand();group.rotation.z=p.angle*Math.PI/180;}
    if(c.kind==='electric_field'){add(new THREE.BoxGeometry(.07,.8,.7),'#e2aa8f',[-.4,0,0]);add(new THREE.BoxGeometry(.07,.8,.7),'#80afcd',[.4,0,0]);}
    if(c.kind==='bar_magnet'){add(new THREE.BoxGeometry(.5,.3,.3),'#d08b8b',[-.25,0,0]);add(new THREE.BoxGeometry(.5,.3,.3),'#76a9c4',[.25,0,0]);if(p.axis===1)group.rotation.z=Math.PI/2;if(p.axis===2)group.rotation.y=Math.PI/2;}
    if(originalKind==='rheostat'){add(new THREE.BoxGeometry(.12,.1,.28),'#779eab',[(p.ratio-.5)*.6,.19,0]);}
    if(['ac_source','current_source'].includes(originalKind)){add(new THREE.BoxGeometry(.45,.2,.015),'#d9e9ed',[0,.03,.24]);const points=Array.from({length:21},(_,i)=>[(i/20-.5)*.35,.03+Math.sin(i/20*Math.PI*2)*.06,.255]);group.add(this.lines(points,'#4b91b4',1,false));}
    if(c.appearance?.color)group.traverse(o=>{if(o.material?.color)o.material.color.set(c.appearance.color);});
    group.position.copy(V(c.position));group.traverse(o=>{if(o.isMesh||o.isLine)o.userData.id=c.id;});return group;
  }
  setDoc(doc) {
    this.transform?.detach();this.doc=doc;this.mode=doc.mode;if(!this.renderer)this.mode='2d';this.canvas.hidden=this.mode!=='3d';this.canvas2.hidden=this.mode!=='2d';this.labels.replaceChildren();this.ports.replaceChildren();
    if(this.renderer){this.disposeGroup(this.root);this.disposeGroup(this.colliderRoot);this.colliderObjects.clear();this.objects.clear();for(const c of doc.components){const obj=this.create(c);this.root.add(obj);this.objects.set(c.id,obj);}}
    for(const c of doc.components){const el=document.createElement('span');el.className='object-label';el.dataset.id=c.id;el.textContent=c.name;this.labels.append(el);if(CATALOG[c.kind].terminals)for(const port of CATALOG[c.kind].terminals){const button=document.createElement('button');button.className='terminal';button.dataset.component=c.id;button.dataset.port=port;button.textContent=port.toUpperCase();button.title=c.name+' 端子 '+port.toUpperCase();button.setAttribute('aria-label',button.title);this.ports.append(button);}}this.select(this.selected);this.resize();
  }
  resize(){const r=this.container.getBoundingClientRect();this.width=r.width;this.height=r.height;const d=Math.min(devicePixelRatio,2);this.canvas2.width=r.width*d;this.canvas2.height=r.height*d;this.ctx.setTransform(d,0,0,d,0,0);if(this.renderer){this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/Math.max(1,r.height);this.camera.updateProjectionMatrix();}}
  fit(){this.scale2=65;this.pan2=[0,0];const bench=this.doc?.components.find(c=>c.kind==='lens_bench');if(bench){const g=benchGraphics(bench.params);this.scale2=Math.min(80,Math.max(18,(this.width-80)/(g.right-g.left+1)));this.pan2=[-(g.right+g.left)/2-bench.position[0],-bench.position[1]+.5];}if(this.renderer){const list=this.doc?.components||[],center=list.length?list.reduce((v,c)=>v.add(V(c.position)),new THREE.Vector3()).divideScalar(list.length):new THREE.Vector3(0,1,0);const span=list.length?Math.max(5,...list.map(c=>V(c.position).distanceTo(center)))*1.5:8;this.controls.target.copy(center);this.camera.position.copy(center.clone().add(new THREE.Vector3(span,span*.7,span*1.2)));this.controls.update();}}
  isBound(c){return !!c&&LINK_KINDS.includes(c.kind)&&c.refs.a&&c.refs.b;}
  setSnap(enabled){this.snap=enabled;this.transform?.setTranslationSnap(enabled?.1:null);}
  focus(id){const c=this.doc.components.find(c=>c.id===id);if(!c)return;const p=this.sim?.bodies.get(id)?.position||c.position;this.pan2=[-p[0],-p[1]+this.height*.14/this.scale2];if(this.renderer){const offset=this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(5);this.controls.target.copy(V(p));this.camera.position.copy(V(p).add(offset));this.controls.update();}}
  select(id){this.selected=id;if(this.transform){this.transform.detach();const object=this.objects.get(id);if(object&&this.mode==='3d'&&!this.isBound(this.doc.components.find(c=>c.id===id)))this.transform.attach(object);}}
  portPosition(id,port){const c=this.doc.components.find(c=>c.id===id),position=this.previewMove?.id===id?this.previewMove.position:this.sim?.bodies.get(id)?.position||c.position;return position.map((v,i)=>i===0?v+(port==='a'?-.55:.55):v);}
  project2(p){return [this.width/2+(p[0]+this.pan2[0])*this.scale2,this.height*.64-(p[1]+this.pan2[1])*this.scale2];}
  unproject2(p){return [(p[0]-this.width/2)/this.scale2-this.pan2[0],(this.height*.64-p[1])/this.scale2-this.pan2[1],0];}
  colliderPose(c,b){return {position:this.previewMove?.id===c.id?this.previewMove.position:b?.position||c.position,quaternion:b?.quaternion?new THREE.Quaternion(...b.quaternion):new THREE.Quaternion().setFromEuler(new THREE.Euler(...colliderRotation(c))) };}
  hitCollider2(point,c,b){
    if(!supportsCollider(c))return false;const hull=colliderOf(c),pose=this.colliderPose(c,b),local=V(this.unproject2(point)).sub(V(pose.position)).applyQuaternion(pose.quaternion.clone().invert()).sub(V(hull.offset)),pad=5/this.scale2;
    return hull.type==='sphere'||hull.type==='cylinder'?Math.hypot(local.x,local.y)<=hull.size[0]/2+pad:Math.abs(local.x)<=hull.size[0]/2+pad&&Math.abs(local.y)<=hull.size[1]/2+pad;
  }
  drawCollider3(c,b){
    if(!supportsCollider(c))return;const hull=colliderOf(c);let line=this.colliderObjects.get(c.id);
    if(!this.showColliders||!hull.enabled&&c.id!==this.selected){if(line)line.visible=false;return;}
    if(!line){
      let geometry;
      if(hull.type==='sphere')geometry=new THREE.SphereGeometry(hull.size[0]/2,16,10);
      else if(hull.type==='cylinder'){geometry=new THREE.CylinderGeometry(hull.size[0]/2,hull.size[0]/2,hull.size[2],16);geometry.rotateX(Math.PI/2);}
      else geometry=new THREE.BoxGeometry(...hull.size);
      geometry.translate(...hull.offset);const edges=new THREE.EdgesGeometry(geometry);geometry.dispose();
      line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({transparent:true,depthTest:false}));
      line.renderOrder=5;this.colliderRoot.add(line);this.colliderObjects.set(c.id,line);
    }
    const pose=this.colliderPose(c,b);line.visible=true;line.material.color.set(hull.enabled&&this.doc.environment.collisions?'#299cb5':'#91a0a8');line.material.opacity=c.id===this.selected ? .95 : .55;
    line.position.copy(this.objects.get(c.id)?.position||V(pose.position));line.quaternion.copy(pose.quaternion);
  }
  drawCollider2(c,b){
    if(!this.showColliders||!supportsCollider(c))return;const hull=colliderOf(c);if(!hull.enabled&&c.id!==this.selected)return;
    const ctx=this.ctx,pose=this.colliderPose(c,b),world=v=>this.project2(V(v).add(V(hull.offset)).applyQuaternion(pose.quaternion).add(V(pose.position)).toArray());
    ctx.save();ctx.strokeStyle=hull.enabled&&this.doc.environment.collisions?'#299cb5':'#91a0a8';ctx.lineWidth=c.id===this.selected?2:1.2;ctx.setLineDash([5,3]);ctx.beginPath();
    if(hull.type==='sphere'||hull.type==='cylinder'){const center=world([0,0,0]);ctx.arc(...center,hull.size[0]/2*this.scale2,0,Math.PI*2);}
    else {const points=Array.from({length:8},(_,i)=>world(hull.size.map((v,j)=>(i&(1<<j)?1:-1)*v/2)));for(let i=0;i<8;i++)for(let j=0;j<3;j++)if(!(i&(1<<j))){ctx.moveTo(...points[i]);ctx.lineTo(...points[i|(1<<j)]);}}
    ctx.stroke();ctx.restore();
  }
  draw(sim) {
    this.sim=sim;if(!this.doc)return;
    if(this.mode==='2d')this.draw2(sim);else this.draw3(sim);
    for(const el of this.ports.children){const id=el.dataset.component;el.hidden=id!==this.selected&&!this.pendingWire;if(el.hidden)continue;const pos=this.portPosition(id,el.dataset.port);let q;if(this.mode==='2d')q=this.project2(pos);else{const v=V(pos).project(this.camera);q=[(v.x+1)*this.width/2,(1-v.y)*this.height/2];el.hidden=v.z>1;}el.style.left=q[0]+'px';el.style.top=q[1]+'px';el.classList.toggle('armed',this.pendingWire?.id===id&&this.pendingWire?.port===el.dataset.port);}
    for(const el of this.labels.children){const c=this.doc.components.find(c=>c.id===el.dataset.id);if(!c)continue;const b=sim.bodies.get(c.id);let point=this.previewMove?.id===c.id?this.previewMove.position:b.position;let q;
      if(this.mode==='2d')q=this.project2(point).map((v,i)=>i?v-30:v);else{const v=V(point).add(new THREE.Vector3(0,.6,0)).project(this.camera);q=[(v.x+1)*this.width/2,(1-v.y)*this.height/2];el.style.opacity=v.z>1?0:1;}
      el.style.left=q[0]+'px';el.style.top=q[1]+'px';el.classList.toggle('selected',c.id===this.selected);el.hidden=this.doc.components.length>24&&c.id!==this.selected;
    }
  }
  draw3(sim) {
    this.controls.update();this.grid.visible=this.showGrid;this.axes.visible=this.showGrid;
    for(const c of this.doc.components){const obj=this.objects.get(c.id),b=sim.bodies.get(c.id);if(!((this.transform.dragging||this.previewMove)&&c.id===this.selected))obj.position.copy(V(b.position));if(b.quaternion)obj.quaternion.fromArray(b.quaternion);if(LINK_KINDS.includes(c.kind)&&c.refs.a&&c.refs.b){const a=sim.bodies.get(c.refs.a),bb=sim.bodies.get(c.refs.b);if(a&&bb){const start=V(a.position),end=V(bb.position),diff=end.clone().sub(start),length=diff.length(),axis=diff.normalize(),perp=new THREE.Vector3(0,0,1);if(Math.abs(axis.dot(perp))>.9)perp.set(0,1,0);if(c.appearance?.parts){obj.position.copy(start).lerp(end,.5);if(length>0)obj.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),axis);continue;}
      perp.cross(axis).normalize();const p2=axis.clone().cross(perp),points=[];for(let i=0;i<=120;i++){const t=i/120;points.push(start.clone().lerp(end,t).addScaledVector(perp,Math.cos(t*Math.PI*20)*(c.kind==='spring'?.1:0)).addScaledVector(p2,Math.sin(t*Math.PI*20)*(c.kind==='spring'?.1:0)));}obj.position.set(0,0,0);obj.children[0].geometry.setFromPoints(points);}}}
    this.disposeGroup(this.dynamic);
    for(const c of this.doc.components)this.drawCollider3(c,sim.bodies.get(c.id));
    const selected=this.objects.get(this.selected);if(selected){const box=new THREE.BoxHelper(selected,'#e9ac76');box.material.transparent=true;box.material.opacity=.55;this.dynamic.add(box);}
    for(const c of this.doc.components){const b=sim.bodies.get(c.id),color=c.appearance?.color||DOMAINS[CATALOG[c.kind].domain].color;
      if(this.showTrails&&b.trail.length>1)this.dynamic.add(this.lines(b.trail,color,.4,false));
      if(this.showFields&&c.kind==='field'){const sphere=new THREE.Mesh(new THREE.SphereGeometry(c.params.radius,20,12),new THREE.MeshBasicMaterial({color:'#b58cba',wireframe:true,transparent:true,opacity:.045}));sphere.position.copy(V(b.position));this.dynamic.add(sphere);const pts=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++){const axis=c.params.axis,a=[x*.7,y*.7,-.9],z=[x*.7,y*.7,.9];if(axis===0){[a[0],a[2]]=[a[2],a[0]];[z[0],z[2]]=[z[2],z[0]];}if(axis===1){[a[1],a[2]]=[a[2],a[1]];[z[1],z[2]]=[z[2],z[1]];}pts.push(a.map((v,i)=>v+b.position[i]),z.map((v,i)=>v+b.position[i]));}this.dynamic.add(this.lines(pts,'#be8cba',.3));}
      if(this.showFields&&SOUND_KINDS.includes(c.kind)){const phase=(sim.time*.7)%1;for(let i=0;i<5;i++){const r=(i+phase)*.7+.3,ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:65},(_,n)=>new THREE.Vector3(Math.cos(n/64*Math.PI*2)*r,Math.sin(n/64*Math.PI*2)*r,0))),new THREE.LineBasicMaterial({color,transparent:true,opacity:(1-i/5)*.2*Math.min(1,sim.modulation(c.id,'acoustic'))}));ring.position.copy(V(b.position));this.dynamic.add(ring);}}
    }
    if(this.showFields){for(const ray of sim.rays())if(ray.power>0)this.dynamic.add(this.lines([ray.from,ray.to],'#76a942',Math.min(.85,ray.power*1.5+.1)));
      if(this.doc.components.some(c=>['charge','electric_field'].includes(c.kind))){const points=[];for(let x=-5;x<=5;x+=1)for(let y=0;y<=4;y+=1){const p=[x,y,0],field=fieldAt(this.doc,p,sim.bodies).electric,dir=V(field).normalize();if(Math.hypot(...field)<.01)continue;const a=V(p).addScaledVector(dir,-.13),b=V(p).addScaledVector(dir,.13);points.push(a.toArray(),b.toArray());}this.dynamic.add(this.lines(points,'#72b4d6',.3));}
    }
    for(const l of this.doc.connections){const a=sim.bodies.get(l.source),b=sim.bodies.get(l.target);if(a&&b){const pa=l.kind==='wire'?this.portPosition(l.source,l.sourcePort):a.position,pb=l.kind==='wire'?this.portPosition(l.target,l.targetPort):b.position;this.dynamic.add(this.lines([pa,pb],l.kind==='wire'?'#3b83c4':'#77a28d',.8));}}
    for(const c of this.doc.components.filter(c=>c.kind==='lamp')){const bulb=this.objects.get(c.id)?.getObjectByName('bulb');if(bulb)bulb.material.emissiveIntensity=Math.min(2,Math.max(0,sim.circuit.readings[c.id]?.power||0)/c.params.ratedPower);}
    this.renderer.render(this.scene,this.camera);
  }
  draw2(sim) {
    const ctx=this.ctx,w=this.width,h=this.height;ctx.clearRect(0,0,w,h);ctx.lineWidth=1;
    if(this.showGrid){const origin=this.project2([0,0,0]);ctx.strokeStyle='#c4d1dc77';ctx.beginPath();for(let x=origin[0]%this.scale2;x<w;x+=this.scale2){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=origin[1]%this.scale2;y<h;y+=this.scale2){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();ctx.strokeStyle='#9bafbd99';ctx.beginPath();ctx.moveTo(origin[0],0);ctx.lineTo(origin[0],h);ctx.moveTo(0,origin[1]);ctx.lineTo(w,origin[1]);ctx.stroke();ctx.fillStyle='#8294a1';ctx.font='9px monospace';ctx.fillText('0',origin[0]+6,origin[1]+13);}
    if(this.showFields&&this.doc.components.some(c=>SOUND_KINDS.includes(c.kind))){const cell=22;for(let x=0;x<w;x+=cell)for(let y=0;y<h;y+=cell){const p=sim.pressure(this.unproject2([x,y])),alpha=Math.min(.24,Math.abs(p)*.18);ctx.fillStyle=p>0?`rgba(169,134,223,${alpha})`:`rgba(81,135,164,${alpha})`;ctx.fillRect(x,y,cell,cell);}}
    if(this.showFields&&this.doc.components.some(c=>['charge','electric_field'].includes(c.kind))){for(let x=30;x<w;x+=48)for(let y=30;y<h-60;y+=48){const {electric}=fieldAt(this.doc,this.unproject2([x,y]),sim.bodies),angle=Math.atan2(-electric[1],electric[0]),mag=Math.hypot(...electric);if(mag<1e-6)continue;ctx.strokeStyle='#81b6d13b';ctx.beginPath();ctx.moveTo(x-Math.cos(angle)*8,y-Math.sin(angle)*8);ctx.lineTo(x+Math.cos(angle)*8,y+Math.sin(angle)*8);ctx.lineTo(x+Math.cos(angle)*8-Math.cos(angle-.6)*5,y+Math.sin(angle)*8-Math.sin(angle-.6)*5);ctx.stroke();}}
    const line=(points,color,width=1)=>{if(!points.length)return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.map(p=>this.project2(p)).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();};
    for(const l of this.doc.connections){const a=sim.bodies.get(l.source),b=sim.bodies.get(l.target);if(a&&b){ctx.setLineDash(l.kind==='wire'?[]:[4,5]);line(l.kind==='wire'?[this.portPosition(l.source,l.sourcePort),this.portPosition(l.target,l.targetPort)]:[a.position,b.position],l.kind==='wire'?'#3b83c4':'#77a28d',l.kind==='wire'?2:1);ctx.setLineDash([]);}}
    if(this.showFields)for(const ray of sim.rays())if(ray.power>0)line([ray.from,ray.to],'#6d9e36c0',1.4);
    for(const c of this.doc.components){const b=sim.bodies.get(c.id),pos=this.previewMove?.id===c.id?this.previewMove.position:b.position,p=this.project2(pos),color=c.appearance?.color||DOMAINS[CATALOG[c.kind].domain].color;
      if(this.showTrails)line(b.trail,color+'66');ctx.save();ctx.translate(...p);ctx.strokeStyle=color;ctx.fillStyle=color+'22';ctx.lineWidth=1.5;
      if(this.showFields&&c.kind==='field'){ctx.strokeStyle=color+'33';ctx.setLineDash([5,8]);ctx.beginPath();ctx.arc(0,0,c.params.radius*this.scale2,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=color;}
      const radius=Math.max(9,(c.params.radius||.25)*this.scale2);
      if(c.appearance?.parts){
        ctx.save();const q=b.quaternion;
        if(this.isBound(c)){
          const a=sim.bodies.get(c.refs.a).position,z=sim.bodies.get(c.refs.b).position;
          ctx.translate(((a[0]+z[0])/2-pos[0])*this.scale2,(pos[1]-(a[1]+z[1])/2)*this.scale2);
          ctx.rotate(-Math.atan2(z[1]-a[1],z[0]-a[0]));
        }else ctx.rotate(-(q?2*Math.atan2(q[2],q[3]):(c.params.angle||0)*Math.PI/180));
        for(const part of [...c.appearance.parts].sort((a,b)=>(a.offset?.[2]||0)-(b.offset?.[2]||0))){
          const [x,y]=part.offset||[0,0],width=part.size[0]*this.scale2,height=part.size[1]*this.scale2;
          ctx.save();ctx.translate(x*this.scale2,-y*this.scale2);ctx.rotate(-(part.angle||0)*Math.PI/180);
          ctx.fillStyle=part.color||color;ctx.beginPath();
          if(part.shape==='sphere')ctx.ellipse(0,0,width/2,height/2,0,0,2*Math.PI);
          else ctx.rect(-width/2,-height/2,width,height);
          ctx.fill();ctx.restore();
        }
        ctx.restore();
      }
      else if(c.kind==='lens_bench'){drawBench2(ctx,c.params,this.scale2);}
      else if(c.kind==='cylinder'){ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.stroke();const q=b.quaternion||[0,0,0,1],angle=2*Math.atan2(q[2],q[3]);ctx.beginPath();ctx.moveTo(-radius*Math.cos(angle),radius*Math.sin(angle));ctx.lineTo(radius*Math.cos(angle),-radius*Math.sin(angle));ctx.stroke();}
      else if(c.kind==='box'||c.kind==='ramp'){const width=(c.kind==='box'?c.params.width:c.params.length)*this.scale2,height=(c.kind==='box'?c.params.height:.16)*this.scale2;const q=b.quaternion;const angle=q?Math.atan2(2*(q[3]*q[2]+q[0]*q[1]),1-2*(q[1]**2+q[2]**2)):(c.params.angle||0)*Math.PI/180;ctx.rotate(-angle);ctx.fillRect(-width/2,-height/2,width,height);ctx.strokeRect(-width/2,-height/2,width,height);ctx.rotate(angle);}
      else if(['body','charge','microphone','probe','motion_sensor','distance_sensor'].includes(c.kind)){ctx.beginPath();ctx.arc(0,0,Math.min(radius,40),0,Math.PI*2);ctx.fill();ctx.stroke();if(c.kind==='charge'){ctx.fillStyle=color;ctx.textAlign='center';ctx.font='16px sans-serif';ctx.fillText(c.params.charge>=0?'+':'−',0,5);}}
      else if([...LENS_KINDS,'mirror','detector','aperture','optical_filter'].includes(c.kind)){ctx.rotate(-((c.params.angle||0)*Math.PI/180));ctx.beginPath();if(LENS_KINDS.includes(c.kind))ctx.ellipse(0,0,6,radius,0,0,Math.PI*2);else{ctx.rect(-3,-radius,6,radius*2);}ctx.fill();ctx.stroke();}
      else if(LINK_KINDS.includes(c.kind)){ctx.restore();const a=sim.bodies.get(c.refs.a),bb=sim.bodies.get(c.refs.b),start=a?.position||pos.map((v,i)=>i===0?v-.7:v),end=bb?.position||pos.map((v,i)=>i===0?v+.7:v),dx=end[0]-start[0],dy=end[1]-start[1],len=Math.hypot(dx,dy)||1,points=Array.from({length:81},(_,i)=>{const t=i/80,s=Math.sin(t*Math.PI*20)*(c.kind==='spring'?.1:0);return[start[0]+dx*t-dy/len*s,start[1]+dy*t+dx/len*s,0];});line(points,color,1.5);continue;}
      else if(CIRCUIT_KINDS.includes(c.kind)){this.drawCircuitSymbol(ctx,c,sim);}
      else{ctx.beginPath();ctx.roundRect(-18,-18,36,36,5);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font='16px monospace';ctx.textAlign='center';ctx.fillText({speaker:'≋',directional_speaker:'≋→',power:'∿',coil:'∿',field:'N S',bar_magnet:'N S',electric_field:'+ −',drag:'阻',expression_force:'F(t)',harmonic_force:'F∿',force:'F→',laser:'→',anchor:'⊥'}[c.kind]||'⊕',0,6);}
      if(c.id===this.selected){ctx.strokeStyle='#edb481';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.strokeRect(-Math.max(24,Math.min(radius+7,47)),-Math.max(24,Math.min(radius+7,47)),Math.max(48,Math.min(radius*2+14,94)),Math.max(48,Math.min(radius*2+14,94)));}ctx.restore();
    }
    for(const c of this.doc.components)this.drawCollider2(c,sim.bodies.get(c.id));
    if(this.selected&&!this.isBound(this.doc.components.find(c=>c.id===this.selected))){const b=sim.bodies.get(this.selected);if(b){const pos=this.previewMove?.id===this.selected?this.previewMove.position:b.position,[x,y]=this.project2(pos);for(const [axis,dx,dy,color]of[['X',80,0,'#d75c52'],['Y',0,-80,'#479c71']]){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.stroke();ctx.beginPath();if(dx){ctx.moveTo(x+dx,y);ctx.lineTo(x+dx-10,y-5);ctx.lineTo(x+dx-10,y+5);}else{ctx.moveTo(x,y+dy);ctx.lineTo(x-5,y+dy+10);ctx.lineTo(x+5,y+dy+10);}ctx.fill();ctx.font='bold 12px sans-serif';ctx.fillText(axis,x+dx+7,y+dy-6);}}}
  }
  drawCircuitSymbol(ctx,c,sim){
    const originalKind=c.kind;c={...c,kind:({rheostat:'resistor',ac_source:'battery',current_source:'ammeter'})[c.kind]||c.kind};
    ctx.lineWidth=2;ctx.strokeStyle='#4081b5';ctx.fillStyle='#f4f9fc';ctx.beginPath();ctx.moveTo(-35,0);ctx.lineTo(-17,0);ctx.moveTo(17,0);ctx.lineTo(35,0);ctx.stroke();ctx.beginPath();
    if(c.kind==='resistor'){ctx.rect(-17,-9,34,18);ctx.fill();ctx.stroke();}
    if(c.kind==='battery'){ctx.moveTo(-7,-17);ctx.lineTo(-7,17);ctx.moveTo(7,-9);ctx.lineTo(7,9);ctx.stroke();ctx.font='10px sans-serif';ctx.fillStyle='#507594';ctx.fillText('+',-15,-21);}
    if(c.kind==='capacitor'){ctx.moveTo(-5,-17);ctx.lineTo(-5,17);ctx.moveTo(5,-17);ctx.lineTo(5,17);ctx.stroke();}
    if(c.kind==='inductor'){ctx.moveTo(-18,0);for(let i=0;i<4;i++)ctx.arc(-13+i*9,0,4.5,Math.PI,0);ctx.stroke();}
    if(c.kind==='switch'){ctx.moveTo(-17,0);ctx.lineTo(17,c.params.closed?0:-18);ctx.stroke();}
    if(['voltmeter','ammeter','lamp'].includes(c.kind)){ctx.arc(0,0,19,0,Math.PI*2);if(c.kind==='lamp'){const power=Math.max(0,sim.circuit.readings[c.id]?.power||0);ctx.fillStyle=power>.001?'rgba(246,194,67,'+Math.min(.8,power/c.params.ratedPower*.8)+')':'#f7f8fa';}ctx.fill();ctx.stroke();ctx.fillStyle='#4081b5';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText({voltmeter:'V',ammeter:'A',lamp:'×'}[c.kind],0,5);}
    if(originalKind==='rheostat'){ctx.beginPath();ctx.moveTo(-10,-20);ctx.lineTo(12,10);ctx.moveTo(12,10);ctx.lineTo(12,2);ctx.moveTo(12,10);ctx.lineTo(4,8);ctx.stroke();}
    if(['ac_source','current_source'].includes(originalKind)){ctx.fillStyle='#f4f9fc';ctx.fillRect(-19,-20,38,40);ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#4081b5';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText(originalKind==='ac_source'?'∿':'↑',0,6);}
    if(c.kind==='ground'){for(let i=0;i<3;i++){ctx.moveTo(-17+i*5,i*7);ctx.lineTo(17-i*5,i*7);}ctx.stroke();}
  }
}
