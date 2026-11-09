(()=>{'use strict';
/* SKATE '96 — Correria de Rua. Jogo arcade original 16-bit em Canvas.
   Construído para execução direta no navegador. Sem motor 3D, sem downloads externos.
   A foto do jogador, se escolhida, é reduzida e processada localmente. */
const E=id=>document.getElementById(id),canvas=E('game'),g=canvas.getContext('2d',{alpha:false});
const W=960,H=540,END=11900,GROUND=439,G=1940,JUMP=-790,TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const gaps=[{a:1670,b:1830},{a:3930,b:4100},{a:6210,b:6380},{a:8650,b:8850},{a:10710,b:10880}];
const ramps=[{x:2250,w:320,h:96},{x:4910,w:360,h:120},{x:7350,w:360,h:100},{x:9540,w:320,h:98}];
const rails=[
 {a:1060,b:1490,y:335,label:'CROOKED ALLEY'},
 {a:3140,b:3550,y:315,label:'ROOFTOP RAIL'},
 {a:5470,b:5930,y:324,label:'CROOKED CITY'},
 {a:7560,b:8000,y:308,label:'NEON LINE'},
 {a:9950,b:10400,y:316,label:'FINAL GRIND'}
];
const letterPositions=[
 {value:'S',x:680,y:342},{value:'K',x:2940,y:345},
 {value:'A',x:5270,y:350},{value:'T',x:7410,y:325},{value:'E',x:11250,y:345}
];
const checkpoints=[0,2200,4600,7100,9200];
const zones=[
 {from:0,label:'PRAÇA DO ASFALTO',sky:['#67c6ce','#b9eed1'],back:'#4e97a6',ground:'#3d556a'},
 {from:2450,label:'BAIRRO DO SKATE',sky:['#77a6d4','#b7cddd'],back:'#6f81a9',ground:'#434e6e'},
 {from:4700,label:'CENTRO DE DREADTOWN',sky:['#e78d93','#f6bf9a'],back:'#a26c93',ground:'#5b4f67'},
 {from:7100,label:'AVENIDA NEON',sky:['#53528b','#be78b3'],back:'#565a93',ground:'#383d6b'},
 {from:9600,label:'VIADUTO FINAL',sky:['#263664','#9979a3'],back:'#424f7e',ground:'#393a60'}
];
const input={grind:false,duck:false};
let photo=null,profile={shirt:'#f3b96b',hair:'cap'};
let audio=null,soundOn=true,musicTimer=0,musicStep=0,toastTime=0,last=0,raf=0,screenShake=0,frameNo=0;
let sceneTime=0,mode='menu',cam=0;
let state={};
const player={x:100,y:GROUND,vy:0,grounded:true,grinding:null,dir:1,
  coyote:.1,duck:false,spin:0,flip:0,spinLife:0,flipLife:0,trickStart:0,activeTrick:'',
  invulnerable:0,pose:0,skid:0,finishJump:0,cleanLanding:0};
const obstacles=[],tokens=[],decoration=[],sparks=[],letters=[];
let seed=9861;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function sr(a,b){return a+rand()*(b-a)}
function area(x){let z=zones[0];for(const a of zones)if(x>=a.from)z=a;return z}
function groundY(x){
 if(gaps.some(h=>x>h.a&&x<h.b))return Infinity;
 let y=GROUND;
 for(const r of ramps){
  if(x>=r.x&&x<r.x+r.w){
   let t=(x-r.x)/r.w;
   y-=r.h*(t<.5?t*2:(1-t)*2);
  }
 }
 return y
}
function makeLevel(){
 obstacles.length=0;tokens.length=0;decoration.length=0;letters.length=0;seed=9861;
 const sequence=[
  ['cone',480],['cop',800],['barricade',970],['cone',1560],['cop',1990],['duck',2610],
  ['cone',2790],['cop',3020],['barrel',3690],['cop',4290],['cone',4510],
  ['cop',4750],['barricade',5300],['duck',6060],['cop',6590],['cone',6810],
  ['cop',7040],['barrel',7460],['barricade',8080],['cop',8400],['duck',9100],
  ['cop',9400],['cone',9730],['barrel',10620],['cop',11030],['cone',11550]
 ];
 for(const [type,x] of sequence)obstacles.push({type,x,passed:false,hit:false,phase:sr(0,TAU)});
 // Alternating short obstacle sequences for rhythm.
 for(const x of [1350,2420,3430,5030,5720,7850,10290])obstacles.push({type:'cone',x,passed:false,hit:false,phase:0});
 for(let x=230;x<END-170;x+=182){
  const sx=x+sr(-45,45),y=groundY(sx);
  if(!Number.isFinite(y))continue;
  const kind=rand()<.19?'gold':'wheel';
  tokens.push({x:sx,y:Math.min(y-75,GROUND-80-sr(0,20)),kind,t:sr(0,TAU),taken:false});
 }
 for(let i=0;i<165;i++){
  const x=90+i*76+sr(-18,18),type=rand();
  decoration.push({x,kind:type<.19?'tree':type<.39?'hydrant':type<.61?'trash':type<.76?'sign':'graffiti',
    phase:sr(0,TAU),color:Math.floor(sr(0,4))})
 }
 for(const data of letterPositions)letters.push({...data,taken:false,phase:sr(0,TAU)});
}
const faceCanvas=document.createElement('canvas');faceCanvas.width=faceCanvas.height=64;
const fg=faceCanvas.getContext('2d',{willReadFrequently:true});
function profileLoad(){
 try{
  const p=JSON.parse(localStorage.getItem('skate96-profile')||'null');
  if(p){profile.shirt=p.shirt||profile.shirt;profile.hair=p.hair||profile.hair;
   E('shirtColor').value=profile.shirt;E('hairStyle').value=profile.hair}
  const img=localStorage.getItem('skate96-photo');
  if(img){const i=new Image();i.onload=()=>{photo=i;photoPreview()};i.src=img}
 }catch(e){}
 photoPreview()
}
function photoPreview(){
 const pg=E('facePreview').getContext('2d');pg.fillStyle='#1a4651';pg.fillRect(0,0,96,96);
 pg.imageSmoothingEnabled=false;
 if(photo){pg.drawImage(photo,0,0,96,96);E('photoStatus').textContent='Sua foto está no personagem ✓'}
 else{pg.fillStyle='#f8c29b';pg.beginPath();pg.arc(48,49,30,0,TAU);pg.fill();pg.fillStyle='#233648';pg.fillRect(25,21,46,12);
 pg.fillStyle='#172a34';pg.fillRect(35,46,6,5);pg.fillRect(57,46,6,5);E('photoStatus').textContent='Avatar padrão'}
}
function handlePhoto(file){
 if(!file)return;
 if(!file.type.startsWith('image/')){notice('Escolha um arquivo de imagem');return}
 if(file.size>10000000){notice('A foto deve ter menos de 10 MB');return}
 const url=URL.createObjectURL(file),im=new Image();
 im.onload=()=>{
  const w=im.naturalWidth,h=im.naturalHeight,side=Math.min(w,h)*.75;
  const sx=(w-side)/2,sy=clamp(h*.14,0,h-side);
  fg.clearRect(0,0,64,64);fg.imageSmoothingEnabled=true;fg.imageSmoothingQuality='high';
  fg.drawImage(im,sx,sy,side,side,0,0,64,64);
  // A pixel-art face uses a deliberately low-resolution 32x32 crop enlarged to 64px.
  const low=document.createElement('canvas');low.width=32;low.height=32;
  low.getContext('2d').drawImage(faceCanvas,0,0,32,32);
  fg.clearRect(0,0,64,64);fg.imageSmoothingEnabled=false;fg.drawImage(low,0,0,64,64);
  const data=faceCanvas.toDataURL('image/png');
  const avatar=new Image();
  avatar.onload=()=>{photo=avatar;photoPreview();notice('Foto aplicada ao personagem!')};
  avatar.src=data;
  try{localStorage.setItem('skate96-photo',data)}catch(e){notice('Foto aplicada nesta sessão. Seu navegador não permitiu salvar.')}
  URL.revokeObjectURL(url)
 };
 im.onerror=()=>{notice('Não foi possível ler a imagem');URL.revokeObjectURL(url)};
 im.src=url
}
function saveProfile(){
 profile.shirt=E('shirtColor').value;profile.hair=E('hairStyle').value;
 try{localStorage.setItem('skate96-profile',JSON.stringify(profile))}catch(e){}
 E('profileDialog').classList.add('hidden');
 notice('Personagem personalizado! 🛹')
}
function openProfile(){E('profileDialog').classList.remove('hidden');if(mode==='playing')pause()}
function hideProfile(){E('profileDialog').classList.add('hidden')}
E('openProfile').addEventListener('click',openProfile);
E('customizeBtn').addEventListener('click',openProfile);
E('closeProfile').addEventListener('click',hideProfile);
E('saveProfile').addEventListener('click',saveProfile);
E('removePhoto').addEventListener('click',()=>{
 photo=null;try{localStorage.removeItem('skate96-photo')}catch(e){}
 photoPreview();notice('Foto removida. Personagem padrão ativado.')
});
E('photoInput').addEventListener('change',e=>{handlePhoto(e.target.files[0]);e.target.value=''});
E('helpBtn').addEventListener('click',()=>{E('helpDialog').classList.remove('hidden');if(mode==='playing')pause()});
for(const id of ['closeHelp','helpGotIt'])E(id).addEventListener('click',()=>E('helpDialog').classList.add('hidden'));
E('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;E('soundBtn').textContent=soundOn?'♫ SOM: ON':'♫ SOM: OFF';if(soundOn)beep(475,.09)});
function beep(freq=440,duration=.10,type='square',volume=.025){
 if(!soundOn)return;
 try{
  if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const t=audio.currentTime,o=audio.createOscillator(),v=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.85),t+duration);
  v.gain.setValueAtTime(volume,t);v.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(v);v.connect(audio.destination);o.start();o.stop(t+duration)
 }catch(e){}
}
function music(dt){
 if(!soundOn||mode!=='playing')return;
 musicTimer-=dt;if(musicTimer>0)return;
 musicTimer+=.205;
 const notes=[196,0,293,261,220,0,330,261,196,220,261,0,293,330,261,0];
 const bass=[98,98,123,98,87,110,98,87];
 if(musicStep%2===0)beep(bass[(musicStep>>1)%8],.16,'triangle',.010);
 if(notes[musicStep%16])beep(notes[musicStep%16],.072,'square',.008);
 if(musicStep%4===2)beep(1300,.026,'triangle',.004);
 musicStep++
}
function notice(message,seconds=2.4){
 const el=E('toast');el.textContent=message;el.classList.add('show');toastTime=seconds
}
function particles(x,y,color,count=10){
 for(let i=0;i<count;i++){
  const a=rnd(0,TAU),power=rnd(45,205);
  sparks.push({x,y,vx:Math.cos(a)*power,vy:Math.sin(a)*power-70,size:rnd(2.2,5.5),color,life:rnd(.28,.85),max:.85})
 }
 while(sparks.length>105)sparks.shift()
}
function restoreHigh(){
 try{return Number(localStorage.getItem('skate96-highscore')||0)||0}catch(e){return 0}
}
function saveHigh(v){try{localStorage.setItem('skate96-highscore',String(v))}catch(e){}}
function reset(){
 state={speed:298,health:3,score:0,record:restoreHigh(),jumpCount:0,trickCount:0,
  grindCount:0,bestCombo:0,comboBase:0,comboMult:1,comboNames:[],comboTimer:0,comboActive:false,
  collected:new Set(),checkpoint:100,objectiveDone:new Set(),coinCount:0,time:0};
 makeLevel();sparks.length=0;player.x=100;player.y=groundY(100);player.vy=0;player.grounded=true;player.grinding=null;
 player.coyote=.11;player.invulnerable=1.1;player.pose=0;player.skid=0;player.spin=0;player.flip=0;
 player.spinLife=0;player.flipLife=0;player.activeTrick='';player.cleanLanding=0;
 input.grind=false;input.duck=false;
 mode='playing';cam=0;screenShake=0;musicStep=0;musicTimer=0;sceneTime=0;
 E('menu').classList.add('hidden');E('pauseModal').classList.add('hidden');E('finishModal').classList.add('hidden');
 notice('FUGA DE RUA! O SKATE ANDA SOZINHO!');
 hud(true);beep(700,.15,'triangle')
}
function pause(){
 if(mode==='playing'){mode='paused';E('pauseModal').classList.remove('hidden')}
 else if(mode==='paused'){mode='playing';E('pauseModal').classList.add('hidden')}
}
function finish(win){
 if(mode!=='playing')return;
 if(win)bankCombo();
 mode=win?'won':'lost';
 E('finishEmoji').textContent=win?'🏆🛹':'💥🛹';
 E('finishTitle').textContent=win?'VOCÊ FECHOU A FASE!':'FIM DE JOGO!';
 E('finishText').innerHTML=win?'Você chegou ao final de Dreadtown! A rua é sua. Missões concluídas: <b>'+state.objectiveDone.size+'/4</b>.':'A patrulha te alcançou. Tente outra vez e use os grinds para escapar dos obstáculos.';
 E('finishScore').textContent=state.score.toLocaleString('pt-BR')+' PTS';
 E('finishModal').classList.remove('hidden');
 beep(win?880:150,.32,win?'triangle':'sawtooth')
}
E('playBtn').addEventListener('click',reset);
E('againBtn').addEventListener('click',reset);
E('pauseBtn').addEventListener('click',pause);
E('resumeBtn').addEventListener('click',pause);
E('restartBtn').addEventListener('click',reset);
E('restartPauseBtn').addEventListener('click',reset);
function scoreAdd(points){
 state.score+=Math.round(points);
 if(state.score>state.record){state.record=state.score;saveHigh(state.record)}
}
function comboAdd(name,base,passive=false){
 if(mode!=='playing')return;
 if(!passive){state.comboMult=Math.min(12,state.comboMult+1);state.trickCount++}
 state.comboBase+=base;state.comboActive=true;state.comboTimer=0;
 state.comboNames.push(name);if(state.comboNames.length>4)state.comboNames.shift();
 player.activeTrick=name;
 if(!passive)notice(name+'  +'+base+'  x'+state.comboMult,1.1);
}
function bankCombo(){
 if(!state.comboActive||state.comboBase<=0)return;
 const total=Math.round(state.comboBase*state.comboMult);
 scoreAdd(total);state.bestCombo=Math.max(state.bestCombo,total);
 particles(player.x,player.y-58,'#e5ff90',12);
 notice('COMBO FECHADO! +'+total.toLocaleString('pt-BR')+' PONTOS',1.6);
 beep(760,.12,'triangle');setTimeout(()=>beep(1060,.10,'triangle'),90);
 clearCombo()
}
function clearCombo(){
 state.comboBase=0;state.comboMult=1;state.comboNames=[];state.comboTimer=0;state.comboActive=false;
 player.activeTrick=''
}
function loseHeart(reason,fall=false){
 if(mode!=='playing'||player.invulnerable>0)return;
 state.health--;clearCombo();screenShake=.55;
 particles(player.x,player.y-65,'#ff8b9c',17);
 beep(170,.24,'sawtooth',.04);
 if(state.health<=0){finish(false);return}
 player.invulnerable=2.0;player.grinding=null;player.vy=0;player.spin=0;player.flip=0;
 if(fall){player.x=state.checkpoint;player.y=groundY(player.x);player.grounded=true}
 else{player.y=Math.min(player.y,GROUND-30);player.grounded=false;player.vy=-290}
 notice('♥ '+reason+'! RESTAM '+state.health+' VIDAS',2)
}
function jump(){
 if(mode!=='playing')return;
 if(player.grinding){
  player.grinding=null;player.grounded=false;player.vy=-675;player.coyote=0;
  state.jumpCount++;comboAdd('OLLIE OUT',230);beep(430,.09);return
 }
 if(!player.grounded&&player.coyote<=0)return;
 player.grounded=false;player.vy=JUMP;player.coyote=0;player.finishJump=sceneTime+.2;
 state.jumpCount++;
 comboAdd('OLLIE',160);
 particles(player.x-15,player.y-6,'#f1ecd0',5);
 beep(345,.095,'triangle')
}
function performTrick(type){
 if(mode!=='playing')return;
 if(player.grounded){jump()}
 if(player.grinding)return;
 if(type==='kick'){
  if(player.flipLife>0)return;
  player.flipLife=.52;player.flip=0;
  comboAdd('KICKFLIP',560);beep(580,.11);
 }else if(type==='spin'){
  if(player.spinLife>0)return;
  player.spinLife=.61;player.spin=0;
  comboAdd('360° AIR',880);beep(690,.14);
 }else{
  if(player.flipLife>0)return;
  player.flipLife=.43;player.flip=0;
  comboAdd('POP SHOVE-IT',470);beep(520,.10)
 }
}
function tryGrind(){
 if(mode!=='playing'||player.grinding||!input.grind)return false;
 const rail=rails.find(r=>player.x>=r.a-24&&player.x<=r.b-8&&Math.abs(player.y-r.y)<145);
 if(!rail)return false;
 player.grinding={rail,t:0,credited:0};
 player.grounded=false;player.y=rail.y;player.vy=0;
 state.grindCount++;
 comboAdd('CROOKED GRIND',740);
 particles(player.x,rail.y,'#fff1a7',8);
 beep(395,.22,'sawtooth',.02);
 return true
}
function exitGrind(){
 if(!player.grinding)return;
 player.grinding=null;player.grounded=false;player.vy=-165;
 player.coyote=0
}
function collect(t){
 if(t.taken)return;t.taken=true;
 const gold=t.kind==='gold',v=gold?180:45;
 scoreAdd(v);state.coinCount++;
 particles(t.x,t.y,gold?'#ffe897':'#a1f8e2',9);
 if(gold)notice('★ BÔNUS DE RUA +180',.9);
 beep(gold?800:580,.06,'triangle',.014)
}
function collectLetter(l){
 if(l.taken)return;
 l.taken=true;state.collected.add(l.value);scoreAdd(750);
 particles(l.x,l.y,'#eaff87',16);
 notice('★ LETRA '+l.value+' COLETADA! +750',1.5);beep(980,.19,'square',.022)
}
function checkGoals(){
 const conditions=[
 state.jumpCount>=5,state.trickCount>=5,state.grindCount>=3,state.collected.size>=5
 ];
 conditions.forEach((done,i)=>{
  if(done&&!state.objectiveDone.has(i)){
   state.objectiveDone.add(i);scoreAdd(1500);notice('🏆 DESAFIO COMPLETO! +1500',2)
  }
 });
 for(let i=0;i<4;i++){
  E('goal'+(i+1)).classList.toggle('done',conditions[i]);
  E('goal'+(i+1)).querySelector('.goal-check').textContent=conditions[i]?'✓':'○';
 }
 E('goal1n').textContent=Math.min(5,state.jumpCount)+'/5';
 E('goal2n').textContent=Math.min(5,state.trickCount)+'/5';
 E('goal3n').textContent=Math.min(3,state.grindCount)+'/3';
 E('goal4n').textContent=state.collected.size+'/5';
 E('objectiveDone').textContent=state.objectiveDone.size+'/4'
}
function collision(ob){
 const x=ob.x+(ob.type==='cop'?Math.sin(sceneTime*1.3+ob.phase)*17:0);
 const py=player.y,top=py-(input.duck&&player.grounded?67:126),bottom=py-10;
 let w=35,ot=GROUND-42,obottom=GROUND;
 if(ob.type==='cop'){w=40;ot=GROUND-95}
 else if(ob.type==='barrel'){w=53;ot=GROUND-65}
 else if(ob.type==='barricade'){w=76;ot=GROUND-89}
 else if(ob.type==='duck'){w=96;ot=GROUND-120;obottom=GROUND-78}
 if(player.x+21<x-w/2||player.x-21>x+w/2)return false;
 return bottom>ot&&top<obottom
}
function update(dt){
 sceneTime+=dt;
 if(mode!=='playing')return;
 state.time+=dt;state.speed=clamp(state.speed+dt*.72,298,340);
 player.invulnerable=Math.max(0,player.invulnerable-dt);
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)E('toast').classList.remove('show')}
 screenShake=Math.max(0,screenShake-dt);
 music(dt);
 if(player.grinding){
  const rail=player.grinding.rail;
  player.x+=state.speed*dt;
  player.y=rail.y;
  player.grinding.credited+=dt;
  state.comboBase+=Math.round(190*dt);
  if(Math.random()<dt*27)particles(player.x,player.y,'#fff7ac',1);
  if(!input.grind||player.x>=rail.b)exitGrind()
 }else{
  player.x+=state.speed*dt;
  if(!tryGrind()){
   const floor=groundY(player.x),oldY=player.y;
   if(player.grounded){
    if(Number.isFinite(floor)){
     player.y=floor;player.coyote=.13;player.vy=0
    }else{
     player.grounded=false;player.coyote=.13;player.vy=40
    }
   }else{
    player.coyote=Math.max(0,player.coyote-dt);
    player.vy+=G*dt;player.y+=player.vy*dt;
    if(Number.isFinite(floor)&&player.vy>=0&&player.y>=floor&&oldY<floor+42){
     player.y=floor;player.vy=0;player.grounded=true;player.coyote=.13;
     if(player.flipLife>.08||player.spinLife>.08){
      notice('✓ POUSO NO LIMITE!',.8)
     }
     bankCombo();
     particles(player.x,player.y-3,'#d9e5e0',5)
    }
   }
  }
 }
 player.pose+=dt*(player.grinding?18:17);
 if(player.grinding)player.coyote=0;
 if(player.flipLife>0){player.flipLife=Math.max(0,player.flipLife-dt);player.flip+=dt*TAU/.52}
 if(player.spinLife>0){player.spinLife=Math.max(0,player.spinLife-dt);player.spin+=dt*TAU/.61}
 if(player.y>H+110){loseHeart('CAIU NO BURACO',true);if(mode!=='playing')return}
 if(player.x>=END-90){finish(true);return}
 for(const cp of checkpoints){
  if(player.x>=cp+40&&cp>state.checkpoint){
   state.checkpoint=cp+80;notice('🚩 CHECKPOINT SALVO',1.3);scoreAdd(150)
  }
 }
 for(const t of tokens){
  if(!t.taken&&Math.abs(t.x-player.x)<28&&Math.abs(t.y-(player.y-48))<70)collect(t)
 }
 for(const l of letters){
  if(!l.taken&&Math.abs(l.x-player.x)<42&&Math.abs(l.y-(player.y-70))<88)collectLetter(l)
 }
 for(const ob of obstacles){
  if(!ob.passed&&player.x>ob.x+72){
   ob.passed=true;
   if(!ob.hit&&ob.type==='cop'&&!player.grounded)scoreAdd(280)
  }
  if(!ob.hit&&player.invulnerable<=0&&collision(ob)&&!player.grinding){
   ob.hit=true;loseHeart('COLISÃO COM '+(ob.type==='cop'?'POLICIAL':'OBSTÁCULO'));
  }
 }
 for(let i=sparks.length-1;i>=0;i--){
  const p=sparks[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.life-=dt;
  if(p.life<=0)sparks.splice(i,1)
 }
 if(state.comboActive&&player.grounded&&!player.grinding){
  state.comboTimer+=dt;
  if(state.comboTimer>.17)bankCombo()
 }
 if(state.time%3<dt)checkGoals();
 cam=lerp(cam,clamp(player.x-270,0,END-W),Math.min(1,dt*10));
 if(frameNo%5===0)hud();
}
function hud(force=false){
 if(!state||!('health'in state))return;
 E('score').textContent=Math.round(state.score).toLocaleString('en-US').padStart(6,'0');
 E('record').textContent=Math.round(state.record).toLocaleString('en-US').padStart(6,'0');
 E('health').textContent='♥ '.repeat(state.health)+'♡ '.repeat(3-state.health);
 E('letters').textContent='SKATE'.split('').map(ch=>state.collected.has(ch)?ch:'_').join(' ');
 const prog=clamp(player.x/(END-150),0,1);
 E('distanceBar').style.width=(prog*100).toFixed(1)+'%';
 E('sideMeter').style.width=(prog*100).toFixed(1)+'%';
 E('progressText').textContent=Math.round(prog*100)+'% DA FASE';
 E('sideProgress').textContent=Math.round(prog*100)+'%';
 E('speed').textContent=Math.round(state.speed*.14);
 E('bestCombo').textContent=state.bestCombo.toLocaleString('pt-BR');
 E('tricks').textContent=state.trickCount;
 E('combo').classList.toggle('visible',state.comboActive);
 E('comboName').textContent=state.comboNames.slice(-2).join(' + ');
 E('comboPts').innerHTML=Math.round(state.comboBase*state.comboMult).toLocaleString('pt-BR')+' <em>×'+state.comboMult+'</em>';
 E('comboLine').style.width=(clamp(1-state.comboTimer/.17,0,1)*100)+'%';
 const zone=area(player.x);E('zoneChip').textContent=zone.label;
 if(force)checkGoals()
}
function rect(x,y,w,h,col){g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function circle(x,y,r,color){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}
function ellipse(x,y,rx,ry,color){g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fill()}
function line(x,y,X,Y,color,w=2){g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.stroke()}
function polygon(points,col){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=col;g.fill()}
function txt(text,x,y,size=18,col='#f4fff0',align='center',family='Arial Black'){
 g.textAlign=align;g.textBaseline='middle';g.font='900 '+size+'px '+family+', sans-serif';g.fillStyle=col;g.fillText(String(text),x,y)
}
function drawBackground(){
 const z=area(mode==='menu'?650:player.x);
 const sky=g.createLinearGradient(0,0,0,H);
 sky.addColorStop(0,z.sky[0]);sky.addColorStop(.86,z.sky[1]);sky.addColorStop(1,'#d7e2b6');
 rect(0,0,W,H,sky);
 const sunX=720-cam*.018%200;
 circle(sunX,115,49,player.x>7500?'#f1bdcf':'#ffeca1');
 if(player.x>7000){
  g.globalAlpha=.7;
  for(let i=0;i<55;i++)rect((i*109+31)%W,15+(i*67)%187,2,2,'#f4f2e8');
  g.globalAlpha=1
 }
 for(let layer=0;layer<3;layer++){
  const factor=.12+layer*.11;
  const off=cam*factor;
  const base=layer===0?215:layer===1?277:337;
  const colors=[z.back,player.x>7100?'#516587':'#5b8c98',player.x>7100?'#43546c':'#417c79'];
  g.fillStyle=colors[layer];g.beginPath();g.moveTo(0,H);g.lineTo(0,base);
  for(let x=-70;x<W+110;x+=36){
   let X=x+off,variation=Math.sin(X*.005+layer)*26+Math.cos(X*.018)*10;
   g.lineTo(x,base+variation)
  }
  g.lineTo(W,H);g.closePath();g.fill()
 }
 // City skyline with illuminated windows, deterministic and cheap.
 const scroll=cam*.33,first=Math.floor(scroll/110)-2;
 for(let i=first;i<first+15;i++){
  const x=i*110-scroll;
  const h=110+((i*67+91)%7)*19;
  const y=GROUND-h+16;
  const col=i%3===0?'#436679':i%3===1?'#48677c':'#547a87';
  rect(x,y,93,h,col);rect(x-5,y-5,103,7,'#324d64');
  for(let wy=y+17;wy<GROUND-8;wy+=23)for(let wx=x+12;wx<x+83;wx+=23){
   let lit=(i+wx*3+wy*7)%11<5;rect(wx,wy,11,15,lit?'#e7b88b':'#7695a1');
   if(!lit)rect(wx+2,wy+2,7,11,'#5d7b93')
  }
 }
 // Backstreet: silhouette of vehicles and police patrols.
 const offset=(cam*.57)%1440;
 for(let i=0;i<6;i++){
  let x=i*360-offset+250;
  rect(x,370,110,36,i%2?'#344b67':'#405c71');
  rect(x+18,357,55,16,'#7397a6');circle(x+25,407,12,'#20303c');circle(x+88,407,12,'#20303c');
  if(i===1){rect(x+52,350,15,6,'#d84954');rect(x+67,350,15,6,'#4fa8ec')}
 }
 // Decorative sidewalk lane horizon.
 rect(0,420,W,H-420,'#253a4a');
 for(let i=0;i<12;i++){let x=i*102-cam*.75%102;rect(x,420,70,4,'#c2aaa0')}
}
function drawGround(){
 const start=Math.floor(cam/18)*18,end=cam+W+40;
 for(let x=start;x<end;x+=18){
  const y=groundY(x+9);
  if(!Number.isFinite(y))continue;
  const zone=area(x);
  rect(x,y,19,H-y,zone.ground);
  rect(x,y,19,10,'#a3d4bf');rect(x,y+10,19,6,'#6fa396');
  if(x%72<18){rect(x+6,y+31,10,4,'#62778d');rect(x+7,y+72,9,4,'#62778d')}
 }
 for(const gap of gaps){
  if(gap.b<cam-10||gap.a>cam+W+10)continue;
  const y=GROUND+8;
  rect(gap.a,y,gap.b-gap.a,H-y,'#142736');
  for(let i=0;i<4;i++){
   polygon([[gap.a+12+i*17,GROUND+43],[gap.a+24+i*17,GROUND+60],[gap.a+16+i*17,GROUND+67]],'#dc626b')
  }
  // warning hazard chevrons on the last ground tile
  for(let i=0;i<3;i++)polygon([[gap.a-58+i*17,GROUND-6],[gap.a-47+i*17,GROUND-27],[gap.a-36+i*17,GROUND-6]],'#f7cd73')
 }
 // Texture and road paint along ground
 for(let x=Math.floor(cam/100)*100;x<cam+W+100;x+=100){
  const y=groundY(x+50);
  if(!Number.isFinite(y))continue;
  rect(x+30,y+22,37,4,'#8196a6');
  rect(x+36,y+58,15,4,'#8698a7')
 }
}
function drawRails(){
 for(const r of rails){
  if(r.b<cam-60||r.a>cam+W+60)continue;
  const y=r.y;
  rect(r.a,y,r.b-r.a,7,'#29404f');
  rect(r.a,y-6,r.b-r.a,5,'#c4d5df');
  rect(r.a,y-9,r.b-r.a,3,'#8ef6dd');
  for(let x=r.a+15;x<r.b-20;x+=65){
   rect(x,y+3,8,GROUND-y-3,'#4c6d7d');
   rect(x-5,GROUND-7,18,7,'#395869')
  }
  rect(r.a,y-29,114,17,'#142f45d9');
  txt(r.label,r.a+57,y-21,10,'#e8fdbe')
 }
}
function drawBackgroundObjects(){
 const left=cam-110,right=cam+W+110;
 for(const d of decoration){
  if(d.x<left||d.x>right)continue;
  const x=d.x,y=groundY(x);
  if(!Number.isFinite(y))continue;
  if(d.kind==='tree'){
   rect(x-4,y-102,9,100,'#764b3e');
   circle(x-30,y-117,38,'#316b67');circle(x+23,y-124,35,'#398b76');
   circle(x,y-151,37,'#59a68c');
   rect(x-25,y-140,8,7,'#75c2a1');rect(x+17,y-143,8,8,'#75c2a1')
  }else if(d.kind==='hydrant'){
   rect(x-12,y-36,24,31,'#c84f56');rect(x-16,y-31,32,8,'#ef7e61');
   rect(x-9,y-47,18,11,'#e66f69');rect(x-18,y-8,36,8,'#973b50');
  }else if(d.kind==='trash'){
   rect(x-18,y-48,35,42,'#567c85');rect(x-21,y-54,42,8,'#9db2af');
   for(let j=0;j<3;j++)rect(x-12+j*10,y-40,5,27,'#41616b')
  }else if(d.kind==='sign'){
   rect(x-3,y-90,6,90,'#6b7786');rect(x-37,y-114,73,34,'#2c6175');
   txt(['SKATE','GO!','1996','RUA'][d.color],x,y-97,14,'#d5ffb0')
  }else{
   rect(x-30,y-62,60,52,'#4b6b7c');rect(x-29,y-60,58,49,'#9a6675');
   txt(['NO FEAR','RIDE','SK8','GO!'][d.color],x,y-35,13,'#fceba2')
  }
 }
}
function drawCop(x,y,t){
 g.save();g.translate(x,y);
 ellipse(2,2,26,6,'#0a253f66');
 const step=Math.sin(t*9)*6;
 rect(-13,-30+step,12,28,'#1a344d');rect(3,-30-step,12,28,'#1a344d');
 rect(-17,-8+step,17,9,'#151b29');rect(1,-8-step,18,9,'#151b29');
 rect(-21,-88,42,63,'#28466c');rect(-23,-82,46,12,'#28466c');
 rect(-10,-77,20,19,'#455e82');rect(-7,-67,14,3,'#e9c779');
 rect(-27,-82,9,48,'#bf9a87');rect(19,-82,9,48,'#bf9a87');
 circle(0,-103,20,'#bd927e');rect(-23,-126,46,15,'#193657');rect(-30,-117,60,8,'#15314e');
 rect(-9,-106,6,5,'#162230');rect(6,-106,6,5,'#162230');
 rect(-2,-95,8,2,'#523c3e');
 g.restore()
}
function drawObstacles(){
 for(const ob of obstacles){
  if(ob.x<cam-145||ob.x>cam+W+145)continue;
  const x=ob.x,y=GROUND;
  if(ob.type==='cone'){
   polygon([[x-23,y],[x,y-51],[x+23,y]],'#f98766');
   rect(x-11,y-28,22,8,'#f6e3c2');rect(x-29,y-6,58,7,'#e2aa67');
  }else if(ob.type==='barrel'){
   rect(x-24,y-66,48,64,'#c96e68');ellipse(x,y-65,24,8,'#e69582');
   rect(x-25,y-47,50,8,'#fff1c5');rect(x-25,y-20,50,8,'#fff1c5');
  }else if(ob.type==='barricade'){
   rect(x-40,y-91,80,55,'#d1dadc');rect(x-44,y-93,88,9,'#3c5e73');
   for(let i=0;i<4;i++)polygon([[x-38+i*22,y-40],[x-23+i*22,y-89],[x-12+i*22,y-89],[x-27+i*22,y-40]],'#ea7763');
   rect(x-30,y-36,8,37,'#637e8c');rect(x+22,y-36,8,37,'#637e8c');
  }else if(ob.type==='duck'){
   rect(x-48,y-124,96,28,'#1a4158');rect(x-48,y-131,96,7,'#afdecd');
   rect(x-48,y-97,96,6,'#edbd87');
   txt('AGACHE!',x,y-110,15,'#f6eeb7');
   rect(x-51,y-96,6,95,'#496574');rect(x+45,y-96,6,95,'#496574')
  }else if(ob.type==='cop'){
   drawCop(x+Math.sin(sceneTime*1.3+ob.phase)*17,y,sceneTime+ob.phase)
  }
 }
}
function drawTokens(){
 for(const t of tokens){
  if(t.taken||t.x<cam-45||t.x>cam+W+45)continue;
  const y=t.y+Math.sin(sceneTime*4+t.t)*4;
  const col=t.kind==='gold'?'#ffe28b':'#89ffe0';
  circle(t.x,y,14,col);circle(t.x,y,9,'#397b82');
  txt(t.kind==='gold'?'★':'S',t.x,y+1,16,col)
 }
 for(const l of letters){
  if(l.taken||l.x<cam-45||l.x>cam+W+45)continue;
  const y=l.y+Math.sin(sceneTime*3+l.phase)*5;
  g.save();g.translate(l.x,y);g.rotate(Math.sin(sceneTime*1.8)*.06);
  g.shadowColor='#ffe68c';g.shadowBlur=19;
  txt(l.value,0,0,42,'#fff08a');g.shadowBlur=0;g.restore()
 }
}
function drawSkater(){
 const x=player.x,y=player.y;
 g.save();g.translate(Math.round(x),Math.round(y));
 if(player.invulnerable>0&&Math.floor(sceneTime*14)%2===0)g.globalAlpha=.50;
 // Flat contact shadow, fading over jumps.
 const distGround=Math.max(0,GROUND-y);
 ellipse(2,5,47+distGround*.08,8,'#0d23344a');
 let crouch=(input.duck&&player.grounded)?34:player.grinding?10:0;
 const animated=Math.sin(player.pose)*4;
 const airborne=!player.grounded&&!player.grinding;
 // Board and feet move together, board rotates for kickflips.
 g.save();g.translate(0,-11);
 const flipScale=player.flipLife>0?Math.max(.11,Math.abs(Math.cos(player.flip))):1;
 const shove=player.flipLife>0?Math.sin(player.flip)*.12:0;
 g.rotate(player.grinding?-.16:shove);
 g.scale(1,flipScale);
 rect(-45,-5,90,9,'#f8a45c');
 rect(-39,-7,78,4,'#24394f');
 rect(-46,-6,9,11,'#f5be71');rect(36,-6,9,11,'#f5be71');
 rect(-30,5,60,4,'#738693');
 for(const ax of [-27,27]){
  circle(ax,10,10,'#25334b');circle(ax,10,6,'#c9e9e3');circle(ax,10,2,'#324757')
 }
 g.restore();
 // Body rotates around its center during 360 with squash perspective.
 g.save();g.translate(0,-76+crouch*.25);g.scale(Math.max(.17,Math.abs(Math.cos(player.spin))),1);g.translate(0,76-crouch*.25);
 const lean=airborne?-.08:-.035;
 g.rotate(lean);
 // Baggy pants + sneaker articulation
 const knee=airborne?13:Math.min(8,Math.abs(animated));
 polygon([[-19,-71+crouch],[-2,-72+crouch],[0,-38+crouch],[10,-26+crouch],[1,-18+crouch],[-14,-34+crouch]],'#34486c');
 polygon([[4,-70+crouch],[24,-70+crouch],[18,-34+crouch],[26,-24+crouch],[8,-20+crouch],[2,-45+crouch]],'#426087');
 line(-5,-50+crouch,4,-38+crouch,'#6c86a4',3);
 // Shoes planted near skateboard
 rect(-17,-27+crouch,29,11,'#e6e2db');rect(8,-28+crouch,32,10,'#f9e8d6');
 rect(-13,-20+crouch,27,4,'#a1cbd2');rect(10,-20+crouch,29,4,'#a1cbd2');
 // sweatshirt body
 polygon([[-23,-125+crouch],[15,-127+crouch],[26,-70+crouch],[-22,-68+crouch]],profile.shirt);
 polygon([[-17,-118+crouch],[14,-119+crouch],[20,-98+crouch],[-20,-98+crouch]],'#e7e8b3');
 txt('96',0,-106+crouch,16,'#24414a');
 rect(-23,-75+crouch,49,7,'#2b5762');
 // Arms: left hand trails behind, right forward holding balance.
 line(-23,-114+crouch,-37,-77+crouch,'#8b5748',13);
 line(15,-113+crouch,34,-83+crouch-knee*.5,'#a46b57',12);
 circle(-39,-75+crouch,7,'#b7846a');circle(35,-82+crouch-knee*.5,7,'#b7846a');
 // Neck and head. Photo becomes a pixel-art facial texture on the character.
 rect(-5,-133+crouch,13,16,'#ad765c');
 const headY=-154+crouch;
 circle(1,headY,24,'#b98265');
 if(photo){
  g.save();
  g.beginPath();g.ellipse(1,headY,22,23,0,0,TAU);g.clip();
  g.imageSmoothingEnabled=false;g.drawImage(photo,-21,headY-23,44,46);
  g.restore()
 }else{
  rect(-6,headY-4,6,5,'#283038');rect(9,headY-4,6,5,'#283038');
  rect(12,headY+5,7,4,'#7a4c44');rect(-2,headY+12,13,3,'#74463c')
 }
 if(profile.hair==='dread'){
  for(let i=0;i<7;i++){
   const xx=-23+i*8;
   line(xx,headY-21,xx-3+Math.sin(sceneTime*5+i)*2,headY+35,'#272733',6)
  }
  rect(-22,headY-28,45,12,'#2a2831')
 }else if(profile.hair==='long'){
  rect(-22,headY-23,44,10,'#353039');
  rect(-27,headY-17,10,45,'#2b2735');rect(19,headY-15,9,41,'#2b2735')
 }else if(profile.hair==='short'){
  rect(-22,headY-26,45,14,'#252c33')
 }else{
  rect(-25,headY-30,50,13,'#193f53');
  rect(14,headY-21,28,7,'#2c6e79');
  rect(-22,headY-34,48,7,'#49b0a0')
 }
 g.restore();
 // action sweat and sticker
 if(player.grinding){
  for(let j=0;j<5;j++){
   const xx=-24+j*13;
   line(xx,-1,xx-7-rnd(0,2),11,'#fff7a0',2.3)
  }
 }
 g.restore()
}
function render(){
 drawBackground();
 g.save();
 if(screenShake>0)g.translate(Math.sin(sceneTime*85)*screenShake*13,Math.cos(sceneTime*74)*screenShake*9);
 g.translate(-Math.round(cam),0);
 drawGround();drawBackgroundObjects();drawRails();drawObstacles();drawTokens();
 drawSkater();
 for(const p of sparks){
  g.globalAlpha=Math.max(0,Math.min(1,p.life/p.max));
  rect(p.x,p.y,p.size,p.size,p.color)
 }
 g.globalAlpha=1;
 // Checkpoint flags
 for(const cp of checkpoints.slice(1)){
  if(cp>cam-70&&cp<cam+W+70){
   rect(cp,GROUND-145,5,145,'#becbd2');
   polygon([[cp+5,GROUND-145],[cp+75,GROUND-131],[cp+5,GROUND-104]],'#d5ff81');
   txt('CHECK',cp+33,GROUND-127,12,'#1e4a41')
  }
 }
 if(END-145>cam-100&&END-145<cam+W+100){
  for(let i=0;i<7;i++){
   rect(END-125,GROUND-210+i*30,55,15,i%2?'#1a3c4f':'#f9e7b8')
  }
  rect(END-125,GROUND-210,8,210,'#e4faf9');
  rect(END-76,GROUND-210,8,210,'#e4faf9');
  txt('FINISH',END-100,GROUND-235,33,'#d9ff8f')
 }
 g.restore();
 // VHS-style soft vignette and tiny scanlines, low cost.
 const grad=g.createRadialGradient(W/2,H/2,100,W/2,H/2,620);
 grad.addColorStop(0,'#050f1c00');grad.addColorStop(1,'#06132250');
 rect(0,0,W,H,grad);
 g.globalAlpha=.085;
 for(let y=1;y<H;y+=5)rect(0,y,W,1,'#123245');
 g.globalAlpha=1;
 if(mode==='paused')rect(0,0,W,H,'#07132333')
}
function frame(time){
 raf=requestAnimationFrame(frame);
 if(!last)last=time;
 let dt=Math.min(.042,(time-last)/1000);last=time;frameNo++;
 update(dt);
 if(mode!=='playing'){sceneTime+=dt*.3;if(toastTime>0){toastTime-=dt;if(toastTime<=0)E('toast').classList.remove('show')}}
 render()
}
function tap(which){
 if(which==='jump')jump();
 else if(which==='kick')performTrick('kick');
 else if(which==='spin')performTrick('spin');
 else if(which==='smoke')performTrick('shove')
}
function keyboard(e,down){
 const pressed=e.code;
 if(['Space','ArrowDown','ShiftLeft','ShiftRight','KeyZ','KeyX','KeyC','KeyP'].includes(pressed))e.preventDefault();
 if(pressed==='ArrowDown'||pressed==='KeyS')input.duck=down;
 if(pressed==='ShiftLeft'||pressed==='ShiftRight'){
  input.grind=down;
  if(down)tryGrind()
 }
 if(!down||e.repeat)return;
 if(pressed==='Space'||pressed==='ArrowUp')tap('jump');
 if(pressed==='KeyZ')tap('kick');
 if(pressed==='KeyX')tap('spin');
 if(pressed==='KeyC')tap('smoke');
 if(pressed==='KeyP')pause()
}
document.addEventListener('keydown',e=>keyboard(e,true));
document.addEventListener('keyup',e=>keyboard(e,false));
window.addEventListener('blur',()=>{
 input.duck=false;input.grind=false;
 if(mode==='playing')pause()
});
for(const button of document.querySelectorAll('[data-tap]')){
 button.addEventListener('click',()=>tap(button.dataset.tap))
}
for(const button of document.querySelectorAll('[data-hold]')){
 const key=button.dataset.hold;
 button.addEventListener('pointerdown',e=>{
  e.preventDefault();input[key]=true;button.classList.add('pressed');
  if(key==='grind')tryGrind();
  try{button.setPointerCapture(e.pointerId)}catch(error){}
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture']){
  button.addEventListener(event,()=>{input[key]=false;button.classList.remove('pressed')})
 }
}
profileLoad();makeLevel();
state={health:3,speed:298,score:0,record:restoreHigh(),collected:new Set(),objectiveDone:new Set(),
 jumpCount:0,trickCount:0,grindCount:0,bestCombo:0,comboBase:0,comboMult:1,comboNames:[],comboTimer:0,comboActive:false,
 checkpoint:100,time:0,coinCount:0};
hud(true);requestAnimationFrame(frame);
window.SKATE96_TEST={getStatus:()=>({mode,x:Math.round(player.x),health:state.health,score:state.score,grinds:state.grindCount,jumps:state.jumpCount,tricks:state.trickCount}),
 start:reset,ollie:jump,trick:performTrick,step:update,profile:()=>({hasPhoto:!!photo,shirt:profile.shirt,hair:profile.hair})};
})();