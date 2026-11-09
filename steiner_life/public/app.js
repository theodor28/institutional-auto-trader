/* STEINER LIFE — original social 3D world client. Three.js for rendering. */
const $=id=>document.getElementById(id);
const tips=[
 'Caminhe pela praça e converse com jogadores reais.',
 'Na praia, o sol se põe sobre a água.',
 'Entre na floresta e descubra jardins e esculturas.',
 'A cidade fica iluminada ao anoitecer.',
 'Construa sua casa na Vila e mostre aos visitantes.'
];
let THREE;
try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js')}
catch(e){$('loadingMessage').textContent='Não foi possível carregar o motor 3D. Verifique a conexão e atualize a página.';throw e}
const scene=new THREE.Scene(),clock=new THREE.Clock();
scene.background=new THREE.Color('#8ec9ef');scene.fog=new THREE.FogExp2('#8ec9ef',0.0035);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.07,700);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.14;
$('scene').append(renderer.domElement);
const hemi=new THREE.HemisphereLight('#e7f6ff','#698c5c',2.05);scene.add(hemi);
const sun=new THREE.DirectionalLight('#ffedc7',2.6);sun.position.set(-95,138,80);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-150;sun.shadow.camera.right=150;sun.shadow.camera.top=150;sun.shadow.camera.bottom=-150;
sun.shadow.normalBias=.03;scene.add(sun);
const ambient=new THREE.AmbientLight('#b8d5ff',.34);scene.add(ambient);
const MAT=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const grass=MAT('#5a9f68'),sand=MAT('#e7c997'),asphalt=MAT('#424b60'),stone=MAT('#9eafbd'),white=MAT('#ecf4fa'),trunk=MAT('#71513b'),leaves=[MAT('#3a8651'),MAT('#478f55'),MAT('#4da864'),MAT('#2e764d')],glass=MAT('#7cd2ea',.21,.3);
const walls=[MAT('#f1d2bf'),MAT('#e3ecfa'),MAT('#f9e6c6'),MAT('#b9d4d5'),MAT('#efc3db')];
const ballGeo=new THREE.SphereGeometry(1,14,10),boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,14);
function box(w,h,d,mat,x=0,y=0,z=0,parent=scene,shadow=true){
 const mesh=new THREE.Mesh(boxGeo,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=shadow;mesh.receiveShadow=shadow;parent.add(mesh);return mesh
}
function sphere(r,mat,x=0,y=0,z=0,parent=scene,shadow=false){let m=new THREE.Mesh(ballGeo,mat);m.scale.setScalar(r);m.position.set(x,y,z);m.castShadow=shadow;parent.add(m);return m}
function cylinder(rt,rb,h,mat,x=0,y=0,z=0,parent=scene,shadow=true){
 const m=new THREE.Mesh(cylGeo,mat);m.scale.set(rt,h,rb);m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=shadow;parent.add(m);return m
}
function plane(w,d,mat,x=0,z=0,height=.02){
 const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.x=-Math.PI/2;m.position.set(x,height,z);m.receiveShadow=true;scene.add(m);return m
}
const world=new THREE.Group();scene.add(world);
const ground=plane(430,430,grass,0,0,-.08);
plane(34,355,asphalt,0,0,-.045);plane(355,34,asphalt,0,0,-.04);
for(let i=-167;i<=167;i+=12){box(.18,.02,5,white,-7.4,.01,i,scene,false);box(.18,.02,5,white,7.4,.01,i,scene,false)}
for(let i=-167;i<=167;i+=12){box(5,.02,.18,white,i,.013,-7.4,scene,false);box(5,.02,.18,white,i,.013,7.4,scene,false)}
const plaza=new THREE.Mesh(new THREE.CylinderGeometry(31,31,.35,64),stone);plaza.position.y=.07;plaza.receiveShadow=true;scene.add(plaza);
const ring=new THREE.Mesh(new THREE.TorusGeometry(13,.65,10,64),white);ring.rotation.x=-Math.PI/2;ring.position.y=.40;scene.add(ring);
const fountainBase=cylinder(5.5,5.6,1,stone,0,1,0);
cylinder(3.6,3.9,.12,glass,0,1.53,0);
cylinder(.55,.7,3.0,white,0,2.65,0);
sphere(1.08,glass,0,4.1,0);
for(let a=0;a<12;a++){let theta=a*Math.PI/6;const x=3*Math.sin(theta),z=3*Math.cos(theta);
 const drop=sphere(.17,glass,x,2.3+Math.sin(a*.6)*.7,z);drop.userData.spray=true}
function sign(label,x,z,color='#132f52'){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,128);
 ctx.strokeStyle='#a5e1ff';ctx.lineWidth=7;ctx.strokeRect(6,6,500,116);
 ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 43px system-ui';ctx.fillText(label,256,65);
 const texture=new THREE.CanvasTexture(canvas),mesh=new THREE.Mesh(new THREE.PlaneGeometry(12,3),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide}));
 mesh.position.set(x,5.5,z);mesh.rotation.y=Math.atan2(x,z);scene.add(mesh);
 return mesh
}
function tree(x,z,scale=1,parent=scene){
 const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(scale);parent.add(group);
 cylinder(.42,.65,4.3,trunk,0,2.18,0,group);
 for(let i=0;i<3;i++)sphere(2.1-i*.23,leaves[(Math.abs(Math.round(x*1.3+z*.4))+i)%leaves.length],(i-1)*.62,5.2+i*.75,(i-1)*.42,group,true);
 return group
}
function lamp(x,z){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 cylinder(.14,.23,5,asphalt,0,2.5,0,g);
 sphere(.38,white,0,5.2,0,g);const point=new THREE.PointLight('#ffd9ab',0,12,2);point.position.set(0,5.3,0);g.add(point);point.userData.night=true;
 g.userData.light=point;lamps.push(point);return g
}
const lamps=[];
function bench(x,z,rot=0){
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;scene.add(g);
 box(3,.23,1, MAT('#855e4c'),0,.82,0,g);box(3,.9,.2, MAT('#855e4c'),0,1.34,.42,g);
 for(const xx of [-1.1,1.1]){box(.18,.78,.75,asphalt,xx,.45,0,g)}
 return g
}
function building(x,z,w=14,d=12,h=10,tint=0,shop=''){
 const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 box(w,h,d,walls[tint%walls.length],0,h/2,0,g);
 box(w+1,.7,d+1,MAT('#384960'),0,h+.3,0,g);
 box(w*.9,.4,1,MAT('#d4ab9f'),0,3.35,d/2+.5,g);
 const frontWindow=MAT('#78aac0',.2,.15);
 for(const xx of [-w*.28,w*.28]){
  for(let floor=1;floor<Math.max(2,h/5);floor++){
   box(w*.22,1.7,.12,frontWindow,xx,floor*3.8+1,d/2+.075,g,false)
  }
 }
 box(2.6,4,.12,MAT('#5e7d90'),0,2,d/2+.09,g);
 if(shop){
  const cc=document.createElement('canvas');cc.width=512;cc.height=100;
  const ctx=cc.getContext('2d');ctx.fillStyle='#182b49';ctx.fillRect(0,0,512,100);
  ctx.fillStyle='#b1efff';ctx.textAlign='center';ctx.font='bold 43px sans-serif';ctx.fillText(shop,256,67);
  const signMesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w*.8,10),1.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cc)}));
  signMesh.position.set(0,5.2,d/2+.16);g.add(signMesh)
 }
 return g
}
for(let i=0;i<90;i++){
 const a=i*2.399, r=41+(i*13%138),x=Math.cos(a)*r,z=Math.sin(a)*r;
 if(Math.abs(x)<22||Math.abs(z)<22)continue;
 if(Math.hypot(x+100,z+80)<56||Math.hypot(x-100,z+90)<40||Math.hypot(x-112,z-87)<48||Math.hypot(x+90,z-92)<48)continue;
 tree(x,z,.65+(i%5)*.18)
}
for(const [x,z] of [[25,25],[-25,25],[25,-25],[-25,-25],[27,0],[-27,0],[0,-27],[0,27]]){if(Math.abs(x)>26||Math.abs(z)>26)lamp(x,z)}
bench(20,13,-.4);bench(-20,-13,2.7);bench(13,-20,-.7);bench(-13,20,.8);
for(const [x,z] of [[35,43],[-40,-38],[40,-42],[-43,40],[73,24],[-75,-24]])building(x,z,12+(Math.abs(x)%5),11,9+(Math.abs(z)%6),Math.abs(x+z)%5);
sign('PRAÇA CENTRAL',0,-28);
// BEACH
plane(105,92,sand,-103,-85,-.026);
const water=new THREE.Mesh(new THREE.PlaneGeometry(110,38),new THREE.MeshPhysicalMaterial({color:'#2baec9',roughness:.18,metalness:.22,transparent:true,opacity:.88,side:THREE.DoubleSide}));
water.rotation.x=-Math.PI/2;water.position.set(-102,.02,-131);scene.add(water);
for(let i=0;i<14;i++){const x=-143+(i*13)%90,z=-103+(i*29)%61;
 tree(x,z,.6+(i%3)*.1);const g=tree(x+2,z+3,.65);g.rotation.z=.16}
