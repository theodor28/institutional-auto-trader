/* Original adaptation of an MIT-licensed Three.js sample human mesh.
   Fallback is a sculpted, articulated mesh built in code. No Tony Hawk IP used. */
import {THREE,rig,torso,legs,arms,board} from './world.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
let avatar=null,mixer=null,headBone=null,bones={},fallback=false,ready=false;
let pending=false;
const skin=new THREE.MeshStandardMaterial({color:'#b98668',roughness:.78});
const shirt=new THREE.MeshStandardMaterial({color:'#314c5d',roughness:.85});
const jeans=new THREE.MeshStandardMaterial({color:'#4e5a73',roughness:.92});
const shoes=new THREE.MeshStandardMaterial({color:'#efefe8',roughness:.75});
const hair=new THREE.MeshStandardMaterial({color:'#29282b',roughness:.9});
function tapered(parent,top,bottom,len,material,x,y,z,angle=0){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,len,12),material);
 m.position.set(x,y,z);m.rotation.x=angle;m.castShadow=true;parent.add(m);return m
}
function builtAvatar(){
 const group=new THREE.Group();
 // Skull, jaw, ears, nose, glasses.
 const skull=new THREE.Mesh(new THREE.SphereGeometry(.23,20,16),skin);skull.scale.set(.86,1.12,.80);skull.position.y=1.63;group.add(skull);
 const jaw=new THREE.Mesh(new THREE.SphereGeometry(.17,16,14),skin);jaw.scale.set(1,.73,.78);jaw.position.set(0,1.51,-.027);group.add(jaw);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(.05,.13,9),skin);nose.rotation.x=-Math.PI/2;nose.position.set(0,1.59,-.204);group.add(nose);
 const eye=new THREE.MeshStandardMaterial({color:'#25252b'});
 for(const x of [-.088,.088]){
  const e=new THREE.Mesh(new THREE.SphereGeometry(.020,10,8),eye);e.position.set(x,1.69,-.184);group.add(e);
  const ear=new THREE.Mesh(new THREE.SphereGeometry(.045,10,8),skin);ear.position.set(x<0?-.208:.208,1.60,0);group.add(ear)
 }
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.241,16,12),hair);cap.scale.set(1,.51,1);cap.position.y=1.84;group.add(cap);
 // Neck and fitted hoodie, shaped in several tapered segments.
 tapered(group,.073,.086,.16,skin,0,1.34,0);
 const chest=tapered(group,.30,.25,.62,shirt,0,1.06,0);
 chest.scale.z=.66;
 const hood=new THREE.Mesh(new THREE.TorusGeometry(.16,.065,10,18,Math.PI*1.6),shirt);
 hood.rotation.x=Math.PI/2;hood.position.set(0,1.30,.075);group.add(hood);
 // Waist, trousers and kneecaps, staggered on skateboard.
 tapered(group,.23,.19,.21,shirt,0,.72,0);
 const legRoots=[];
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.14,.68,0);group.add(hip);
  const thigh=tapered(hip,.125,.106,.37,jeans,0,-.175,side*.11,.12*side);
  const knee=new THREE.Group();knee.position.set(0,-.35,side*.115);hip.add(knee);
  tapered(knee,.108,.087,.34,jeans,0,-.16,-.03,-.22);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.22,.125,.39),shoes);
  shoe.position.set(0,-.38,-.14);shoe.castShadow=true;knee.add(shoe);
  legRoots.push({hip,knee,side});
 }
 const armRoots=[];
 for(const side of [-1,1]){
  const sh=new THREE.Group();sh.position.set(side*.33,1.26,0);group.add(sh);
  tapered(sh,.117,.090,.34,shirt,side*.035,-.14,0,side*.2);
  const elbow=new THREE.Group();elbow.position.set(side*.05,-.32,0);sh.add(elbow);
  tapered(elbow,.083,.061,.29,skin,0,-.15,0,.1);
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.068,10,8),skin);hand.position.y=-.29;elbow.add(hand);
  armRoots.push({sh,elbow,side});
 }
 group.userData.parts={legRoots,armRoots};
 return group
}
function hidePlaceholder(){
 torso.visible=false;
 for(const part of legs)part.visible=false;
 for(const part of arms)part.visible=false
}
function attachModel(model,animations=[]){
 if(avatar)rig.remove(avatar);
 avatar=model;rig.add(avatar);hidePlaceholder();ready=true;
 if(animations.length){
  mixer=new THREE.AnimationMixer(avatar);
  const clip=animations.find(a=>a.name.toLowerCase().includes('idle'))||animations[0];
  mixer.clipAction(clip).play()
 }
 bones={};avatar.traverse(o=>{
  if(o.isBone){
   const n=o.name.toLowerCase();
   if(n.includes('leftupleg')||n.includes('leftup_leg'))bones.leftThigh=o;
   if(n.includes('rightupleg')||n.includes('rightup_leg'))bones.rightThigh=o;
   if(n.includes('leftleg')&&!n.includes('upleg'))bones.leftKnee=o;
   if(n.includes('rightleg')&&!n.includes('upleg'))bones.rightKnee=o;
   if(n.includes('leftarm')&&!n.includes('forearm'))bones.leftArm=o;
   if(n.includes('rightarm')&&!n.includes('forearm'))bones.rightArm=o;
   if(n.includes('spine'))bones.spine=o
  }
  if(o.isMesh){
   o.castShadow=true;o.receiveShadow=true;
   if(o.material&&o.material.map)o.material.needsUpdate=true
  }
 });
}
export function loadHumanSkater(){
 if(pending)return;pending=true;
 // Realtime fallback ensures a human silhouette even if asset service is unavailable.
 const fallbackAvatar=builtAvatar();
 fallbackAvatar.position.y=.22;fallbackAvatar.rotation.y=Math.PI/2;
 fallback=true;attachModel(fallbackAvatar);
 const url='https://cdn.jsdelivr.net/gh/mrdoob/three.js@r164/examples/models/gltf/Soldier.glb';
 new GLTFLoader().load(url,gltf=>{
  const model=gltf.scene;
  const bounding=new THREE.Box3().setFromObject(model);
  const size=bounding.getSize(new THREE.Vector3());
  if(!size.y||!isFinite(size.y))return;
  const factor=1.72/size.y;
  model.scale.setScalar(factor);
  model.position.set(0,-bounding.min.y*factor+.23,0);
  model.rotation.y=Math.PI/2;
  model.userData.realHuman=true;
  fallback=false;attachModel(model,gltf.animations||[]);
  document.dispatchEvent(new CustomEvent('steiner-skater-ready',{detail:{human:true}}))
 },undefined,err=>{
  console.warn('Avatar externo indisponível. Personagem original ativado.',err?.message||err);
 })
}
export function humanReady(){return ready}
export function updateHumanSkater(dt,{speed=0,grounded=true,air=false,grinding=false,time=0,lean=0,grab=false}={}){
 if(!ready||!avatar)return;
 if(mixer){
  mixer.update(dt);
  // Idle rig gets an additive stance with flexed knees, asymmetrical legs, arms balancing.
  const bend=grounded?.36:.55;
  if(bones.leftThigh)bones.leftThigh.rotation.x+=-.20-bend*.25;
  if(bones.rightThigh)bones.rightThigh.rotation.x+=.13-bend*.36;
  if(bones.leftKnee)bones.leftKnee.rotation.x+=.26+bend*.62;
  if(bones.rightKnee)bones.rightKnee.rotation.x+=.30+bend*.55;
  if(bones.leftArm)bones.leftArm.rotation.z+=.30+Math.sin(time*2)*.08;
  if(bones.rightArm)bones.rightArm.rotation.z-=.30+Math.sin(time*2)*.08;
  if(bones.spine)bones.spine.rotation.x+=air?-.16:grounded?.12:.22
 }
 if(fallback&&avatar.userData.parts){
  const {legRoots,armRoots}=avatar.userData.parts;
  legRoots.forEach(o=>{
   o.hip.rotation.x=lerp(o.hip.rotation.x,(air?-.30:.3)*o.side,Math.min(1,dt*8));
   o.knee.rotation.x=lerp(o.knee.rotation.x,air?.48:.42,Math.min(1,dt*7))
  });
  armRoots.forEach(o=>{
   o.sh.rotation.z=lerp(o.sh.rotation.z,(-.48+Math.sin(time*2+o.side)*.12)*o.side,Math.min(1,dt*8));
   o.elbow.rotation.x=lerp(o.elbow.rotation.x,grab?.9:.12,Math.min(1,dt*10))
  })
 }
 avatar.position.y+=(Math.sin(time*13)*.012*(grounded?Math.min(1,Math.abs(speed)/15):0)-avatar.position.y*.0)*Math.min(1,dt*6);
 avatar.rotation.z=lerp(avatar.rotation.z,-lean*.38,Math.min(1,dt*7));
 avatar.rotation.x=lerp(avatar.rotation.x,air?-.13:grinding?-.2:.04,Math.min(1,dt*7));
}
