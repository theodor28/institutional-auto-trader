import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';
/* STEINER SKATE 3D — Original park, materials and character geometry. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const scene=new THREE.Scene();scene.background=new THREE.Color('#b0d0d9');
scene.fog=new THREE.FogExp2('#a0b8c5',.0044);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,600);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
document.getElementById('viewport').append(renderer.domElement);
const sky=new THREE.HemisphereLight('#ebf6ff','#648a73',1.9);scene.add(sky);
const sun=new THREE.DirectionalLight('#ffe2bb',3.2);sun.position.set(-93,135,41);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-105;sun.shadow.camera.right=105;sun.shadow.camera.top=105;sun.shadow.camera.bottom=-105;
sun.shadow.normalBias=.025;scene.add(sun);
const mat=(color,rough=.8,metal=0)=>new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
const M={
 concrete:mat('#c8d4d5'),cement:mat('#92a6b0'),dark:mat('#223244'),asphalt:mat('#455968'),
 steel:mat('#7d9ba5',.3,.7),lime:mat('#d1fa7b'),orange:mat('#ef9571'),
 blue:mat('#76c7d5'),green:mat('#4d9069'),wood:mat('#8d634a'),hood:mat('#b9d1e2'),pants:mat('#44516d')
};
const boxGeo=new THREE.BoxGeometry(1,1,1),ballGeo=new THREE.SphereGeometry(1,14,10);
function box(x,y,z,w,h,d,m,parent=scene){
 const mesh=new THREE.Mesh(boxGeo,m);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh
}
function ball(x,y,z,r,m,parent=scene){
 const mesh=new THREE.Mesh(ballGeo,m);mesh.scale.setScalar(r);mesh.position.set(x,y,z);
 mesh.castShadow=true;parent.add(mesh);return mesh
}
function floor(x,z,w,d,y,m){
 const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m);o.rotation.x=-Math.PI/2;
 o.position.set(x,y,z);o.receiveShadow=true;scene.add(o);return o
}
function makeTexture(w,h,fn){
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 fn(cv.getContext('2d'),w,h);
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t
}
const concrete=makeTexture(512,512,(g,w,h)=>{
 g.fillStyle='#adbbbe';g.fillRect(0,0,w,h);
 let s=333;const rng=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
 for(let i=0;i<2300;i++){g.fillStyle='rgba(22,44,51,'+(.02+rng()*.09)+')';g.fillRect(rng()*w,rng()*h,1+rng()*5,1+rng()*5)}
 g.lineWidth=2;g.strokeStyle='#8699a1';
 for(let k=0;k<512;k+=128){
  g.beginPath();g.moveTo(k,0);g.lineTo(k,512);g.stroke();
  g.beginPath();g.moveTo(0,k);g.lineTo(512,k);g.stroke()
 }
});concrete.wrapS=concrete.wrapT=THREE.RepeatWrapping;concrete.repeat.set(13,12);
floor(0,0,185,165,-.04,new THREE.MeshStandardMaterial({map:concrete,roughness:.95}));
floor(0,0,225,205,-.09,M.asphalt);
for(const x of [-89,89])box(x,.01,0,.22,.045,155,M.concrete);
for(const z of [-78,78])box(0,.01,z,178,.045,.22,M.concrete);
// Procedural city skyline (texture atlas on cube sides).
const windows=makeTexture(256,512,(g,w,h)=>{
 g.fillStyle='#4b6377';g.fillRect(0,0,w,h);
 for(let y=20;y<500;y+=43)for(let x=15;x<255;x+=38){
  const lit=(x*13+y*17)%13<6;
  g.fillStyle=lit?'#e9d7b0':'#84a6bd';g.fillRect(x,y,24,25);
  g.fillStyle=lit?'#cfa270':'#456479';g.fillRect(x+5,y+4,10,17)
 }
});
const skylineMat=new THREE.MeshStandardMaterial({map:windows,roughness:.8});
for(let i=0;i<58;i++){
 const a=i*Math.PI*2/58,r=119+i%6*5;
 const x=Math.cos(a)*r,z=Math.sin(a)*r,h=13+(i*47)%49,w=9+(i*11)%12;
 box(x,h/2,z,w,h,w,skylineMat);box(x,h+.2,z,w+.4,.4,w+.4,M.dark)
}
function sign(str,x,y,z,w=49,h=8,rotation=0){
 const tx=makeTexture(1024,256,(g,W,H)=>{
  g.fillStyle='#14283d';g.fillRect(0,0,W,H);g.fillStyle='#275163';
  for(let i=0;i<70;i++)g.fillRect(i*61%W,i*31%H,18,8);
  g.lineWidth=14;g.strokeStyle='#60b09d';g.strokeRect(7,7,W-14,H-14);
  g.fillStyle='#d2ff7b';g.font='italic 900 128px Impact,Arial Black';g.textAlign='center';g.textBaseline='middle';
  g.fillText(str,W/2,H/2,W-40)
 });
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide}));
 m.position.set(x,y,z);m.rotation.y=rotation;scene.add(m)
}
box(0,5.4,-70,68,11,.9,M.dark);sign('STEINER SKATE',0,6,-69.5,62,9);
sign('CONCRETE CITY',17,7,72,35,6,Math.PI);
for(let i=0;i<26;i++){
 const x=-80+(i%13)*13,z=i<13?-65:65;
 const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(.68+(i%3)*.12);scene.add(g);
 box(0,2,0,.6,4,.6,M.wood,g);
 ball(0,5,0,2.4,M.green,g);ball(1.2,5.9,.6,2.0,mat('#63ac74'),g);ball(-.9,6,-.5,1.7,mat('#3d765e'),g)
}
for(const [x,z] of [[-77,-50],[-74,50],[75,-50],[74,53]]){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 box(0,4,0,.15,8,.15,M.steel,g);box(.7,8,0,2,.2,.7,M.dark,g);
 ball(.7,7.8,0,.35,M.lime,g)
}
for(const [x,z] of [[-65,40],[66,58]]){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 box(0,1,0,4,.2,1,M.wood,g);box(0,1.65,.47,4,1.25,.25,M.wood,g);
 for(const a of [-1.5,1.5])box(a,.5,0,.13,1,.9,M.steel,g)
}
// Heights used for graphics and skate wheel contact.
function terrain(x,z){
 let y=0;
 if(Math.abs(x+38)<22&&Math.abs(z+32)<12){
  const u=Math.max(0,Math.abs(x+38)-7);
  y=Math.max(y,Math.min(5.0,.035*u*u)*(1-smooth(10,12,Math.abs(z+32))))
 }
 const q=Math.max(Math.abs(x-5)/14,Math.abs(z-9)/12);
 if(q<1)y=Math.max(y,2.7*(1-q));
 const r=Math.hypot(x-45,z-36);
 if(r<20)y=Math.max(y,r<8?0:r<=16?2.5*smooth(8,16,r):2.5*(1-smooth(16,20,r)));
 if(Math.abs(x-42)<15&&z>-55&&z<-32){
  const v=-z-32;
  y=Math.max(y,3.85*smooth(0,18,Math.min(v,18))*(v>18?1-smooth(18,23,v):1)*
   (1-smooth(13,15,Math.abs(x-42))))
 }
 return y
}
function geomSurface(x0,x1,z0,z1,nx,nz,material){
 const positions=[],uv=[],indices=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=lerp(x0,x1,i/nx),z=lerp(z0,z1,j/nz);
  positions.push(x,terrain(x,z)+.034,z);uv.push(i/nx,j/nz)
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
  indices.push(a,c,b,b,c,d)
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
 const surface=material.clone();surface.side=THREE.DoubleSide;
 const o=new THREE.Mesh(geo,surface);o.castShadow=true;o.receiveShadow=true;scene.add(o)
}
geomSurface(-60,-16,-44,-20,42,24,M.concrete);
geomSurface(-9,19,-3,21,26,22,M.concrete);
geomSurface(25,65,16,56,48,48,M.concrete);
geomSurface(27,57,-55,-31,26,22,M.cement);
for(const x of [-59,-17])box(x,5.09,-32,.18,.18,23,M.steel);
const bowlLip=new THREE.Mesh(new THREE.TorusGeometry(16,.09,9,84),M.steel);
bowlLip.rotation.x=Math.PI/2;bowlLip.position.set(45,2.58,36);scene.add(bowlLip);
for(let i=0;i<6;i++){
 const h=(6-i)*.26;
 box(-43+i*1.65,h/2,48+i*2.45,12,h,2.7,M.cement);
 box(-43+i*1.65,h+.025,48+i*2.45,12,.05,2.7,M.concrete)
}
for(const [x,z,w,d,h] of [[-58,6,14,4,1.1],[59,-6,12,5,1],[-7,53,9,8,1.35]]){
 box(x,h/2,z,w,h,d,M.cement);box(x,h+.04,z,w+.1,.09,d+.1,M.concrete)
}
// Real gameplay grind rails (axis determines traversal).
const rails=[{x:-13,z:8,axis:'z',len:25,y:1.25},
 {x:-27,z:28,axis:'x',len:24,y:1.42},{x:9,z:50,axis:'x',len:28,y:1.32},
 {x:53,z:-5,axis:'z',len:22,y:1.64}];
for(const r of rails){
 const g=new THREE.Group();g.position.set(r.x,0,r.z);
 if(r.axis==='z')g.rotation.y=Math.PI/2;
 scene.add(g);
 box(0,r.y,0,r.len,.16,.14,M.steel,g);
 for(const a of [-r.len*.38,0,r.len*.38]){
  box(a,r.y/2,0,.14,r.y,.14,M.steel,g);box(a,.08,0,.55,.15,.50,M.steel,g)
 }
}
for(let i=0;i<8;i++){
 const x=i<4?-74+i*9:48+(i-4)*8,z=i<4?-10:13;
 const geo=new THREE.CylinderGeometry(.57,.62,1,16);
 const o=new THREE.Mesh(geo,i%2?M.orange:M.blue);o.position.set(x,.5,z);o.castShadow=true;scene.add(o)
}
const letters=[];
for(const [chr,x,y,z] of [
 ['S',13,3.1,-2],['K',-38,6.2,-32],['A',45,4.4,36],['T',-26,3.3,28],['E',42,5.35,-47]]){
 const texture=makeTexture(256,256,(g,w,h)=>{
  g.clearRect(0,0,w,h);g.fillStyle='#d7ff7f';g.strokeStyle='#1a3837';g.lineWidth=15;
  g.shadowColor='#a6ffb3';g.shadowBlur=18;g.textAlign='center';g.textBaseline='middle';
  g.font='900 180px Impact,Arial Black';g.strokeText(chr,128,142);g.fillText(chr,128,142)
 });
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
 sprite.position.set(x,y,z);sprite.scale.set(3.2,3.2,1);scene.add(sprite);
 letters.push({chr,x,y,z,sprite,found:false})
}
// Skater / animated rig and board.
const skater=new THREE.Group();scene.add(skater);
const rig=new THREE.Group();skater.add(rig);
const board=new THREE.Group();rig.add(board);
box(0,.17,0,.72,.11,1.72,M.orange,board);
box(0,.24,0,.66,.028,1.63,M.dark,board);
for(const z of [-.74,.74]){
 const round=ball(0,.17,z,.31,M.orange,board);round.scale.set(1,.18,.42)
}
for(const z of [-.53,.53]){
 box(0,.035,z,.52,.08,.16,M.steel,board);
 for(const x of [-.38,.38]){
  const wh=new THREE.Mesh(new THREE.CylinderGeometry(.145,.145,.13,14),M.concrete);
  wh.rotation.z=Math.PI/2;wh.position.set(x,-.075,z);board.add(wh)
 }
}
const torso=new THREE.Group();torso.position.y=1.3;rig.add(torso);
box(0,.23,0,.76,1.05,.52,M.hood,torso);
box(0,.25,-.272,.58,.15,.03,M.orange,torso);
const skin=mat('#c48c6f'),hair=mat('#2a2830');
ball(0,1.03,-.02,.32,skin,torso);
const hat=ball(0,1.30,.03,.33,hair,torso);hat.scale.y=.35;
for(const x of [-.13,.13])ball(x,1.045,-.294,.033,M.dark,torso);
const legs=[],arms=[];
for(const side of [-1,1]){
 const leg=new THREE.Group();leg.position.set(side*.22,1,0);rig.add(leg);
 box(0,-.38,.02,.32,.79,.35,M.pants,leg);
 box(0,-.8,-.1,.38,.23,.62,M.concrete,leg);legs.push(leg);
 const arm=new THREE.Group();arm.position.set(side*.54,.6,0);torso.add(arm);
 box(0,-.35,.03,.27,.72,.3,M.hood,arm);arms.push(arm)
}
const shadowTex=makeTexture(128,128,(g,w,h)=>{
 const v=g.createRadialGradient(64,64,0,64,64,62);v.addColorStop(0,'#13242f93');v.addColorStop(1,'#13242f00');g.fillStyle=v;g.fillRect(0,0,w,h)
});
const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.6,3.8),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
shadow.rotation.x=-Math.PI/2;scene.add(shadow);
export {THREE,scene,camera,renderer,M,terrain,rails,letters,skater,rig,board,torso,legs,arms,shadow,clamp,lerp,box,ball};