for(let i=0;i<6;i++){const x=-144+i*16,z=-85+(i%2)*9;const chair=bench(x,z,1.7);chair.scale.set(.75,.75,.75)}
sign('PRAIA SOLAR',-103,-48);
// FOREST
for(let i=0;i<57;i++){const angle=i*2.39,rad=6+(i*19%57);tree(89+Math.cos(angle)*rad,-93+Math.sin(angle)*rad,.9+(i%5)*.17)}
sign('FLORESTA',84,-53);
for(const [x,z] of [[88,-90],[103,-78],[78,-111]])bench(x,z,.4);
// CLUB
plane(72,72,MAT('#59475f'),109,92,-.025);const club=building(111,94,26,21,14,3,'LIFE CLUB');
for(let i=0;i<14;i++){const x=94+Math.sin(i*1.77)*22,z=80+Math.cos(i*1.77)*21;
 const light=new THREE.PointLight(['#ff49d7','#44bafa','#ffed80'][i%3],1.2,20,2);light.position.set(x,4,z);scene.add(light)}
sign('LIFE CLUB',108,64);
// VILLAGE
for(let i=0;i<11;i++){const angle=i*Math.PI*2/11;const x=-88+Math.sin(angle)*34,z=94+Math.cos(angle)*34;
 building(x,z,9,10,7,i%5)}
