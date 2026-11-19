import * as CANNON from 'cannon-es';
import { RIGID_KINDS } from './catalog.js';
import {colliderOf,colliderRotation} from './colliders.js';

export class Mechanics {
  constructor(doc,bodies){
    this.doc=doc;this.world=new CANNON.World({gravity:new CANNON.Vec3(0,0,0)});this.world.solver.iterations=30;this.world.solver.tolerance=1e-9;this.map=new Map();const materials=[];
    const makeMaterial=(friction,restitution)=>{const m=new CANNON.Material();for(const old of materials)this.world.addContactMaterial(new CANNON.ContactMaterial(m,old.m,{friction:Math.min(friction,old.friction),restitution:Math.min(restitution,old.restitution),contactEquationStiffness:1e8,contactEquationRelaxation:50}));this.world.addContactMaterial(new CANNON.ContactMaterial(m,m,{friction,restitution,contactEquationStiffness:1e8,contactEquationRelaxation:50}));materials.push({m,friction,restitution});return m;};
    if(doc.environment.collisions){const ground=new CANNON.Body({mass:0,shape:new CANNON.Plane(),material:makeMaterial(1,1)});ground.quaternion.setFromEuler(-Math.PI/2,0,0);this.world.addBody(ground);}
    for(const c of doc.components.filter(c=>[...RIGID_KINDS,'anchor','ramp'].includes(c.kind)||colliderOf(c).enabled)){
      const p=c.params,state=bodies.get(c.id),fixed=c.fixed||!RIGID_KINDS.includes(c.kind),collider=colliderOf(c);let shape;
      if(c.kind==='anchor'&&!collider.enabled)shape=new CANNON.Particle();
      else if(collider.type==='sphere')shape=new CANNON.Sphere(collider.size[0]/2);
      else if(collider.type==='cylinder')shape=new CANNON.Cylinder(collider.size[0]/2,collider.size[0]/2,collider.size[2],24);
      else shape=new CANNON.Box(new CANNON.Vec3(...collider.size.map(v=>v/2)));
      const body=new CANNON.Body({mass:fixed?0:p.mass,position:new CANNON.Vec3(...state.position),velocity:new CANNON.Vec3(...state.velocity),material:makeMaterial(p.friction??.25,p.restitution??.2),linearDamping:0,angularDamping:0,allowSleep:false});
      const rotation=new CANNON.Quaternion();if(collider.type==='cylinder')rotation.setFromEuler(Math.PI/2,0,0);
      body.addShape(shape,new CANNON.Vec3(...collider.offset),rotation);
      if(!doc.environment.collisions||!collider.enabled)body.collisionFilterMask=0;
      body.quaternion.setFromEuler(...colliderRotation(c));if(!fixed)body.angularVelocity.z=p.spin||0;
      if(doc.mode==='2d'){body.linearFactor.set(1,1,0);body.angularFactor.set(0,0,1);}
      this.world.addBody(body);this.map.set(c.id,body);state.quaternion=body.quaternion.toArray();state.angularVelocity=body.angularVelocity.toArray();
    }
    for(const c of doc.components.filter(c=>c.kind==='rod')){const a=this.map.get(c.refs.a),b=this.map.get(c.refs.b);if(a&&b&&a!==b)this.world.addConstraint(new CANNON.DistanceConstraint(a,b,c.params.restLength,1e6));}
  }
  step(dt,bodies){
    for(const [id,body]of this.map){const b=bodies.get(id);if(!body.mass)continue;body.force.set(...b.force);body.torque.set(...(b.torque||[0,0,0]));}
    this.world.step(dt);
    for(const [id,body]of this.map){const b=bodies.get(id);b.position=body.position.toArray();b.velocity=body.velocity.toArray();b.quaternion=body.quaternion.toArray();b.angularVelocity=body.angularVelocity.toArray();if(this.doc.mode==='2d'){b.position[2]=0;b.velocity[2]=0;body.position.z=0;body.velocity.z=0;}}
  }
  rotationalEnergy(id){const b=this.map.get(id);if(!b?.mass)return 0;const local=new CANNON.Vec3();b.quaternion.conjugate().vmult(b.angularVelocity,local);return .5*(b.inertia.x*local.x**2+b.inertia.y*local.y**2+b.inertia.z*local.z**2);}
}
