(()=>{
"use strict";
const $=id=>document.getElementById(id),m=window.NRMarket;
const cv=$("game"),g=cv.getContext("2d",{alpha:false});
const W=1152,H=648,TAU=Math.PI*2,LENGTH=75,STORAGE="neon_rift_progress_v1";
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n)),lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const money=n=>Number(n).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
let progress={version:1,wallet:10000,crystals:0,history:[],missions:0,record:0,open:null};
try{
 const d=JSON.parse(localStorage.getItem(STORAGE)||"null");
 if(d&&d.version===1){
  progress.wallet=Number.isFinite(d.wallet)?clamp(d.wallet,0,1000000):10000;
  progress.crystals=Number.isFinite(d.crystals)?Math.max(0,d.crystals):0;
  progress.missions=Number.isFinite(d.missions)?d.missions:0;
  progress.record=Number.isFinite(d.record)?d.record:0;
  progress.history=Array.isArray(d.history)?d.history.slice(0,45):[];
  if(d.open)progress.history.unshift({time:d.open.startedAt,side:d.open.side,status:"interrompida",net:null,combat:0});
 }
}catch(e){}
const S={phase:"intro",practice:false,paused:false,order:null,time:0,clock:0,keys:{},drag:false,fire:false,touchFire:false,
 ship:{x:190,y:350,shield:100,inv:0,charges:2,fire:0,ax:800,ay:330},
 enemies:[],bullets:[],enemyBullets:[],drops:[],parts:[],stars:[],spawn:0,boss:false,bossKilled:false,
 score:0,kills:0,shots:0,hits:0,pulses:0,combo:0,bestCombo:0,lastKill:-100,shake:0,flash:0,noticeTime:0};
