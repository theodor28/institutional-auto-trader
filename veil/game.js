(()=>{
'use strict';
/* VEIL • O LIMIAR / original cinematic mystery.
 * Read-only Binance BTCUSDT public market streams through market.js.
 * No account, credentials, real orders, deposits or money prizes.
 * Floating +/- numbers are deltas in UNREALIZED hypothetical P&L.
 * Wallet is settled once only on exit/retreat; lost feed freezes action.
 */
const E=id=>document.getElementById(id),M=window.RIFT_MARKET,cv=E('world'),ctx=cv.getContext('2d');
const W=1536,H=864,PI=Math.PI,TAU=PI*2,DURATION=66,STORE='veil-limiar-game-v1';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),mix=(a,b,t)=>a+(b-a)*t,rnd=(a,b)=>a+Math.random()*(b-a);
const fmt=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const ROADS={
 light:{name:'O VOTO DA LUZ',small:'Marchar para a luz',side:1,color:'#9debd0',symbol:'✦'},
 shadow:{name:'O PACTO DA SOMBRA',small:'Atravessar as sombras',side:-1,color:'#e3aa8c',symbol:'◈'},
 watch:{name:'O SILÊNCIO DOS SÁBIOS',small:'Permanecer no mirante',side:0,color:'#cad4c4',symbol:'○'}
};
const RIDDLES=[
 {title:'Quem conduz os viajantes?',hint:s=>s.dominant==='aurora'?'O coro das chamas cresce junto às torres.':s.dominant==='eclipse'?'O rumor das sombras ocupa as muralhas.':'Dois coros disputam a mesma passagem.',
  options:[['aurora','As chamas antigas'],['eclipse','Os guardiões da sombra'],['equilibrio','Nenhum domínio']],key:'dominant',
  reason:s=>s.dominant==='aurora'?'A corrente de negociações favorece a luz.':s.dominant==='eclipse'?'A corrente de negociações favorece a sombra.':'A corrente recente está dividida.'},
 {title:'O céu anuncia perigo?',hint:s=>s.storm==='tempestade'?'Raios silenciosos cortam as nuvens além do vale.':'As nuvens atravessam devagar os picos.',
  options:[['brisa','Apenas uma brisa'],['tempestade','Uma tempestade cresce']],key:'storm',
  reason:s=>s.storm==='tempestade'?'As últimas oscilações foram intensas.':'A amplitude recente das cotações está contida.'},
 {title:'O portão deixa passar?',hint:s=>s.passage==='estreita'?'As duas bordas do arco quase se tocam.':'Há um espaço visível entre as pedras do arco.',
  options:[['estreita','O vão é estreito'],['traiçoeira','A travessia é larga demais']],key:'passage',
  reason:s=>s.passage==='estreita'?'A distância entre bid e ask é pequena.':'A distância entre bid e ask está mais ampla.'},
 {title:'A voz segue os próprios passos?',hint:s=>s.alignment==='aliada'?'A corrente e as pegadas apontam para a mesma direção.':s.alignment==='conflito'?'A corrente enfrenta o caminho traçado nas pedras.':'Uma névoa cobre o sentido dos passos.',
  options:[['aliada','As forças se acompanham'],['conflito','As forças se contradizem'],['nevoa','A direção se perdeu']],key:'alignment',
  reason:s=>s.alignment==='aliada'?'O movimento recente do preço e a agressão estão alinhados.':s.alignment==='conflito'?'O movimento recente e a pressão discordam.':'Os sinais não formam alinhamento claro.'}
];
let saveData={version:1,wallet:10000,runes:0,adventures:0,history:[],open:null};
try{
 const raw=JSON.parse(localStorage.getItem(STORE)||'null');
 if(raw&&raw.version===1){
  saveData.wallet=Number.isFinite(raw.wallet)?clamp(raw.wallet,0,1e6):10000;
  saveData.runes=Number.isFinite(raw.runes)?raw.runes:0;
  saveData.adventures=Number.isFinite(raw.adventures)?raw.adventures:0;
  saveData.history=Array.isArray(raw.history)?raw.history.slice(0,35):[];
  if(raw.open&&raw.open.started){
   saveData.history.unshift({time:raw.open.started,road:raw.open.road,status:'interrompida',net:null,runes:0});
  }
 }
}catch(err){}
const s={phase:'cover',paused:false,time:0,sceneTime:0,q:0,answered:false,snap:null,correct:0,earned:0,road:null,order:null,
 hero:{x:520,y:645,shield:100,wards:2,attackCd:0,facing:1},enemies:[],allies:[],sparks:[],runes:[],spawn:4,
 kills:0,lastImpact:0,lastPricePulse:0,lastPnl:null,lastNotice:0,eventTimer:0,walking:0,modal:false,stale:false,settled:false,
 floatCount:0,canContinue:false};
let sound=true,audio=null,musicIndex=0,musicClock=.1;
function persist(){
 saveData.open=s.phase==='journey'?{started:s.order?.startAt||Date.now(),road:s.road}:null;
 try{localStorage.setItem(STORE,JSON.stringify(saveData))}catch(e){}
}
function showBank(){
 const preview=s.phase==='journey'&&s.order&&M.fresh()?M.close(s.order):null;
 E('wallet').textContent=fmt(clamp(saveData.wallet+(preview?.net||0),0,1e6));
 const label=document.querySelector('.bank>span');
 label.textContent=s.phase==='journey'&&s.order?'TESOURO PROJETADO · FICTÍCIO':'TESOURO DA JORNADA · FICTÍCIO';
}
function tone(f,d=.11,type='triangle',volume=.017,slide=.8){
 if(!sound)return;
 try{
  audio??=new(window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const o=audio.createOscillator(),v=audio.createGain(),t=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(45,f*slide),t+d);
  v.gain.setValueAtTime(volume,t);v.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(v);v.connect(audio.destination);o.start(t);o.stop(t+d+.02)
 }catch(e){}
}
function ambiance(dt){
 if(!sound||s.phase!=='journey'||s.modal)return;
 musicClock-=dt;if(musicClock>0)return;musicClock+=.36;
 const bass=[110,0,138,0,123,0,98,0],notes=[0,294,330,0,392,0,349,0,0,330,0,294,349,0,0,0];
 if(bass[musicIndex%8])tone(bass[musicIndex%8],.28,'sine',.004);
 if(notes[musicIndex%16])tone(notes[musicIndex%16],.17,'triangle',.005);
 musicIndex++
}
function toast(title,body,icon='◈',duration=3){
 E('eventTitle').textContent=title;E('eventBody').textContent=body;E('eventIcon').textContent=icon;
 E('event').classList.remove('hidden');s.eventTimer=duration;
}
function floatNumber(value,subtitle='VARIAÇÃO EM CURSO',x=s.hero.x,y=s.hero.y-155,settled=false){
 if(!Number.isFinite(value))return;
 const host=E('floats'),node=document.createElement('div');
 node.className='float '+(value>=0?'good':'bad')+(settled?' settled':'');
 const main=document.createElement('span');main.textContent=(value>=0?'+':'−')+fmt(Math.abs(value));
 const label=document.createElement('small');label.textContent=subtitle;
 node.append(main,label);
 const rect=cv.getBoundingClientRect(),scale=Math.max(rect.width/W,rect.height/H);
 const crop=Math.max(0,W*scale-rect.width),offsetX=-crop*cameraPosition(),offsetY=(rect.height-H*scale)/2;
 node.style.left=(offsetX+x*scale)+'px';node.style.top=(offsetY+y*scale)+'px';
 host.append(node);setTimeout(()=>node.remove(),1900);
 if(host.children.length>12)host.firstElementChild?.remove()
}
function sparks(x,y,col,n=12,v=90){
 for(let i=0;i<n;i++){
  const a=rnd(0,TAU),speed=rnd(v*.1,v);
  s.sparks.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,t:rnd(.35,.95),max:.95,r:rnd(1,4),col})
 }
 if(s.sparks.length>150)s.sparks.splice(0,s.sparks.length-150)
}
function phase(p){
 s.phase=p;
 E('cover').classList.toggle('hidden',p!=='cover');
 E('dialogue').classList.toggle('hidden',p!=='quiz'&&p!=='roads');
 E('controls').classList.toggle('hidden',p!=='journey');
 E('outcome').classList.toggle('hidden',p!=='end');
 E('heroChip').classList.toggle('hidden',p!=='journey');
 E('clock').classList.toggle('hidden',p!=='journey');
 E('riskStatus').classList.toggle('hidden',p!=='journey');
 E('chapter').textContent=p==='cover'?'ATO I / OS SUSSURROS':p==='quiz'?'ATO I / QUATRO SEGREDOS':p==='roads'?'ATO II / A ESCOLHA':p==='journey'?'ATO III / A TRAVESSIA':p==='end'?'ATO IV / O REGISTRO':'ATO I / O MIRANTE';
 E('realmTitle').textContent=p==='journey'?'O caminho adiante':p==='end'?'O reino se recorda':p==='roads'?'O ponto de não retorno':p==='quiz'?'A voz sob as pedras':'A passagem das cinzas';
 E('sceneFooter').textContent=p==='journey'?'O VIAJANTE ESTÁ EM MOVIMENTO':p==='roads'?'A ESCOLHA NÃO É UMA PREVISÃO':p==='quiz'?'AS PEDRAS GUARDAM QUATRO RESPOSTAS':'OS VENTOS AINDA ESCREVEM O REINO';
 E('sceneHint').textContent=p==='journey'?'ESPAÇO · MAGIA / E · ESCUDO / R · RECUAR':'A HISTÓRIA MUDA EM TEMPO REAL';
 showBank()
}
function liveUI(){
 const yes=M.fresh();
 E('signalLamp').classList.toggle('live',yes);
 E('liveStatus').textContent=yes?'ORÁCULO EM TEMPO REAL':'ORÁCULO EM SILÊNCIO';
 E('coverInfo').textContent=yes?'Conexão com BTC/USDT estabelecida. O mundo está pronto.':'Esperando negociações e cotações recentes da Binance.';
 E('begin').disabled=!yes;
 E('riskStatus').classList.toggle('danger',s.stale);
 E('riskStatus').textContent=s.stale?'NÉVOA · MUNDO CONGELADO':s.enemies.some(e=>e.kind==='king')?'O REI APROXIMA-SE':s.enemies.length>2?'GUARDIÕES NO CAMINHO':'VENTOS CALMOS';
 showBank()
}
function unlock(){
 if(s.phase==='journey')return;
 const snap=M.snapshot();
 if(!snap){toast('O ORÁCULO NÃO RESPONDE','São necessárias cotações e negociações recentes. Tente novamente depois.','○');return}
 s.snap=snap;s.q=0;s.answered=false;s.correct=0;s.earned=0;
 phase('quiz');renderQuestion();tone(540,.24,'sine');
}
function renderQuestion(){
 if(s.q>=RIDDLES.length)return renderRoads();
 s.answered=false;s.canContinue=false;const q=RIDDLES[s.q];
 E('question').textContent=q.title;E('questionHint').textContent=q.hint(s.snap);
 E('questionCount').textContent='SEGREDO '+String(s.q+1).padStart(2,'0')+' DE 04';
 E('continue').classList.add('hidden');
 E('pips').querySelectorAll('span').forEach((pip,i)=>{
  pip.classList.toggle('active',i===s.q);pip.classList.toggle('done',i<s.q)
 });
 const list=E('choices');list.textContent='';
 for(let i=0;i<q.options.length;i++){
  const [value,text]=q.options[i],b=document.createElement('button');
  const digit=document.createElement('span');digit.textContent=String(i+1).padStart(2,'0');
  const label=document.createElement('div');label.textContent=text;b.append(digit,label);
  b.dataset.choice=value;b.onclick=()=>answer(value);list.append(b)
 }
}
function answer(value){
 if(s.phase!=='quiz'||s.answered||!s.snap)return;
 const q=RIDDLES[s.q],correct=value===s.snap[q.key];s.answered=true;
 s.earned+=correct?12:3;if(correct)s.correct++;
 E('choices').querySelectorAll('button').forEach(b=>{
  b.disabled=true;b.classList.toggle('correct',b.dataset.choice===s.snap[q.key]);
  b.classList.toggle('wrong',b.dataset.choice===value&&!correct)
 });
 E('questionHint').textContent=(correct?'Sua leitura foi precisa. ':'Uma nova pista se revela. ')+q.reason(s.snap);
 E('questionCount').textContent=(correct?'✦ +12 RUNAS':'◦ +3 RUNAS')+' · '+(s.q+1)+' / 4';
 E('continue').classList.remove('hidden');s.canContinue=true;
 sparks(745,507,correct?'#b0f5d4':'#dbad98',18,150);
 tone(correct?680:220,.16,correct?'triangle':'sawtooth')
}
function next(){if(s.phase!=='quiz'||!s.answered)return;s.q++;renderQuestion()}
function renderRoads(){
 phase('roads');
 E('question').textContent='Que voto você está disposto a fazer?';
 E('questionHint').textContent='A resposta certa sobre o presente não revela o amanhã. Você decide o caminho.';
 E('questionCount').textContent='ESCOLHA UM DOS TRÊS VOTOS';
 E('continue').classList.add('hidden');
 const list=E('choices');list.textContent='';
 for(const key of ['light','shadow','watch']){
  const road=ROADS[key],b=document.createElement('button'),symbol=document.createElement('span'),label=document.createElement('div');
  symbol.textContent=road.symbol;label.textContent=road.small;
  b.append(symbol,label);b.onclick=()=>choose(key);list.append(b)
 }
 toast('OS CAMINHOS SE ABREM','Atravesse a luz, siga a sombra ou espere no mirante.','✦',3);
 tone(520,.35,'triangle',.022)
}
function choose(which){
 if(s.phase!=='roads')return;
 if(!M.fresh()){toast('A NÉVOA CAIU','O voto só pode começar quando a cotação voltar.','○');return}
 const path=ROADS[which];if(!path)return;
 if(path.side&&saveData.wallet<20){toast('TESOURO INSUFICIENTE','Escolha o mirante ou reinicie a campanha no diário.','○');return}
 const order=path.side?M.enter(path.side,Math.min(1000,saveData.wallet*.10)):null;
 if(path.side&&!order){toast('TRILHA BLOQUEADA','Faltou uma cotação válida para abrir o voto.','○');return}
 s.order=order;s.road=which;s.time=0;s.settled=false;s.stale=false;s.hero={x:520,y:648,shield:100,wards:2,attackCd:0,facing:1};
 s.enemies=[];s.allies=[];s.sparks=[];s.runes=[];s.kills=0;s.spawn=3.8;s.lastPnl=null;
 s.lastPricePulse=0;s.walking=0;s.earned=Math.max(0,s.earned);musicIndex=0;musicClock=.1;
 E('pathLabel').textContent=path.name;
 E('pathStory').textContent=path.side?'A estrada mudará de aspecto com as forças da Binance.':'Você atravessa o reino sem firmar um voto sobre o tesouro.';
 E('wards').textContent=s.hero.wards;E('ward').disabled=false;E('shield').style.width='100%';
 E('shieldPct').textContent='100%';E('clockNumber').textContent='01:06';
 phase('journey');persist();tone(path.side===-1?310:540,.31,'sawtooth',.021);
 toast('O VIAJANTE PARTIU',path.side?'O voto foi feito. Seu tesouro projetado agora acompanha o mundo real.':'A contemplação não altera seu tesouro fictício.','✦',3)
}
function dangerToPlayer(attack){
 const hero=s.hero;hero.shield=Math.max(0,hero.shield-attack);
 E('shield').style.width=hero.shield+'%';E('shieldPct').textContent=hero.shield+'%';
 sparks(hero.x,hero.y-67,'#e9b6a0',18,165);
 tone(145,.16,'sawtooth',.027);
 toast(hero.shield>0?'O VIAJANTE FOI ATINGIDO':'A PROTEÇÃO SE ROMPEU',
  hero.shield>0?'O caminho ficou hostil. Proteja-se ou escolha recuar.':'O capítulo se encerra diante dos guardiões.','◈');
 if(hero.shield<=0)end('queda')
}
function spawn(){
 const market=M.data,road=ROADS[s.road],mid=(market.bid+market.ask)/2;
 const margin=road.side?(mid/s.order.startMid-1)*road.side:0;
 const opposition=road.side?(road.side===1?market.pressure<.44:market.pressure>.56):Math.abs(market.pressure-.5)>.16;
 const storm=Number.isFinite(market.stormPercent)?market.stormPercent:0;
 const strong=market.largestTrade>2000000;
 const kind=opposition&&(margin<-.00035||storm>.075&&strong)?'king':
  opposition||storm>.065?'guardian':Math.abs(market.pressure-.5)>.13?'soldier':'scout';
 if(road.side&&margin>.00015&&!opposition&&s.allies.length<2&&Math.random()<.42){
  s.allies.push({x:s.hero.x+rnd(60,150),y:s.hero.y+20,t:0,kind:'ally'});
  toast('UMA PRESENÇA AMIGA','Por enquanto, as forças do reino caminham com você.','✦',2.5)
 }else{
  const side=Math.random()<.5?-1:1;
  s.enemies.push({x:clamp(s.hero.x+side*rnd(190,280),85,1450),
   y:clamp(s.hero.y+rnd(-19,20),300,700),kind,t:0,
   hp:kind==='king'?5:kind==='guardian'?3:kind==='soldier'?2:1});
  if(kind==='king'){toast('O REI DAS CINZAS DESPERTOU','A oposição cresceu. Recuar também pode ser uma decisão inteligente.','♛',3.8);tone(125,.33,'sawtooth',.031)}
  else if(kind==='guardian')toast('UM GUARDIÃO SURGIU','A travessia exige atenção.','◈',2.7)
 }
}
function spell(x,y,auto){
 if(s.phase!=='journey'||!M.fresh()||s.hero.attackCd>0)return;
 s.hero.attackCd=.48;
 const hero=s.hero;let target=null,min=auto?180:96;
 for(const e of s.enemies){
  if(e.dead)continue;
  const dx=e.x-(auto?hero.x:x),dy=e.y-(auto?hero.y:y),d=Math.hypot(dx,dy);
  if(d<min){min=d;target=e}
 }
 const X=target?.x??x,Y=(target?.y??y)-56;
 s.runes.push({x:hero.x+15,y:hero.y-95,X,Y,t:.23});
 sparks(X,Y,'#b9f6e0',14,130);
 if(target){
  target.hp--;
  if(target.hp<=0){
   target.dead=true;s.kills++;
   const reward=target.kind==='king'?60:target.kind==='guardian'?25:target.kind==='soldier'?12:5;
   s.earned+=reward;sparks(target.x,target.y-86,'#caecd3',27,180);
   floatNumber(reward,'RUNAS DO REINO',target.x,target.y-142);
   tone(510,.14,'triangle',.022)
  }else tone(350,.11,'triangle',.016)
 }else tone(220,.08,'triangle',.009)
}
function ward(){
 if(s.phase!=='journey'||!M.fresh())return;
 if(s.hero.wards<1){toast('SEM RUNAS DE GUARDA','O Vórtice continua disponível para recuar.','○');return}
 s.hero.wards--;s.hero.shield=Math.min(100,s.hero.shield+28);
 E('wards').textContent=s.hero.wards;
 E('ward').disabled=s.hero.wards<1;E('shield').style.width=s.hero.shield+'%';
 E('shieldPct').textContent=s.hero.shield+'%';sparks(s.hero.x,s.hero.y-85,'#acebd5',36,170);
 tone(720,.22,'sine',.018);
 toast('A LUZ SE RECOMPÕE','Sua proteção aumenta. O voto e o preço continuam independentes da defesa.','✦',2.3)
}
function updateJourney(dt){
 if(s.phase!=='journey'||s.modal)return;
 if(!M.fresh()){
  if(!s.stale){s.stale=true;toast('A NÉVOA ENCERRIU O CAMINHO','A aventura e o cálculo param até a volta de uma cotação recente.','○',6)}
  return
 }
 if(s.stale){s.stale=false;toast('O VENTO RETORNOU','O mercado voltou a transmitir. A jornada continua.','✦')}
 s.time+=dt;s.walking+=dt;ambiance(dt);
 if(s.time>=DURATION){end('concluida');return}
 const hero=s.hero,u=clamp(s.time/55,0,1);
 hero.x=mix(520,1070,u)+Math.sin(s.time*1.55)*3;
 hero.y=mix(650,550,u)+Math.sin(s.time*11)*2;
 hero.attackCd=Math.max(0,hero.attackCd-dt);
 const remain=Math.ceil(Math.max(0,DURATION-s.time));
 E('clockNumber').textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');
 s.spawn-=dt;
 if(s.spawn<=0){
  spawn();const storm=Number.isFinite(M.data.stormPercent)?M.data.stormPercent:0;
  s.spawn=clamp(8.4-storm*18-(M.data.largestTrade>1500000?1:0),4.2,10)
 }
 for(const foe of s.enemies){
  if(foe.dead)continue;
  foe.t+=dt;
  const dx=hero.x-foe.x,dy=hero.y-foe.y,d=Math.hypot(dx,dy)||1;
  const speed=foe.kind==='king'?37:foe.kind==='guardian'?48:foe.kind==='soldier'?61:73;
  foe.x+=dx/d*dt*speed;foe.y+=dy/d*dt*speed*.55;
  if(d<38){foe.dead=true;dangerToPlayer(foe.kind==='king'?23:foe.kind==='guardian'?14:7)}
 }
 s.enemies=s.enemies.filter(e=>!e.dead);
 s.allies.forEach(a=>a.t+=dt);s.allies=s.allies.filter(a=>a.t<7);
 s.runes.forEach(a=>a.t-=dt);s.runes=s.runes.filter(a=>a.t>0);
 // One financial truth: feedback always based on current hypothetical P&L, not enemy kills.
 if(s.order&&s.time-s.lastPricePulse>=2.1){
  s.lastPricePulse=s.time;
  const pnl=M.close(s.order);
  if(pnl){
   const previous=s.lastPnl;
   if(previous!==null){
    const delta=pnl.net-previous;
    if(Math.abs(delta)>=.045){floatNumber(delta,'VARIAÇÃO EM CURSO',hero.x+25,hero.y-170);tone(delta>=0?580:290,.07,'sine',.007)}
   }else if(Math.abs(pnl.net)>.045){floatNumber(pnl.net,'CUSTO INICIAL • EM CURSO',hero.x+25,hero.y-170)}
   s.lastPnl=pnl.net;
  }
 }
}
function end(reason){
 if(s.phase!=='journey'||s.settled)return;
 if(s.order&&!M.fresh()){toast('AGUARDANDO COTAÇÃO','O tesouro não pode ser liquidado com um preço antigo.','○');return}
 const result=s.order?M.close(s.order):null;if(s.order&&!result)return;
 s.settled=true;
 if(result)saveData.wallet=clamp(saveData.wallet+result.net,0,1e6);
 saveData.runes+=s.earned;saveData.adventures++;
 saveData.history.unshift({time:Date.now(),road:s.road,status:reason,net:result?.net??null,
  runes:s.earned,correct:s.correct,duration:s.time,kills:s.kills,
  fee:result?.fees??0,movement:result?.movementPct??null});
 saveData.history=saveData.history.slice(0,35);
 s.order=null;s.phase='end';persist();phase('end');
 E('outcomeOverline').textContent=reason==='recuo'?'O PESO DE SABER VOLTAR':reason==='queda'?'NEM TODA TRAVESSIA TERMINA':'O FINAL DO CAPÍTULO';
 E('outcomeTitle').textContent=reason==='recuo'?'Você soube recuar.':reason==='queda'?'O reino resistiu.':'O limiar foi atravessado.';
 E('outcomeValue').textContent=result?(result.net>=0?'+':'−')+fmt(Math.abs(result.net)):'◈ TESOURO PRESERVADO';
 E('outcomeValue').classList.toggle('bad',Boolean(result&&result.net<0));
 E('outcomeDesc').textContent=result?
  'Desfecho fictício apurado na cotação recebida da Binance, com spread, taxas e deslizamento simulados. Runas desta expedição: '+s.earned+'.':
  'Você escolheu o silêncio. Recolheu '+s.earned+' runas sem expor créditos fictícios à variação do BTC.';
 E('chapter').textContent='ATO IV / O REGISTRO';
 if(result){floatNumber(result.net,'RESULTADO ENCERRADO',s.hero.x,s.hero.y-130,true)}
 sparks(s.hero.x,s.hero.y-100,result?.net>=0?'#b7f5d8':'#f1af98',49,250);
 tone(result?.net>=0?780:240,.42,'triangle',.028);showBank()
}
function retreat(){
 if(s.phase!=='journey')return;
 if(!M.fresh()){toast('A NÉVOA BLOQUEIA O RETORNO','Aguarde uma cotação recente para apurar o voto.','○');return}
 end('recuo')
}
function restart(){
 if(s.phase==='journey'){
  if(!M.fresh()){toast('A NÉVOA IMPEDE O RETORNO','Espere uma cotação real.','○');return}
  if(!confirm('Encerrar agora a jornada na cotação atual e começar outra?'))return;
  end('recuo')
 }
 s.q=0;s.answered=false;s.correct=0;s.earned=0;s.snap=null;s.order=null;s.road=null;
 s.hero={x:520,y:645,shield:100,wards:2,attackCd:0,facing:1};
 s.enemies=[];s.allies=[];s.sparks=[];s.runes=[];s.eventTimer=0;s.settled=false;s.lastPnl=null;
 E('event').classList.add('hidden');phase('cover');liveUI()
}
function modal(title,content){
 E('modalTitle').textContent=title;E('modalContent').innerHTML=content;
 E('modal').classList.remove('hidden');s.modal=true
}
function hideModal(){E('modal').classList.add('hidden');s.modal=false}
function diary(){
 const list=saveData.history.slice(0,30).map(h=>{
  const label=ROADS[h.road]?.name||h.road||'—';
  const amount=h.net==null?'NÃO APURADO':(h.net>=0?'+':'−')+fmt(Math.abs(h.net));
  const clazz=h.net==null?'':h.net>=0?'pos':'neg';
  return '<tr><td>'+new Date(h.time||Date.now()).toLocaleString('pt-BR')+'</td><td>'+label+'</td><td class="'+clazz+'">'+amount+'</td><td>'+(h.runes||0)+'</td></tr>'
 }).join('');
 modal('O diário das travessias','<p>Você guarda seus próprios registros neste navegador. Jornadas interrompidas não recebem um resultado inventado.</p>'+
  '<table><tr><th>QUANDO</th><th>CAMINHO</th><th>TESOURO FICTÍCIO</th><th>RUNAS</th></tr>'+ (list||'<tr><td colspan="4">O livro ainda está em branco.</td></tr>')+'</table>'+
  '<p>Expedições: <strong>'+saveData.adventures+'</strong>. Tesouro fictício: <strong>'+fmt(saveData.wallet)+'</strong>. Runas: <strong>'+saveData.runes+'</strong>.</p>'+
  '<button id="resetAll" class="btn-inline">RECOMEÇAR DO ZERO</button>');
 if(window.VEIL_MASTER?.appendDiary)window.VEIL_MASTER.appendDiary(E('modalContent'));
 E('resetAll').onclick=()=>{
  if(s.phase==='journey'){alert('Conclua ou recue desta expedição antes de limpar o histórico.');return}
  if(!confirm('Apagar definitivamente os créditos fictícios, as runas e o diário deste navegador?'))return;
  saveData={version:1,wallet:10000,runes:0,adventures:0,history:[],open:null};
  persist();hideModal();restart()
 }
}
function details(){
 const d=M.data,live=M.fresh(),p=live?fmt((d.bid+d.ask)/2):'indisponível';
 const spread=live?((d.ask-d.bid)/((d.ask+d.bid)/2)*100).toFixed(5)+'%':'indisponível';
 modal('A verdade por trás do reino',
 '<p><strong>VEIL é uma aventura, não uma plataforma financeira.</strong> Cada sinal visual é uma representação de dados públicos BTC/USDT da Binance; ninguém envia ordens ou conecta contas.</p>'+
 '<h3>Os quatro segredos</h3><p>O domínio da luz e das sombras usa a distribuição em valor das agressões nas negociações recentes; a tempestade usa a amplitude dos preços; a passagem, a distância entre os melhores bid e ask; e o último enigma compara pressão das negociações com a direção recente do preço. Uma leitura é congelada no início das perguntas para o enigma não mudar durante sua resposta.</p>'+
 '<h3>Por que reis e guardiões aparecem?</h3><p>As forças contrárias ao seu caminho, a intensidade das oscilações e o tamanho das negociações mudam os inimigos. Isso representa condições observadas, não uma previsão de lucro.</p>'+
 '<h3>Por que números aparecem e desaparecem?</h3><p>São mudanças do <strong>resultado hipotético ainda em aberto</strong>, medidas entre leituras recentes. Se a variação subir, surge um número jade; se cair, âmbar. O saldo acima mostra um tesouro projetado enquanto a jornada está aberta. Somente terminar ou recuar realiza o resultado fictício.</p>'+
 '<h3>Regra de apuração</h3><p>Saldo inicial de 10.000 créditos fictícios. Cada voto simula uma posição teórica de 10% do tesouro, limitada a 1.000, sem alavancagem. A trilha da Luz simula exposição à alta (entrada ask / saída bid), a Sombra à baixa (entrada bid / saída ask) e o Silêncio nenhuma exposição. A apuração usa custos hipotéticos de 0,05% por lado e slippage de 0,02% por lado. As runas do combate não alteram o resultado do preço.</p>'+
 '<div class="note">Último BTC/USDT observado: '+p+' créditos por BTC; spread: '+spread+'; fonte: '+d.source+'. O mundo pausa e a apuração é bloqueada se a cotação ficar antiga.</div>'+
 '<p><strong>Somente educação e entretenimento:</strong> sem dinheiro real, depósitos, saques, prêmios, conta Binance, promessas de ganhos ou execução de ordens.</p>')
}
function cameraPosition(){
 const r=cv.getBoundingClientRect(),scale=Math.max(r.width/W,r.height/H),overflow=W*scale-r.width;
 if(overflow<=1){cv.style.objectPosition='50% center';E('cinematic').style.backgroundPosition='50% center';return .5}
 const hero=s.hero.x,desired=hero*scale-r.width*.5;
 const pct=clamp(desired/overflow,0,1);
 cv.style.objectPosition=(pct*100).toFixed(2)+'% center';
 E('cinematic').style.backgroundPosition=(pct*100).toFixed(2)+'% center';return pct
}
function coordinateFromPointer(e){
 const r=cv.getBoundingClientRect(),scale=Math.max(r.width/W,r.height/H),
 overflow=Math.max(0,W*scale-r.width),pct=cameraPosition(),
 ox=-overflow*pct,oy=(r.height-H*scale)/2;
 return{x:(e.clientX-r.left-ox)/scale,y:(e.clientY-r.top-oy)/scale}
}
function stepEffects(dt){
 for(const x of s.sparks){x.t-=dt;x.x+=x.vx*dt;x.y+=x.vy*dt;x.vx*=Math.pow(.91,dt*11);x.vy*=Math.pow(.91,dt*11)}
 s.sparks=s.sparks.filter(x=>x.t>0);
 for(const ray of s.runes)ray.t-=dt;s.runes=s.runes.filter(ray=>ray.t>0);
 s.allies.forEach(a=>a.t+=dt);s.allies=s.allies.filter(a=>a.t<8);
 if(s.eventTimer>0){s.eventTimer-=dt;if(s.eventTimer<=0)E('event').classList.add('hidden')}
}
function ellipse(x,y,rx,ry,c){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fillStyle=c;ctx.fill()}
function path(points,c){
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=c;ctx.fill()
}
function line(x,y,X,Y,c,w=2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineCap='round';ctx.stroke()}
function hero(t){
 const h=s.hero,moving=s.phase==='journey',step=moving?Math.sin(t*10.8):Math.sin(t*1.7)*.12;
 const cloak=Math.sin(t*(moving?7.9:1.5))*8,bob=moving?Math.abs(step)*3:Math.sin(t*2)*2;
 ctx.save();ctx.translate(h.x,h.y);
 // physical shadow and warm edge-light
 ellipse(0,8,27,6,'#09151cb8');
 const capeGrad=ctx.createLinearGradient(-30,-135,40,-22);
 capeGrad.addColorStop(0,'#35555c');capeGrad.addColorStop(.38,'#183640');capeGrad.addColorStop(1,'#0a202a');
 path([[-19,-118],[-38,-96],[-47-cloak,-34],[-17,-48],[31+cloak,-32],[24,-108]],capeGrad);
 line(-18,-116,-39,-48,'#b7b09850',2);
 // boots articulated
 for(const [offset,phase] of [[-8,step],[11,-step]]){
  ctx.save();ctx.translate(offset,-48);ctx.rotate(phase*.29);
  path([[-8,0],[7,0],[9,39],[-7,38]],'#293b3f');
  path([[-7,33],[12,32],[19,39],[18,43],[-9,43]],'#131f26');
  line(-7,38,17,39,'#b5b49a80',2);ctx.restore()
 }
 // doublet and belt
 const tunic=ctx.createLinearGradient(-29,-123,31,-41);
 tunic.addColorStop(0,'#43595a');tunic.addColorStop(.45,'#233b44');tunic.addColorStop(1,'#0d2730');
 path([[-18,-117],[18,-119],[23,-61],[15,-41],[-17,-41],[-24,-64]],tunic);
 path([[-20,-68],[19,-68],[20,-61],[-21,-61]],'#b49b75');
 ctx.save();ctx.translate(-2,-110);
 ctx.strokeStyle='#6d8582';ctx.lineWidth=12;
 ctx.beginPath();ctx.moveTo(-16,0);ctx.lineTo(-27,48+step*5);ctx.moveTo(19,0);ctx.lineTo(29,49-step*5);ctx.stroke();ctx.restore();
 // collar, scarf and head; realistic silhouette vs cartoon face
 path([[-19,-120],[0,-129],[20,-120],[13,-109],[-14,-110]],'#718a83');
 ctx.fillStyle='#9f9080';ctx.beginPath();ctx.ellipse(0,-139+bob,14,19,0,0,TAU);ctx.fill();
 path([[-17,-144+bob],[-13,-157+bob],[2,-163+bob],[16,-157+bob],[18,-139+bob],[2,-148+bob]],'#24343b');
 path([[-17,-148+bob],[-27,-145+bob],[-22,-134+bob],[-12,-135+bob]],'#3e5357');
 line(7,-137+bob,11,-137+bob,'#14282b',1.5);
 // hanging lantern with light
 line(27,-76,36,-70,'#a5b6a3',3);
 ctx.shadowColor='#aed8bc';ctx.shadowBlur=16;
 ellipse(37,-62,5,8,'#a3f5d5');ctx.shadowBlur=0;
 ctx.restore()
}
function enemy(e,t){
 ctx.save();ctx.translate(e.x,e.y);
 const isKing=e.kind==='king',isGuardian=e.kind==='guardian',scale=isKing?1.48:isGuardian?1.15:e.kind==='scout'?.77:1;
 ctx.scale(scale,scale);const step=Math.sin(e.t*8.3)*5;
 ellipse(0,6,24,6,'#06151bba');
 const cloth=ctx.createLinearGradient(-30,-130,35,-30);
 cloth.addColorStop(0,isKing?'#7c4b3f':isGuardian?'#445454':'#3b4f55');cloth.addColorStop(1,'#10242b');
 path([[-17,-111],[-27,-87],[-32,-33],[32,-32],[22,-88],[14,-114]],cloth);
 line(-7,-38,-11+step,0,'#4e5c58',8);line(8,-38,14-step,0,'#566561',8);
 line(-23,-96,-35,-54,'#60736e',10);line(22,-96,31,-51,'#667775',10);
 ellipse(0,-131,15,20,'#756d65');
 path([[-18,-144],[0,-162],[19,-143],[17,-134],[-17,-134]],'#24353a');
 if(isKing){
  path([[-20,-149],[-18,-169],[-8,-160],[0,-181],[10,-161],[19,-169],[22,-148]],'#bda17d');
  line(33,-61,44,-164,'#b99579',5);
  ctx.shadowColor='#c5926e';ctx.shadowBlur=12;ellipse(43,-166,8,11,'#c7a989');ctx.shadowBlur=0
 }else if(isGuardian){
  path([[-19,-151],[20,-150],[23,-144],[-23,-143]],'#8c9487');
  line(29,-67,39,-157,'#a6b3a8',4)
 }else path([[-20,-149],[18,-148],[15,-143],[-18,-144]],'#6d8481');
 ctx.restore()
}
function ally(a){
 ctx.save();ctx.translate(a.x,a.y);ellipse(0,4,21,5,'#08171cb3');
 path([[-15,-112],[17,-112],[28,-37],[-25,-38]],'#4e7776');
 ellipse(0,-129,15,19,'#9faaa0');
 path([[-23,-142],[0,-176],[25,-142]],'#4a7e80');
 ctx.shadowColor='#b3e9da';ctx.shadowBlur=25;ellipse(29,-83,8,10,'#b5f7db');ctx.shadowBlur=0;ctx.restore()
}
function draw(now){
 const t=now/1000;ctx.clearRect(0,0,W,H);
 // atmospheric movement -- background is a detailed matte-painting SVG
 const storm=M.data.stormPercent||0;
 ctx.globalAlpha=.10;
 for(let i=0;i<4;i++){
  const x=(Math.sin(t*.12+i)*250)+350+i*250;
  const grad=ctx.createRadialGradient(x,570,30,x,570,320);
  grad.addColorStop(0,i%2?'#b9ded1':'#e4bba9');grad.addColorStop(1,'#a4c1bd00');
  ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(x,560,320,95,0,0,TAU);ctx.fill()
 }
 ctx.globalAlpha=1;
 const count=storm>.05?65:35;
 for(let i=0;i<count;i++){
  const x=(i*107+Math.sin(i*5+t*.5)*36+((t*13)%102))%W;
  const y=90+(i*91+t*(i%5?5:12))%670;
  ctx.fillStyle=i%6===0?'#c5eddf9e':'#bad4c36a';ctx.fillRect(x,y,i%6===0?2:1,1.5)
 }
 if(storm>.05){
  ctx.globalAlpha=clamp(storm*5,0,.4);
  for(let i=0;i<18;i++){const x=(i*133+t*100)%1700-100,y=(i*89+t*38)%790;line(x,y,x+48,y-18,'#e1c2b7',1.5)}
  ctx.globalAlpha=1
 }
 // directional portal glow
 const ambient=s.road==='shadow'?'#e8a88b':s.road==='light'?'#a1ebcf':'#a0b8af';
 const halo=ctx.createRadialGradient(893,458,20,893,458,203);
 halo.addColorStop(0,ambient+'33');halo.addColorStop(1,ambient+'00');
 ctx.fillStyle=halo;ctx.fillRect(690,255,405,405);
 if(s.phase==='journey'){
  for(const a of s.allies)ally(a);
  for(const e of s.enemies)enemy(e,t);
  for(const ray of s.runes){
   ctx.shadowColor='#b0f7d8';ctx.shadowBlur=21;
   line(ray.x,ray.y,ray.X,ray.Y,'#d1ffec',5);ctx.shadowBlur=0
  }
 }
 hero(t);
 // motes and impact sparks
 for(const p of s.sparks){ctx.globalAlpha=clamp(p.t/p.max,0,1);ctx.fillStyle=p.col;ctx.fillRect(p.x,p.y,p.r*2,p.r*2)}ctx.globalAlpha=1
}
let last=0,uiClock=0;
function loop(now){
 requestAnimationFrame(loop);const dt=last?Math.min(.05,(now-last)/1000):.016;last=now;
 s.sceneTime+=dt;
 if(s.phase==='journey')updateJourney(dt);
 stepEffects(dt);
 cameraPosition();
 draw(now);
 uiClock+=dt;if(uiClock>.4){uiClock=0;liveUI()}
}
E('begin').onclick=unlock;
E('look').onclick=()=>{
 if(s.phase!=='cover')return;
 s.phase='observe';E('cover').classList.add('hidden');
 toast('O MUNDO RESPIRA','Por alguns instantes, contemple o vale antes da jornada.','✦',4);
 setTimeout(()=>{if(s.phase==='observe'){s.phase='cover';E('cover').classList.remove('hidden')}},5600)
};
E('home').onclick=restart;
E('continue').onclick=next;
E('ward').onclick=ward;E('retreat').onclick=retreat;
E('again').onclick=restart;E('review').onclick=diary;
E('menu').onclick=diary;E('how').onclick=details;
E('audio').onclick=()=>{
 sound=!sound;E('audio').style.opacity=sound?'1':'.4';if(sound)tone(540,.1)
};
E('closeModal').onclick=hideModal;E('modal').onclick=e=>{if(e.target===E('modal'))hideModal()};
cv.addEventListener('pointerdown',e=>{
 if(s.phase!=='journey'||s.modal)return;
 const p=coordinateFromPointer(e);spell(p.x,p.y,false)
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')hideModal();
 if(s.phase==='quiz'&&!s.answered){
  const k=Number(e.key),q=RIDDLES[s.q];
  if(Number.isInteger(k)&&k>=1&&k<=q.options.length)answer(q.options[k-1][0]);
  return
 }
 if(s.phase==='quiz'&&s.answered&&e.key==='Enter'){next();return}
 if(s.phase==='roads'){
  const k=Number(e.key);if(k>=1&&k<=3)choose(['light','shadow','watch'][k-1]);return
 }
 if(s.phase==='journey'){
  if(e.code==='Space'){e.preventDefault();spell(s.hero.x+150,s.hero.y-70,true)}
  if(e.key.toLowerCase()==='e')ward();
  if(e.key.toLowerCase()==='r')retreat()
 }
});
phase('cover');M.init();liveUI();requestAnimationFrame(loop);
/* Dedicated narrow, read-only snapshot interface for autonomous mode.
 * The agent calls the SAME gameplay actions as a human, with no private market orders.
 * This API deliberately does not offer direct wallet or market mutation.
 */
