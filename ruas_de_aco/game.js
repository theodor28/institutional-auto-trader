(()=>{'use strict';
/* RUAS DE AÇO '96 — original side-scrolling arcade beat-em-up.
   16-bit protagonist uses the images designed in this conversation.
   Movement, attacks, enemy AI, combos, stage waves, collision, particles and
   audio run entirely on-device; no analytics or third-party game engines. */
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
const W=960,H=540,TAU=Math.PI*2,END=4560,GRAVITY=1840;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a),d2=(a,b)=>Math.hypot(a.x-b.x,(a.d-b.d)*1.8);
const key={left:false,right:false,up:false,down:false,dash:false};
const waves=[
 {x:300,label:'RUA DAS OFICINAS',foes:['punk','punk']},
 {x:1120,label:'BECO DA ESTAÇÃO',foes:['punk','runner','punk']},
 {x:1960,label:'AVENIDA CENTRAL',foes:['runner','brute','punk','runner']},
 {x:2890,label:'BAIXO VIADUTO',foes:['brute','runner','brute']},
 {x:3840,label:'ACERTO FINAL',foes:['punk','brute','boss']}
];
const p={x:126,d:55,z:0,vz:0,facing:1,hp:100,maxHp:100,lives:3,power:70,
  speed:265,jumping:false,action:null,actionTime:0,actionDone:false,comboPunch:0,comboPunchTimer:0,
  invincible:0,animClock:0,hitstun:0,kills:0,score:0,comboHits:0,comboPoints:0,
  comboTime:0,bestCombo:0,attackCount:0,walkPhase:0,queuedAction:null};
const enemies=[],drops=[],particles=[],popups=[],signs=[],decor=[],obstacles=[];
let state='menu',curWave=-1,clearUntil=0,startedWave=new Set(),camera=0,prevTime=0,nowTime=0,
  toastTime=0,screenShake=0,lastHud=0,lastMusic=0,musicStep=0,record=0,assetsReady=false;
let soundOn=true,audioCtx=null;
try{record=Number(localStorage.getItem('ruas-de-aco-record')||0)||0}catch(e){}
const sprite=new Image();
sprite.onload=()=>{assetsReady=true;const box=$('heroPortrait');box.textContent='';box.style.backgroundImage='url('+sprite.src+')';box.style.backgroundRepeat='no-repeat';box.style.backgroundSize='720px 76px';box.style.backgroundPosition='left top'};
sprite.onerror=()=>{$('heroPortrait').textContent='★';assetsReady=false};
if(window.STEINER_FIGHT_SPRITES) sprite.src=window.STEINER_FIGHT_SPRITES;
const SP={idle:0,walk1:1,walk2:2,walk3:3,walk4:4,run:5,crouch:6,jump:7,
  guard:8,jab:9,punch:10,uppercut:11,kick:12,roundkick:13,jumpkick:14,hit:15,fall:16,win:17};
const CW=50,CH=82;
function tone(freq=390,dur=.11,type='square',gain=.028){
 if(!soundOn)return;
 try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  const t=audioCtx.currentTime,o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.66),t+dur);
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(audioCtx.destination);
  o.start(t);o.stop(t+dur+.01)
 }catch(e){}
}
function music(dt){
 if(!soundOn||state!=='playing')return;
 lastMusic-=dt;if(lastMusic>0)return;
 lastMusic+=.25;
 const bass=[110,110,146,110,98,123,110,87];
 const mel=[0,330,0,293,392,0,349,293,0,330,392,0,261,294,330,0];
 if(musicStep%2===0)tone(bass[(musicStep/2)%bass.length],.18,'triangle',.008);
 if(mel[musicStep%16])tone(mel[musicStep%16],.068,'square',.006);
 if(musicStep%4===2)tone(940,.024,'triangle',.004);
 musicStep++;
}
function showToast(s,time=2.2){$('toast').textContent=s;$('toast').classList.add('visible');toastTime=time}
function spark(x,y,col,n=10,power=170){
 for(let i=0;i<n;i++){const a=rand(0,TAU),v=rand(power*.3,power);
  particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-rand(10,40),life:rand(.24,.68),max:.68,col,size:rand(2,7)})
 }while(particles.length>170)particles.shift()
}
function popup(x,y,text,col='#e5ff9d'){popups.push({x,y,text,col,life:1,vy:-45});if(popups.length>24)popups.shift()}
function reset(){
 p.x=126;p.d=55;p.z=0;p.vz=0;p.facing=1;p.hp=100;p.maxHp=100;p.lives=3;p.power=70;
 p.jumping=false;p.action=null;p.actionTime=0;p.actionDone=false;p.comboPunch=0;p.comboPunchTimer=0;
 p.invincible=1.1;p.animClock=0;p.hitstun=0;p.kills=0;p.score=0;p.comboHits=0;p.comboPoints=0;
 p.comboTime=0;p.bestCombo=0;p.attackCount=0;p.walkPhase=0;p.queuedAction=null;
 enemies.length=0;drops.length=0;particles.length=0;popups.length=0;startedWave.clear();
 curWave=-1;clearUntil=0;nowTime=0;lastHud=0;lastMusic=0;musicStep=0;camera=0;screenShake=0;
 Object.keys(key).forEach(k=>key[k]=false);
 state='playing';$('menu').classList.add('hidden');$('pauseScreen').classList.add('hidden');$('endScreen').classList.add('hidden');
 $('bossHud').classList.add('hidden');
 showToast('STAGE 01 · RESGATE DREADTOWN',2.9);
 updateUI(true);tone(650,.14)
}
function pause(){if(state==='playing'){state='paused';$('pauseScreen').classList.remove('hidden')}
 else if(state==='paused'){state='playing';$('pauseScreen').classList.add('hidden')}}
