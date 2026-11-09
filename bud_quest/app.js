(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=960,H=610,WORLD={w:2400,h:1850};
const TAU=Math.PI*2,lerp=(a,b,t)=>a+(b-a)*t,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b,x,y)=>Math.hypot(a-x,b-y),rand=(a,b)=>a+Math.random()*(b-a);
let seed=198213;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
const R=(a,b)=>a+random()*(b-a);
const zones=[
 {id:'plaza',name:'Vila Central',x:430,y:355,r:385,color:'#7bae7d'},
 {id:'forest',name:'Bosque Neon',x:1570,y:400,r:380,color:'#3b8964'},
 {id:'beach',name:'Praia do Sol',x:1730,y:1435,r:385,color:'#dcc98d'},
 {id:'festival',name:'Festival Verde',x:490,y:1390,r:325,color:'#9f81c6'}
];
const npcs=[
 {id:'mestre',name:'MESTRE BROTO',x:430,y:300,color:'#ffda85',hat:'#38694e',icon:'★',phrase:'Bem-vindo à ilha, viajante!'},
 {id:'dj',name:'DJ FOLHA',x:485,y:1300,color:'#fb97e4',hat:'#6247a3',icon:'♫',phrase:'A música está no ar!'},
 {id:'sol',name:'TIA SOL',x:1760,y:1384,color:'#ffe0aa',hat:'#f2af56',icon:'☀',phrase:'Curte a brisa da praia!'},
 {id:'luna',name:'LUNA',x:1550,y:365,color:'#a9d6ff',hat:'#315b8f',icon:'✿',phrase:'O Bosque está cheio de segredos.'}
];
const missions=[
 {title:'Conheça Mestre Broto',desc:'Encontre Mestre Broto, na Vila Central, e aperte E para conversar.',goal:1,zone:'plaza',x:430,y:300,type:'talk'},
 {title:'Caçada no Bosque',desc:'Colete 8 buds verdes brilhantes no Bosque Neon.',goal:8,zone:'forest',x:1570,y:400,type:'collect',kind:'bud'},
 {title:'Volte ao mestre',desc:'Mestre Broto tem uma recompensa para você. Volte à Vila Central.',goal:1,zone:'plaza',x:430,y:300,type:'talk'},
 {title:'Ondas de Buds',desc:'Colete 12 buds encantados na Praia do Sol.',goal:12,zone:'beach',x:1730,y:1435,type:'collect',kind:'bud'},
 {title:'Segredo da Vila',desc:'Volte a Mestre Broto para receber a última missão.',goal:1,zone:'plaza',x:430,y:300,type:'talk'},
 {title:'Buds Lendários',desc:'Encontre 5 buds dourados no Festival Verde.',goal:5,zone:'festival',x:490,y:1390,type:'collect',kind:'gold'},
 {title:'A Festa Final',desc:'Fale com DJ Folha no palco do Festival e termine a aventura!',goal:1,zone:'festival',x:485,y:1300,type:'talk'},
 {title:'Lenda da Ilha!',desc:'Todas as missões concluídas! Explore livremente e bata seu recorde.',goal:1,zone:'festival',x:485,y:1300,type:'free'}
];
const keys={up:false,down:false,left:false,right:false,run:false};
const solidRects=[
 {x:114,y:180,w:135,h:102},{x:642,y:185,w:140,h:106},{x:115,y:506,w:150,h:110},
 {x:675,y:500,w:125,h:130},{x:380,y:1220,w:210,h:77},
 {x:1630,y:1220,w:148,h:102}
];
const state={mode:'menu',x:435,y:390,vx:0,vy:0,camX:0,camY:0,hearts:3,maxHearts:3,
 invuln:0,combo:0,comboT:0,stage:0,progress:0,buds:0,coins:0,points:0,
 high:0,speedLevel:0,magnet:false,shield:0,dash:0,dashCooldown:0,walk:0,
 timer:0,activeZone:'',messageT:0,map:false,saveT:0,dayTime:0,
 screenShake:0,near:null,particles:[],items:[],guards:[],scenery:[],gameTicks:0};
let sound=true,actx=null,last=0,animationId=0,holdStart=0;
function storeGet(name,alt){try{let o=localStorage.getItem(name);return o===null?alt:JSON.parse(o)}catch(e){return alt}}
function storeSet(name,value){try{localStorage.setItem(name,JSON.stringify(value))}catch(e){}}
state.high=Number(storeGet('bud-quest-high',0))||0;
function pointColor(zone){return zones.find(z=>z.id===zone)?.color||'#86a97b'}
function whichZone(x,y){let best=zones[0],bestDist=Infinity;for(const z of zones){
 const d=distance(x,y,z.x,z.y);if(d<bestDist){best=z;bestDist=d}}
 return best.id}
