import {THREE,scene,camera,renderer,terrain,rails,letters,skater,rig,board,torso,legs,arms,shadow,clamp,lerp} from './world.js';
import {loadHumanSkater,updateHumanSkater,humanReady} from './skater_real.js';
/* STEINER SKATE — physics, trick scoring, multiplayer-free original game logic */
const $=id=>document.getElementById(id),TAU=Math.PI*2;
const input={up:false,down:false,left:false,right:false,grind:false};
const sk={x:0,z:13,y:.17,heading:0,speed:0,vy:0,grounded:true,
 grind:null,airtime:0,flip:0,spin:0,flipGoal:0,spinGoal:0,lean:0,tricks:new Set(),manual:false,manualTime:0,landedAt:-100,flipFrom:0,spinFrom:0,flipStarted:0,spinStarted:0};
let status='menu',isFree=false,elapsed=0,timeLeft=120,score=0,best=0,landedTricks=0,
 bestCombo=0,grindTime=0,foundLetters=0,lastHUD=-1,combo={base:0,mult:1,tricks:[],timer:0},
 missions=new Set(),lastFrame=0,camYaw=0,camDist=7.6,camMode=0,
 toneEnabled=true,audio=null;
try{best=Number(localStorage.getItem('steiner-skate-best')||0)||0}catch(e){}
$('best-score').textContent=best;
function tone(freq=400,seconds=.11,type='triangle'){
 if(!toneEnabled)return;
 try{
  if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();
  const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.68),t+seconds);
  gain.gain.setValueAtTime(.035,t);gain.gain.exponentialRampToValueAtTime(.0001,t+seconds);
  osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+seconds+.01)
 }catch(e){}
}
function feed(txt,isBad=false){
 const el=document.createElement('div');el.className='feed-item '+(isBad?'bad':'good');el.textContent=txt;
 $('trick-feed').prepend(el);
 while($('trick-feed').children.length>4)$('trick-feed').lastChild.remove();
 setTimeout(()=>el.remove(),2450)
}
let notificationTimer;
function notify(txt){
 const e=$('toast');e.textContent=txt;e.classList.add('visible');
 clearTimeout(notificationTimer);
 notificationTimer=setTimeout(()=>e.classList.remove('visible'),2900)
}
function resetSkater(){
 sk.x=0;sk.z=13;sk.y=.17;sk.heading=0;sk.speed=0;sk.vy=0;
 sk.grounded=true;sk.airtime=0;sk.flip=0;sk.spin=0;sk.flipGoal=0;sk.spinGoal=0;
 sk.lean=0;sk.grind=null;sk.tricks.clear();sk.manual=false;sk.manualTime=0;sk.landedAt=-100;
 sk.flipFrom=0;sk.spinFrom=0;sk.flipStarted=0;sk.spinStarted=0;
 combo={base:0,mult:1,tricks:[],timer:0};
 skater.position.set(sk.x,sk.y,sk.z);skater.rotation.y=0;
}
function newRun(free=false){
 isFree=free;status='playing';elapsed=0;timeLeft=120;score=0;landedTricks=0;
 bestCombo=0;grindTime=0;foundLetters=0;missions.clear();
 letters.forEach(l=>{l.found=false;l.sprite.visible=true});
 resetSkater();
 for(const k in input)input[k]=false;
 $('menu').classList.add('hidden');$('pause-screen').classList.add('hidden');$('results-screen').classList.add('hidden');
 $('session-status').textContent=free?'MODO LIVRE':'SESSÃO DE 2 MINUTOS';
 notify('CONCRETE CITY É SUA! MANDE SUA MELHOR LINHA!');
 updateHUD(true);
}
function pause(){
 if(status==='playing'){status='paused';$('pause-screen').classList.remove('hidden')}
 else if(status==='paused'){status='playing';$('pause-screen').classList.add('hidden')}
}
function endRun(){
 if(status!=='playing')return;
 if(combo.base)bankCombo();
 status='results';
 $('result-score').textContent=score.toLocaleString('pt-BR');
 $('result-combo').textContent=bestCombo.toLocaleString('pt-BR');
 $('result-tricks').textContent=landedTricks;
 $('result-missions').textContent=missions.size+'/4';
 $('results-screen').classList.remove('hidden')
}
function pushTrick(name,base,allowRepeat=false){
 if(status!=='playing')return;
 if(!allowRepeat&&sk.tricks.has(name))return;
 sk.tricks.add(name);
 combo.base+=base;combo.mult=Math.min(12,combo.mult+1);combo.tricks.push(name);
 if(combo.tricks.length>8)combo.tricks.shift();
 combo.timer=0;
 tone(380+base*.22,.10,'square');feed(name+'  +'+base)
}
function bankCombo(){
 if(combo.base<=0)return;
 const points=combo.base*combo.mult;
 score+=points;bestCombo=Math.max(bestCombo,points);landedTricks+=combo.tricks.length;
 feed('✓ '+points.toLocaleString('pt-BR')+' PONTOS!');
 tone(720,.16);setTimeout(()=>tone(950,.12),100);
 combo={base:0,mult:1,tricks:[],timer:0};
 if(score>best){
  best=score;try{localStorage.setItem('steiner-skate-best',String(best))}catch(e){}
 }
}
function bail(){
 if(combo.base>0){feed('BAIL! COMBO PERDIDO',true);tone(96,.30,'sawtooth')}
 combo={base:0,mult:1,tricks:[],timer:0};sk.speed*=.45
}
function ollie(){
 if(status!=='playing')return;
 if(sk.grind){
  sk.grind=null;sk.vy=9.7;sk.grounded=false;sk.airtime=0;
  sk.tricks.clear();pushTrick('OLLIE OUT',190);return
 }
 if(!sk.grounded)return;
 sk.grounded=false;sk.vy=10.4+Math.min(24,Math.abs(sk.speed))*.11;sk.airtime=0;sk.manual=false;
 sk.tricks.clear();sk.flip=0;sk.spin=0;sk.flipGoal=0;sk.spinGoal=0;
 pushTrick('OLLIE',100);tone(290,.11)
}
const trickList={
 KeyQ:{name:'KICKFLIP',pts:500,flip:TAU},
 KeyE:{name:'HEELFLIP',pts:560,flip:-TAU},
 KeyJ:{name:'INDY GRAB',pts:390},
 KeyK:{name:'NOSEGRAB',pts:445},
 KeyZ:{name:'BS 180',pts:400,spin:Math.PI},
 KeyX:{name:'FS 360',pts:850,spin:TAU},
 KeyC:{name:'POP SHOVE-IT',pts:480,spin:Math.PI}
};
function trick(code){
 if(status!=='playing'||sk.grounded||sk.grind)return;
 const v=trickList[code];if(!v||sk.tricks.has(v.name))return;
 pushTrick(v.name,v.pts);
 if(v.flip){sk.flipFrom=sk.flip;sk.flipGoal+=v.flip;sk.flipStarted=elapsed}
 if(v.spin){sk.spinFrom=sk.spin;sk.spinGoal+=v.spin;sk.spinStarted=elapsed}
}
function closestRail(){
 let best=null,distance=100;
 for(const r of rails){
  const along=r.axis==='x'?sk.x-r.x:sk.z-r.z;
  const cross=r.axis==='x'?sk.z-r.z:sk.x-r.x;
  const vertical=Math.abs(sk.y-(r.y+.32));
  if(Math.abs(along)<r.len/2+1.1&&Math.abs(cross)<1.35&&vertical<1.55){
   const d=Math.abs(cross)+vertical*.35;
   if(d<distance){distance=d;best={rail:r,along}}
  }
 }
 return best
}
function startGrind(o){
 if(sk.grind||!o)return;
 const r=o.rail,dir=sk.speed>=0?1:-1;
 sk.grind={rail:r,t:o.along,dir,speed:Math.max(6,Math.abs(sk.speed))};
 sk.grounded=false;sk.vy=0;sk.y=r.y+.32;
 if(r.axis==='x'){
  sk.heading=dir>0?Math.PI/2:-Math.PI/2;sk.z=r.z
 }else{
  sk.heading=dir>0?Math.PI:0;sk.x=r.x
 }
 pushTrick('50-50 GRIND',600);tone(310,.19,'sawtooth')
}
function grindStep(dt){
 const g=sk.grind;if(!g)return;
 if(!input.grind){sk.grind=null;sk.vy=5.3;return}
 g.t+=g.dir*g.speed*dt;sk.speed=g.speed;
 sk.y=g.rail.y+.32;
 if(g.rail.axis==='x'){sk.x=g.rail.x+g.t;sk.z=g.rail.z}
 else{sk.x=g.rail.x;sk.z=g.rail.z+g.t}
 grindTime+=dt;combo.base+=Math.round(280*dt);combo.timer=0;
 if(Math.abs(g.t)>g.rail.len/2){
  sk.grind=null;sk.vy=4.4;sk.grounded=false;sk.airtime=0
 }
}
function ride(dt){
 const turn=(input.left?1:0)-(input.right?1:0);
 // Fast Tony-Hawk-style arcade handling: immediate push, high cruise, low drag.
 if(input.up)sk.speed=clamp(sk.speed+(sk.speed<23?40:18)*dt,-11,35);
 else if(input.down)sk.speed=clamp(sk.speed-31*dt,-11,35);
 else sk.speed=sk.speed>0?Math.max(0,sk.speed-1.6*dt):Math.min(0,sk.speed+2.0*dt);
 sk.heading+=turn*(sk.grounded?2.65:1.85)*dt*(sk.speed<0?-.80:1);
 sk.lean=lerp(sk.lean,turn*.27,Math.min(1,dt*8));
 sk.x+=Math.sin(sk.heading)*sk.speed*dt;
 sk.z-=Math.cos(sk.heading)*sk.speed*dt;
 if(Math.abs(sk.x)>85||Math.abs(sk.z)>75){
  sk.x=clamp(sk.x,-85,85);sk.z=clamp(sk.z,-75,75);
  sk.speed*=-.08;bail();notify('LIMITE DO SKATEPARK')
 }
 const y=terrain(sk.x,sk.z)+.17;
 if(sk.grounded){
  const diff=y-sk.y;
  sk.y+=clamp(diff,-dt*30,dt*30);
  if(diff<-.45&&sk.speed>14){
   sk.grounded=false;sk.vy=5.3;sk.airtime=0;
   sk.tricks.clear();pushTrick('RAMP AIR',240)
  }
 }else{
  sk.vy-=19.5*dt;sk.y+=sk.vy*dt;sk.airtime+=dt;
  if(input.grind&&sk.vy<4){const r=closestRail();if(r)startGrind(r)}
  if(!sk.grind&&sk.y<=y&&sk.vy<0){
   sk.y=y;sk.vy=0;sk.grounded=true;sk.landedAt=elapsed;
   const flipDiff=Math.abs(sk.flipGoal-sk.flip),spinDiff=Math.abs(sk.spinGoal-sk.spin);
   if(flipDiff>1.05||spinDiff>1.25){
    bail()
   }else{
    sk.flip=sk.flipGoal;sk.spin=sk.spinGoal;combo.timer=0;
    tone(195,.08);
   }
  }
 }
 if(sk.manual){
  if(!sk.grounded||Math.abs(sk.speed)<4){
   sk.manual=false;
  }else{
   sk.manualTime+=dt;
   combo.base+=Math.round(175*dt);
   combo.timer=0;
   if(sk.manualTime>8){sk.manual=false;bail();notify('MANUAL LONGO: PERDEU O EQUILÍBRIO!')}
  }
 }
}
function updateMissions(){
 const results=[
 {ok:landedTricks>=5,val:Math.min(5,landedTricks)+'/5'},
 {ok:grindTime>=5,val:Math.min(5,grindTime).toFixed(1)+'/5s'},
 {ok:foundLetters>=5,val:foundLetters+'/5'},
 {ok:bestCombo>=3000,val:Math.min(bestCombo,3000)+'/3000'}
 ];
 let done=0;
 results.forEach((v,i)=>{
  $('obj'+(i+1)).textContent=v.ok?'✓':'○';
  $('obj'+(i+1)).classList.toggle('done',v.ok);
  $('obj'+(i+1)+'-progress').textContent=v.val;
  if(v.ok){
   done++;
   if(!missions.has(i)){
    missions.add(i);score+=1000;feed('DESAFIO CONCLUÍDO! +1000');notify('DESAFIO DO PARQUE CONCLUÍDO!')
   }
  }
 });
 $('mission-done').textContent=done+'/4'
}
function updateHUD(force=false){
 if(!force&&elapsed-lastHUD<.12)return;lastHUD=elapsed;
 $('total-score').textContent=score.toLocaleString('en-US').padStart(7,'0');
 $('best-score').textContent=best.toLocaleString('pt-BR');
 $('tricks-count').textContent=landedTricks;
 const sec=Math.ceil(timeLeft);
 $('timer').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');
 $('speed').textContent=Math.round(Math.abs(sk.speed)*3.2);
 $('speed-fill').style.width=clamp(Math.abs(sk.speed)/35*100,0,100)+'%';
 $('combo-wrap').classList.toggle('active',combo.base>0);
 $('combo-score').textContent=(combo.base*combo.mult).toLocaleString('pt-BR');
 $('combo-multiplier').textContent='×'+combo.mult;
 $('combo-tricks').textContent=combo.tricks.slice(-3).join(' + ')||'OLLIE';
 $('combo-progress').style.width=(sk.grounded?clamp(1-combo.timer/1.7,0,1)*100:100)+'%';
 $('surface-name').textContent=sk.grind?'GRINDING':'CONCRETE CITY'
}
function animateCharacter(dt){
 skater.position.set(sk.x,sk.y,sk.z);
 skater.rotation.y=sk.heading;
 const air=!sk.grounded&&!sk.grind;
 rig.rotation.z=lerp(rig.rotation.z,sk.lean*(air?.55:1),Math.min(1,dt*10));
 if(!humanReady()){
  torso.position.y=1.30-(air?.16:Math.abs(sk.speed)>7?.10:0);
  torso.rotation.x=lerp(torso.rotation.x,air?.2:input.up?.06:0,Math.min(1,dt*8));
  legs.forEach((leg,i)=>leg.rotation.x=lerp(leg.rotation.x,air?(i?.40:-.40):Math.sin(elapsed*9+i*Math.PI)*.06,Math.min(1,dt*9)));
  arms.forEach((arm,i)=>arm.rotation.z=lerp(arm.rotation.z,air?(i?-.5:.5):0,Math.min(1,dt*10)));
 }
 // Full rotation finishes within 0.44s, rather than asymptotically lagging behind landing.
 const ease=t=>{const x=clamp(t,0,1);return x*x*(3-2*x)};
 if(air){
  sk.flip=lerp(sk.flipFrom,sk.flipGoal,ease((elapsed-sk.flipStarted)/.48));
  sk.spin=lerp(sk.spinFrom,sk.spinGoal,ease((elapsed-sk.spinStarted)/.55));
 }else{
  sk.flip=lerp(sk.flip,0,Math.min(1,dt*13));
  sk.spin=lerp(sk.spin,0,Math.min(1,dt*13));
  if(sk.grounded){sk.flipGoal=0;sk.spinGoal=0;sk.flipFrom=0;sk.spinFrom=0;}
 }
 board.rotation.z=sk.flip;
 board.rotation.y=sk.spin;
 rig.rotation.y=sk.manual?Math.sin(elapsed*1.2)*.025:sk.spin*.12;
 board.rotation.x=lerp(board.rotation.x,sk.manual?-.25:0,Math.min(1,dt*8));
 updateHumanSkater(dt,{speed:sk.speed,grounded:sk.grounded,air,grinding:!!sk.grind,time:elapsed,lean:sk.lean,grab:sk.tricks.has('INDY GRAB')||sk.tricks.has('NOSEGRAB')});
 shadow.position.set(sk.x,terrain(sk.x,sk.z)+.015,sk.z);
 shadow.material.opacity=clamp(1-(sk.y-terrain(sk.x,sk.z))/6,.2,1)
}
function update(dt){
 if(status!=='playing')return;
 elapsed+=dt;
 if(!isFree){
  timeLeft=Math.max(0,timeLeft-dt);
  if(timeLeft<=0){endRun();return}
 }
 if(sk.grind)grindStep(dt);else ride(dt);
 if(sk.grounded&&combo.base&&!sk.manual){
  combo.timer+=dt;
  if(combo.timer>1.7)bankCombo()
 }
 letters.forEach((l,i)=>{
  if(l.found)return;
  l.sprite.position.y=l.y+Math.sin(elapsed*2.5+i)*.23;
  if(Math.hypot(sk.x-l.x,sk.y+1.1-l.y,sk.z-l.z)<3.6){
   l.found=true;l.sprite.visible=false;foundLetters++;score+=400;
   feed('★ '+l.chr+' ENCONTRADO +400');tone(800,.18)
  }
 });
 animateCharacter(dt);updateMissions();updateHUD()
}
const chase=new THREE.Vector3(),look=new THREE.Vector3(),focus=new THREE.Vector3();
function follow(dt){
 camYaw=lerp(camYaw,0,Math.min(1,dt*.48));
 const heading=sk.heading+camYaw,dist=camDist+(camMode?6:0);
 chase.set(sk.x-Math.sin(heading)*dist,sk.y+2.9+(camMode?3.8:0),sk.z+Math.cos(heading)*dist);
 camera.position.lerp(chase,Math.min(1,dt*8.0));
 look.set(sk.x,sk.y+1.33,sk.z);focus.lerp(look,Math.min(1,dt*8));
 camera.lookAt(focus);
 camera.fov=lerp(camera.fov,63+clamp(Math.abs(sk.speed)*.34,0,12),Math.min(1,dt*2));
 camera.updateProjectionMatrix()
}
let last=0;
function frame(now){
 requestAnimationFrame(frame);
 if(!last)last=now;
 const dt=Math.min(.045,(now-last)/1000);last=now;
 if(status==='playing')update(dt);
 follow(dt);renderer.render(scene,camera)
}
window.addEventListener('resize',()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)
});
const mapKeys={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',
 KeyD:'right',ArrowRight:'right',ShiftLeft:'grind',ShiftRight:'grind'};
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 if(mapKeys[e.code]){input[mapKeys[e.code]]=true;e.preventDefault()}
 if(e.code==='Space'&&!e.repeat){e.preventDefault();ollie()}
 if(trickList[e.code]&&!e.repeat){e.preventDefault();trick(e.code)}
 if(e.code==='KeyM'&&!e.repeat&&status==='playing'&&sk.grounded&&Math.abs(sk.speed)>4){
  sk.manual=!sk.manual;
  sk.manualTime=0;
  if(sk.manual){sk.tricks.delete('MANUAL');pushTrick('MANUAL',260)}
  else bankCombo()
 }
 if(e.code==='KeyR'&&!e.repeat&&status==='playing'&&sk.grounded&&elapsed-sk.landedAt<1.0&&combo.base){
  sk.heading+=Math.PI;sk.speed*=-.92;sk.tricks.delete('REVERT');pushTrick('REVERT',220);
  sk.landedAt=-100;notify('REVERT + COMBO!')
 }
 if(e.code==='Backspace'&&!e.repeat){e.preventDefault();resetSkater();notify('SKATISTA REPOSICIONADO')}
 if(e.code==='KeyV'&&!e.repeat){camMode=1-camMode;notify(camMode?'CÂMERA ABERTA':'CÂMERA PRÓXIMA')}
 if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause()}
});
document.addEventListener('keyup',e=>{if(mapKeys[e.code])input[mapKeys[e.code]]=false});
window.addEventListener('blur',()=>{
 Object.keys(input).forEach(k=>input[k]=false);
 if(status==='playing')pause()
});
document.querySelectorAll('[data-hold]').forEach(btn=>{
 const action=btn.dataset.hold;
 btn.addEventListener('pointerdown',e=>{
  e.preventDefault();btn.classList.add('pressed');
  if(action==='jump')ollie();
  else if(action==='accelerate')input.up=true;
  else input[action]=true;
  try{btn.setPointerCapture(e.pointerId)}catch(err){}
 });
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,()=>{
  btn.classList.remove('pressed');if(action==='accelerate')input.up=false;
  else if(action!=='jump')input[action]=false
 })
});
document.querySelectorAll('[data-tap]').forEach(btn=>btn.addEventListener('click',()=>{
 if(btn.dataset.tap==='flip'){if(sk.grounded)ollie();setTimeout(()=>trick('KeyQ'),180)}
 if(btn.dataset.tap==='grind'){input.grind=true;setTimeout(()=>input.grind=false,1600)}
}));
let drag=false,lastX=0,lastY=0;
renderer.domElement.addEventListener('pointerdown',e=>{
 drag=true;lastX=e.clientX;lastY=e.clientY;
 try{renderer.domElement.setPointerCapture(e.pointerId)}catch(err){}
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(!drag)return;
 camYaw-=clamp((e.clientX-lastX)*.005,-.2,.2);
 camDist=clamp(camDist+(e.clientY-lastY)*.012,6,18);
 lastX=e.clientX;lastY=e.clientY
});
renderer.domElement.addEventListener('pointerup',()=>drag=false);
renderer.domElement.addEventListener('pointercancel',()=>drag=false);
renderer.domElement.addEventListener('wheel',e=>{
 camDist=clamp(camDist+Math.sign(e.deltaY)*.65,6,18);e.preventDefault()
},{passive:false});
$('play-btn').addEventListener('click',()=>newRun(false));
$('resume-btn').addEventListener('click',pause);
$('restart-btn').addEventListener('click',()=>newRun(false));
$('retry-btn').addEventListener('click',()=>newRun(false));
$('free-btn').addEventListener('click',()=>{
 status='playing';isFree=true;$('results-screen').classList.add('hidden');notify('MODO LIVRE!')
});
$('help-btn').addEventListener('click',()=>{
 $('help-screen').classList.remove('hidden');if(status==='playing')pause()
});
$('help-close').addEventListener('click',()=>$('help-screen').classList.add('hidden'));
$('help-ok').addEventListener('click',()=>$('help-screen').classList.add('hidden'));
$('sound-btn').addEventListener('click',()=>{
 toneEnabled=!toneEnabled;$('sound-btn').textContent=toneEnabled?'♫':'♪';
 if(toneEnabled)tone(480)
});
$('fullscreen-btn').addEventListener('click',()=>{
 try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()}catch(e){}
});
window.STEINER_SKATE_VERSION='1.0';
resetSkater();camera.position.set(0,5.8,17);camera.lookAt(0,1,0);$('loading').classList.add('hidden');
loadHumanSkater();
updateHUD(true);requestAnimationFrame(frame);