function finish(win){
 if(state!=='playing')return;
 state=win?'won':'lost';
 if(win){p.score+=3000+1000*p.lives;saveRecord();tone(940,.26,'triangle')}else tone(106,.35,'sawtooth');
 $('endIcon').textContent=win?'🏆':'💔';
 $('endTitle').textContent=win?'DREADTOWN ESTÁ LIVRE!':'FIM DE JOGO';
 $('endDesc').textContent=win?'Você derrotou o Rei do Asfalto e protegeu a cidade!':'A gangue venceu esta rodada. Recomece e use mais esquivas, saltos e combos.';
 $('endScore').textContent=p.score.toLocaleString('pt-BR')+' PONTOS';
 $('endScreen').classList.remove('hidden');updateUI(true)
}
function saveRecord(){if(p.score>record){record=p.score;try{localStorage.setItem('ruas-de-aco-record',String(record))}catch(e){}}}
function healthDamage(amount){
 if(state!=='playing'||p.invincible>0)return;
 p.hp=Math.max(0,p.hp-amount);p.hitstun=.35;p.invincible=.88;screenShake=.32;
 p.z=Math.max(0,p.z);p.action=null;p.actionTime=0;
 if(p.comboHits>=2){p.comboHits=0;p.comboPoints=0;}
 spark(p.x,groundScreen(p.d)-88-p.z,'#ff9d8b',11);tone(115,.20,'sawtooth');
 if(p.hp<=0){
  p.lives--;
  if(p.lives<=0){finish(false);return}
  p.hp=100;p.invincible=2;p.hitstun=.4;
  showToast('♥ VIDA EXTRA · LEVANTE E LUTE!',2.2)
 }else showToast('CUIDADO! '+p.hp+' DE ENERGIA',1.0);
}
function spawnEnemy(type,x,d,idx){
 const stats={punk:{hp:75,speed:104,damage:10,range:84},
 runner:{hp:60,speed:146,damage:8,range:79},
 brute:{hp:142,speed:74,damage:17,range:95},
 boss:{hp:430,speed:111,damage:22,range:112}}[type];
 const e={type,x,d,hp:stats.hp,max:stats.hp,speed:stats.speed,damage:stats.damage,
  range:stats.range,facing:-1,vx:0,z:0,vz:0,action:null,actionTime:0,actionDone:false,
  hitstun:0,invincible:0,attackCd:rand(.7,1.7),walk:rand(0,TAU),dead:false,deathT:0,idx};
 enemies.push(e);return e
}
function beginWave(id){
 if(startedWave.has(id))return;
 startedWave.add(id);curWave=id;clearUntil=0;
 const wave=waves[id],center=clamp(Math.max(p.x+270,wave.x+280),200,END-200);
 wave.foes.forEach((type,i)=>{
  const x=center+i*110+(i%2?55:0);
  const d=27+(i*23)%62;
  spawnEnemy(type,x,d,i)
 });
 showToast(id===4?'⚠ CHEFÃO! REI DO ASFALTO':'⚔ '+wave.label+' · DERROTE A GANGUE',3);
 tone(id===4?180:440,.3,id===4?'sawtooth':'square',.05);
 if(id===4)$('bossHud').classList.remove('hidden')
}
function waveClear(){
 const id=curWave;if(id<0)return;
 curWave=-1;clearUntil=nowTime+3.5;
 const reward=1000+id*450;p.score+=reward;p.power=Math.min(100,p.power+20);saveRecord();
 showToast(id===4?'🏆 REI DO ASFALTO DERROTADO!':'✅ ÁREA LIBERADA! AVANCE ➜',3);
 spark(p.x+70,groundScreen(p.d)-110,'#eaff8b',28,235);tone(960,.18,'triangle');
 if(id===4)$('bossHud').classList.add('hidden');
}
const ATTACKS={
 punch1:{name:'DIRETO',dur:.30,contact:.115,range:116,lane:37,damage:20,knock:20,frame:'jab',power:5},
 punch2:{name:'CRUZADO',dur:.33,contact:.125,range:118,lane:40,damage:23,knock:27,frame:'punch',power:6},
 punch3:{name:'UPPERCUT',dur:.40,contact:.165,range:125,lane:42,damage:40,knock:74,frame:'uppercut',power:9},
 kick:{name:'CHUTE LATERAL',dur:.46,contact:.19,range:152,lane:45,damage:39,knock:59,frame:'kick',power:10},
 airkick:{name:'CHUTE VOADOR',dur:.48,contact:.17,range:150,lane:45,damage:54,knock:65,frame:'jumpkick',power:11},
 grab:{name:'AGARRÃO',dur:.43,contact:.15,range:79,lane:32,damage:52,knock:125,frame:'throw',power:7},
 special:{name:'FÚRIA DE AÇO',dur:.65,contact:.23,range:195,lane:75,damage:68,knock:110,frame:'roundkick',power:0}
};
function startAction(type){
 if(state!=='playing'||p.hitstun>0)return;
 if(p.action){
  p.queuedAction=type;return
 }
 if(type==='special'){
  if(p.power<34){showToast('⚡ FALTA ENERGIA PARA O ESPECIAL!',1.5);tone(150,.08);return}
  p.power-=34
 }
 if(type==='punch'){
  p.comboPunch=p.comboPunchTimer>0?(p.comboPunch+1)%3:0;
  type=['punch1','punch2','punch3'][p.comboPunch];p.comboPunchTimer=.8
 }
 if(type==='kick'&&p.z>32)type='airkick';
 p.action=type;p.actionTime=0;p.actionDone=false;p.attackCount++;
 tone(type==='special'?220:type==='kick'?370:430,.09,type==='special'?'sawtooth':'square')
}
function jump(){
 if(state!=='playing'||p.z>1||p.hitstun>0)return;
 p.vz=710;p.z=2;p.jumping=true;tone(260,.12,'triangle');spark(p.x,groundScreen(p.d)-11,'#d7e9ce',5,75)
}
function resolveHit(){
 const data=ATTACKS[p.action];if(!data)return;
 let impacts=0;
 for(const e of enemies){
  if(e.dead||e.invincible>0)continue;
  const dx=(e.x-p.x)*p.facing,dd=Math.abs(e.d-p.d);
  if((data.name==='FÚRIA DE AÇO'?Math.abs(e.x-p.x)<data.range:dx>-36&&dx<data.range)&&dd<data.lane){
   if(data.name==='CHUTE VOADOR'&&p.z<22)continue;
   e.hp-=data.damage;e.hitstun=data.name==='FÚRIA DE AÇO'?.65:.34;
   e.invincible=.16;
   e.x+=p.facing*data.knock;
   if(e.hp<=0)e.hp=0;
   impacts++;
   const y=groundScreen(e.d)-83-e.z;
   spark(e.x,y,data.name==='FÚRIA DE AÇO'?'#b9f6ff':'#ffdc91',data.name==='FÚRIA DE AÇO'?19:12,190);
   popup(e.x,y-35,'-'+data.damage,'#ffe9a3');
   p.power=Math.min(100,p.power+data.power);
   p.comboHits++;p.comboPoints+=data.damage*12+(p.comboHits>1?180:0);p.comboTime=2.6;
   p.score+=data.damage*6;saveRecord();screenShake=.12;
   tone(rand(110,160),.095,'sawtooth',.042);
   if(e.hp===0)killEnemy(e)
  }
 }
 if(impacts&&p.comboHits>=2){
  $('comboTitle').textContent=p.comboHits+' HIT COMBO';
  $('comboScore').textContent='+'+p.comboPoints.toLocaleString('pt-BR');
  $('comboPop').classList.add('visible')
 }
 if(!impacts&&p.action!=='special')tone(190,.045,'triangle',.009)
}
function killEnemy(e){
 if(e.dead)return;
 e.dead=true;e.deathT=.65;p.kills++;
 p.score+=(e.type==='boss'?3500:e.type==='brute'?450:270);
 popup(e.x,groundScreen(e.d)-135,e.type==='boss'?'+3500':'KO! +'+(e.type==='brute'?450:270),'#deff93');
 const chance=Math.random();if(chance<.57||e.type==='boss'){
  drops.push({x:e.x,d:e.d,type:chance<.30?'food':'coin',taken:false,phase:rand(0,TAU)})
 }
 tone(e.type==='boss'?100:170,.24,'sawtooth',.04);saveRecord()
}
function updatePlayer(dt){
 p.invincible=Math.max(0,p.invincible-dt);p.hitstun=Math.max(0,p.hitstun-dt);p.comboPunchTimer=Math.max(0,p.comboPunchTimer-dt);
 p.power=Math.min(100,p.power+dt*.75);
 if(p.comboTime>0){p.comboTime-=dt;if(p.comboTime<=0){
  if(p.comboHits>=2){p.bestCombo=Math.max(p.bestCombo,p.comboHits);p.score+=p.comboPoints;saveRecord()}
  p.comboHits=0;p.comboPoints=0;$('comboPop').classList.remove('visible')
 }}
 if(p.action){
  p.actionTime+=dt;
  const a=ATTACKS[p.action];
  if(p.actionTime>=a.contact&&!p.actionDone){p.actionDone=true;resolveHit()}
  if(p.actionTime>=a.dur){
   p.action=null;p.actionTime=0;p.actionDone=false;
   if(p.queuedAction){const q=p.queuedAction;p.queuedAction=null;startAction(q)}
  }
 }
 if(p.hitstun<=0){
  const dx=(key.right?1:0)-(key.left?1:0),dy=(key.down?1:0)-(key.up?1:0);
  const len=Math.hypot(dx,dy)||1;const move=p.action?0.47:1;
  const rate=p.speed*(key.dash?1.44:1)*move;
  p.x+=dx/len*rate*dt;p.d+=dy/len*rate*.68*dt;
  p.d=clamp(p.d,12,102);
  if(dx)p.facing=Math.sign(dx);
  p.walkPhase+=Math.hypot(dx,dy)*dt*(key.dash?12:9);
 }
 if(curWave>=0){
  const anchor=waves[curWave].x;
  p.x=clamp(p.x,Math.max(80,anchor-245),anchor+465)
 }else p.x=clamp(p.x,50,END+90);
 if(p.z>0||p.vz>0){
  p.z+=p.vz*dt;p.vz-=GRAVITY*dt;
  if(p.z<=0){p.z=0;p.vz=0;p.jumping=false}
 }
 p.animClock+=dt;
}
function enemyMove(e,dt){
 if(e.dead){e.deathT=Math.max(0,e.deathT-dt);return}
 e.invincible=Math.max(0,e.invincible-dt);
 if(e.hitstun>0){e.hitstun=Math.max(0,e.hitstun-dt);return}
 e.walk+=dt*(e.type==='runner'?13:9);
 e.attackCd-=dt;
 const dx=p.x-e.x,dd=p.d-e.d;
 e.facing=dx>0?1:-1;
 if(Math.abs(dx)>e.range*.79||Math.abs(dd)>19){
  e.x+=clamp(dx,-1,1)*Math.min(Math.abs(dx),e.speed*dt)*(Math.abs(dx)>24?1:.1);
  e.d+=clamp(dd,-1,1)*Math.min(Math.abs(dd),e.speed*.43*dt);
  e.x=clamp(e.x,60,END+150);
 }else if(e.attackCd<=0&&p.invincible<=0){
  e.action='hit';e.actionTime=0;e.actionDone=false;e.attackCd=rand(e.type==='boss'?.75:1.2,e.type==='boss'?1.2:2.1)
 }
 if(e.action){
  e.actionTime+=dt;
  if(e.actionTime>.18&&!e.actionDone){
   e.actionDone=true;
   if(Math.abs(p.x-e.x)<e.range+12&&Math.abs(p.d-e.d)<24&&p.z<55)healthDamage(e.damage)
  }
  if(e.actionTime>.42)e.action=null
 }
}
function collectDrops(){
 for(const drop of drops){
  if(drop.taken)continue;
  if(Math.abs(p.x-drop.x)<38&&Math.abs(p.d-drop.d)<25){
   drop.taken=true;
   if(drop.type==='food'){
    const hp=Math.min(100,p.hp+29);p.hp=hp;
    popup(drop.x,groundScreen(drop.d)-90,'+29 HP','#bbff99');
    showToast('🍗 ENERGIA RECUPERADA!',1.3)
   }else{
    p.score+=500;p.power=Math.min(100,p.power+13);
    popup(drop.x,groundScreen(drop.d)-90,'+500','#ffe8a8')
   }
   tone(860,.11,'triangle')
  }
 }
}
function updateWaves(){
 if(curWave>=0){
  if(enemies.filter(e=>!e.dead).length===0)waveClear();
  return
 }
 const next=waves.findIndex((w,i)=>!startedWave.has(i)&&p.x>=w.x);
 if(next>=0)beginWave(next);
 if(startedWave.size===waves.length&&enemies.every(e=>e.dead)&&p.x>END-100)finish(true)
}
function update(dt){
 nowTime+=dt;if(state!=='playing')return;
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible')}
 screenShake=Math.max(0,screenShake-dt);
 music(dt);updatePlayer(dt);
 enemies.forEach(e=>enemyMove(e,dt));collectDrops();updateWaves();
 if(screenShake>0)screenShake=Math.max(0,screenShake-dt);
 for(let i=particles.length-1;i>=0;i--){
  const o=particles[i];o.x+=o.vx*dt;o.y+=o.vy*dt;o.vy+=210*dt;o.life-=dt;if(o.life<0)particles.splice(i,1)
 }
 for(let i=popups.length-1;i>=0;i--){
  const o=popups[i];o.y+=o.vy*dt;o.life-=dt;if(o.life<0)popups.splice(i,1)
 }
 camera=lerp(camera,clamp(p.x-330,0,END-W+100),Math.min(1,dt*4.5));
 if(nowTime-lastHud>.085){lastHud=nowTime;updateUI()}
}
function updateUI(force=false){
 $('lifeText').textContent=Math.max(0,Math.round(p.hp))+' / 100';$('lifeBar').style.width=p.hp+'%';
 $('lives').textContent='♥ '.repeat(Math.max(0,p.lives));$('lifeCount').textContent=p.lives;
 $('score').textContent=p.score.toLocaleString('en-US').padStart(6,'0');
 $('kills').textContent=p.kills;$('bestCombo').textContent=p.bestCombo;
 $('record').textContent=record.toLocaleString('pt-BR');
 $('waveNum').textContent=Math.min(5,Math.max(1,startedWave.size))+' / 5';
 $('enemyCount').textContent=enemies.filter(e=>!e.dead).length;
 const prog=clamp(p.x/END*100,0,100);
 $('progressFill').style.width=prog+'%';$('sideProgress').style.width=prog+'%';
 $('progressLabel').textContent='DREADTOWN • '+prog.toFixed(0)+'%';$('missionPct').textContent=prog.toFixed(0)+'%';
 $('placeLabel').textContent=(curWave>=0?waves[curWave].label:p.x>2800?'BAIXO VIADUTO':p.x>1800?'AVENIDA CENTRAL':'CENTRO DE DREADTOWN');
 $('hintArrow').classList.toggle('hidden',state!=='playing'||curWave>=0||nowTime<clearUntil||p.x>END-50);
 const boss=enemies.find(e=>e.type==='boss');
 if(boss&&!boss.dead){$('bossHud').classList.remove('hidden');$('bossLifeBar').style.width=clamp(boss.hp/boss.max*100,0,100)+'%'}
 else $('bossHud').classList.add('hidden');
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill()}
function line(x,y,X,Y,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke()}
function polygon(a,color){ctx.fillStyle=color;ctx.beginPath();a.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function text(s,x,y,size=13,color='#fff',align='center',font='Arial Black'){ctx.font='900 '+size+'px '+font+',Arial,sans-serif';ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(String(s),x,y)}
function groundScreen(d){return 374+d*.88}
function drawBg(){
 const sky=ctx.createLinearGradient(0,0,0,375);
 const night=p.x>2300?0.35:0;
 sky.addColorStop(0,p.x>2200?'#302c5c':'#435d8f');sky.addColorStop(.7,p.x>2200?'#98668e':'#cf8095');sky.addColorStop(1,'#edaf8a');
 rect(0,0,W,H,sky);
 // Sun/moon and atmospheric glow
 const sunX=750-camera*.035%450;
 ellipse(sunX,105,50,50,p.x>2500?'#e6d8d9':'#ffe1ad');
 // Distant skyline at 0.14x scrolling.
 const par1=camera*.14;for(let i=Math.floor(par1/70)-2;i<Math.floor(par1/70)+18;i++){
  const x=i*70-par1,h=85+(i*31+791)%145;
  rect(x,364-h,65,h,'#5d587a');rect(x-3,361-h,71,7,'#4b4869');
  for(let yy=385-h;yy<352;yy+=21)for(let xx=x+9;xx<x+60;xx+=17){
   rect(xx,yy,8,11,(i*7+yy*3+xx*11)%13<5?'#e6afaa':'#9284a5')
  }
 }
 // High-rise foreground at 0.37x scroll.
 const par=camera*.35;for(let i=Math.floor(par/180)-2;i<Math.floor(par/180)+10;i++){
  const x=i*180-par,h=165+(i*39+421)%110;
  const c=i%3===0?'#344b69':i%3===1?'#3a5470':'#445775';
  rect(x,374-h,158,h,c);rect(x-5,371-h,168,10,'#263b56');
  for(let yy=391-h;yy<358;yy+=30)for(let xx=x+14;xx<x+145;xx+=29){
   const on=(i*17+yy*7+xx*3)%11<4;rect(xx,yy,15,19,on?'#f7c79d':'#66839a');
   if(!on)rect(xx+2,yy+2,11,15,'#3f607b')
  }
 }
 // Wires and overhead fixtures
 for(let n=0;n<3;n++)line(0,90+n*17,960,106+n*17,'#344662a8',1.3);
 // Sidewalk and street
 rect(0,356,W,184,'#475c71');rect(0,356,W,14,'#7a7983');
 rect(0,368,W,11,'#afb4b6');rect(0,380,W,7,'#5a626e');
 rect(0,487,W,53,'#31475c');
 for(let i=-1;i<11;i++){
  const x=i*105-camera*.75%105;
  rect(x,382,3,98,'#526475');rect(x,485,3,55,'#263b53');
  rect(x+29,515,50,4,'#e6ba92')
 }
}
function drawWorld(){
 const L=camera-100,R=camera+W+130;
 // stylized store facades, neon signs, pipes, dumpsters, lampposts
 for(let i=0;i<20;i++){
  const x=i*256+80;if(x<L||x>R)continue;
  const a=i%4;
  if(a===0){rect(x-38,247,160,103,'#3d6d78');rect(x-32,261,149,57,'#19374d');
   rect(x-17,268,122,23,'#d19b81');text(['OFICINA 96','LOJA SK8','AUTO PEÇAS','ARCADE'][i%4],x+45,280,18,'#203b4d');
   rect(x-16,297,120,17,'#75a4aa');for(let k=0;k<4;k++)rect(x-16+k*30,310,24,5,'#dfe6be');
  }else if(a===1){
   rect(x,283,62,67,'#395c6e');rect(x+6,292,50,54,'#29404e');text('NO',x+29,306,13,'#c5f4bf');
   text('FEAR',x+28,324,19,'#ff9b9d');
  }else if(a===2){
   rect(x,342,135,16,'#a0b9b9');rect(x+5,321,124,21,'#436d7d');text('RUAS DE AÇO',x+66,332,11,'#d1ffad');
  }else{
   rect(x+30,307,6,62,'#536675');
   ellipse(x+33,305,33,13,'#1e4353');rect(x-2,306,70,10,'#c89b81');text('LANCHES',x+32,311,12,'#ffecd1')
  }
  if(i%3===2){
   rect(x+130,264,7,123,'#405c64');rect(x+125,269,37,9,'#7a9898');
   circle(x+155,273,9,'#ffe3a5');circle(x+155,273,19,'#ffe3a521')
  }
 }
 // road vertical lanes, boxes, fire hydrants and posters
 for(let i=0;i<20;i++){
  const x=i*233+195;if(x<L||x>R)continue;
  if(i%3===0){
   rect(x,409,53,35,'#986d56');rect(x+4,411,45,30,'#bb9275');
   line(x,412,x+50,439,'#684f47',2);line(x+50,412,x,439,'#684f47',2)
  }else if(i%3===1){
   rect(x,411,20,35,'#bb6067');rect(x-7,417,34,7,'#e88b7f');rect(x-3,442,26,5,'#773f4b')
  }else{
   ellipse(x,443,17,7,'#25374480');
   rect(x-11,404,21,41,'#536b74');rect(x-15,400,29,6,'#829aa0')
  }
 }
 // arena boundary warning when group active
 if(curWave>=0){
  const x=waves[curWave].x+465;
  if(x>L&&x<R){
   for(let y=358;y<535;y+=24)rect(x-7,y,14,11,'#e8d17b99');
   text('PAREDE DE BATALHA',x-9,347,10,'#ffe7a6')
  }
 }
 if(p.x>END-350){rect(END,340,12,155,'#dce9e5');rect(END+75,340,12,155,'#dce9e5');rect(END,344,85,26,'#e9d98b');
  text('FINAL',END+41,356,18,'#224355')
 }
}
function playerFrame(e,isHero){
 if(e.dead)return SP.fall;
 if(e.hitstun>0)return SP.hit;
 if(e.action){
  if(isHero){const a=ATTACKS[e.action];return SP[a?.frame]??SP.guard}
  return e.action==='hit'?SP.jab:SP.guard
 }
 if(isHero&&p.z>15)return SP.jump;
 if(!isHero&&e.type==='boss'&&e.hitstun<=0&&e.action)return SP.punch;
 if(isHero&&(key.left||key.right||key.up||key.down))return [SP.walk1,SP.walk2,SP.walk3,SP.walk4][Math.floor(e.walkPhase*2.8)%4];
 if(!isHero&&Math.abs(e.x-p.x)>100)return [SP.walk1,SP.walk2,SP.walk3,SP.walk4][Math.floor(e.walk*2)%4];
 return isHero?SP.guard:SP.idle
}
function fallbackBody(x,y,scale,tint='#48a9ad'){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ellipse(0,3,35,7,'#182a3970');
 rect(-11,-68,13,60,'#455a8b');rect(3,-67,13,59,'#4b638e');
 rect(-18,-10,20,11,'#e7e8e1');rect(5,-10,20,11,'#f4e6de');
 rect(-22,-145,44,79,tint);rect(-24,-121,48,14,'#d9a25c');
 rect(-26,-133,11,49,'#bd876a');rect(16,-133,11,49,'#bd876a');
 circle(0,-161,24,'#b8826d');rect(-24,-184,46,11,'#282d3b');rect(-7,-164,6,5,'#252a38');rect(9,-164,6,5,'#252a38');
 ctx.restore()
}
function drawPerson(e,hero=false){
 if(e.dead&&e.deathT<=0)return;
 const foot=groundScreen(e.d),z=e.z||0,s=e.type==='boss'?2.00:e.type==='brute'?1.80:hero?1.72:1.55;
 const x=e.x,y=foot-z;
 ellipse(x,foot+7,31*s/1.72,8,'#10243960');
 ctx.save();
 ctx.globalAlpha=e.dead?clamp(e.deathT/.65,0,1):e.invincible>0&&hero&&Math.floor(nowTime*19)%2===0?.56:1;
 if(assetsReady){
  const index=playerFrame(e,hero);
  ctx.translate(Math.round(x),Math.round(y));
  ctx.scale(e.facing||1,1);
  if(!hero){
   ctx.filter=e.type==='boss'?'hue-rotate(210deg) saturate(1.5) brightness(.78)':e.type==='runner'?'hue-rotate(135deg) saturate(1.35)':'hue-rotate(290deg) saturate(.75) brightness(.85)';
  }
  ctx.imageSmoothingEnabled=false;
  // use a 50x82 cell; floor of sprite corresponds with bottom of cell.
  ctx.drawImage(sprite,index*CW,0,CW,CH,-CW*s*.5,-CH*s,CW*s,CH*s);
  ctx.filter='none';
 }else fallbackBody(x,y,s*.94,hero?'#268e8f':e.type==='boss'?'#a34c64':'#a5686c');
 ctx.restore();
 if(!hero&&!e.dead){
  const width=e.type==='boss'?120:68;
  rect(e.x-width/2,foot-z-CH*s-12,width,7,'#491e36');
  rect(e.x-width/2,foot-z-CH*s-12,width*e.hp/e.max,7,e.type==='boss'?'#f1ae73':'#cc6e70');
  if(e.type==='boss')text('REI DO ASFALTO',e.x,foot-z-CH*s-21,12,'#ffe2a5')
 }
}
function drawItems(){
 for(const drop of drops){
  if(drop.taken)continue;
  const y=groundScreen(drop.d)-21+Math.sin(nowTime*4+drop.phase)*3;
  circle(drop.x,y,17,drop.type==='food'?'#d9a969':'#d9dc78');
  circle(drop.x,y,12,drop.type==='food'?'#8d663e':'#6d8f53');
  text(drop.type==='food'?'♥':'★',drop.x,y,15,'#fff4c9')
 }
}
function drawFX(){
 for(const s of particles){ctx.globalAlpha=clamp(s.life/s.max,0,1);rect(s.x,s.y,s.size,s.size,s.col)}
 ctx.globalAlpha=1;
 for(const a of popups){ctx.globalAlpha=clamp(a.life,0,1);text(a.text,a.x,a.y,18,a.col);ctx.globalAlpha=1}
}
function render(){
 drawBg();ctx.save();if(screenShake>0)ctx.translate(rand(-8,8)*screenShake*2,rand(-6,6)*screenShake*2);
 ctx.translate(-camera,0);
 drawWorld();drawItems();
 const actors=[...enemies.filter(e=>!e.dead||e.deathT>0),p].sort((a,b)=>a.d-b.d);
 for(const a of actors)drawPerson(a,a===p);
 drawFX();ctx.restore();
 // VHS stripes and vignette.
 const shade=ctx.createRadialGradient(W*.48,H*.45,100,W*.48,H*.45,630);
 shade.addColorStop(0,'#05142200');shade.addColorStop(1,'#07142865');rect(0,0,W,H,shade);
 ctx.globalAlpha=.055;for(let i=2;i<H;i+=5)rect(0,i,W,1,'#011722');ctx.globalAlpha=1;
}
function frame(t){
 requestAnimationFrame(frame);
 if(!prevTime)prevTime=t;
 const dt=Math.min(.045,(t-prevTime)/1000);prevTime=t;
 if(state==='playing')update(dt);
 else{nowTime+=dt*.2;if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible')}}
 render()
}
const mapping={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'dash',ShiftRight:'dash'};
document.addEventListener('keydown',ev=>{
 if(mapping[ev.code]){key[mapping[ev.code]]=true;ev.preventDefault()}
 if(ev.repeat)return;
 if(ev.code==='KeyJ'){startAction('punch');ev.preventDefault()}
 if(ev.code==='KeyK'){startAction('kick');ev.preventDefault()}
 if(ev.code==='KeyL'){startAction('special');ev.preventDefault()}
 if(ev.code==='KeyU'){startAction('grab');ev.preventDefault()}
 if(ev.code==='Space'){jump();ev.preventDefault()}
 if(ev.code==='KeyP'){pause();ev.preventDefault()}
});
document.addEventListener('keyup',ev=>{if(mapping[ev.code]){key[mapping[ev.code]]=false;ev.preventDefault()}});
window.addEventListener('blur',()=>{Object.keys(key).forEach(k=>key[k]=false);if(state==='playing')pause()});
document.querySelectorAll('[data-hold]').forEach(btn=>{
 const direction=btn.dataset.hold;
 btn.addEventListener('pointerdown',ev=>{ev.preventDefault();key[direction]=true;btn.classList.add('pressed');try{btn.setPointerCapture(ev.pointerId)}catch(e){}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(event,()=>{key[direction]=false;btn.classList.remove('pressed')})
});
document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
 const action=btn.dataset.action;
 if(action==='jump')jump();else startAction(action)
}));
$('startBtn').addEventListener('click',reset);
$('playAgainBtn').addEventListener('click',reset);
$('pauseBtn').addEventListener('click',pause);
$('resumeBtn').addEventListener('click',pause);
$('restartBtn').addEventListener('click',reset);
$('restartPauseBtn').addEventListener('click',reset);
$('helpBtn').addEventListener('click',()=>{$('helpDialog').classList.remove('hidden');if(state==='playing')pause()});
$('helpClose').addEventListener('click',()=>$('helpDialog').classList.add('hidden'));
$('helpOk').addEventListener('click',()=>$('helpDialog').classList.add('hidden'));
$('soundBtn').addEventListener('click',()=>{soundOn=!soundOn;$('soundBtn').textContent=soundOn?'♫ SOM ON':'♫ SOM OFF';if(soundOn)tone(430,.1)});
$('fullscreenBtn').addEventListener('click',()=>{try{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()}catch(e){}});
window.RUAS96={version:'1.0',state:()=>({mode:state,x:p.x,hp:p.hp,lives:p.lives,score:p.score,kills:p.kills,wave:curWave,assetsReady}),start:reset,step:update,action:startAction};
updateUI(true);requestAnimationFrame(frame);
})();