sign('VILA DOS SONHOS',-92,53);
// low distant decorative peaks
for(let i=0;i<19;i++){
 const a=i*Math.PI*2/19,x=Math.sin(a)*211,z=Math.cos(a)*211;
 let m=new THREE.Mesh(new THREE.ConeGeometry(19+(i%3)*10,24+(i%4)*9,5),MAT(i%3===0?'#74877e':'#718c8c'));
 m.position.set(x,7,z);m.rotation.y=a;scene.add(m)
}
const clouds=[];
for(let i=0;i<13;i++){
 const g=new THREE.Group();g.position.set(-130+i*22,28+(i%5)*5,-110+(i*53%240));
 for(let k=0;k<4;k++)sphere(4+(k%2),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.67}),k*3,Math.sin(k)*1.6,0,g);
 scene.add(g);clouds.push(g)
}
function nameSprite(text){
 const cv=document.createElement('canvas');cv.width=384;cv.height=96;const ctx=cv.getContext('2d');
 ctx.fillStyle='#0a1c32cf';ctx.roundRect(4,4,376,88,24);ctx.fill();
 ctx.font='bold 34px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f2faff';
 ctx.fillText(text.slice(0,20),192,50,344);
 const tex=new THREE.CanvasTexture(cv),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
 sprite.scale.set(3.8,.95,1);sprite.position.y=3.7;return sprite
}
function avatar(name,color='#61c6f7',hair=0,outfit=0){
 const g=new THREE.Group();g.userData={limbs:[],emote:'none'};
 let top=MAT(color,.66),skin=MAT('#edbe9c'),dark=MAT('#1b2d44'),hairMat=MAT(['#342b31','#151c30','#80604e','#c09b72','#212124','#675238'][hair%6]||'#342b31');
 const body=box(.91,1.28,.5,top,0,1.7,0,g);
 if(outfit===2){box(.78,.24,.56,white,0,2.18,.02,g);box(.15,1.04,.08,MAT('#e0bd6c'),0,1.53,-.31,g)}
 if(outfit===3){box(.9,.21,.54,MAT('#c6f0ff'),0,2.29,0,g)}
 if(outfit===4){box(.9,.2,.56,MAT('#c3e1f6'),0,1.73,-.3,g);box(.2,1,.08,MAT('#70ffce'),0,1.65,-.34,g)}
 sphere(.44,skin,0,2.66,0,g,true);
 // face oriented toward -Z
 for(let x of [-.15,.15])sphere(.042,dark,x,2.7,-.401,g);
 let mouth=box(.17,.035,.02,MAT('#a35b62'),0,2.48,-.422,g,false);
 if(hair!==4){
  const cap=sphere(.46,hairMat,0,2.98,.025,g,true);cap.scale.set(1,.38,1);
  if(hair===1){for(let x of [-.31,.31])box(.21,.62,.23,hairMat,x,2.58,.12,g)}
  if(hair===2){for(let j=0;j<10;j++)sphere(.16,hairMat,Math.sin(j*.628)*.35,3.03,Math.cos(j*.628)*.31,g)}
  if(hair===5){box(.3,.31,.44,hairMat,0,3.15,-.16,g)}
 }
 for(let s of [-1,1]){
  const arm=new THREE.Group();arm.position.set(s*.62,2.15,0);g.add(arm);
  box(.27,.97,.34,top,0,-.45,0,arm);sphere(.17,skin,0,-.95,0,arm);g.userData.limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(s*.24,1.1,0);g.add(leg);
  box(.34,.98,.42,outfit===1?MAT('#26364e'):MAT('#344356'),0,-.48,0,leg);
  box(.37,.20,.68,MAT('#f4f4f5'),0,-1.0,-.1,leg);
  g.userData.limbs.push(leg)
 }
 const tag=nameSprite(name);g.add(tag);
 g.userData.label=tag;return g
}
const me={name:'',id:null,color:'#61c6f7',hair:0,outfit:0,model:null,coins:120,x:0,y:0,z:6,yaw:0,jumpV:0,vy:0,moveTick:0,anim:0,emote:'none'};
const others=new Map(),objects=new Map(),npc=[];
const places={plaza:{x:0,z:6,label:'Praça Central',desc:'Ponto de encontro do mundo'},beach:{x:-100,z:-80,label:'Praia Solar',desc:'Sol, mar e novas amizades'},forest:{x:87,z:-94,label:'Floresta Encantada',desc:'Natureza e caminhos secretos'},club:{x:112,z:87,label:'Life Club',desc:'Música e dança sob as estrelas'},homes:{x:-91,z:91,label:'Vila dos Sonhos',desc:'Encontre casas e construa a sua'}};
function setZone(){
 let nearest='plaza',distance=1e6;
 for(const [k,v] of Object.entries(places)){
  const d=Math.hypot(me.x-v.x,me.z-v.z);if(d<distance){nearest=k;distance=d}
 }
 if(me.zone!==nearest){
  me.zone=nearest;$('zoneName').textContent=places[nearest].label;$('zoneDesc').textContent=places[nearest].desc;
  $('profileLoc').textContent=places[nearest].label;
  document.querySelectorAll('[data-place]').forEach(b=>b.classList.toggle('active',b.dataset.place===nearest))
 }
}
const npcSpots=[[-12,8,'Lia (NPC)','#ff96ce'],[13,14,'Kai (NPC)','#8ee4c0'],[4,-15,'Noah (NPC)','#ebbb7c'],[-99,-72,'Lua (NPC)','#a9d6fc'],[95,-95,'Nina (NPC)','#beabff'],[108,83,'DJ Pixel (NPC)','#f8ba7d'],[-88,96,'Alex (NPC)','#a5e1b5']];
for(let i=0;i<npcSpots.length;i++){
 const [x,z,n,col]=npcSpots[i],m=avatar(n,col,i%6,i%5);m.position.set(x,0,z);scene.add(m);
 npc.push({model:m,x,z,angle:i*2.3,time:i*.72})
}
function addObject(o){
 if(!o||objects.has(o.id))return;
 const g=new THREE.Group();g.position.set(o.x,0,o.z);g.rotation.y=o.rotation||0;scene.add(g);
 if(o.type==='tree'){tree(0,0,1.25,g)}
 else if(o.type==='house'){
  box(8,5,7,MAT('#efd9c2'),0,2.5,0,g);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(6,3,4),MAT('#b46c59'));roof.position.y=6.0;roof.rotation.y=Math.PI/4;g.add(roof);
  box(1.7,3,.15,MAT('#6e87a5'),0,1.5,-3.58,g);
  for(const x of [-2.4,2.4])box(1.5,1.5,.15,glass,x,3.1,-3.61,g,false)
 }else if(o.type==='bench'){
  box(3,.23,.9,MAT('#ad8566'),0,.9,0,g);box(3,.94,.20,MAT('#ad8566'),0,1.38,.43,g);
  for(const x of [-1,1])box(.15,.72,.7,MAT('#455565'),x,.4,0,g)
 }else if(o.type==='lamp'){cylinder(.13,.2,5,asphalt,0,2.5,0,g);sphere(.42,white,0,5.2,0,g)}
 else if(o.type==='garden'){for(let i=0;i<12;i++){
  const a=i*1.73,r=.7+(i%4)*.7,x=Math.cos(a)*r,z=Math.sin(a)*r;
  cylinder(.05,.08,.45,MAT('#3c9a57'),x,.3,z,g);
  sphere(.22,MAT(['#f4759f','#f8c85d','#b29cff','#feeeee'][i%4]),x,.65,z,g)
 }}
 else {cylinder(1.2,1.5,.7,stone,0,.35,0,g);
  const art=new THREE.Mesh(new THREE.TorusKnotGeometry(1.2,.28,84,9),new THREE.MeshStandardMaterial({color:'#74e5e2',metalness:.85,roughness:.18}));
  art.position.y=3;g.add(art);g.userData.rotateArt=art}
 objects.set(o.id,g)
}
const coins=[];
let saved=120;try{saved=Number(localStorage.getItem('steiner-life-coins')||120)}catch(e){}
me.coins=Math.max(0,Math.min(100000,Number.isFinite(saved)?saved:120));$('coinCount').textContent=me.coins;
for(let i=0;i<36;i++){
 const a=i*2.399,r=38+(i*7%115),x=Math.cos(a)*r,z=Math.sin(a)*r;
 const shape=new THREE.Mesh(new THREE.OctahedronGeometry(.55),new THREE.MeshStandardMaterial({color:'#fdd66b',emissive:'#bb8609',emissiveIntensity:.5,metalness:.7,roughness:.12}));
 shape.position.set(x,1.3,z);shape.userData={phase:i*.9,hidden:false};scene.add(shape);coins.push(shape)
}
function cash(n){me.coins+=n;$('coinCount').textContent=me.coins;try{localStorage.setItem('steiner-life-coins',String(me.coins))}catch(e){}}
const keys={forward:false,back:false,left:false,right:false,run:false},held={};
function localAvatar(){if(me.model)scene.remove(me.model);me.model=avatar(me.name,me.color,me.hair,me.outfit);me.model.position.set(me.x,0,me.z);scene.add(me.model);
 $('profileName').textContent=me.name;$('profileColor').style.background=me.color}