window.VEIL_ENGINE={
 state:()=>({
  phase:s.phase,visible:!document.hidden,modal:s.modal,stale:s.stale,
  quoteFresh:M.fresh(),quizIndex:s.q,quizAnswered:s.answered,
  questionTruth:s.snap&&s.phase==='quiz'?s.snap[RIDDLES[s.q]?.key]:null,
  quizTruthList:s.snap?RIDDLES.map(x=>s.snap[x.key]):[],
  frozenReading:s.snap?{...s.snap}:null,
  availableReading:M.snapshot(),
  road:s.road,elapsed:s.time,enemyCount:s.enemies.length,
  enemies:s.enemies.map(e=>({kind:e.kind,x:e.x,y:e.y,hp:e.hp,dead:Boolean(e.dead)})),
  hero:{x:s.hero.x,y:s.hero.y,shield:s.hero.shield,wards:s.hero.wards,attackCd:s.hero.attackCd},
  unrealized:s.order&&M.fresh()?M.close(s.order)?.net:null,
  fee:s.order&&M.fresh()?M.close(s.order)?.fees:null,
  wallet:saveData.wallet,latest:saveData.history[0]?{...saveData.history[0]}:null,
  history:saveData.history.slice(0,24).map(h=>({...h})),
  adventures:saveData.adventures,crystals:saveData.runes,
  currentMarket:{pressure:M.data.pressure,momentumPercent:M.data.momentumPercent,
    stormPercent:M.data.stormPercent,spreadPercent:M.data.spreadPercent,largestTrade:M.data.largestTrade}
 }),
 actions:{start:unlock,answer,next,choose,spell,ward,retreat,restart},
 summarize:()=>({wins:saveData.history.filter(h=>h.net!=null&&h.net>0).length,
  losses:saveData.history.filter(h=>h.net!=null&&h.net<0).length,
  net:saveData.history.reduce((v,h)=>v+(Number.isFinite(h.net)?h.net:0),0),
  watch:saveData.history.filter(h=>h.road==='watch').length})
};

window.VEIL_TEST={
 version:'2.0',
 state:()=>({phase:s.phase,live:M.fresh(),q:s.q,answered:s.answered,road:s.road,
  time:s.time,hero:{x:s.hero.x,y:s.hero.y},enemyCount:s.enemies.length,
  wallet:saveData.wallet,displayWallet:E('wallet').textContent,credits:saveData.runes,
  adventures:saveData.adventures,unrealized:s.order&&M.fresh()?M.close(s.order)?.net:null}),
 start:unlock,answer,next,choose,ward,retreat,finish:end,details,
 questions:()=>RIDDLES.map(x=>x.title)
};
})();