function soundNote(freq=650,dur=.10,type='triangle',volume=.045){
 if(!sound)return;
 try{
  if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();
  const osc=actx.createOscillator(),gain=actx.createGain(),t=actx.currentTime;
  osc.type=type;osc.frequency.setValueAtTime(freq,t);osc.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.72),t+dur);
  gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);
  osc.connect(gain);gain.connect(actx.destination);osc.start(t);osc.stop(t+dur+.01)
 }catch(e){}
}
function notification(text,time=2.4){
 const box=$('toast');box.textContent=text;box.classList.add('show');state.messageT=time
}
function hideOverlay(){$('overlay').classList.add('hidden')}
function showOverlay(icon,title,html,button){
 $('poster').textContent=icon;$('overlayTitle').textContent=title;$('overlayDesc').innerHTML=html;
 $('startBtn').textContent=button;$('overlay').classList.remove('hidden')
}
function resetKeys(){for(const key in keys)keys[key]=false}
function saveGame(){
 if(state.mode!=='playing'&&state.mode!=='paused')return;
 storeSet('bud-quest-save',{
  version:1,x:state.x,y:state.y,hearts:state.hearts,maxHearts:state.maxHearts,
  stage:state.stage,progress:state.progress,buds:state.buds,coins:state.coins,
  points:state.points,speedLevel:state.speedLevel,magnet:state.magnet,shield:state.shield,
  dayTime:state.dayTime,high:state.high
 })
}
function newGame(resume=false){
 const prev=resume?storeGet('bud-quest-save',null):null;
 const def={x:435,y:390,hearts:3,maxHearts:3,stage:0,progress:0,buds:0,coins:0,
 points:0,speedLevel:0,magnet:false,shield:0,dayTime:0};
 for(const k of Object.keys(def))state[k]=prev&&Number(prev.version)===1&&k in prev?prev[k]:def[k];
 state.x=clamp(Number(state.x)||435,40,WORLD.w-40);
 state.y=clamp(Number(state.y)||390,40,WORLD.h-40);
 state.stage=clamp(Math.floor(Number(state.stage)||0),0,7);
 state.progress=clamp(Math.floor(Number(state.progress)||0),0,missions[state.stage].goal);
 state.hearts=clamp(Math.floor(Number(state.hearts)||3),1,3);
 state.coins=Math.max(0,Math.floor(Number(state.coins)||0));
 state.points=Math.max(0,Math.floor(Number(state.points)||0));
 state.buds=Math.max(0,Math.floor(Number(state.buds)||0));
 state.speedLevel=clamp(Math.floor(Number(state.speedLevel)||0),0,3);
 state.shield=clamp(Math.floor(Number(state.shield)||0),0,3);
 state.mode='playing';state.invuln=1.5;state.combo=0;state.comboT=0;
 state.vx=0;state.vy=0;state.dash=0;state.dashCooldown=0;
 state.timer=0;state.saveT=0;state.dayTime=Number(state.dayTime)||0;
 state.guards=[];state.items=[];state.particles=[];state.scenery=[];
 resetKeys();initWorld();
 hideOverlay();syncHud(true);
 notification(resume?'Aventura restaurada! Bora continuar!':'Bem-vindo à Ilha Verde! Procure o mestre.');soundNote(620,.18)
}
function initWorld(){
 seed=198213;
 const exclude=(x,y)=>npcs.some(n=>distance(n.x,n.y,x,y)<65)||distance(435,390,x,y)<110;
 for(let i=0;i<290;i++){
  const x=R(40,WORLD.w-40),y=R(40,WORLD.h-40),zone=whichZone(x,y);
  if(exclude(x,y))continue;
  if(zone==='beach'&&x>1990&&y>1250)continue;
  if(zone==='plaza'&&distance(x,y,430,355)<245)continue;
  if(Math.abs(x-900)<65&&y>200&&y<1450)continue;
  if(Math.abs(y-885)<65&&x>200&&x<2010)continue;
  let type=zone==='forest'?(random()<.76?'tree':'flower'):zone==='beach'?(random()<.50?'palm':random()<.5?'flower':'rock'):zone==='festival'?(random()<.35?'lamp':'flower'):(random()<.61?'tree':random()<.5?'bush':'flower');
  state.scenery.push({x,y,type,scale:R(.72,1.55),angle:R(0,TAU),shade:Math.floor(R(0,4))})
 }
 const colors=['#fa7180','#74a7fa','#f4ca77'];
 for(let i=0;i<9;i++){
  const x=i<4?R(1100,2050):i<7?R(800,1850):R(180,880);
  const y=i<4?R(200,770):i<7?R(1000,1590):R(1050,1690);
  state.guards.push({x,y,ox:x,oy:y,vx:0,vy:0,angle:R(0,TAU),r:17,color:colors[i%colors.length],phase:R(0,TAU),alert:0,stun:0})
 }
 for(const zone of zones){
  const count=zone.id==='forest'?50:zone.id==='beach'?48:zone.id==='festival'?42:24;
  for(let i=0;i<count;i++){
   let x,y;
   for(let t=0;t<50;t++){
    const a=R(0,TAU),r=Math.sqrt(random())*(zone.r-55);
    x=clamp(zone.x+Math.cos(a)*r,50,WORLD.w-50);
    y=clamp(zone.y+Math.sin(a)*r,50,WORLD.h-50);
    if(distance(x,y,zone.x,zone.y)>90&&(!npcs.some(n=>distance(n.x,n.y,x,y)<40)))break;
   }
   const gold=zone.id==='festival' && i<16;
   state.items.push({x,y,zone:zone.id,kind:gold?'gold':'bud',
    phase:R(0,TAU),visible:true,respawn:0,value:gold?3:1})
  }
 }
}
function addParticles(x,y,col,count=10){
 for(let i=0;i<count;i++){
  const a=rand(0,TAU),speed=rand(30,190);
  state.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-40,
   life:rand(.35,.8),max:.8,color:col,sz:rand(2,5)})
 }
 if(state.particles.length>145)state.particles.splice(0,state.particles.length-145)
}
function updateMission(){
 const m=missions[state.stage],done=state.progress>=m.goal;
 $('missionTitle').textContent=m.title;
 $('missionDesc').textContent=m.desc;
 $('missionProgress').textContent=state.stage===7?'CONCLUÍDO':state.progress+' / '+m.goal;
 $('missionBar').style.width=(state.stage===7?100:100*state.progress/m.goal)+'%';
 $('missionBar').style.background=done?'linear-gradient(90deg,#edc66a,#fafa7c)':'linear-gradient(90deg,#64d69f,#d2fa61)';
}
function advanceMission(){
 if(state.stage>=7)return;
 state.stage++;state.progress=0;
 state.points+=250;state.coins+=45;
 addParticles(state.x,state.y,'#fff1a0',24);
 soundNote(890,.22);setTimeout(()=>soundNote(1160,.21),110);
 const m=missions[state.stage];
 if(state.stage===7){
  storeSet('bud-quest-completed',true);
  notification('🏆 Você virou uma Lenda da Ilha! +250 pontos, +45 moedas',4);
  state.mode='won';
  showOverlay('🏆🌿✨','LENDA DA ILHA!','Você terminou todas as missões!<br><b>Pontuação: '+state.points.toLocaleString('pt-BR')+
  '</b> · Buds coletados: <b>'+state.buds+'</b><br>Volte a explorar e bata seu recorde.','▶ EXPLORAR LIVREMENTE');
 }else notification('✅ MISSÃO COMPLETA! Próxima: '+m.title,3.2);
 updateMission();saveGame()
}
function onCollect(item){
 item.visible=false;item.respawn=state.timer+(item.kind==='gold'?65:28);
 state.buds+=item.value;
 state.points+=(item.kind==='gold'?75:25)*Math.min(5,Math.max(1,state.combo));
 state.coins+=(item.kind==='gold'?15:5);
 state.combo=Math.min(5,state.combo+1);state.comboT=4;
 addParticles(item.x,item.y,item.kind==='gold'?'#ffe36c':'#b7fb7f',12);
 soundNote(item.kind==='gold'?880:560,.12,'triangle',.045);
 if(item.kind==='gold')notification('✨ BUD LENDÁRIO! +3 buds',1.4);
 const m=missions[state.stage];
 if(m?.type==='collect'&&item.zone===m.zone&&item.kind===m.kind){
  state.progress++;
  if(state.progress>=m.goal){advanceMission()}
  else updateMission()
 }
 if(state.points>state.high){state.high=state.points;storeSet('bud-quest-high',state.high)}
 syncHud()
}
function interact(){
 if(state.mode!=='playing')return;
 const npc=npcs.find(n=>distance(n.x,n.y,state.x,state.y)<100);
 if(!npc){notification('Aproxime-se de um personagem para conversar!');return}
 soundNote(330,.10);
 if(npc.id==='mestre'){
  if([0,2,4].includes(state.stage)){
   state.progress=1;
   advanceMission();
   notification(state.stage===1?'Mestre Broto: "No Bosque, procure as folhas brilhantes!"':
    state.stage===3?'Mestre Broto: "A praia está cheia de surpresas!"':
    'Mestre Broto: "Os buds dourados estão no festival!"',3.5)
  }else notification('Mestre Broto: "Explore a ilha e siga sua missão no painel!"',3)
 }else if(npc.id==='dj'){
  if(state.stage===6){state.progress=1;advanceMission()}
  else notification('DJ Folha: "Solta o passinho! O show vai começar!" 🎵',3)
 }else if(npc.id==='sol')notification('Tia Sol: "A Praia do Sol guarda muitos buds encantados!" ☀',3);
 else notification('Luna: "Dizem que há folhas brilhantes escondidas no Bosque..." 🌳',3)
}
function syncHud(force=false){
 $('hudBuds').textContent=state.buds;
 $('hudLevel').textContent=state.stage+1;
 $('hearts').textContent=('♥ '.repeat(state.hearts)+'♡ '.repeat(Math.max(0,state.maxHearts-state.hearts))).trim();
 $('buds').textContent=state.buds;
 $('coins').textContent=state.coins;
 $('points').textContent=state.points.toLocaleString('pt-BR');
 $('high').textContent=state.high.toLocaleString('pt-BR');
 for(const b of document.querySelectorAll('[data-buy]')){
  const item=b.dataset.buy,cost={speed:50,magnet:75,shield:40}[item];
  b.disabled=state.coins<cost||(item==='speed'&&state.speedLevel>=3)||(item==='magnet'&&state.magnet)||(item==='shield'&&state.shield>=3)
 }
 if(force)updateMission()
}
function buy(name){
 if(state.mode!=='playing')return;
 const cost={speed:50,magnet:75,shield:40}[name];
 if(state.coins<cost)return notification('Você precisa de mais moedas!');
 if(name==='speed'&&state.speedLevel>=3)return notification('Tênis Turbo já está no máximo!');
 if(name==='magnet'&&state.magnet)return notification('Você já tem o Ímã Verde!');
 if(name==='shield'&&state.shield>=3)return notification('Você já tem três escudos!');
 state.coins-=cost;
 if(name==='speed')state.speedLevel++;
 if(name==='magnet')state.magnet=true;
 if(name==='shield')state.shield++;
 soundNote(720,.17);notification({speed:'👟 Turbo equipado!',magnet:'🧲 Ímã Verde ativado!',shield:'🛡️ Escudo extra equipado!'}[name]);
 syncHud();saveGame()
}
function damage(g){
 if(state.invuln>0||g.stun>0)return;
 g.stun=1;
 if(state.shield>0){state.shield--;notification('🛡️ Escudo absorveu o impacto!');soundNote(190,.16,'sawtooth');state.invuln=1.5;syncHud();return}
 state.hearts=Math.max(0,state.hearts-1);state.invuln=2.0;state.combo=0;state.screenShake=.44;
 const dx=state.x-g.x,dy=state.y-g.y,len=Math.max(1,Math.hypot(dx,dy));
 state.x=clamp(state.x+dx/len*65,35,WORLD.w-35);
 state.y=clamp(state.y+dy/len*65,35,WORLD.h-35);
 addParticles(state.x,state.y,'#ff8c92',16);soundNote(130,.24,'sawtooth');
 notification('😵 Fiscal da Vibe! Você perdeu um coração.');syncHud();if(state.hearts<=0)lose()
}
function lose(){
 state.mode='lost';storeSet('bud-quest-save',null);
 showOverlay('💔🌿','FIM DO ROLÊ','Você perdeu seus três corações!<br>Mas fez <b>'+state.points.toLocaleString('pt-BR')+
 '</b> pontos e coletou <b>'+state.buds+'</b> buds.<br>O recorde continua salvo!','↻ JOGAR NOVAMENTE')
}
function blocked(x,y){
 if(x<28||y<28||x>WORLD.w-28||y>WORLD.h-28)return true;
 return solidRects.some(r=>x+14>r.x&&x-14<r.x+r.w&&y+14>r.y&&y-14<r.y+r.h)
}
function update(dt){
 if(state.mode!=='playing')return;
 state.timer+=dt;state.gameTicks++;state.dayTime+=dt;
 state.invuln=Math.max(0,state.invuln-dt);
 state.dashCooldown=Math.max(0,state.dashCooldown-dt);
 state.dash=Math.max(0,state.dash-dt);
 state.comboT=Math.max(0,state.comboT-dt);
 if(!state.comboT)state.combo=0;
 state.screenShake=Math.max(0,state.screenShake-dt);
 if(state.messageT>0){state.messageT-=dt;if(state.messageT<=0)$('toast').classList.remove('show')}
 const mx=(keys.right?1:0)-(keys.left?1:0),my=(keys.down?1:0)-(keys.up?1:0);
 const len=Math.hypot(mx,my)||1,base=240+state.speedLevel*36,speed=base*(keys.run?1.62:1)*(state.dash>0?2.15:1);
 let vx=mx/len*speed,vy=my/len*speed;
 if(!mx&&!my){vx=0;vy=0}
 const nx=state.x+vx*dt,ny=state.y+vy*dt;
 if(!blocked(nx,state.y))state.x=nx;
 if(!blocked(state.x,ny))state.y=ny;
 state.vx=lerp(state.vx,vx,Math.min(1,dt*11));state.vy=lerp(state.vy,vy,Math.min(1,dt*11));
 state.walk+=dt*(vx||vy?13:2);
 state.near=npcs.find(n=>distance(n.x,n.y,state.x,state.y)<100)||null;
 $('prompt').classList.toggle('show',!!state.near);
 if(state.near)$('promptText').textContent='Conversar com '+state.near.name;
 const zone=whichZone(state.x,state.y);
 if(zone!==state.activeZone){state.activeZone=zone;notification('📍 '+zones.find(z=>z.id===zone).name,1.6)}
 for(const item of state.items){
  if(!item.visible){
   if(state.timer>=item.respawn)item.visible=true;
   continue
  }
  const reach=state.magnet?79:32;
  if(distance(item.x,item.y,state.x,state.y)<reach)onCollect(item)
 }
 for(const g of state.guards){
  g.stun=Math.max(0,g.stun-dt);
  let dx=state.x-g.x,dy=state.y-g.y,dist=Math.hypot(dx,dy);
  const chase=dist<205;
  let tx,ty,spd;
  if(chase){
   tx=dx/(dist||1);ty=dy/(dist||1);
   spd=118+Math.min(70,state.stage*11);g.alert=1;
  }else{
   const a=state.timer*.5+g.phase;
   const targetX=g.ox+Math.cos(a)*82,targetY=g.oy+Math.sin(a)*82;
   let dd=Math.hypot(targetX-g.x,targetY-g.y)||1;
   tx=(targetX-g.x)/dd;ty=(targetY-g.y)/dd;spd=67;g.alert=0
  }
  let nextX=clamp(g.x+tx*spd*dt,30,WORLD.w-30),nextY=clamp(g.y+ty*spd*dt,30,WORLD.h-30);
  if(!blocked(nextX,g.y))g.x=nextX;else g.ox+=Math.sin(state.timer)*dt*8;
  if(!blocked(g.x,nextY))g.y=nextY;else g.oy+=Math.cos(state.timer)*dt*8;
  g.angle=Math.atan2(ty,tx);
  if(dist<37)damage(g)
 }
 for(let i=state.particles.length-1;i>=0;i--){
  let p=state.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;
  p.vy+=120*dt;p.life-=dt;if(p.life<=0)state.particles.splice(i,1)
 }
 if(state.saveT+=dt, state.saveT>5){state.saveT=0;saveGame()}
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function pathRound(x,y,w,h,r,color){
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()
}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill()}
function strokeCircle(x,y,r,color,line=3){ctx.strokeStyle=color;ctx.lineWidth=line;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke()}
function line(x1,y1,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function text(str,x,y,size,color='#effff2',align='center',font='Outfit'){
 ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.font='900 '+size+'px '+font;ctx.fillText(str,x,y)
}
function drawBud(x,y,scale,t,legend=false){
 ctx.save();ctx.translate(x,y+Math.sin(t*2)*4*scale);ctx.scale(scale,scale);
 ctx.shadowColor=legend?'#ffe78b':'#b6ff7d';ctx.shadowBlur=legend?18:14;
 circle(0,0,13,legend?'#e9b84d':'#59bd58');ctx.shadowBlur=0;
 const c=legend?'#ffe17a':'#a1ee64';
 for(let i=0;i<7;i++){
  const a=i*TAU/7+t*.12,cx=Math.cos(a)*10,cy=Math.sin(a)*10;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(a+Math.PI/2);ctx.fillStyle=c;
  ctx.beginPath();ctx.ellipse(0,-7,5.4,11,0,0,TAU);ctx.fill();ctx.restore()
 }
 circle(0,0,9,legend?'#ffc14f':'#418c47');
 circle(-3,-4,3.2,'#eaffb0');circle(4,3,2.3,'#eaff9c');circle(1,-2,1.8,'#f7fff1');
 ctx.restore()
}
function drawTree(o){
 const {x,y,scale:s}=o;
 ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 circle(3,5,21,'#142e2a44');rect(-7,-3,14,26,'#7a5033');
 circle(-17,-19,23,'#226b4c');circle(14,-20,26,'#2e8759');circle(-2,-40,25,'#368c50');
 circle(-23,-25,14,'#369c60');circle(12,-43,15,'#58b96d');circle(-5,-43,12,'#63bd69');
 circle(-27,-36,3,'#d0ff92');circle(15,-42,3,'#d0ff92');
 ctx.restore()
}
function drawPalm(o){
 const {x,y,scale:s}=o;ctx.save();ctx.translate(x,y);ctx.scale(s,s);
 circle(0,8,18,'#102b2438');line(0,14,3,-31,'#906543',8);
 for(let i=0;i<7;i++){
  const a=i*TAU/7;ctx.strokeStyle=i%2?'#2b9665':'#35865a';ctx.lineWidth=7;ctx.beginPath();
  ctx.moveTo(2,-32);ctx.quadraticCurveTo(Math.cos(a)*19,-51+Math.sin(a)*17,Math.cos(a)*35,-31+Math.sin(a)*35);ctx.stroke()
 }
 ctx.restore()
}
function drawFlower(o){
 const {x,y,scale:s,shade}=o;circle(x,y,7*s,'#327d58');
 for(let i=0;i<5;i++){let a=i*TAU/5;circle(x+Math.cos(a)*8*s,y+Math.sin(a)*8*s,4*s,
  ['#eec1f6','#f7e28a','#a8e6ef','#f6b7a0'][shade])}
 circle(x,y,4*s,'#ffdc83')
}
function drawScenery(o){
 const x=o.x,y=o.y;
 if(o.type==='tree')drawTree(o);
 else if(o.type==='palm')drawPalm(o);
 else if(o.type==='flower')drawFlower(o);
 else if(o.type==='bush'){
  circle(x,y,15*o.scale,'#286c4c');circle(x-7,y-5,12*o.scale,'#39895a');
  circle(x+6,y-7,12*o.scale,'#4fa663')
 }else if(o.type==='rock'){
  ctx.fillStyle='#8a9695';ctx.beginPath();ctx.moveTo(x-12,y+11);ctx.lineTo(x-13,y-4);
  ctx.lineTo(x+2,y-14);ctx.lineTo(x+17,y+9);ctx.closePath();ctx.fill();
  circle(x-4,y-4,3,'#c1c7b5')
 }else if(o.type==='lamp'){
  line(x,y+12,x,y-21,'#394d51',5);circle(x,y-23,10,'#fbe6a6');
  circle(x,y-23,17,'#fce6ad18')
 }
}
function drawBuilding(x,y,w,h,body,roof,name){
 ctx.save();ctx.translate(x,y);
 rect(-w/2+8,-h/2+10,w,h,'#10292255');
 pathRound(-w/2,-h/2,w,h,7,body);pathRound(-w/2-8,-h/2-10,w+16,28,5,roof);
 rect(-w/2+20,-h/2+36,25,20,'#d6f8ee');rect(w/2-45,-h/2+36,25,20,'#d6f8ee');
 pathRound(-14,h/2-48,28,48,4,'#745f52');circle(9,h/2-23,2,'#ffe9a1');
 if(name){pathRound(-w*.40,-h/2-5,w*.8,24,5,'#133c38');text(name,0,-h/2+7,12,'#fcf5c7')}
 ctx.restore()
}
function drawGround(){
 rect(0,0,WORLD.w,WORLD.h,'#69a57c');
 for(let y=0;y<WORLD.h;y+=70)for(let x=0;x<WORLD.w;x+=70){
  const n=(Math.sin(x*1.37+y*.74)+Math.cos(x*.17-y*.21));
  ctx.globalAlpha=.09;rect(x,y,65,65,n>.2?'#4a845c':'#b0d18d');ctx.globalAlpha=1
 }
 // biome flooring
 circle(1570,400,435,'#4d9974');circle(1570,400,370,'#428b69');
 circle(1730,1435,435,'#e2c990');circle(1730,1435,376,'#ecd7a2');
 circle(490,1390,371,'#9c8bb9');circle(490,1390,325,'#a78ec0');
 // ocean on east side
 rect(2130,0,270,1850,'#51b1c0');
 for(let yy=10;yy<1850;yy+=56){
  const xx=2140+Math.sin(yy*.013+state.timer*.65)*12;
  line(xx,yy,2395,yy+14,'#a4eddf88',5)
 }
 // roads
 pathRound(845,45,102,1660,50,'#d0bfa0');
 pathRound(105,833,1965,103,46,'#d0bfa0');
 pathRound(827,843,135,385,10,'#d0bfa0');
 pathRound(370,780,105,485,20,'#d0bfa0');
 pathRound(1480,770,95,540,20,'#d0bfa0');
 // central plaza
 circle(430,355,230,'#7bc08d');strokeCircle(430,355,220,'#e6dfbd',15);
 circle(430,355,161,'#9dd99e');circle(430,355,148,'#bfe4a4');
 circle(430,355,83,'#d9d9ae');circle(430,355,65,'#75b5a3');
 for(let i=0;i<12;i++){const a=i*TAU/12;circle(430+Math.cos(a)*110,355+Math.sin(a)*110,7,'#f7e2b4')}
 // beach islands and footprints
 for(let i=0;i<33;i++){let x=1470+(i*67%620),y=1190+(i*47%550);
  circle(x,y,3,'#c4a976');circle(x+7,y+12,2,'#c4a976')}
 // festival dance floor and neon stage
 pathRound(280,1254,420,245,24,'#3c3e5f');
 for(let i=0;i<10;i++)for(let j=0;j<5;j++){
  const pal=['#5e527c','#625787','#715989','#775b90'];
  rect(305+i*37,1292+j*36,33,32,pal[(i+j+Math.floor(state.timer*.22))%4])
 }
 pathRound(373,1153,235,94,10,'#2b3b61');
 pathRound(398,1173,185,38,7,'#253957');
 text('♬  FESTIVAL VERDE  ♬',490,1190,19,'#eaffac');
 for(let i=0;i<9;i++){let x=280+i*50,y=1227+Math.sin(i*.9)*12;line(x,1213,x,y,'#ffe7a4',3);circle(x,y,9,['#f8aaff','#84ecfb','#c0fd94'][i%3])}
 // central area buildings
 drawBuilding(182,230,136,104,'#e3bf92','#bc6e61','LOJA');
 drawBuilding(700,244,136,110,'#ddd3b4','#7798a6','LANCHES');
 drawBuilding(182,546,146,103,'#d0d4ca','#65918d','ARCADE');
 drawBuilding(726,560,124,115,'#d0b6bd','#a46f84','CASAS');
 // palm huts
 drawBuilding(1630,1268,120,85,'#e7d5aa','#b7845a','PRAIA');
 // road signs
 pathRound(1090,760,166,48,12,'#274f43');text('BOSQUE  →',1173,783,17,'#e8ffba');
 pathRound(1040,990,154,48,12,'#274f43');text('PRAIA   ↘',1117,1014,17,'#e8ffba');
 pathRound(290,1008,178,48,12,'#343c64');text('♫ FESTIVAL',379,1030,17,'#fce5ff')
}
function drawNPC(n){
 ctx.save();ctx.translate(n.x,n.y);
 circle(0,16,20,'#16352260');rect(-19,-25,38,44,n.color);
 rect(-26,-24,11,37,'#c59578');rect(15,-24,11,37,'#c59578');
 rect(-17,13,12,21,'#444b4b');rect(5,13,12,21,'#444b4b');
 circle(0,-39,21,'#f4c49d');pathRound(-23,-65,46,14,5,n.hat);
 circle(-8,-39,2.7,'#433c3c');circle(8,-39,2.7,'#433c3c');
 ctx.restore();
 const important=(n.id==='mestre'&&[0,2,4].includes(state.stage))||(n.id==='dj'&&state.stage===6);
 if(important){
  const bob=Math.sin(state.timer*3)*6;
  text('★',n.x,n.y-98+bob,32,'#ffe973');strokeCircle(n.x,n.y-97+bob,20,'#ffee9b6d',3)
 }
 pathRound(n.x-68,n.y-107,136,26,8,'#133832dd');text(n.name,n.x,n.y-94,13,'#eaffeb');
}
function drawGuard(g){
 ctx.save();ctx.translate(g.x,g.y);
 circle(2,12,19,'#18232e66');rect(-15,-21,30,32,g.color);
 rect(-13,10,10,13,'#26344c');rect(3,10,10,13,'#26344c');
 circle(0,-29,17,'#f0b0a3');pathRound(-21,-47,42,12,5,'#293349');
 circle(-6,-29,2,'#243039');circle(6,-29,2,'#243039');
 ctx.restore();
 if(g.alert)text('!',g.x,g.y-59,28,'#f5e17b');
 else text('FISCAL',g.x,g.y-55,10,'#fff1ed')
}
function drawPlayer(){
 const x=state.x,y=state.y;
 ctx.save();ctx.translate(x,y);
 const blinking=state.invuln>0&&Math.floor(state.timer*12)%2===0;
 if(blinking)ctx.globalAlpha=.48;
 circle(3,19,23,'#10282566');
 const walking=Math.abs(state.vx)+Math.abs(state.vy)>20;
 const bounce=walking?Math.sin(state.walk)*3:Math.sin(state.timer*3)*1.4;
 rect(-17,12+bounce,13,25,'#374a5e');rect(5,12+bounce,13,25,'#374a5e');
 rect(-18,29+bounce,16,10,'#eff7df');rect(5,29+bounce,16,10,'#eff7df');
 pathRound(-23,-30+bounce,46,53,11,'#f3a947');
 pathRound(-15,-23+bounce,30,30,8,'#dceaae');
 rect(-25,-24+bounce,9,31,'#e1a279');rect(16,-24+bounce,9,31,'#e1a279');
 circle(0,-43+bounce,22,'#f2be91');
 pathRound(-25,-64+bounce,50,15,8,'#165744');
 pathRound(-31,-56+bounce,62,9,3,'#2f815c');
 circle(-8,-41+bounce,3,'#3a3936');circle(8,-41+bounce,3,'#3a3936');
 line(-4,-32+bounce,4,-32+bounce,'#8d5c4b',2);
 ctx.restore();
 if(state.shield>0){strokeCircle(x,y-16,46,'#80f8e488',3);circle(x+35,y-49,12,'#9bf6cf');text('✦',x+35,y-49,15,'#164d35')}
}
function arrowToGoal(){
 if(state.stage>=7)return;
 const m=missions[state.stage];
 const dx=m.x-state.x,dy=m.y-state.y,dist=Math.hypot(dx,dy);
 if(dist<160)return;
 const theta=Math.atan2(dy,dx);
 const x=W/2+Math.cos(theta)*Math.min(W*.40,350);
 const y=H/2+Math.sin(theta)*Math.min(H*.37,220);
 ctx.save();ctx.translate(x,y);ctx.rotate(theta+Math.PI/2);
 ctx.fillStyle='#f5df79';ctx.shadowColor='#ffdc64';ctx.shadowBlur=18;
 ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(13,12);ctx.lineTo(0,5);ctx.lineTo(-13,12);ctx.closePath();ctx.fill();
 ctx.restore();
 pathRound(x-32,y+19,64,21,8,'#0b3027dd');
 text(Math.round(dist/12)+'m',x,y+30,12,'#fff6bf')
}
function drawMiniMap(){
 const x=W-240,y=98,w=216,h=180;
 pathRound(x-9,y-34,w+18,h+47,12,'#082720ed');
 text('MAPA DA ILHA',x+15,y-14,14,'#cdf7c3','left');
 for(const zone of zones){
  const zx=x+(zone.x/WORLD.w)*w,zy=y+(zone.y/WORLD.h)*h;
  circle(zx,zy,21,zone.color);text(zone.id==='forest'?'🌳':zone.id==='beach'?'☀':zone.id==='festival'?'♫':'⌂',zx,zy,13,'#ffffff');
 }
 rect(x,y,w,h,'#ffffff05');
 circle(x+(state.x/WORLD.w)*w,y+(state.y/WORLD.h)*h,5,'#fffc90');
 strokeCircle(x+(state.x/WORLD.w)*w,y+(state.y/WORLD.h)*h,8,'#ffffff',2)
}
function draw(){
 ctx.clearRect(0,0,W,H);
 const targetX=clamp(state.x-W/2,0,WORLD.w-W),targetY=clamp(state.y-H/2,0,WORLD.h-H);
 state.camX=lerp(state.camX,targetX,.11);
 state.camY=lerp(state.camY,targetY,.11);
 ctx.save();
 if(state.screenShake>0)ctx.translate(rand(-5,5)*state.screenShake*2,rand(-5,5)*state.screenShake*2);
 ctx.translate(-state.camX,-state.camY);
 drawGround();
 const visible=(x,y,p=75)=>x>state.camX-p&&x<state.camX+W+p&&y>state.camY-p&&y<state.camY+H+p;
 for(const s of state.scenery){if(visible(s.x,s.y,85))drawScenery(s)}
 for(const item of state.items){if(item.visible&&visible(item.x,item.y)){
  circle(item.x,item.y+5,19,item.kind==='gold'?'#ffd76029':'#c6f78b20');
  drawBud(item.x,item.y,1.05+Math.sin(item.phase+state.timer*2)*.06,item.phase+state.timer,item.kind==='gold');
 }}
 for(const npc of npcs){if(visible(npc.x,npc.y,115))drawNPC(npc)}
 for(const g of state.guards){if(visible(g.x,g.y,80))drawGuard(g)}
 drawPlayer();
 for(const p of state.particles){
  ctx.globalAlpha=clamp(p.life/p.max,0,1);
  circle(p.x,p.y,p.sz,p.color);ctx.globalAlpha=1
 }
 ctx.restore();
 // day/night atmosphere (subtle)
 const light=(1-Math.cos(state.dayTime*Math.PI/120))/2;
 if(light>.40){rect(0,0,W,H,'rgba(8,13,49,'+(light-.4)*.40+')')}
 const zone=zones.find(z=>z.id===state.activeZone);
 if(zone){pathRound(W/2-94,14,188,28,14,'#092d2cd7');text(zone.name.toUpperCase(),W/2,28,13,'#e0ffba')}
 if(state.combo>1&&state.comboT>0){pathRound(W/2-54,53,108,31,12,'#2e7255e0');text('COMBO ×'+state.combo,W/2,69,15,'#f4f8af')}
 arrowToGoal();
 if(state.map)drawMiniMap()
}
function frame(now){
 animationId=requestAnimationFrame(frame);
 if(!last)last=now;
 const dt=Math.min(.041,(now-last)/1000);last=now;
 update(dt);
 draw()
}
function start(){
 if(state.mode==='won'){state.mode='playing';hideOverlay();state.stage=7;notification('Modo livre liberado!');return}
 if(state.mode==='paused'){state.mode='playing';hideOverlay();$('pauseBtn').textContent='⏸ PAUSA';return}
 const hasSave=storeGet('bud-quest-save',null);
 newGame(state.mode==='menu'&&!!hasSave);
}
$('startBtn').addEventListener('click',start);
$('pauseBtn').addEventListener('click',()=>{
 if(state.mode==='playing'){state.mode='paused';saveGame();showOverlay('⏸️🌿','PAUSADO','Sua aventura está guardada. Respire, prepare o próximo rolê e volte quando quiser.','▶ CONTINUAR');$('pauseBtn').textContent='▶ CONTINUAR'}
 else if(state.mode==='paused')start()
});
$('mapBtn').addEventListener('click',()=>{state.map=!state.map;$('mapBtn').textContent=state.map?'🗺 FECHAR MAPA':'🗺 MAPA'});
$('restartBtn').addEventListener('click',()=>{
 if(state.mode==='playing'||state.mode==='paused'){
  if(!window.confirm('Reiniciar do começo? Você perderá o progresso da partida atual.'))return
 }
 storeSet('bud-quest-save',null);newGame(false)
});
$('audioBtn').addEventListener('click',()=>{sound=!sound;$('audioBtn').textContent=sound?'♫ SOM: ON':'♫ SOM: OFF';if(sound)soundNote(450,.1)});
document.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.buy)));
const keymap={KeyW:'up',ArrowUp:'up',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyS:'down',ArrowDown:'down'};
document.addEventListener('keydown',e=>{
 if(keymap[e.code]){keys[keymap[e.code]]=true;e.preventDefault()}
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.run=true;
 if(e.code==='KeyE'&&!e.repeat){e.preventDefault();interact()}
 if(e.code==='Space'&&!e.repeat){e.preventDefault();if(state.dashCooldown<=0&&state.mode==='playing'){
  state.dash=.19;state.dashCooldown=2.2;addParticles(state.x,state.y,'#d2ffa4',9);soundNote(280,.07)}}
 if(e.code==='KeyP'&&!e.repeat){e.preventDefault();$('pauseBtn').click()}
 if(e.code==='KeyM'&&!e.repeat){e.preventDefault();$('mapBtn').click()}
});
document.addEventListener('keyup',e=>{
 if(keymap[e.code])keys[keymap[e.code]]=false;
 if(e.code==='ShiftLeft'||e.code==='ShiftRight')keys.run=false
});
window.addEventListener('blur',()=>resetKeys());
document.querySelectorAll('[data-hold]').forEach(b=>{
 const k=b.dataset.hold;
 b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;b.classList.add('down');try{b.setPointerCapture(e.pointerId)}catch(err){}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{keys[k]=false;b.classList.remove('down')})
});
$('touchAction').addEventListener('click',interact);
window.addEventListener('pagehide',saveGame);
if(storeGet('bud-quest-save',null)){
 $('startBtn').textContent='▶ CONTINUAR AVENTURA';
 $('overlayDesc').innerHTML='Sua missão anterior está salva! Volte à ilha para coletar buds encantados, encontrar personagens e concluir os desafios.'
}
syncHud(true);
animationId=requestAnimationFrame(frame);
})();