const chat=$('messages');
function message(name,text,type='public',id=null){
 const line=document.createElement('div');line.className='chat-line '+(type==='dm'?'dm':id===me.id?'me':'');
 const b=document.createElement('b');b.textContent=name+': ';line.append(b);
 const span=document.createElement('span');span.textContent=text;line.append(span);
 chat.append(line);
 while(chat.children.length>95)chat.firstElementChild.remove();
 chat.scrollTop=chat.scrollHeight
}
function toast(text){const elem=document.createElement('div');elem.className='toast';elem.textContent=text;$('toasts').append(elem);setTimeout(()=>elem.remove(),3900)}
let socket=null,reconnect=null,joined=false;
function transmit(data){if(socket?.readyState===1){try{socket.send(JSON.stringify(data))}catch(e){}}}
function connect(){
 if(socket&&(socket.readyState===0||socket.readyState===1))return;
 const proto=location.protocol==='https:'?'wss:':'ws:';
 socket=new WebSocket(proto+'//'+location.host+'/live');
 $('connection').classList.remove('connected');$('connection').innerHTML='<i></i> Conectando';
 socket.onopen=()=>{transmit({type:'join',name:me.name,color:me.color,hair:me.hair,outfit:me.outfit});};
 socket.onmessage=e=>{
  let packet;try{packet=JSON.parse(e.data)}catch(err){return}
  if(packet.type==='welcome'){
   me.id=packet.id;joined=true;others.forEach(o=>scene.remove(o.model));others.clear();
   for(const p of packet.users||[])addPlayer(p);
   for(const o of packet.objects||[])addObject(o);
   $('connection').classList.add('connected');$('connection').innerHTML='<i></i> Online';
   updatePeople();toast('Você entrou no mundo com '+packet.online+' jogador(es).');
  }else if(packet.type==='join'){addPlayer(packet.player);updatePeople();toast(packet.player.name+' entrou no mundo!')}
  else if(packet.type==='leave'){const o=others.get(packet.id);if(o)scene.remove(o.model);others.delete(packet.id);updatePeople()}
  else if(packet.type==='move'){const p=others.get(packet.id);if(p){p.target.set(packet.x,packet.y,packet.z);p.heading=packet.heading}}
  else if(packet.type==='chat'){message(packet.name,packet.message,'public',packet.id);
   const o=others.get(packet.id);if(o){o.chat=packet.message;o.chatUntil=performance.now()+3800}
  }else if(packet.type==='dm'){message(packet.own?'Para jogador (privado)':packet.name+' (privado)',packet.message,'dm')}
  else if(packet.type==='emote'){const o=others.get(packet.id);if(o){o.emote=packet.emote;o.emoteUntil=performance.now()+4500}}
  else if(packet.type==='build'){addObject(packet.object);toast('Uma construção apareceu no mundo!')}
  else if(packet.type==='teleport'){me.x=packet.x;me.y=packet.y;me.z=packet.z;me.jumpV=0;me.model?.position.set(me.x,0,me.z);setZone()}
  else if(packet.type==='error')toast(packet.message)
 };
 socket.onerror=()=>{};
 socket.onclose=()=>{joined=false;$('connection').classList.remove('connected');$('connection').innerHTML='<i></i> Reconectando';
  clearTimeout(reconnect);reconnect=setTimeout(()=>{if(me.name)connect()},3200);
 };
}
function addPlayer(p){
 if(!p||p.id===me.id||others.has(p.id))return;
 const model=avatar(p.name,p.color,p.hair||0,p.outfit||0);model.position.set(p.x,p.y,p.z);scene.add(model);
 others.set(p.id,{id:p.id,name:p.name,color:p.color,model,target:new THREE.Vector3(p.x,p.y,p.z),heading:p.heading||0,emote:'',chat:'',chatUntil:0,emoteUntil:0,moveTime:0});
}
function updatePeople(){
 $('onlineCount').textContent=others.size+1;
 $('people').replaceChildren();
 for(const p of others.values()){
  const btn=document.createElement('button');btn.className='person';btn.dataset.person=p.id;
  const dot=document.createElement('span');dot.className='avatar-dot';dot.style.background=p.color;
  const name=document.createElement('span');name.textContent=p.name;
  btn.append(dot,name);$('people').append(btn)
 }
 if(!others.size){const e=document.createElement('div');e.className='hint';e.textContent='Você é o primeiro! Compartilhe o link para encontrar amigos.';$('people').append(e)}
}
let dmPerson=null;
$('people').addEventListener('click',e=>{const btn=e.target.closest('[data-person]');if(!btn)return;dmPerson=others.get(btn.dataset.person);if(dmPerson){$('dmName').textContent='Mensagem para '+dmPerson.name;$('dmModal').classList.remove('hidden');$('dmInput').focus()}});
$('dmForm').addEventListener('submit',e=>{e.preventDefault();const txt=$('dmInput').value.trim();if(txt&&dmPerson){transmit({type:'dm',to:dmPerson.id,message:txt});$('dmInput').value='';$('dmModal').classList.add('hidden')}});
$('chatForm').addEventListener('submit',e=>{e.preventDefault();if(!me.name)return;const txt=$('chatInput').value.trim();if(!txt)return;
 if(socket?.readyState!==1){toast('Reconectando ao servidor.');return}
 transmit({type:'chat',message:txt});$('chatInput').value=''
});
$('chatToggle').addEventListener('click',()=>{$('right-panel')?.classList?.toggle('collapsed');const panel=document.querySelector('.right-panel');panel.classList.toggle('collapsed');$('chatToggle').textContent=panel.classList.contains('collapsed')?'+':'–'});
const palette=document.querySelectorAll('[data-color]');
palette.forEach(b=>b.addEventListener('click',()=>{me.color=b.dataset.color;palette.forEach(x=>x.classList.toggle('selected',x===b))}));
try{let old=JSON.parse(localStorage.getItem('steiner-life-avatar')||'{}');
 if(typeof old.name==='string')$('playerName').value=old.name.slice(0,20);
 if(/^#[a-f0-9]{6}$/i.test(old.color||'')){me.color=old.color;palette.forEach(b=>b.classList.toggle('selected',b.dataset.color===old.color))}
 if(Number.isFinite(old.hair))$('hairSelect').value=old.hair;
 if(Number.isFinite(old.outfit))$('outfitSelect').value=old.outfit;
}catch(e){}
$('enterWorld').addEventListener('click',()=>{
 const value=$('playerName').value.replace(/[<>]/g,'').trim().slice(0,20);
 if(value.length<2){$('joinError').textContent='Digite um apelido com pelo menos 2 caracteres.';return}
 me.name=value;me.hair=Number($('hairSelect').value)||0;me.outfit=Number($('outfitSelect').value)||0;
 try{localStorage.setItem('steiner-life-avatar',JSON.stringify({name:me.name,color:me.color,hair:me.hair,outfit:me.outfit}))}catch(e){}
 localAvatar();$('welcome').classList.add('hidden');$('joinError').textContent='';if(!socket||socket.readyState>=2)connect();
 else if(socket.readyState===1&&!joined)transmit({type:'join',name:me.name,color:me.color,hair:me.hair,outfit:me.outfit});
 toast('Bem-vindo, '+me.name+'! Use WASD para caminhar.');
});
$('playerName').addEventListener('keydown',e=>{if(e.key==='Enter')$('enterWorld').click()});
$('editAvatar').addEventListener('click',()=>{$('welcome').classList.remove('hidden');$('playerName').value=me.name});
document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>$(x.dataset.close).classList.add('hidden')));
$('openBuild').addEventListener('click',()=>{$('buildModal').classList.remove('hidden')});
$('helpBtn').addEventListener('click',()=>{$('helpModal').classList.remove('hidden')});
document.querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>{
 if(!me.model)return;const forward=new THREE.Vector3(Math.sin(me.yaw)*-1,0,Math.cos(me.y)*-1);
 const x=Math.round(me.x+forward.x*7),z=Math.round(me.z+forward.z*7);
 if(Math.abs(x)<28&&Math.abs(z)<28){toast('A praça central é protegida. Viaje para a vila para construir.');return}
 if(!joined){toast('Espere conexão com o mundo para construir.');return}
 transmit({type:'build',object:b.dataset.build,x,z,rotation:me.yaw});$('buildModal').classList.add('hidden')
}));
document.querySelectorAll('[data-place]').forEach(b=>b.addEventListener('click',()=>{
 const p=places[b.dataset.place];if(!p||!me.model)return;
 me.x=p.x;me.z=p.z;me.y=0;me.jumpV=0;me.model.position.set(me.x,0,me.z);me.yaw=0;
 transmit({type:'teleport',place:b.dataset.place});setZone();toast('Você chegou a '+p.label)
}));
document.querySelectorAll('[data-emote]').forEach(b=>b.addEventListener('click',()=>{
 if(!me.model)return;
 me.emote=b.dataset.emote;me.emoteUntil=performance.now()+4800;transmit({type:'emote',emote:me.emote});
 toast({wave:'Acenando! 👋',dance:'Hora de dançar!',sit:'Sentando para descansar.',cheer:'Celebrando! ★'}[me.emote])
}));
$('photoBtn').addEventListener('click',()=>{
 try{renderer.render(scene,camera);const a=document.createElement('a');a.download='steiner-life-foto.png';a.href=renderer.domElement.toDataURL('image/png');a.click();toast('Foto salva!')}
 catch(e){toast('Não foi possível salvar a foto neste navegador.')}
});
const keyMap={KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
window.addEventListener('keydown',e=>{
 const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
 if(keyMap[e.code]){keys[keyMap[e.code]]=true;e.preventDefault()}
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.run=true;
 if(e.code==='Space'&&me.y<=.01){me.jumpV=8.2;e.preventDefault()}
 if(e.code==='Enter'){$('chatInput').focus();e.preventDefault()}
});
window.addEventListener('keyup',e=>{if(keyMap[e.code]){keys[keyMap[e.code]]=false;e.preventDefault()}if(e.code.startsWith('Shift'))keys.run=false});
window.addEventListener('blur',()=>{for(const k of Object.keys(keys))keys[k]=false});
const touchMap={up:'forward',down:'back',left:'left',right:'right'};
for(const [id,k] of Object.entries(touchMap)){
 const b=$(id);
 b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;try{b.setPointerCapture(e.pointerId)}catch(x){}});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{keys[k]=false})
}
$('jump').addEventListener('click',()=>{if(me.y<=.01)me.jumpV=8.2});
$('mobileChat').addEventListener('click',()=>{$('chatInput').focus();document.querySelector('.right-panel').classList.remove('collapsed')});
let dragging=false,pointerX=0,pointerY=0,camYaw=.5,camPitch=.30,camDist=9;
renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;pointerX=e.clientX;pointerY=e.clientY;try{renderer.domElement.setPointerCapture(e.pointerId)}catch(x){}});
renderer.domElement.addEventListener('pointermove',e=>{
 if(!dragging)return;
 camYaw-=(e.clientX-pointerX)*.005;camPitch=Math.min(1.0,Math.max(.10,camPitch+(e.clientY-pointerY)*.004));
 pointerX=e.clientX;pointerY=e.clientY
});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
renderer.domElement.addEventListener('wheel',e=>{camDist=Math.min(18,Math.max(5,camDist+Math.sign(e.deltaY)*1.2));e.preventDefault()},{passive:false});
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
window.addEventListener('resize',resize);
let total=0,lastMoveSend=0;
function moveAvatar(dt,time){
 if(!me.model)return;
 let forward=(keys.forward?1:0)-(keys.back?1:0),strafe=(keys.right?1:0)-(keys.left?1:0);
 const len=Math.hypot(forward,strafe);let moving=len>.01;
 if(moving){forward/=len;strafe/=len}
 const speed=keys.run?10.2:5.7;
 const dx=(-Math.sin(camYaw)*forward+Math.cos(camYaw)*strafe)*speed*dt;
 const dz=(-Math.cos(camYaw)*forward-Math.sin(camYaw)*strafe)*speed*dt;
 me.x=Math.max(-193,Math.min(193,me.x+dx));me.z=Math.max(-193,Math.min(193,me.z+dz));
 if(moving){me.yaw=Math.atan2(dx,dz)+Math.PI;me.anim+=dt*(keys.run?15:10)}
 else me.anim+=dt*2;
 me.jumpV-=22*dt;me.y=Math.max(0,me.y+me.jumpV*dt);
 if(me.y<=0)me.jumpV=0;
 me.model.position.set(me.x,me.y,me.z);
 if(moving)me.model.rotation.y=me.yaw;
 pose(me.model,me.anim,moving,me.emote,time<me.emoteUntil);
 if(moving||me.y>0){
  if(time-lastMoveSend>110){
   transmit({type:'move',x:me.x,y:me.y,z:me.z,heading:me.model.rotation.y});lastMoveSend=time
  }
 }
 setZone()
}
function pose(model,t,moving,emote,active){
 const limbs=model.userData.limbs||[];
 const amp=moving?.50:0;
 if(limbs.length===4){
  limbs[0].rotation.x=Math.sin(t)*amp;
  limbs[2].rotation.x=-Math.sin(t)*amp;
  limbs[1].rotation.x=-Math.sin(t)*amp;
  limbs[3].rotation.x=Math.sin(t)*amp;
  for(const limb of limbs)limb.rotation.z=0;
  if(active&&emote==='wave'){limbs[0].rotation.z=-2.0;limbs[0].rotation.x=.25+Math.sin(t*7)*.15}
  if(active&&emote==='dance'){limbs[0].rotation.z=-1;limbs[2].rotation.z=1;model.rotation.z=Math.sin(t*7)*.15}
  else model.rotation.z=0;
  if(active&&emote==='cheer'){limbs[0].rotation.z=-2.4;limbs[2].rotation.z=2.4}
  if(active&&emote==='sit'){limbs[1].rotation.x=-1.2;limbs[3].rotation.x=-1.2}
 }
}
function animate(time){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);total+=dt;
 for(let i=0;i<clouds.length;i++){clouds[i].position.x+=dt*(.25+i*.03);if(clouds[i].position.x>210)clouds[i].position.x=-210}
 const day=(total/290)%1;
 const daylight=Math.max(.10,Math.sin(day*Math.PI*2)*.45+.55);
 scene.background.setRGB(.09+daylight*.50,.13+daylight*.63,.24+daylight*.72);
 scene.fog.color.copy(scene.background);sun.intensity=daylight*2.4+.25;
 hemi.intensity=daylight*1.3+.5;ambient.intensity=.25+(1-daylight)*.6;
 sun.position.set(Math.cos(day*Math.PI*2)*100,Math.max(12,Math.sin(day*Math.PI*2)*145),50);
 for(const l of lamps)l.intensity=daylight<.48?2.2:0;
 if(me.name)moveAvatar(dt,time);
 for(const p of others.values()){
  p.model.position.lerp(p.target,Math.min(1,dt*7));p.model.rotation.y+=(p.heading-p.model.rotation.y)*Math.min(1,dt*9);
  p.moveTime+=dt*9;pose(p.model,p.moveTime,true,p.emote,time<p.emoteUntil)
 }
 for(const n of npc){
  n.time+=dt;const tx=n.x+Math.cos(n.time*.32+n.angle)*2,tz=n.z+Math.sin(n.time*.32+n.angle)*2;
  n.model.position.x+=(tx-n.model.position.x)*dt*.9;n.model.position.z+=(tz-n.model.position.z)*dt*.9;
  n.model.rotation.y=n.time*.3;pose(n.model,n.time*6,true,'none',false)
 }
 for(const [id,obj] of objects){if(obj.userData.rotateArt)obj.userData.rotateArt.rotation.y+=dt*.5}
 for(const coin of coins){if(coin.userData.hidden)continue;
  coin.rotation.y+=dt*1.8;coin.position.y=1.3+Math.sin(total*2.4+coin.userData.phase)*.2;
  if(me.name&&Math.hypot(me.x-coin.position.x,me.z-coin.position.z)<1.6){
   coin.visible=false;coin.userData.hidden=true;cash(5);toast('✦ +5 moedas virtuais encontradas!')
  }
 }
 const target=new THREE.Vector3(me.x,me.y+2.05,me.z);
 const dist=camDist,hor=Math.cos(camPitch)*dist;
 const desired=new THREE.Vector3(me.x+Math.sin(camYaw)*hor,me.y+2.3+Math.sin(camPitch)*dist,me.z+Math.cos(camYaw)*hor);
 camera.position.lerp(desired,Math.min(1,dt*5.3));camera.lookAt(target);
 renderer.render(scene,camera)
}
camera.position.set(5,8,15);camera.lookAt(0,1,0);
requestAnimationFrame(animate);
$('loading').classList.add('hidden');
$('welcome').classList.remove('hidden');
if(innerWidth<800)document.querySelector('.right-panel').classList.add('collapsed');
updatePeople();