const fresh=()=>m.fresh();
function store(){progress.open=S.order?{startedAt:S.order.startedAt,side:S.order.side}:null;try{localStorage.setItem(STORAGE,JSON.stringify(progress))}catch(e){}}
function soundTone(freq,duration=.12,type="triangle",volume=.023){
 if(!soundOn)return;
 try{
  audio??=new(window.AudioContext||window.webkitAudioContext)();
  if(audio.state==="suspended")audio.resume();
  const t=audio.currentTime,o=audio.createOscillator(),v=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.7),t+duration);
  v.gain.setValueAtTime(volume,t);v.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(v);v.connect(audio.destination);o.start(t);o.stop(t+duration+.01)
 }catch(e){}
}
let audio=null,soundOn=true,musicClock=0,musicIdx=0;
function music(dt){
 if(!soundOn||S.phase!=="playing")return;
 musicClock-=dt;if(musicClock>0)return;musicClock+=.23;
 const bass=[98,98,123,98,110,110,146,123],notes=[0,349,0,392,415,0,440,0,0,392,349,0,330,0,294,0];
 if(musicIdx%2===0)soundTone(bass[(musicIdx>>1)%8],.16,"triangle",.006);
 if(notes[musicIdx%16])soundTone(notes[musicIdx%16],.065,"square",.004);
 musicIdx++;
}
function notify(t,sec=2.2){$("gameMessage").textContent=t;$("gameMessage").classList.add("show");S.noticeTime=sec}
function particles(x,y,color,count=14,force=165){
 for(let i=0;i<count;i++){
  const a=rand(0,TAU),v=rand(force*.3,force);
  S.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:rand(.2,.65),max:.65,r:rand(1.5,5),color})
 }if(S.parts.length>260)S.parts.splice(0,S.parts.length-260)
}
function floatText(x,y,t,color="#b9ffe5"){S.parts.push({x,y,t:1,max:1,vx:0,vy:-42,text:t,color})}
function initialize(){
 S.stars=Array.from({length:200},()=>({x:rand(0,W),y:rand(0,H),r:rand(.4,2),speed:rand(7,55),phase:rand(0,TAU)}))
}
function resetArena(){
 S.time=0;S.spawn=.75;S.score=0;S.kills=0;S.shots=0;S.hits=0;S.pulses=0;S.combo=0;S.bestCombo=0;
 S.lastKill=-100;S.boss=false;S.bossKilled=false;S.shake=0;S.flash=0;S.paused=false;S.drag=false;S.fire=false;S.touchFire=false;
 S.enemies=[];S.bullets=[];S.enemyBullets=[];S.drops=[];S.parts=[];S.keys={};
 S.ship={x:190,y:355,shield:100,inv:1.2,charges:2,fire:0,ax:800,ay:330};
 $("resultOverlay").classList.add("hidden");$("pauseOverlay").classList.add("hidden");
 musicIdx=0;musicClock=0;hud()
}
function enter(){
 if(!fresh()){notify("SEM COTAÇÃO DA BINANCE. USE TREINO DE COMBATE.");return}
 S.phase="lobby";S.practice=false;S.order=null;resetArena();
 $("startOverlay").classList.add("hidden");notify("ESCOLHA AURORA OU ECLIPSE PARA ABRIR A MISSÃO!",3);
}
function training(){
 S.phase="playing";S.practice=true;S.order=null;resetArena();
 $("startOverlay").classList.add("hidden");notify("TREINO DE COMBATE: ZERO COTAÇÕES FICTÍCIAS.",3);
}
function portal(side){
 if(S.phase!=="lobby")return;
 if(!fresh()){notify("SEM COTAÇÃO RECENTE. AGUARDE RECONEXÃO.");return}
 if(progress.wallet<25){notify("TESOURO BAIXO. INICIE UMA NOVA CAMPANHA.");return}
 const notional=Math.min(1000,progress.wallet*.1);
 const ord=m.snapshot(side,notional);
 if(!ord){notify("FALHA AO PREPARAR O PORTAL.");return}
 S.order=ord;S.practice=false;S.phase="playing";resetArena();store();
 notify(side===1?"PORTAL AURORA: DEFENDA SUA NAVE!":"PORTAL ECLIPSE: DEFENDA SUA NAVE!",2.9);
 particles(S.ship.x,S.ship.y,side===1?"#6fffd0":"#d59afa",55,260);
 soundTone(side===1?680:320,.35,"sawtooth",.037)
}
function finish(reason){
 if(S.phase!=="playing")return;
 if(S.order&&!fresh()){notify("SEM COTAÇÃO NOVA PARA APURAR. MISSÃO CONGELADA.",2.3);return}
 const result=S.order?m.settlement(S.order):null;
 if(S.order&&!result)return;
 S.phase="result";S.paused=false;
 if(result)progress.wallet=clamp(progress.wallet+result.net,0,1000000);
 progress.crystals+=S.score;progress.missions++;progress.record=Math.max(progress.record,S.score);
 const accuracy=S.shots?S.hits/S.shots*100:0;
 progress.history.unshift({time:Date.now(),side:S.order?.side??null,status:S.practice?"treino":reason,
  net:result?.net??null,fees:result?.fees??0,entry:S.order?.entry??null,exit:result?.exit??null,
  combat:S.score,kills:S.kills,accuracy});
 progress.history=progress.history.slice(0,50);S.order=null;store();
 $("resultIcon").textContent=reason==="concluida"?"✦":reason==="escudo"?"◈":"✧";
 $("resultTitle").textContent=reason==="concluida"?"EXPEDIÇÃO FINALIZADA":reason==="escudo"?"ESCUDO DESTRUÍDO":"FUGA DA ARENA";
 $("resultDesc").textContent=reason==="concluida"?"Você completou a missão. Agora compare sua previsão ao movimento real.":reason==="escudo"?"A nave caiu, mas o resultado hipotético foi calculado com o preço no momento da derrota.":"Você encerrou a missão pelo portal de fuga.";
 $("resultMoney").textContent=result?(result.net>=0?"+":"")+money(result.net):"SEM RESULTADO";
 $("resultMoney").style.color=result?(result.net>=0?"#a0ffda":"#ffadcb"):"#dce2ff";
 $("resultPoints").textContent=S.score.toLocaleString("pt-BR");
 $("resultAccuracy").textContent=accuracy.toFixed(0)+"%";
 $("resultDetail").textContent=result?
  "Movimento do BTC: "+result.changePct.toFixed(4)+"%. Custos fictícios: "+money(result.fees)+" USDT (spread + taxa e slippage estimado). A precisão de tiro não muda o resultado da cotação.":
  "Treino arcade sem ligação com preços ou dinheiro fictício. A arena não gerou valores de mercado.";
 $("resultOverlay").classList.remove("hidden");soundTone(reason==="concluida"?890:175,.38,"sawtooth",.038);
 if(reason==="concluida")particles(W/2,H/2,"#b4ffdc",95,340);
 hud()
}
function next(){S.phase="lobby";S.practice=false;S.order=null;resetArena();notify("ESCOLHA SEU PRÓXIMO PORTAL.",2)}
function damage(n){
 const s=S.ship;if(s.inv>0||S.phase!=="playing")return;
 s.shield=Math.max(0,s.shield-n);s.inv=.64;S.shake=.38;S.flash=.19;
 particles(s.x,s.y,"#ff85bd",18,180);soundTone(115,.18,"sawtooth",.038);
 if(!s.shield)finish("escudo")
}
function spawn(type){
 const pressure=m.data.trades.length?m.data.pressure:.5;
 const side=S.practice?(Math.random()<.5?1:-1):Math.random()<pressure?1:-1;
 const kind=type||((Math.random()<.12)?"tank":Math.random()<.25?"hunter":"drone");
 const stats=kind==="tank"?[8,67,32,145]:kind==="hunter"?[3,145,19,67]:[2,100,24,48];
 const y=rand(120,H-60);
 S.enemies.push({x:W+45,y,base:y,phase:rand(0,TAU),t:0,type:kind,side,hp:stats[0],max:stats[0],
  speed:stats[1],r:stats[2],points:stats[3],fire:rand(.6,2.4),hit:0,dead:false});
 if(S.enemies.length>53)S.enemies.shift()
}
function boss(){
 S.boss=true;
 S.enemies.push({x:W+90,y:H*.45,base:H*.45,phase:0,t:0,type:"boss",side:-1,
  hp:52,max:52,speed:65,r:61,points:1200,fire:1.1,hit:0,dead:false});
 notify("⚠ O COLOSSO DA TEMPESTADE APARECEU!",3.4);soundTone(137,.42,"sawtooth",.055)
}
function kill(e){
 if(e.dead)return;
 e.dead=true;S.kills++;
 S.combo=S.time-S.lastKill<3?Math.min(12,S.combo+1):1;
 S.bestCombo=Math.max(S.bestCombo,S.combo);S.lastKill=S.time;
 const points=Math.round(e.points*(1+Math.min(2,S.combo*.18)));
 S.score+=points;
 particles(e.x,e.y,e.side===1?"#8efad8":"#e0a2fa",e.type==="boss"?68:19,e.type==="boss"?310:175);
 floatText(e.x,e.y-25,"+"+points,"#faffb6");
 $("comboLabel").textContent="COMBO x"+S.combo;$("comboBonus").textContent="+"+points;
 if(S.kills%10===0&&S.ship.charges<3){S.ship.charges++;notify("✦ +1 CARGA MAGNÉTICA!")}
 if(Math.random()<.18)S.drops.push({x:e.x,y:e.y,kind:Math.random()<.48?"repair":"points",t:12});
 if(e.type==="boss"){S.bossKilled=true;notify("COLOSSO DERROTADO! +CRISTAIS!",3)}
 soundTone(e.type==="boss"?150:230,.13,"sawtooth",.03)
}
function shoot(){
 if(S.phase!=="playing"||S.paused||S.ship.fire>0)return;
 const s=S.ship;s.fire=.15;S.shots++;
 let target=null;
 if(!S.drag){
  let d=Infinity;for(const e of S.enemies){const distance=dist(s,e);if(!e.dead&&e.x>s.x-20&&distance<d){target=e;d=distance}}
 }
 let dx=(target?target.x:s.ax)-s.x,dy=(target?target.y:s.ay)-s.y;
 const k=Math.hypot(dx,dy)||1;dx/=k;dy/=k;
 S.bullets.push({x:s.x+dx*24,y:s.y+dy*24,vx:dx*720,vy:dy*720,t:1.5,r:6});
 particles(s.x+dx*24,s.y+dy*24,"#b2fff5",2,65);
 soundTone(480,.045,"triangle",.011);
}
function pulse(){
 if(S.phase!=="playing"||S.paused||S.ship.charges<1)return;
 S.ship.charges--;S.pulses++;S.flash=.25;S.shake=.28;
 for(const e of S.enemies)if(!e.dead&&dist(S.ship,e)<265){e.hp-=e.type==="boss"?6:5;e.x+=52;if(e.hp<=0)kill(e)}
 S.enemyBullets=S.enemyBullets.filter(b=>dist(S.ship,b)>290);
 S.parts.push({ring:true,x:S.ship.x,y:S.ship.y,r:0,t:.60,max:.60,color:"#9dfdf6"});
 particles(S.ship.x,S.ship.y,"#8ffff1",45,300);
 notify("⚡ PULSO MAGNÉTICO!",1.3);soundTone(170,.39,"sawtooth",.049)
}
function update(dt){
 if(S.phase!=="playing"||S.paused)return;
 if(!S.practice&&!fresh()){
  if(S.noticeTime<=0)notify("CONEXÃO PAUSADA. SEM PREÇO RECENTE, SEM RESULTADO.",2.4);
  return
 }
 S.time+=dt;music(dt);
 const s=S.ship;s.inv=Math.max(0,s.inv-dt);s.fire=Math.max(0,s.fire-dt);
 const keys=S.keys;
 let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
 let dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
 const len=Math.hypot(dx,dy)||1;
 if(!S.drag){s.x+=dx/len*300*dt;s.y+=dy/len*300*dt}
 s.x=clamp(s.x,60,W-60);s.y=clamp(s.y,115,H-52);
 if(keys[" "]||S.touchFire||S.fire)shoot();
 if(!S.boss&&S.time>54)boss();
 if(S.time>=LENGTH){finish("concluida");return}
 S.spawn-=dt;if(S.spawn<=0){
  spawn();const intensity=S.practice?1.2:m.data.intensity;
  S.spawn=clamp((1.15-S.time*.003)/intensity,.39,1.3)
 }
 for(const e of S.enemies){
  if(e.dead)continue;
  e.t+=dt;e.fire-=dt;e.hit=Math.max(0,e.hit-dt);
  if(e.type==="boss"){e.x=lerp(e.x,W-170,clamp(dt*.6,0,1));e.y=H*.45+Math.sin(S.time*1.5)*95}
  else if(e.type==="hunter"){e.x-=e.speed*dt;e.y+=clamp(s.y-e.y,-1,1)*80*dt}
  else{e.x-=e.speed*dt;e.y=e.base+Math.sin(e.t*2.4+e.phase)*28}
  if(e.fire<=0){
   const vx=s.x-e.x,vy=s.y-e.y,k=Math.hypot(vx,vy)||1;
   S.enemyBullets.push({x:e.x,y:e.y,vx:vx/k*190,vy:vy/k*190,t:4,r:e.type==="boss"?10:7,damage:e.type==="boss"?13:8});
   if(e.type==="boss")for(const rot of [-.25,.25]){
    const c=Math.cos(rot),sn=Math.sin(rot),v1=vx/k*200,v2=vy/k*200;
    S.enemyBullets.push({x:e.x,y:e.y,vx:v1*c-v2*sn,vy:v1*sn+v2*c,t:4,r:8,damage:8})
   }
   e.fire=rand(e.type==="boss"?.62:1.25,e.type==="boss"?1.1:2.45)
  }
  if(dist(s,e)<e.r+17){damage(e.type==="boss"?24:13);e.hp-=2;e.x+=30;if(e.hp<=0)kill(e)}
  if(e.x<-35){if(e.type!=="boss"){damage(8);e.dead=true}}
 }
 for(const b of S.bullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;
  for(const e of S.enemies){
   if(b.t<=0||e.dead||e.hit>0)continue;
   if(dist(b,e)<b.r+e.r){b.t=0;e.hp--;e.hit=.06;S.hits++;
    particles(b.x,b.y,"#e4fff1",6,88);if(e.hp<=0)kill(e);break}
  }
 }
 for(const b of S.enemyBullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.t-=dt;
  if(b.t>0&&dist(b,s)<b.r+17){b.t=0;damage(b.damage)}
 }
 S.bullets=S.bullets.filter(b=>b.t>0&&b.x>-20&&b.x<W+25&&b.y>-20&&b.y<H+20);
 S.enemyBullets=S.enemyBullets.filter(b=>b.t>0&&b.x>-30&&b.x<W+30&&b.y>-30&&b.y<H+30);
 S.enemies=S.enemies.filter(e=>!e.dead&&e.x>-110);
 for(const d of S.drops){
  d.x-=27*dt;d.t-=dt;
  if(dist(d,s)<30){d.t=0;if(d.kind==="repair"){s.shield=Math.min(100,s.shield+14);floatText(s.x,s.y-30,"+ESCUDO")}
   else{S.score+=110;floatText(s.x,s.y-30,"+110")};soundTone(760,.08)}
 }
 S.drops=S.drops.filter(d=>d.t>0);
 S.flash=Math.max(0,S.flash-dt);S.shake=Math.max(0,S.shake-dt);
 for(const p of S.parts){p.t-=dt;if(p.ring){p.r+=530*dt}else{p.x+=p.vx*dt;p.y+=p.vy*dt}}
 S.parts=S.parts.filter(p=>p.t>0);
 hud()
}
function rank(){return progress.crystals>=43000?"LENDÁRIO":progress.crystals>=20000?"ALMIRANTE":progress.crystals>=8000?"COMANDANTE":progress.crystals>=2200?"GUARDIÃO":"CADETE"}
function statusUI(){
 const ok=fresh(),model=m.data;
 $("sourceDot").classList.toggle("live",ok);
 $("sourceLabel").textContent=ok?(model.source==="WEBSOCKET"?"BINANCE · AO VIVO":"BINANCE · COTAÇÃO REST"):"SEM COTAÇÃO ATUAL";
 $("startStatus").textContent=ok?"✓ Dados públicos BTC/USDT recebidos.":"Buscando dados reais da Binance. Você também pode treinar só combate.";
 $("startBtn").disabled=!ok;
 $("solarBtn").disabled=S.phase!=="lobby"||!ok;
 $("shadowBtn").disabled=S.phase!=="lobby"||!ok;
 $("arenaMode").textContent=S.practice?"TREINO · SEM DINHEIRO":S.phase==="playing"?"EXPEDIÇÃO · DADOS REAIS":ok?"SINAL BINANCE RECEBIDO":"AGUARDANDO BINANCE";
 $("dataAge").textContent=ok?Math.round((Date.now()-model.quoteAt)/1000)+"s":"SEM SINAL";
 const evidence=model.trades.length>0&&Date.now()-model.lastTradeAt<28000;
 const pct=ok&&evidence?Math.round(model.pressure*100):null;
 $("sunFill").style.width=(pct??0)+"%";$("moonFill").style.width=(pct==null?0:100-pct)+"%";
 $("sunLevel").textContent=pct==null?"—":pct+"%";$("moonLevel").textContent=pct==null?"—":(100-pct)+"%";
 $("stormLabel").textContent=!ok?"SEM LEITURA":model.storm<.8?"BRISA":model.storm<1.8?"VENTANIA":model.storm<3.2?"TURBILHÃO":"TEMPESTADE";
 $("flowLabel").textContent=model.flow;
}
function hud(){
 const s=S.ship,sec=Math.ceil(Math.max(0,LENGTH-S.time)),p=S.phase==="playing";
 $("shieldText").textContent=Math.round(s.shield)+"%";$("shieldFill").style.width=s.shield+"%";
 $("scoreText").textContent=String(S.score).padStart(6,"0");
 $("sectorText").textContent=S.time<25?"01 / 03":S.time<50?"02 / 03":"03 / 03";
 $("timeText").textContent=String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
 $("walletText").textContent=money(progress.wallet);
 $("crystalText").textContent=progress.crystals.toLocaleString("pt-BR");
 $("rankText").textContent=rank();$("killsText").textContent=S.kills;
 $("missionsText").textContent=progress.missions;$("bestComboText").textContent=S.bestCombo;
 $("chargesText").textContent=s.charges+" / 3";
 const metrics=[Math.min(S.kills,12)+"/12",Math.min(Math.floor(S.time),35)+"/35",Math.min(S.pulses,2)+"/2",(S.bossKilled?1:0)+"/1"];
 const check=[S.kills>=12,S.time>=35,S.pulses>=2,S.bossKilled];
 for(let i=0;i<4;i++){const el=$("task"+(i+1));el.textContent=check[i]?"✓":"○";el.classList.toggle("done",check[i]);$("task"+(i+1)+"Num").textContent=metrics[i]}
 $("comboPop").classList.toggle("visible",p&&S.combo>=2&&S.time-S.lastKill<1.5);
 $("restartBtn").textContent=p?"↪ EVACUAR":"↻ NOVA MISSÃO";
 $("worldEvent").textContent=p?(S.boss&&!S.bossKilled?"COLOSSO NA ARENA":m.data.flow):S.phase==="lobby"?"ESCOLHA O PORTAL":"MUNDO EM ESPERA";
}
function line(x,y,X,Y,color,w=1){g.strokeStyle=color;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(X,Y);g.stroke()}
function circle(x,y,r,color,stroke=false,w=1){g.beginPath();g.arc(x,y,r,0,TAU);if(stroke){g.strokeStyle=color;g.lineWidth=w;g.stroke()}else{g.fillStyle=color;g.fill()}}
function poly(points,color){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill()}
function label(s,x,y,size=20,color="#e6ffff"){g.fillStyle=color;g.font="900 "+size+"px Impact,Arial,sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText(s,x,y)}
function background(t){
 const gradient=g.createLinearGradient(0,0,0,H);
 gradient.addColorStop(0,"#070a23");gradient.addColorStop(.65,"#152451");gradient.addColorStop(1,"#071b2b");
 g.fillStyle=gradient;g.fillRect(0,0,W,H);
 const aura=g.createRadialGradient(830,370,0,830,370,450);
 aura.addColorStop(0,S.order?.side===-1?"#ac51df35":"#44e2db37");aura.addColorStop(1,"#0b102900");
 g.fillStyle=aura;g.fillRect(0,0,W,H);
 for(const star of S.stars){
  const x=((star.x-S.clock*star.speed*.3)%W+W)%W;
  g.fillStyle="rgba(218,244,255,"+(.22+.4*(.5+.5*Math.sin(t*2+star.phase)))+")";
  g.fillRect(x,star.y,star.r,star.r)
 }
 for(let j=0;j<28;j++){
  const x=j*45-((S.clock*7)%45),h=30+Math.abs(Math.sin(j*3.69))*100;
  g.fillStyle=j%3===0?"#132d50":"#0e2544";g.fillRect(x,460-h,37,h)
 }
 line(0,461,W,461,"#4679ac",2);
 for(let x=-1200;x<W*2;x+=135)line(W/2,461,x+(S.clock*20)%135,H,"#28529388");
 for(let j=0;j<9;j++){
  const y=461+(H-461)*Math.pow((j+((S.clock*.7)%1))/9,1.7);
  line(0,y,W,y,"#3b56878a")
 }
 const cx=950,cy=266;
 for(let i=0;i<4;i++){
  g.save();g.translate(cx,cy);g.rotate(t*.13+i*.48);
  g.beginPath();g.ellipse(0,0,91+i*15,66+i*12,.12,0,TAU);
  g.strokeStyle=i%2?"#665aa35a":"#55cbd358";g.lineWidth=2;g.stroke();g.restore()
 }
}
function ship(x,y,t){
 g.save();g.translate(x,y);
 if(S.ship.inv>0&&Math.floor(t*18)%2===0)g.globalAlpha=.58;
 const throttle=Math.sin(t*20)*7;
 const flame=g.createLinearGradient(-40,0,-100,0);flame.addColorStop(0,"#a4ffddd6");flame.addColorStop(1,"#66b9ff00");
 poly([[-34,-11],[-92-throttle,-20],[-57,0],[-92-throttle,20],[-34,11]],flame);
 g.shadowColor="#63f6cf";g.shadowBlur=25;
 poly([[41,0],[-18,-23],[-38,-17],[-24,0],[-38,17],[-18,23]],"#66d8ce");
 g.shadowBlur=0;poly([[36,0],[-5,-13],[-19,0],[-5,13]],"#e5fff6");
 poly([[-19,-22],[-35,-29],[-26,-3],[-10,-8]],"#317ab1");
 poly([[-19,22],[-35,29],[-26,3],[-10,8]],"#317ab1");
 circle(5,0,6,"#eaffff");g.restore()
}
function drone(e,t){
 g.save();g.translate(e.x,e.y);g.rotate(Math.sin(t*2+e.phase)*.1);
 const r=e.r,col=e.side===1?"#83ffd3":"#d994fc",dark=e.side===1?"#1d5065":"#54315f";
 g.shadowColor=col;g.shadowBlur=e.type==="boss"?22:12;
 if(e.type==="boss"){
  poly([[-r,0],[-r*.5,-r*.8],[r*.7,-r*.8],[r,0],[r*.7,r*.8],[-r*.5,r*.8]],dark);
  g.strokeStyle=col;g.lineWidth=4;g.stroke();circle(0,0,23,col);circle(0,0,12,"#1a3750")
 }else if(e.type==="tank"){
  poly([[-r,0],[-r*.7,-r*.8],[r*.65,-r*.8],[r,0],[r*.65,r*.8],[-r*.7,r*.8]],dark);
  g.strokeStyle=col;g.lineWidth=3;g.stroke();circle(0,0,10,col)
 }else{
  poly([[-r,0],[0,-r*.75],[r,0],[0,r*.75]],dark);
  g.strokeStyle=col;g.lineWidth=2;g.stroke();circle(0,0,r*.3,col)
 }
 g.shadowBlur=0;
 if(e.hp<e.max){
  g.fillStyle="#0c233d";g.fillRect(-r,r+7,r*2,5);
  g.fillStyle=col;g.fillRect(-r,r+7,r*2*Math.max(0,e.hp/e.max),5)
 }
 g.restore()
}
function draw(t){
 g.save();
 if(S.shake>0)g.translate(rand(-7,7)*S.shake,rand(-7,7)*S.shake);
 background(t);
 if(S.phase==="intro"||S.phase==="lobby"){
  ship(200,H*.57+Math.sin(t*2)*7,t);
  for(let i=0;i<4;i++)drone({x:825+i*66,y:210+(i%2)*80+Math.sin(t+i)*14,r:i===3?32:22,type:i===3?"tank":"drone",
   side:i%2?1:-1,phase:i,hp:2,max:2},t)
 }else{
  for(const e of S.enemies)drone(e,t);
  for(const b of S.bullets){g.shadowColor="#bdfff8";g.shadowBlur=12;circle(b.x,b.y,b.r,"#e4ffff");g.shadowBlur=0;line(b.x-b.vx*.016,b.y-b.vy*.016,b.x,b.y,"#6aecca",3)}
  for(const b of S.enemyBullets){g.shadowColor="#e88def";g.shadowBlur=9;circle(b.x,b.y,b.r,"#f39cde");g.shadowBlur=0}
  for(const d of S.drops){circle(d.x,d.y,15,d.kind==="repair"?"#9cffb9":"#ffe39b");label(d.kind==="repair"?"✦":"★",d.x,d.y,17,"#133953")}
  ship(S.ship.x,S.ship.y,t);
  for(const p of S.parts){
   g.globalAlpha=clamp(p.t/p.max,0,1);
   if(p.ring)circle(p.x,p.y,p.r,p.color,true,5*p.t/p.max);
   else if(p.text)label(p.text,p.x,p.y,23,p.color);
   else{g.fillStyle=p.color;g.fillRect(p.x,p.y,p.r*2,p.r*2)}
  }
  g.globalAlpha=1;
  if(S.phase==="playing")label(S.practice?"TREINO SEM COTAÇÃO":S.order?.side===1?"EXPEDIÇÃO AURORA":"EXPEDIÇÃO ECLIPSE",W/2,H-28,14,"#b6dfe4")
 }
 if(S.flash>0){g.fillStyle="rgba(240,255,255,"+(S.flash*.55)+")";g.fillRect(0,0,W,H)}
 g.restore();
 const vign=g.createRadialGradient(W/2,H/2,90,W/2,H/2,720);vign.addColorStop(0,"#00000000");vign.addColorStop(1,"#020713a0");
 g.fillStyle=vign;g.fillRect(0,0,W,H)
}
function popup(title,content){$("modalTitle").textContent=title;$("modalBody").innerHTML=content;$("modalBack").classList.remove("hidden")}
function hidePopup(){$("modalBack").classList.add("hidden")}
function help(){
 popup("COMO JOGAR",'<h3>Escolha um reino e lute!</h3><p>O portal <strong>Aurora</strong> representa a hipótese de o preço do BTC subir. O <strong>Eclipse</strong> representa a hipótese de cair. A facção só define a previsão; você continua pilotando e atirando independentemente dos preços.</p><h3>Movimento e combate</h3><p>Use WASD/setas para mover, Espaço ou mouse para disparar e E para o pulso especial. No celular, deslize na arena e segure DISPARAR. São 75 segundos e três setores, com o colosso final.</p><h3>Recompensas</h3><p>Destruir inimigos dá cristais e patente. O resultado em USDT fictícios depende exclusivamente do preço de BTC/USDT ao entrar e sair, com custos simulados.</p><div class="info"><strong>Somente aprendizado:</strong> nenhuma ordem real, depósitos, saques ou promessas de renda. A IA não prevê o futuro e os sinais de fluxo não garantem direção.</div>')
}
function rules(){
 const quote=fresh()?money((m.data.ask+m.data.bid)/2):"indisponível";
 const spread=fresh()?((m.data.ask-m.data.bid)/(m.data.ask+m.data.bid)*200).toFixed(4)+"%":"indisponível";
 const age=fresh()?((Date.now()-m.data.quoteAt)/1000).toFixed(1)+" s":"sem cotação";
 popup("COMO OS DADOS VIRAM UM JOGO",
 '<p>O universo nasce de fluxos públicos do mercado à vista <strong>BTC/USDT</strong> da Binance. Não é um gráfico financeiro disfarçado: a arena tem combate e mecânicas próprias.</p>'+
 '<table><tr><th>NO JOGO</th><th>REGRA POR TRÁS</th></tr>'+
 '<tr><td>Exércitos Aurora e Eclipse</td><td>Participação das agressões compradoras e vendedoras nas negociações recentes (aggTrade).</td></tr>'+
 '<tr><td>Quantidade de drones</td><td>Atividade de negociações em 24 segundos com limite para manter a fase jogável.</td></tr>'+
 '<tr><td>Tempestades</td><td>Oscilações recentes das melhores cotações mais atividade.</td></tr>'+
 '<tr><td>Portal Aurora</td><td>Hipótese de alta: entrada no melhor ASK, saída no melhor BID, com custos adicionais simulados.</td></tr>'+
 '<tr><td>Portal Eclipse</td><td>Hipótese de baixa: entrada no melhor BID, saída no melhor ASK, com custos adicionais simulados. Não é uma ordem de venda.</td></tr>'+
 '<tr><td>Tesouro USDT fictício</td><td>Posição teórica até 1.000 USDT, sem alavancagem, taxa de 0,05% por lado e slippage fictício de 0,02% por lado. Não altera seu saldo Binance.</td></tr></table>'+
 '<h3>OBSERVATÓRIO TÉCNICO</h3>'+
 '<p>BTC/USDT: <strong>'+quote+'</strong> | Cotação recebida há: <strong>'+age+'</strong> | Spread: <strong>'+spread+'</strong> | Origem: <strong>'+m.data.source+'</strong>.</p>'+
 '<div class="info">As taxas e o slippage são hipóteses didáticas, não uma promessa de custos reais. Se a cotação ficar velha, o cronômetro e a apuração são congelados. Os resultados não são inventados.</div>')
}
function history(){
 let rows=progress.history.slice(0,45).map(h=>{
  const side=h.side===1?"AURORA":h.side===-1?"ECLIPSE":"TREINO";
  const value=h.net==null?"NÃO APURADA":(h.net>=0?"+":"")+money(h.net)+" USDT";
  const cls=h.net==null?"":h.net>=0?"positive":"negative";
  return "<tr><td>"+new Date(h.time).toLocaleString("pt-BR")+"</td><td>"+side+"</td><td class='"+cls+"'>"+value+"</td><td>"+Math.round(h.combat||0)+"</td></tr>"
 }).join("");
 popup("DIÁRIO DAS EXPEDIÇÕES",
 '<p>Se o navegador foi fechado durante uma missão, ela aparece como interrompida e <strong>não</strong> recebe lucro fictício realizado.</p>'+
 '<table><tr><th>QUANDO</th><th>FACÇÃO</th><th>RESULTADO</th><th>CRISTAIS</th></tr>'+ (rows||'<tr><td colspan="4">Ainda não há missões.</td></tr>')+'</table>'+
 '<p>Missões: '+progress.missions+'. Tesouro fictício: <strong>'+money(progress.wallet)+' USDT</strong>. Nada aqui pode ser sacado ou convertido em dinheiro real.</p>')
}
function resetProgress(){
 if(S.phase==="playing"){notify("EVACUE A MISSÃO ANTES DE ZERAR A CAMPANHA.");return}
 if(!confirm("Recomeçar o jogo e apagar o saldo fictício, cristais e histórico deste navegador?"))return;
 progress={version:1,wallet:10000,crystals:0,history:[],missions:0,record:0,open:null};store();hud();notify("NOVA CAMPANHA INICIADA.")
}
function pause(){
 if(S.phase!=="playing")return;
 S.paused=!S.paused;$("pauseOverlay").classList.toggle("hidden",!S.paused);S.keys={};S.touchFire=false;S.fire=false;
}
function coords(e){const b=cv.getBoundingClientRect();return{x:clamp((e.clientX-b.left)*W/b.width,0,W),y:clamp((e.clientY-b.top)*H/b.height,0,H)}}
cv.addEventListener("pointerdown",e=>{
 if(S.phase!=="playing")return;
 e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(err){}
 const q=coords(e);S.drag=true;S.fire=e.pointerType!=="touch";
 S.ship.ax=q.x;S.ship.ay=q.y;
 if(e.pointerType==="touch"){S.ship.x=clamp(q.x,60,W-60);S.ship.y=clamp(q.y,115,H-52)}
 else shoot()
});
cv.addEventListener("pointermove",e=>{
 if(!S.drag||S.phase!=="playing")return;
 const q=coords(e);if(e.pointerType==="touch"){S.ship.x=clamp(q.x,60,W-60);S.ship.y=clamp(q.y,115,H-52)}
 else{S.ship.ax=q.x;S.ship.ay=q.y}
});
for(const event of ["pointerup","pointercancel","lostpointercapture"])cv.addEventListener(event,()=>{S.drag=false;S.fire=false});
document.addEventListener("keydown",e=>{
 const key=e.key.toLowerCase();
 if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(key))e.preventDefault();
 S.keys[key]=true;
 if(key==="1"&&!e.repeat)portal(1);
 if(key==="2"&&!e.repeat)portal(-1);
 if(key==="e"&&!e.repeat)pulse();
 if(key==="p"&&!e.repeat)pause();
 if(key==="escape")hidePopup()
});
document.addEventListener("keyup",e=>{S.keys[e.key.toLowerCase()]=false});
window.addEventListener("blur",()=>{S.keys={};S.touchFire=false;if(S.phase==="playing"&&!S.paused)pause()});
function hold(el,down,up){
 el.addEventListener("pointerdown",e=>{e.preventDefault();down();try{el.setPointerCapture(e.pointerId)}catch(err){}});
 for(const type of ["pointerup","pointercancel","lostpointercapture"])el.addEventListener(type,up)
}
hold($("mobileShoot"),()=>{S.touchFire=true;shoot()},()=>S.touchFire=false);
$("mobilePulse").onclick=pulse;$("solarBtn").onclick=()=>portal(1);$("shadowBtn").onclick=()=>portal(-1);
$("startBtn").onclick=enter;$("offlineBtn").onclick=training;
$("pauseBtn").onclick=pause;$("resumeBtn").onclick=pause;
$("retryBtn").onclick=next;
$("restartBtn").onclick=()=>{
 if(S.phase==="playing"){
  if(S.order&&!fresh()){notify("AGUARDE A RECONEXÃO PARA EVACUAR.");return}
  if(confirm("Evacuar? A missão será apurada usando a cotação real atual, se houver."))finish("evacuada")
 }else if(S.phase==="result")next();
 else if(S.phase==="lobby"){resetArena();notify("ARENA LIMPA. ESCOLHA UM PORTAL.")}
};
$("soundBtn").onclick=()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"♫ ON":"♫ OFF";if(soundOn)soundTone(570,.1)};
$("helpBtn").onclick=help;$("rulesBtn").onclick=rules;$("historyBtn").onclick=history;$("reviewBtn").onclick=history;
$("resetProgressBtn").onclick=resetProgress;
$("modalClose").onclick=hidePopup;$("modalBack").onclick=e=>{if(e.target===$("modalBack"))hidePopup()};
let last=0,nextHUD=0;
function frame(t){
 requestAnimationFrame(frame);const dt=last?Math.min(.045,(t-last)/1000):.016;last=t;
 S.clock+=dt;S.noticeTime=Math.max(0,S.noticeTime-dt);
 if(S.noticeTime===0)$("gameMessage").classList.remove("show");
 update(dt);draw(t/1000);
 nextHUD+=dt;
 if(nextHUD>.7){nextHUD=0;statusUI();if(S.phase!=="playing")hud()}
}
initialize();m.start();statusUI();hud();store();requestAnimationFrame(frame);
window.NEON_RIFT_TEST={
 version:"1.0",state:()=>({phase:S.phase,time:S.time,score:S.score,shield:S.ship.shield,kills:S.kills,
  wallet:progress.wallet,crystals:progress.crystals,bid:m.data.bid,ask:m.data.ask,fresh:fresh(),order:S.order?.side??null}),
 training,portal,shoot,pulse,
 settlement:(side,entry,exit,notional=1000)=>{
  const qty=notional/entry;return (exit-entry)*side*qty-(notional+exit*qty)*.0005
 }
};
})();