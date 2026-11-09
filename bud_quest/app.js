(()=>{'use strict';
/* BUD QUEST: DREADLAND v2 — Jogo de plataforma original.
   Toda a arte é desenhada em Canvas. Não há imagens ou músicas de terceiros.
   Buds e plantas são fictícios; sistema arcade, sem transações reais. */
const $=id=>document.getElementById(id);
const canvas=$('game'),c=canvas.getContext('2d');
const W=960,H=560,GROUND=443,PI=Math.PI,TWO=PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,dist=(x,y,u,v)=>Math.hypot(x-u,y-v);
const WORLDS=[
 {name:'Vila do Groove',sub:'O começo da lenda',theme:'sunny',w:4550,goal:12,color:'#7ebaa2',song:0,
   mission:'Cate 12 buds brilhantes, converse com o Mestre Roots e chegue ao portal da vila.',npc:'MESTRE ROOTS'},
 {name:'Plantação da Colina',sub:'Entre as folhas gigantes',theme:'plantation',w:4900,goal:16,color:'#5baf77',song:1,
   mission:'Explore as plantações, reúna 16 buds e escape das rondas da Seca.',npc:'DONA FOLHA'},
 {name:'Estrada da Neblina',sub:'As colinas escondidas',theme:'sunset',w:5250,goal:20,color:'#d7a4a3',song:2,
   mission:'Atravesse a névoa, desvie da Patrulha e recolha 20 buds.',npc:'TIO DREAD'},
 {name:'Festival da Lua',sub:'O show nunca acaba',theme:'night',w:5550,goal:24,color:'#6459a4',song:3,
   mission:'Recupere 24 buds para iluminar o Festival da Lua e abra o último portal.',npc:'DJ JAHZIN'}
];
const saveKey='bud-quest-dreadland-v2';
const input={left:false,right:false,jump:false,run:false};
const p={x:112,y:GROUND,vx:0,vy:0,dir:1,w:32,h:67,grounded:true,jumpCount:0,walk:0,smoking:0,smokeCooldown:0,immune:0};
const s={mode:'menu',stage:0,picked:0,wallet:0,total:0,coins:0,score:0,lives:3,maxLives:3,hasDouble:false,smokePlus:false,
  time:0,cam:0,checkpoint:110,level:null,particles:[],smokes:[],enemy:[],pickups:[],platforms:[],
  flora:[],decor:[],noticeTime:0,nearNpc:false,nearExit:false,saveTime:0,finished:false,winOpen:false,clouds:[],
  phase:0,coinsCollected:0,shake:0};
let sound=true,context=null,last=0,frameCount=0,noticeTimer=0;
function tone(freq=420,dur=.11,type='triangle',gain=.036){
 if(!sound)return;
 try{
  if(!context)context=new(window.AudioContext||window.webkitAudioContext)();
  const osc=context.createOscillator(),vol=context.createGain(),t=context.currentTime;
  osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.75),t+dur);
  vol.gain.setValueAtTime(gain,t);vol.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(vol);vol.connect(context.destination);osc.start(t);osc.stop(t+dur+.01)
 }catch(e){}
}
function triad(){tone(440,.15);setTimeout(()=>tone(660,.14),110);setTimeout(()=>tone(880,.16),220)}
let seed=1337;
function resetSeed(n){seed=(n>>>0)||1337}
function rng(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function R(a,b){return a+rng()*(b-a)}
function getSave(){try{const raw=JSON.parse(localStorage.getItem(saveKey)||'null');return raw&&raw.version===2?raw:null}catch(e){return null}}
function persist(){
 if(s.mode!=='playing'&&s.mode!=='paused')return;
 const pack={version:2,stage:s.stage,picked:s.picked,wallet:s.wallet,total:s.total,
  coins:s.coins,score:s.score,lives:s.lives,maxLives:s.maxLives,hasDouble:s.hasDouble,
  smokePlus:s.smokePlus,x:p.x,y:p.y,checkpoint:s.checkpoint};
 try{localStorage.setItem(saveKey,JSON.stringify(pack))}catch(e){}
}
function clearSave(){try{localStorage.removeItem(saveKey)}catch(e){}}
function toast(message,secs=2.6){
 const element=$('notice');element.textContent=message;element.classList.add('visible');
 s.noticeTime=secs
}
function overlay(icon,title,message,button){
 $('poster').textContent=icon;$('ovTitle').textContent=title;$('ovText').innerHTML=message;
 $('mainBtn').textContent=button;$('overlay').classList.remove('hidden')
}
function hideOverlay(){$('overlay').classList.add('hidden')}
function refresh(){
 const level=WORLDS[s.stage];
 $('missionTitle').textContent=level.sub;
 $('missionText').textContent=level.mission;
 $('missionValue').textContent=s.picked+' / '+level.goal;
 $('missionBar').style.width=Math.min(100,s.picked/level.goal*100)+'%';
 $('missionBar').style.background=s.picked>=level.goal?'linear-gradient(90deg,#ffbd66,#ffe891)':'linear-gradient(90deg,#6ed8ae,#d8ff75)';
 $('hudStage').textContent=(s.stage+1)+'/4';
 $('stageName').textContent=level.name.toUpperCase();
 $('hudBuds').textContent=s.picked;
 $('hudCoins').textContent=s.coins;
 $('hearts').textContent='♥'.repeat(s.lives)+'♡'.repeat(Math.max(0,s.maxLives-s.lives));
 $('wallet').textContent=s.wallet;
 $('picked').textContent=s.total;
 $('coins').textContent=s.coins;
 $('score').textContent=s.score.toLocaleString('pt-BR');
 for(const btn of document.querySelectorAll('[data-buy]')){
  const key=btn.dataset.buy;
  btn.disabled=s.mode!=='playing'||(key==='double'&&s.hasDouble)||(key==='smoke'&&s.smokePlus)||(key==='heart'&&s.lives>=s.maxLives)||s.coins<{double:120,smoke:85,heart:65}[key]
 }
}
function makeLevel(index,restore){
 const L=WORLDS[index];s.level=L;s.stage=index;s.finished=false;s.time=0;s.cam=0;s.particles=[];s.smokes=[];
 s.nearNpc=false;s.nearExit=false;s.shake=0;
 s.picked=restore?.picked||0;
 s.pickups=[];s.enemy=[];s.flora=[];s.decor=[];
 resetSeed(5009+index*938);
 // Ground segments have 75px canyons; reachable by jumping.
 const edges=[0,1080,1150,2130,2225,3240,3330,4250,4340,L.w];
 const grounds=[];
 for(let i=0;i<edges.length-1;i+=2){grounds.push({x:edges[i],w:edges[i+1]-edges[i]})}
 if(L.w>4500)grounds.push({x:4350,w:L.w-4350});
 s.grounds=grounds;
 s.platforms=[];
 for(let x=355,i=0;x<L.w-360;x+=235,i++){
  const y=[348,293,337,310,365,285][i%6];
  const width=[152,132,170,150,145,165][i%6];
  s.platforms.push({x:x-60,y,w:width,kind:i%3});
 }
 // bridge platforms for every gap
 for(let k=0;k<grounds.length-1;k++){
  const end=grounds[k].x+grounds[k].w,start=grounds[k+1].x,gap=start-end;
  if(gap>10&&gap<160)s.platforms.push({x:end-15,y:GROUND-77,w:gap+30,kind:2});
 }
 const used=new Set();
 function makePickup(x,y,kind='bud'){
  const key=Math.round(x/20)+':'+Math.round(y/20);
  if(used.has(key))return;used.add(key);
  s.pickups.push({x,y,kind,t:R(0,TWO),used:false,scale:kind==='gold'?1.12:1})
 }
 // Most of the buds are accessible from ground, extra valuable items above.
 for(let i=0,x=145;x<L.w-180;i++,x+=126){
  let grounded=grounds.some(g=>x>=g.x+20&&x<=g.x+g.w-20);
  if(grounded)makePickup(x,GROUND-58-R(0,8),i%9===0?'gold':'bud');
 }
 s.platforms.forEach((v,i)=>{
  if(i%2===0){makePickup(v.x+v.w*.5,v.y-47,i%7===0?'gold':'bud');
   if(i%5===0)makePickup(v.x+v.w*.2,v.y-44,'bud')}
 });
 // Enemies on solid ground, increasingly numerous.
 for(let i=0;i<9+index*3;i++){
  let x=640+i*360;
  if(x>L.w-330)break;
  const g=grounds.find(g=>x>g.x+75&&x<g.x+g.w-75);
  if(!g)continue;
  s.enemy.push({x,y:GROUND,base:x,dir:(i%2?1:-1),speed:60+index*12+(i%3)*9,stun:0,alive:true,phase:R(0,TWO),type:i%4===0?'drone':'inspector',bounds:[Math.max(g.x+35,x-92),Math.min(g.x+g.w-35,x+92)]})
 }
 for(let x=78;x<L.w;x+=42){
  const zone=(x/250)%3;
  if(rng()<.70){
   const groundY=GROUND+R(5,40);
   const isPlantation=index===1||index===2;
   s.flora.push({x,y:GROUND,kind:isPlantation?(rng()<.68?'weed':'bush'):
      index===3?(rng()<.30?'weed':'palm'):
      rng()<.42?'weed':rng()<.7?'tree':'bush',
      h:R(38,95),phase:R(0,TWO),seed:Math.floor(R(1,2000))})
  }
 }
 for(let x=180;x<L.w;x+=460){s.decor.push({x,type:Math.floor(R(0,4))})}
 const spawn=restore?{x:clamp(restore.x||110,45,L.w-180),y:clamp(restore.y||GROUND,-100,GROUND)}:{x:112,y:GROUND};
 p.x=spawn.x;p.y=spawn.y;p.vx=0;p.vy=0;p.dir=1;p.grounded=true;p.jumpCount=0;p.immune=2;p.smoking=0;
 s.checkpoint=restore?.checkpoint||115;s.cam=clamp(p.x-300,0,Math.max(0,L.w-W));
 toast('🎵 FASE '+(index+1)+': '+L.name+' — '+L.goal+' buds!',3);
 refresh();persist()
}
function startNew(){
 clearSave();
 s.coins=0;s.wallet=0;s.total=0;s.score=0;s.lives=3;s.maxLives=3;s.hasDouble=false;s.smokePlus=false;s.stage=0;
 makeLevel(0);s.mode='playing';hideOverlay();refresh();triad()
}
function startSaved(){
 const save=getSave();
 if(!save){startNew();return}
 for(const key of ['stage','wallet','total','coins','score','lives','maxLives','hasDouble','smokePlus'])
  if(key in save)s[key]=save[key];
 s.stage=clamp(Math.floor(Number(s.stage)||0),0,WORLDS.length-1);
 s.lives=clamp(Number(s.lives)||3,1,5);
 s.maxLives=clamp(Number(s.maxLives)||3,3,5);
 s.coins=Math.max(0,Number(s.coins)||0);
 s.wallet=Math.max(0,Number(s.wallet)||0);
 s.total=Math.max(0,Number(s.total)||0);
 s.score=Math.max(0,Number(s.score)||0);
 makeLevel(s.stage,save);s.mode='playing';hideOverlay();refresh()
}
function hasGround(x){
 return s.grounds.some(g=>x>=g.x&&x<=g.x+g.w)
}
function jump(){
 if(s.mode!=='playing')return;
 if(p.grounded){
  p.vy=-635;p.grounded=false;p.jumpCount=1;tone(420,.11)
 }else if(s.hasDouble&&p.jumpCount<2){
  p.vy=-580;p.jumpCount++;splash(p.x,p.y,'#bafca7',10);tone(650,.11)
 }
}
function puff(){
 if(s.mode!=='playing')return;
 if(p.smokeCooldown>0)return;
 if(s.wallet<2){toast('🌿 Recolha 2 buds para soltar fumaça!',1.9);return}
 s.wallet-=2;p.smoking=1.25;p.smokeCooldown=2.9;
 const range=s.smokePlus?265:175;
 for(const g of s.enemy){
  if(g.alive&&dist(p.x,p.y,g.x,g.y-33)<range)g.stun=s.smokePlus?5.2:3.6
 }
 for(let i=0;i<28;i++){
  const a=Math.random()*TWO,rr=10+Math.random()*50;
  s.smokes.push({x:p.x+20+Math.cos(a)*rr,y:p.y-68+Math.sin(a)*rr,
   vx:40*Math.cos(a)+Math.random()*55,vy:-40-Math.random()*110,r:4+Math.random()*12,
   alpha:.9,life:.8+Math.random()*.85});
 }
 tone(230,.3,'sine',.06);toast('💨 NUVEM DO GROOVE! Os fiscais ficaram confusos.',2.2);refresh()
}
function buy(type){
 if(s.mode!=='playing')return;
 const prices={double:120,smoke:85,heart:65};
 if(s.coins<prices[type]){toast('💰 Junte mais moedas de jogo!',1.6);return}
 if(type==='double'&&s.hasDouble)return;
 if(type==='smoke'&&s.smokePlus)return;
 if(type==='heart'&&s.lives>=s.maxLives)return;
 s.coins-=prices[type];
 if(type==='double')s.hasDouble=true;
 if(type==='smoke')s.smokePlus=true;
 if(type==='heart')s.lives++;
 tone(760,.22);toast(({double:'🦘 PULO DUPLO DESBLOQUEADO!',smoke:'💨 FUMAÇA TURBINADA!',heart:'❤️ CORAÇÃO RECUPERADO!'})[type]);
 refresh();persist()
}
function hit(){
 if(p.immune>0)return;
 p.immune=2.0;s.shake=.35;s.lives--;tone(95,.32,'sawtooth',.06);
 splash(p.x,p.y-32,'#ff819e',16);
 if(s.lives<=0){
  s.mode='gameover';clearSave();
  overlay('💔🌿','O GROOVE PAROU',
   'A patrulha conseguiu te pegar! Você fez <b>'+s.score.toLocaleString('pt-BR')+
   '</b> pontos e encontrou <b>'+s.total+'</b> buds.<br>Que tal tentar outra vez?', '↻ JOGAR NOVAMENTE');
 }else{
  p.x=Math.max(85,s.checkpoint);p.y=GROUND-5;p.vy=0;p.vx=0;
  toast('💔 Você perdeu um coração! Volte ao checkpoint.',2.5);
  refresh()
 }
}
function pickup(v){
 if(v.used)return;
 v.used=true;
 s.picked++;s.wallet++;s.total++;
 const golden=v.kind==='gold';
 s.coins+=golden?18:6;
 s.score+=golden?160:75;
 splash(v.x,v.y,golden?'#ffe17b':'#bafb75',13);
 tone(golden?870:610,.1);
 if(golden)toast('✨ BUD DOURADO! +18 moedas!',1.1);
 else if(s.picked===s.level.goal)toast('🎉 META ALCANÇADA! Corra até o portal da fase.',3);
 refresh()
}
function nextStage(){
 if(s.picked<s.level.goal){toast('🔒 Faltam '+(s.level.goal-s.picked)+' buds para abrir o portal!',2);return}
 s.score+=400+s.stage*200;s.coins+=50;tone(720,.19);setTimeout(()=>tone(960,.17),130);
 if(s.stage===WORLDS.length-1){
  s.mode='won';s.finished=true;clearSave();refresh();
  overlay('🏆🌿🎵','LENDA DO GROOVE!',
   'Você venceu as <b>4 fases</b>, superou a Patrulha da Seca e chegou ao festival!<br><b>'+s.total+
   ' buds coletados</b> • <b>'+s.score.toLocaleString('pt-BR')+' pontos</b><br>O Jahzin virou lenda de Dreadland!',
   '↻ JOGAR NOVAMENTE');return
 }
 const stage=s.stage+1;
 makeLevel(stage);s.mode='playing';refresh();persist();toast('✅ NOVA FASE DESBLOQUEADA!',2.7)
}
function splash(x,y,color,count){
 for(let i=0;i<count;i++){
  const a=Math.random()*TWO,vel=65+Math.random()*190;
  s.particles.push({x,y,vx:Math.cos(a)*vel,vy:Math.sin(a)*vel-75,size:2+Math.random()*4,color,ttl:.3+Math.random()*.75})
 }
}
function nearestNPC(){
 // One NPC at the start of the world, another near its end.
 const npcX=260,dx=Math.abs(p.x-npcX);
 return dx<76&&Math.abs(p.y-GROUND)<80
}
function interact(){
 if(s.mode!=='playing')return;
 if(s.nearExit){nextStage();return}
 if(nearestNPC()){
  const quotes=[
   'Mestre Roots: “Siga seu ritmo! Pegue os buds e atravesse o portal.”',
   'Dona Folha: “Nessa colina, cada pulo esconde uma surpresa!”',
   'Tio Dread: “Na neblina, mantenha a calma e o equilíbrio.”',
   'DJ Jahzin: “O Festival está pronto pra você!”'
  ];
  toast('💬 '+quotes[s.stage],3.8);tone(330,.17);
 }else toast('Aproxime-se do personagem ou do portal para interagir.',1.9)
}
function update(dt){
 if(s.mode!=='playing')return;
 const L=s.level;s.time+=dt;s.phase+=dt;s.saveTime+=dt;
 p.immune=Math.max(0,p.immune-dt);p.smoking=Math.max(0,p.smoking-dt);
 p.smokeCooldown=Math.max(0,p.smokeCooldown-dt);
 s.shake=Math.max(0,s.shake-dt);
 if(s.noticeTime>0){s.noticeTime-=dt;if(s.noticeTime<=0)$('notice').classList.remove('visible')}
 const ix=(input.right?1:0)-(input.left?1:0);
 let speed=input.run?366:256;
 if(p.smoking>0)speed*=.65;
 p.vx=ix*speed;
 if(ix)p.dir=ix;
 const wasGrounded=p.grounded;
 const oldY=p.y;
 const nx=p.x+p.vx*dt;
 p.x=clamp(nx,23,L.w-22);
 p.vy=Math.min(p.vy+1450*dt,1200);
 p.y+=p.vy*dt;
 p.grounded=false;
 if(p.vy>=0){
  // one-way platforms from above
  let landing=Infinity;
  for(const pl of s.platforms){
   if(p.x+14>=pl.x&&p.x-14<=pl.x+pl.w&&oldY<=pl.y+10&&p.y>=pl.y&&pl.y<landing)landing=pl.y
  }
  if(hasGround(p.x)&&oldY<=GROUND+8&&p.y>=GROUND)landing=Math.min(landing,GROUND);
  if(landing!==Infinity){p.y=landing;p.vy=0;p.grounded=true;p.jumpCount=0}
 }
 if(input.jump && p.grounded && !wasGrounded && p.vy===0){/* held jump won't auto-repeat */}
 p.walk+=dt*(Math.abs(p.vx)>10?11:2);
 if(p.y>H+160){hit();if(s.mode==='playing'&&p.y>H){p.x=s.checkpoint;p.y=GROUND-20;p.vy=0;p.immune=1.5}}
 for(const x of [1010,2110,3150,4250]){
  if(p.x>x&&s.checkpoint<x){s.checkpoint=x;toast('🚩 Checkpoint salvo!',1.8);persist();tone(760,.10)}
 }
 for(const v of s.pickups){
  if(!v.used&&dist(p.x,p.y-36,v.x,v.y)<37)pickup(v)
 }
 for(const g of s.enemy){
  if(!g.alive)continue;
  g.stun=Math.max(0,g.stun-dt);
  if(g.stun<=0){
   g.x+=g.speed*g.dir*dt;
   if(g.x<g.bounds[0]){g.x=g.bounds[0];g.dir=1}
   if(g.x>g.bounds[1]){g.x=g.bounds[1];g.dir=-1}
  }
  const overlap=Math.abs(p.x-g.x)<33&&Math.abs(p.y-40-(g.y-37))<39;
  if(overlap){
   if(p.vy>150 && oldY-9<=g.y-51){
    g.alive=false;p.vy=-390;p.grounded=false;s.score+=180;toast('⭐ PULOU NA PATRULHA! +180 pontos',1.7);
    splash(g.x,g.y-30,'#f6df98',12);tone(770,.11)
  }else hit()
  }
 }
 s.nearNpc=nearestNPC();
 s.nearExit=Math.abs(p.x-(L.w-145))<92&&Math.abs(p.y-GROUND)<110;
 const prompt=s.nearExit?'<kbd>E</kbd> '+(s.picked>=L.goal?'ENTRAR NO PORTAL':'FALTAM '+(L.goal-s.picked)+' BUDS'):
  s.nearNpc?'<kbd>E</kbd> CONVERSAR COM '+L.npc:'';
 $('prompt').innerHTML=prompt;$('prompt').classList.toggle('visible',!!prompt);
 if(s.nearExit&&s.picked>=L.goal&&p.x>L.w-129){nextStage()}
 for(const a of s.smokes){
  a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy-=8*dt;a.r+=9*dt;
  a.life-=dt;a.alpha=Math.max(0,a.life/1.6)
 }
 s.smokes=s.smokes.filter(x=>x.life>0);
 for(const a of s.particles){
  a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=225*dt;a.ttl-=dt
 }
 s.particles=s.particles.filter(x=>x.ttl>0);
 if(s.saveTime>6){s.saveTime=0;persist()}
 // smooth camera
 s.cam=lerp(s.cam,clamp(p.x-W*.32,0,L.w-W),Math.min(1,dt*5.6))
}
function fill(x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h)}
function ellipse(x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TWO);c.fill()}
function line(x,y,a,b,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.stroke()}
function rounded(x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}
function text(t,x,y,size=16,color='#effff5',align='center',font='Outfit'){
 c.font='900 '+size+'px '+font;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(String(t),x,y)
}
function stripe(x,y,w,h){fill(x,y,w,h,'#28654b');fill(x,y,w,h*.31,'#da444d');fill(x,y+h*.31,w,h*.34,'#e4cb60');fill(x,y+h*.65,w,h*.35,'#43a56e')}
function bg(t){
 const L=s.level||WORLDS[0],theme=L.theme;
 let sky=c.createLinearGradient(0,0,0,H);
 if(theme==='sunny'){sky.addColorStop(0,'#63bed5');sky.addColorStop(.8,'#b2ebd6');sky.addColorStop(1,'#e3f1cb')}
 if(theme==='plantation'){sky.addColorStop(0,'#4e9ca3');sky.addColorStop(.82,'#b8e4b9');sky.addColorStop(1,'#d5edbf')}
 if(theme==='sunset'){sky.addColorStop(0,'#564b87');sky.addColorStop(.54,'#d38a94');sky.addColorStop(1,'#efbe94')}
 if(theme==='night'){sky.addColorStop(0,'#101435');sky.addColorStop(.60,'#3d367c');sky.addColorStop(1,'#6d5691')}
 fill(0,0,W,H,sky);
 const sunX=W*.76 - Math.sin(s.time*.02)*30, sunY=theme==='night'?80:128;
 ellipse(sunX,sunY,theme==='night'?30:46,theme==='night'?30:46,theme==='night'?'#dfeaf1':'#fff3b4');
 if(theme==='night'){
  for(let i=0;i<61;i++){
   const x=((i*117+31)%W),y=(i*73)%230;
   const blink=.5+Math.sin(s.phase*1.6+i)*.25;
   c.globalAlpha=blink;ellipse(x,y,1.3,1.3,'#d5eafa');c.globalAlpha=1
  }
 }
 for(let layer=0;layer<3;layer++){
  const parallax=(s.cam*(.09+layer*.10))%360;
  const y0=230+layer*58;
  const colors=theme==='night'?['#2b3362','#334976','#365468']:
    theme==='sunset'?['#835b87','#897a97','#648e80']:
    theme==='plantation'?['#5f9d92','#4c9e7f','#579c6a']:['#75b6b6','#63aa95','#469f7e'];
  c.fillStyle=colors[layer];c.beginPath();c.moveTo(0,H);
  c.lineTo(0,y0);
  for(let x=-90;x<=W+140;x+=55){
   const wx=x+parallax;
   const yy=y0+Math.sin(wx*.009+layer)*20+Math.cos(wx*.018+layer)*18;
   c.lineTo(x,yy)
  }
  c.lineTo(W,H);c.closePath();c.fill()
 }
 // drifting clouds
 if(theme!=='night'){
  for(let i=0;i<9;i++){
   const x=((i*162+50-s.cam*.14+s.time*(4+i*.15))%(W+240)+W+240)%(W+240)-80;
   const y=70+(i*39)%112;
   c.globalAlpha=.28;ellipse(x,y,50,17,'#ffffff');ellipse(x-30,y+6,33,14,'#ffffff');ellipse(x+34,y+7,28,13,'#ffffff');c.globalAlpha=1
  }
 }
 // distant fields on the horizon
 const stripeOffset=(s.cam*.31)%140;
 for(let i=-2;i<12;i++){
  const x=i*140-stripeOffset;
  const levelColor=theme==='night'?'#263b58':theme==='sunset'?'#5c7f7c':'#478964';
  fill(x,GROUND-76,30,76,levelColor);
  for(let p=0;p<5;p++)ellipse(x+15,GROUND-83-p*16,11,14,theme==='night'?'#2c7465':'#50a273')
 }
}
function drawLeaf(x,y,r,angle,color,detail=false){
 c.save();c.translate(x,y);c.rotate(angle);
 // slender serrated plant leaf
 c.fillStyle=color;c.beginPath();c.moveTo(0,0);
 for(let k=0;k<=7;k++){
  const t=k/7;
  const width=Math.sin(Math.PI*t)*r*.24*(k%2?1.13:.73);
  c.lineTo(t*r, -width);
 }
 c.lineTo(r,0);
 for(let k=7;k>=0;k--){
  const t=k/7;
  const width=Math.sin(Math.PI*t)*r*.24*(k%2?1.12:.70);
  c.lineTo(t*r,width)
 }
 c.closePath();c.fill();
 line(1,0,r*.93,0,detail?'#8ac075':'#568659',detail?1.8:1);
 c.restore()
}
function plant(x,y,height,shine=false){
 const sH=height/95;
 c.save();c.translate(x,y);c.scale(sH,sH);
 line(0,2,0,-92,'#2e663b',5);
 for(let tier=0;tier<4;tier++){
  let yy=-17-tier*18,sz=38-tier*5;
  for(let side of [-1,1]){
   let col=['#1d6945','#288456','#399e53','#6cb85c'][tier];
   drawLeaf(0,yy,sz,side===1?-.66:-PI+.66,col);
   drawLeaf(0,yy,sz*.77,side===1?-.29:-PI+.29,col);
  }
 }
 for(let i=-2;i<=2;i++)drawLeaf(0,-90,35,(-PI/2)+i*.36,'#388f51',true);
 // clusters of bloom buds at stalk ends
 for(let i=0;i<4;i++){
  let yy=-32-i*17,xx=(i%2?1:-1)*(18-i*3);
  ellipse(xx,yy,7,11,shine?'#cfda86':'#97bc6a');
  ellipse(xx+3,yy-4,4,6,'#4e9754')
 }
 c.restore()
}
function tree(x,y,scale=1){
 c.save();c.translate(x,y);c.scale(scale,scale);
 fill(-7,-72,15,75,'#7b4a3a');
 ellipse(-24,-95,40,31,'#286d50');ellipse(19,-113,42,32,'#238960');
 ellipse(-7,-134,47,31,'#439d67');ellipse(-29,-139,20,18,'#6ec183');
 c.restore()
}
function drawFlora(){
 const xmin=s.cam-90,xmax=s.cam+W+90;
 for(const f of s.flora){
  if(f.x<xmin||f.x>xmax)continue;
  if(f.kind==='weed')plant(f.x,f.y,f.h,true);
  else if(f.kind==='tree')tree(f.x,f.y,f.h/110);
  else if(f.kind==='palm'){
   line(f.x,f.y,f.x+9,f.y-f.h,'#80634b',8);
   for(let k=0;k<7;k++){
    const a=k*TWO/7;
    line(f.x+9,f.y-f.h,f.x+9+Math.cos(a)*36,f.y-f.h+Math.sin(a)*20,'#4a9f79',8)
   }
  }else{
   ellipse(f.x,f.y-19,27,22,'#285f4c');
   ellipse(f.x+11,f.y-29,19,20,'#3f9b62')
  }
 }
}
function environment(){
 const L=s.level,cam=s.cam;
 // ground chunks
 for(const g of s.grounds){
  if(g.x+g.w<cam-20||g.x>cam+W+20)continue;
  const x=g.x,y=GROUND;
  fill(x,y,g.w,H-y,'#52443b');
  fill(x,y,g.w,14,L.theme==='night'?'#61b077':'#8bcc6f');
  fill(x,y+14,g.w,12,'#4d6a45');
  for(let k=0;k<Math.ceil(g.w/46);k++){
   const xx=x+k*46,yy=GROUND+38+(k*13)%73;
   rounded(xx,yy,25,6,3,k%2?'#82604b':'#654a3c');
  }
 }
 for(const pl of s.platforms){
  if(pl.x+pl.w<cam-50||pl.x>cam+W+50)continue;
  rounded(pl.x,pl.y,pl.w,19,5,'#5c5146');
  rounded(pl.x,pl.y,pl.w,9,5,pl.kind===1?'#b9dc75':'#80c67e');
  for(let x=pl.x+16;x<pl.x+pl.w-8;x+=32)fill(x,pl.y+15,15,5,'#85694a')
 }
 // Rows of stylized fantasy cannabis crop fields
 drawFlora();
 for(const d of s.decor){
  if(d.x<cam-180||d.x>cam+W+180)continue;
  const x=d.x,y=GROUND;
  if(d.type===0){
   rounded(x-45,y-93,90,91,8,'#e4c49f');rounded(x-52,y-111,103,25,4,'#a66a69');
   fill(x-24,y-65,25,20,'#90dace');rounded(x+11,y-43,19,43,3,'#79584c');
  }else if(d.type===1){
   plant(x,GROUND,148,true);plant(x+47,GROUND,129,true);
  }else if(d.type===2){
   line(x,GROUND,x,GROUND-105,'#705d48',9);
   rounded(x-65,GROUND-132,132,41,8,'#185b52');text('GROOVE',x,GROUND-110,17,'#fff0a6')
  }else{
   rounded(x-55,GROUND-38,108,33,8,'#695f57');fill(x-45,GROUND-45,8,50,'#694f45');fill(x+38,GROUND-45,8,50,'#694f45')
  }
 }
}
function makeBudSprite(gold=false){
 const cv=document.createElement('canvas');cv.width=156;cv.height=168;
 const b=cv.getContext('2d');
 let seed2=gold?54321:98765;
 function pr(){seed2=(Math.imul(seed2,1664525)+1013904223)>>>0;return seed2/4294967296}
 function blob(x,y,rx,ry,col,a=0){
  b.save();b.translate(x,y);b.rotate(a);b.fillStyle=col;b.beginPath();b.ellipse(0,0,rx,ry,0,0,TWO);b.fill();b.restore()
 }
 b.shadowColor=gold?'#ffe788':'#90f074';b.shadowBlur=25;
 blob(79,82,46,62,gold?'#a67f33':'#315d29');
 b.shadowBlur=0;
 const colors=gold?['#a87927','#cca63d','#e3bb5c','#ffe18b','#87662a']:
   ['#225b36','#387e40','#53934d','#6ba35a','#9fc078'];
 for(let i=0;i<85;i++){
  const a=pr()*TWO,r=Math.sqrt(pr());
  const x=79+Math.cos(a)*43*r,y=82+Math.sin(a)*60*r;
  blob(x,y,5+pr()*8,5+pr()*9,colors[Math.floor(pr()*colors.length)],pr()*TWO)
 }
 // Orange pistils: individual filaments
 b.lineWidth=1.65;b.lineCap='round';
 for(let i=0;i<98;i++){
  const a=pr()*TWO,r=Math.sqrt(pr());
  const x=79+Math.cos(a)*35*r,y=83+Math.sin(a)*49*r;
  b.strokeStyle=gold?'#f8f3a8':['#e1a45c','#d47942','#bd7b3e'][Math.floor(pr()*3)];
  b.beginPath();b.moveTo(x,y);
  b.quadraticCurveTo(x+(pr()-.5)*15,y+(pr()-.5)*15,x+(pr()-.5)*13,y-8+pr()*19);b.stroke()
 }
 // crystalline trichomes / tiny frosted points
 for(let i=0;i<390;i++){
  const a=pr()*TWO,r=Math.sqrt(pr()),x=79+Math.cos(a)*43*r,y=82+Math.sin(a)*59*r;
  blob(x,y,.35+pr()*1.25,.35+pr()*1.25,pr()>.65?'#fffce7':'#d9efc0')
 }
 b.fillStyle=gold?'#ffe7a0':'#e2ffc2';b.beginPath();b.ellipse(60,50,7,3,-.4,0,TWO);b.fill();
 return cv
}
const budImage=makeBudSprite(),goldImage=makeBudSprite(true);
function drawPickups(){
 const left=s.cam-90,right=s.cam+W+90;
 for(const v of s.pickups){
  if(v.used||v.x<left||v.x>right)continue;
  const bounce=Math.sin(s.time*4+v.t)*5;
  ellipse(v.x,v.y+16,17,5,'#0f392d66');
  c.save();c.translate(v.x,v.y+bounce);
  c.rotate(Math.sin(s.time*1.4+v.t)*.15);
  const size=v.kind==='gold'?55:48;
  c.drawImage(v.kind==='gold'?goldImage:budImage,-size/2,-size/2,size,size);
  c.restore();
  if(v.kind==='gold'){text('✦',v.x+18,v.y-25+bounce,21,'#fff2b5')}
 }
}
function drawEnemy(g){
 c.save();c.translate(g.x,g.y);
 ellipse(0,0,22,6,'#102b2a69');
 if(g.stun>0){c.globalAlpha=.72}
 if(g.type==='inspector'){
  fill(-19,-57,38,41,'#c45d65');fill(-16,-18,14,18,'#283444');fill(2,-18,14,18,'#283444');
  ellipse(0,-64,18,17,'#e1ab93');
  rounded(-24,-82,48,12,5,'#334051');fill(-12,-72,5,12,'#334051');
  ellipse(-7,-65,2.5,3,'#293044');ellipse(8,-65,2.5,3,'#293044');
  line(-14,-35,14,-35,'#ebc0a8',3)
 }else{
  rounded(-22,-73,44,45,12,'#334d70');
  ellipse(0,-82,17,11,'#83cce7');fill(-15,-43,30,17,'#3c7598');
  rounded(-35,-63,70,9,4,'#2e567a');
  ellipse(-12,-83,3,3,'#ff8b86');ellipse(12,-83,3,3,'#ff8b86')
 }
 if(g.stun>0){
  text('✦  ✧  ✦',0,-110,17,'#fff29f');
 }
 c.restore()
}
function drawNPC(){
 const x=260,y=GROUND;
 ellipse(x,y,25,7,'#102d2755');
 fill(x-22,y-59,44,51,'#815caa');fill(x-17,y-11,14,12,'#395e62');fill(x+3,y-11,14,12,'#395e62');
 ellipse(x,y-77,22,25,'#b97958');
 // locs and colorful tam
 for(let i=-2;i<=2;i++){
  line(x+i*8,y-92,x+i*10,y-60-Math.abs(i)*4,'#25211f',7)
 }
 rounded(x-30,y-112,60,17,9,'#d95b5b');fill(x-29,y-108,57,6,'#f4ca66');
 ellipse(x-7,y-79,3,3,'#312c25');ellipse(x+9,y-79,3,3,'#312c25');
 text(s.level.npc,x,y-139,14,'#fffbe9');
 if(s.nearNpc)text('E',x,y-169,20,'#ffe78e')
}
function drawSmoke(){
 for(const a of s.smokes){
  c.save();c.globalAlpha=Math.min(.68,a.alpha);
  const cloud=c.createRadialGradient(a.x,a.y,1,a.x,a.y,a.r);
  cloud.addColorStop(0,'#f3f6dc');cloud.addColorStop(.5,'#d7e9da');cloud.addColorStop(1,'#b2c9bd00');
  ellipse(a.x,a.y,a.r,a.r,cloud);
  c.restore()
 }
}
function drawPlayer(){
 const x=p.x,y=p.y;
 c.save();c.translate(x,y);
 if(p.immune>0&&Math.floor(s.time*13)%2===0)c.globalAlpha=.46;
 const step=p.grounded&&Math.abs(p.vx)>20?Math.sin(p.walk)*6:0;
 ellipse(0,0,23,6,'#102d3466');
 // legs + boots
 rounded(-17,-35+step,15,35,4,'#344c6c');rounded(4,-35-step,15,35,4,'#344c6c');
 rounded(-21,-6+step,23,10,5,'#f5e7c7');rounded(3,-6-step,23,10,5,'#f5e7c7');
 // dreadlocks behind torso
 const hair='#251c21';
 for(let i=0;i<9;i++){
  const xx=-26+i*6.4;
  line(xx,-103,xx+Math.sin(s.time*3+i)*2,-58+(i%3)*4,hair,7);
  ellipse(xx+Math.sin(s.time*3+i)*2,-59+(i%3)*4,4,4,hair)
 }
 // tunic with green-yellow-red accent
 rounded(-24,-98,48,65,12,'#e6a144');
 rounded(-15,-91,30,38,5,'#2e7d5b');
 fill(-15,-91,30,9,'#d95550');fill(-15,-82,30,8,'#f8d864');fill(-15,-74,30,9,'#4ea36b');
 // arms
 const armSwing=Math.sin(p.walk)*Math.min(10,Math.abs(p.vx)*.035);
 line(-24,-88,-34,-58+armSwing,'#a66b4f',12);
 if(p.smoking>0){
  line(24,-86,24+11*p.dir,-112,'#aa6b4f',11);
  line(24+11*p.dir,-112,16*p.dir,-112,'#dbc8a9',4);
  ellipse(17*p.dir,-112,4,4,'#fa8a5e')
 }else{
  line(24,-87,34,-56-armSwing,'#aa6b4f',12)
 }
 // neck face and beard
 fill(-10,-112,20,22,'#ae714f');
 ellipse(0,-128,26,30,'#c1845c');
 ellipse(1,-114,19,11,'#3d2922'); // beard
 ellipse(-8,-130,3.3,3,'#251f22');ellipse(10,-130,3.3,3,'#251f22');
 line(-2,-118,6,-118,'#f6d6ad',2.5);
 // hat distinct horizontal Rasta stripes
 rounded(-29,-160,58,22,10,'#171b21');
 fill(-27,-155,54,7,'#ca4a50');fill(-27,-148,54,6,'#e8c85c');fill(-27,-142,54,6,'#329665');
 rounded(-32,-140,64,9,5,'#212825');
 // hair strands on face sides
 for(let k=0;k<3;k++){
  line(-24+k*3,-143,-29+k*3,-96+k*6,hair,6);
  line(22+k*3,-142,27+k*3,-95+k*6,hair,6)
 }
 if(!p.grounded)text('✦',-29,-166,18,'#ffffbb');
 c.restore()
}
function portal(){
 const x=s.level.w-145,y=GROUND-104;
 const unlocked=s.picked>=s.level.goal;
 c.save();c.translate(x,y);
 ellipse(0,103,61,12,'#102a3555');
 c.strokeStyle=unlocked?'#aaf5d4':'#8b959d';c.lineWidth=13;
 c.beginPath();c.ellipse(0,3,52,89,0,0,TWO);c.stroke();
 c.lineWidth=7;c.strokeStyle=unlocked?'#d5ff93':'#607b78';
 c.beginPath();c.ellipse(0,3,40,77,0,0,TWO);c.stroke();
 if(unlocked){
  const g=c.createLinearGradient(-24,-75,24,77);
  g.addColorStop(0,'#83c9ba66');g.addColorStop(1,'#e6ed94cb');
  ellipse(0,3,34,71,g);
  for(let i=0;i<7;i++){const a=i*TWO/7+s.time*.9;
   ellipse(Math.sin(a)*31,Math.cos(a)*62,3.5,3.5,'#fff6a5')}
 }
 text(unlocked?'ENTRADA LIBERADA':'PORTAL TRANCADO',0,-117,17,unlocked?'#e9ffb9':'#f5c9bc');
 if(!unlocked)text('🔒',0,5,40)
 c.restore()
}
function effects(){
 for(const a of s.particles){
  c.globalAlpha=Math.min(1,a.ttl*1.5);
  ellipse(a.x,a.y,a.size,a.size,a.color);c.globalAlpha=1
 }
}
function draw(){
 const L=s.level||WORLDS[0];
 bg(s.time);
 c.save();
 if(s.shake>0)c.translate((Math.random()-.5)*s.shake*18,(Math.random()-.5)*s.shake*14);
 c.translate(-s.cam,0);
 environment();
 drawPickups();
 drawNPC();
 for(const g of s.enemy){if(g.alive&&g.x>s.cam-80&&g.x<s.cam+W+80)drawEnemy(g)}
 portal();
 drawPlayer();
 drawSmoke();
 effects();
 c.restore();
 // soft vignette
 const gradient=c.createRadialGradient(W/2,H/2,100,W/2,H/2,640);
 gradient.addColorStop(0,'#020f1f00');gradient.addColorStop(1,'#020f1f38');
 fill(0,0,W,H,gradient);
 // mark progress
 rounded(13,H-14,W-26,5,3,'#072a3c66');
 rounded(13,H-14,Math.max(5,(p.x/L.w)*(W-26)),5,3,'#c9f96a');
}
function loop(t){
 requestAnimationFrame(loop);
 if(!last)last=t;const dt=Math.min(.045,(t-last)/1000);last=t;
 update(dt);
 draw();
 frameCount++
}
$('mainBtn').addEventListener('click',()=>{
 if(s.mode==='paused'){s.mode='playing';hideOverlay();$('pauseBtn').textContent='⏸ PAUSA';return}
 if(s.mode==='menu'&&getSave()){startSaved();return}
 startNew()
});
function pause(){
 if(s.mode==='playing'){
  persist();s.mode='paused';
  overlay('⏸️🎧','INTERVALO DO GROOVE','Seu progresso foi salvo neste navegador. Volte para continuar colhendo buds e explorando os mundos.','▶ CONTINUAR');
  $('pauseBtn').textContent='▶ CONTINUAR';
 }else if(s.mode==='paused'){s.mode='playing';hideOverlay();$('pauseBtn').textContent='⏸ PAUSA'}
 refresh()
}
$('pauseBtn').addEventListener('click',pause);
$('restartBtn').addEventListener('click',()=>{
 if(s.mode==='playing'&&!window.confirm('Recomeçar toda a aventura e perder o progresso atual?'))return;
 startNew()
});
$('soundBtn').addEventListener('click',()=>{
 sound=!sound;$('soundBtn').textContent=sound?'♫ SOM: ON':'♫ SOM: OFF';
 if(sound)tone(580,.14)
});
document.querySelectorAll('[data-buy]').forEach(btn=>btn.addEventListener('click',()=>buy(btn.dataset.buy)));
const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',ShiftLeft:'run',ShiftRight:'run'};
document.addEventListener('keydown',e=>{
 if(keys[e.code]){
  e.preventDefault();const key=keys[e.code];
  if(key==='jump'&&!input.jump)jump();
  input[key]=true
 }
 if(e.code==='KeyF'&&!e.repeat){e.preventDefault();puff()}
 if(e.code==='KeyE'&&!e.repeat){e.preventDefault();interact()}
 if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause()}
});
document.addEventListener('keyup',e=>{if(keys[e.code]){input[keys[e.code]]=false;e.preventDefault()}});
window.addEventListener('blur',()=>{for(const k in input)input[k]=false;if(s.mode==='playing')pause()});
document.querySelectorAll('[data-hold]').forEach(btn=>{
 const key=btn.dataset.hold;
 btn.addEventListener('pointerdown',e=>{
  e.preventDefault();
  if(key==='jump'&&!input.jump)jump();
  input[key]=true;btn.classList.add('pressed');
  try{btn.setPointerCapture(e.pointerId)}catch(err){}
 });
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,()=>{
  input[key]=false;btn.classList.remove('pressed')
 })
});
document.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
 if(btn.dataset.action==='smoke')puff();else interact()
}));
window.addEventListener('pagehide',persist);
// Set up a complete preview behind title overlay.
makeLevel(0);
s.mode='menu';refresh();
const saved=getSave();
if(saved){
 $('mainBtn').textContent='▶ CONTINUAR AVENTURA';
 $('ovText').innerHTML='Seu progresso em Dreadland foi encontrado. Continue com Jahzin, recolha buds das plantações e termine as quatro fases de plataforma!'
}
requestAnimationFrame(loop);
})();
