(()=>{'use strict';
/* NEON RIFT — Four-path mystery. Real public Binance BTCUSDT; no real orders or keys. */
const E=id=>document.getElementById(id),M=window.RIFT_MARKET,C=E('scene'),g=C.getContext('2d');
const W=1100,H=650,TAU=Math.PI*2,DURATION=66,STORAGE='neon-rift-enigma-v1';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a);
const num=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const ROUTES={
 aurora:{name:'TRILHA DA AURORA',side:1,x:270,y:358,color:'#74ffc6',symbol:'☀'},
 eclipse:{name:'TEMPLO DO ECLIPSE',side:-1,x:815,y:360,color:'#ffd38b',symbol:'♛'},
 echo:{name:'CAVERNA DO ECO',side:0,x:350,y:509,color:'#82eaff',symbol:'◉'},
 vortex:{name:'PONTE DO VÓRTICE',side:0,x:823,y:516,color:'#dcaaff',symbol:'↶'}
};
const QS=[
 {icon:'♛',title:'Quem governa o reino agora?',hint:'Compare Pressão Solar e Sombra Profunda nas pistas do Oráculo.',
 opts:[['aurora','A Chama da Aurora'],['eclipse','A Coroa do Eclipse'],['equilibrio','O trono dividido']],key:'dominant',
 explain:s=>s.dominant==='aurora'?'A força luminosa predominou nas negociações recentes.':s.dominant==='eclipse'?'A força sombria predominou nas negociações recentes.':'Nenhum dos exércitos teve vantagem bastante clara.'},
 {icon:'ϟ',title:'A tempestade está calma ou furiosa?',hint:'Observe o que diz a Tempestade Quântica.',
 opts:[['brisa','Brisa nas torres'],['tempestade','Tempestade no castelo']],key:'storm',
 explain:s=>s.storm==='tempestade'?'Os preços oscilaram bastante na janela observada.':'Os preços oscilaram pouco na janela observada.'},
 {icon:'⌂',title:'Como está a passagem?',hint:'O Sussurro do Portal compara a largura de duas bordas do reino.',
 opts:[['estreita','Passagem estreita'],['traiçoeira','Passagem traiçoeira']],key:'passage',
 explain:s=>s.passage==='estreita'?'A passagem tem pouca distância entre suas bordas.':'A passagem está relativamente ampla; atravesse com cautela.'},
 {icon:'✧',title:'Os ventos seguem a mesma direção?',hint:'Compare a força dos exércitos com a direção dos últimos movimentos.',
 opts:[['aliada','As energias são aliadas'],['conflito','As energias se contradizem'],['nevoa','A direção está indefinida']],key:'alignment',
 explain:s=>s.alignment==='aliada'?'Movimento e pressão concordam neste momento.':s.alignment==='conflito'?'Movimento e pressão discordam neste momento.':'Não há alinhamento claro o suficiente.'}
];
let db={version:1,wallet:10000,crystals:0,journeys:0,history:[],open:null};
try{
 const d=JSON.parse(localStorage.getItem(STORAGE)||'null');
 if(d?.version===1){
  db.wallet=Number.isFinite(d.wallet)?clamp(d.wallet,0,1000000):10000;
  db.crystals=Number.isFinite(d.crystals)?Math.max(0,d.crystals):0;
  db.journeys=Number.isFinite(d.journeys)?Math.max(0,d.journeys):0;
  db.history=Array.isArray(d.history)?d.history.slice(0,40):[];
  if(d.open)db.history.unshift({time:d.open.time,route:d.open.route,status:'interrompida',net:null,runes:0});
 }
}catch(e){}
const S={phase:'intro',frozen:null,index:0,answered:false,answers:[],knowledge:0,route:null,order:null,
 time:0,t:0,hero:{x:550,y:575,facing:1,shield:100,wards:2,cast:0},runes:0,kills:0,spawns:4,
 foes:[],friends:[],fx:[],rays:[],bubble:0,stale:false,alerts:0};
let audio=null,soundOn=true,musicTimer=0,musicStep=0;
function beep(hz=450,dur=.11,type='triangle',volume=.022){
 if(!soundOn)return;
 try{
  audio??=new(window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const o=audio.createOscillator(),v=audio.createGain(),t=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(hz,t);o.frequency.exponentialRampToValueAtTime(Math.max(60,hz*.7),t+dur);
  v.gain.setValueAtTime(volume,t);v.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(v);v.connect(audio.destination);o.start(t);o.stop(t+dur+.01)
 }catch(e){}
}
function music(dt){
 if(!soundOn||S.phase!=='mission')return;musicTimer-=dt;if(musicTimer>0)return;musicTimer+=.32;
 const bass=[110,0,146,0,123,0,98,0],mel=[0,330,392,0,349,415,0,293,0,392,440,0,349,0,330,0];
 const b=bass[musicStep%8],n=mel[musicStep%16];if(b)beep(b,.22,'triangle',.006);if(n)beep(n,.14,'sine',.007);musicStep++
}
function save(){
 db.open=S.phase==='mission'?{time:S.order?.startAt||Date.now(),route:S.route}:null;
 try{localStorage.setItem(STORAGE,JSON.stringify(db))}catch(e){}
}
function wallet(){
 E('treasure').textContent=num(db.wallet);
 E('crystals').textContent=db.crystals.toLocaleString('pt-BR');
 E('level').textContent=String(1+Math.floor(db.crystals/200)).padStart(2,'0')
}
function say(s,bubble=true){
 E('narrator').textContent=s;
 if(bubble){E('storyBubble').textContent=s;E('storyBubble').classList.remove('hidden');S.bubble=4}
}
function dust(x,y,col,n=18,force=130){
 for(let i=0;i<n;i++){
  const a=rand(0,TAU),v=rand(force*.27,force);
  S.fx.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:rand(.34,.85),max:.85,col,r:rand(1.5,4.8)})
 }if(S.fx.length>230)S.fx.splice(0,S.fx.length-230)
}
function flowUI(){
 const step={intro:0,observing:0,quiz:1,routes:2,mission:3,result:4}[S.phase]??0;
 for(let i=1;i<=5;i++){
  E('flow'+i).classList.toggle('active',i===step+1);
  E('flow'+i).classList.toggle('done',i<step+1)
 }
 E('flowPhase').textContent=['1 · INVESTIGAR','2 · DECIFRAR','3 · ESCOLHER','4 · CAMINHAR','5 · DESFECHO'][step];
 E('chapter').textContent=['01 / 04','01 / 04','02 / 04','03 / 04','04 / 04'][step];
 E('missionBar').style.width=(step===4?100:step*22)+'%';
 E('missionStatus').textContent=S.phase==='mission'?'✦ CAPÍTULO III · JORNADA ATIVA':S.phase==='result'?'✦ A JORNADA FOI REGISTRADA':'✦ O MISTÉRIO DOS QUATRO CAMINHOS'
}
function clues(v,freeze=false){
 if(!v)return;
 const p=v.sunRatio;
 E('clue1desc').textContent=p>.56?'A luz prevalece entre os exércitos.':p<.44?'A luz recuou diante das sombras.':'A luz não domina a disputa.';
 E('clue2desc').textContent=p<.44?'As sombras dominam as negociações.':p>.56?'As sombras perdem terreno.':'Nenhum lado domina o reino.';
 E('clue3desc').textContent=v.storm==='tempestade'?'Os ventos sacodem as torres.':'O céu sopra apenas uma brisa.';
 E('clue4desc').textContent=v.passage==='estreita'?'A passagem está estreita.':'A passagem se abriu demais.';
 const wind=v.alignment==='aliada'?'Os últimos passos acompanham a pressão.':v.alignment==='conflito'?'Os últimos passos contradizem a pressão.':'A direção recente está encoberta pela névoa.';
 E('oracleSummary').textContent=(freeze?'Pistas preservadas para o enigma. ':'')+wind
}
function status(){
 const live=M.fresh(),d=M.data;
 E('liveDot').classList.toggle('live',live);
 E('liveText').textContent=live?'BTC/USDT · ORÁCULO SINCRONIZADO':'BINANCE · AGUARDANDO O SINAL';
 E('ageText').textContent=live?'há '+Math.round((Date.now()-d.quoteAt)/1000)+'s':'SEM COTAÇÃO RECENTE';
 E('coverSignal').textContent=live?'O reino recebeu dados reais da Binance.':'Sem cotação recente; aguarde ou observe o mapa.';
 E('storyStatus').textContent=S.phase==='mission'?(S.stale?'NÉVOA · CAMINHADA CONGELADA':ROUTES[S.route].name):
  S.phase==='quiz'?'O ORÁCULO REVELA SEUS SEGREDOS':S.phase==='routes'?'QUATRO PORTAIS DESBLOQUEADOS':'O REINO AGUARDA O AVENTUREIRO';
 if(['intro','observing'].includes(S.phase)&&live){const snap=M.snapshot();if(snap)clues(snap)}
}
function begin(){
 if(S.phase==='mission'){say('O herói já está na trilha. Use suas runas ou recue.');return}
 const snap=M.snapshot();
 if(!snap){say('O Oráculo ainda não tem cotações e negociações recentes suficientes. Aguarde a Binance.',true);beep(155,.15,'sawtooth');return}
 S.phase='quiz';S.frozen=snap;S.index=0;S.answered=false;S.answers=[];S.knowledge=0;S.route=null;S.order=null;
 S.hero={x:550,y:575,facing:1,shield:100,wards:2,cast:0};
 S.foes=[];S.friends=[];S.fx=[];
 E('sceneCover').classList.add('hidden');E('questionPanel').classList.remove('hidden');E('expeditionPanel').classList.add('hidden');
 clues(snap,true);displayQuestion();flowUI();say('O Livro dos Enigmas se abriu. Leia as quatro pistas antes de escolher sua trilha.',true);beep(720,.24)
}
function displayQuestion(){
 if(S.index>=4){routesUnlocked();return}
 S.answered=false;const q=QS[S.index];
 E('questionIcon').textContent=q.icon;E('questionCount').textContent='PERGUNTA '+(S.index+1)+' DE 4';
 E('questionTitle').textContent=q.title;E('questionHint').textContent=q.hint;
 E('quizProgress').textContent=S.index+' / 4';E('quizFeedback').classList.add('hidden');
 E('quizStart').classList.add('hidden');E('nextQuestion').classList.add('hidden');
 const list=E('answers');list.textContent='';
 q.opts.forEach(([value,label],i)=>{
  const b=document.createElement('button'),k=document.createElement('span'),t=document.createElement('span');
  k.className='choice-key';k.textContent=i+1;t.textContent=label;
  b.dataset.choice=value;b.append(k,t);b.onclick=()=>answer(value);list.append(b)
 });
 for(let i=1;i<=4;i++)E('clue'+i).classList.toggle('active',S.index===0?i<=2:S.index===1?i===3:i===4)
}
function answer(value){
 if(S.phase!=='quiz'||S.answered)return;
 const q=QS[S.index],right=S.frozen[q.key],ok=value===right;
 S.answered=true;S.answers.push({q:S.index+1,answer:value,truth:right,correct:ok});S.knowledge+=ok?15:4;
 E('answers').querySelectorAll('button').forEach(b=>{b.disabled=true;b.classList.toggle('correct',b.dataset.choice===right);b.classList.toggle('wrong',b.dataset.choice===value&&!ok)});
 const feedback=E('quizFeedback');feedback.classList.remove('hidden');
 feedback.textContent=(ok?'✦ ENIGMA DECIFRADO! +15 cristais. ':'◉ O ORÁCULO EXPLICA. +4 cristais. ')+q.explain(S.frozen);
 E('nextQuestion').classList.remove('hidden');E('nextQuestion').textContent=S.index===3?'✦ REVELAR OS CAMINHOS':'PRÓXIMO ENIGMA ›';
 E('quizProgress').textContent=S.index+1+' / 4';dust(550,359,ok?'#a7ffde':'#cca1ff',ok?21:9,150);
 say(ok?'Sua leitura despertou um símbolo no mapa!':'O futuro não fica mais fácil por adivinhar. Aprenda com o Oráculo.',true);
 beep(ok?730:310,.18,ok?'triangle':'sawtooth')
}
function nextQuestion(){if(S.phase!=='quiz'||!S.answered)return;S.index++;displayQuestion()}
function routesUnlocked(){
 S.phase='routes';S.answered=false;
 E('questionIcon').textContent='✦';E('questionCount').textContent='OS QUATRO PORTAIS';
 E('questionTitle').textContent='Que caminho merece seus passos?';
 E('questionHint').textContent='As pistas retratam o presente, mas o futuro ainda é um mistério.';
 E('quizProgress').textContent='4 / 4';E('quizFeedback').classList.add('hidden');E('nextQuestion').classList.add('hidden');
 E('quizStart').classList.add('hidden');const list=E('answers');list.textContent='';
 for(const [key,route] of Object.entries(ROUTES)){
  const b=document.createElement('button'),k=document.createElement('span'),t=document.createElement('span');
  k.className='choice-key';k.textContent=route.symbol;t.textContent=route.name;
  b.append(k,t);b.onclick=()=>choose(key);list.append(b)
 }
 E('routeNote').querySelector('p').textContent='Aurora e Eclipse fazem juramentos fictícios. Eco e Vórtice exploram sem expor seu tesouro.';
 flowUI();say('Os quatro portais despertaram! Observe o terreno e escolha uma passagem.',true);beep(950,.29)
}
function choose(key){
 if(S.phase!=='routes'){say('Decifre as quatro questões antes de escolher um portal.',true);return}
 if(!M.fresh()){say('A névoa encobre a passagem. Aguarde o sinal recente da Binance.',true);return}
 const r=ROUTES[key];if(!r)return;let order=null;
 if(r.side){
  if(db.wallet<20){say('Tesouro fictício insuficiente. Eco e Vórtice continuam disponíveis.');return}
  order=M.enter(r.side,Math.min(1000,db.wallet*.10));
  if(!order){say('A passagem não foi confirmada pela cotação atual.');return}
 }
 S.phase='mission';S.route=key;S.order=order;S.time=0;S.runes=S.knowledge;S.kills=0;S.spawns=4;
 S.hero={x:550,y:575,facing:r.x<550?-1:1,shield:100,wards:2,cast:0};
 S.foes=[];S.friends=[];S.fx=[];S.rays=[];S.stale=false;musicStep=0;musicTimer=0;
 E('questionPanel').classList.add('hidden');E('expeditionPanel').classList.remove('hidden');
 E('missionHeading').textContent=r.name;
 E('missionText').textContent=r.side?'Você assumiu um juramento na direção desta trilha. O desfecho será lido no fim ou no recuo.':'Você investiga sem juramento: conhecimento e cristais, com o tesouro intacto.';
 E('expeditionStage').textContent=r.side?'JURAMENTO ATIVO':'OBSERVAÇÃO';
 E('sceneMode').textContent=r.symbol+' '+r.name;E('sceneClock').textContent='◷ 66s';E('sceneAlert').classList.add('hidden');
 E('wardBtn').textContent='✦ ESCUDO MÍSTICO (2 CARGAS)';E('wardBtn').disabled=false;
 E('routeNote').querySelector('p').textContent=r.side?'Recuar pelo Vórtice encerra o juramento usando a cotação atual e os custos fictícios.':'Esta trilha não altera o tesouro fictício. A aventura continua com os dados do reino.';
 save();flowUI();say('O aventureiro entra em '+r.name+'. A caminhada começou!',true);
 dust(S.hero.x,S.hero.y-80,r.color,46,220);beep(r.side===-1?360:650,.33,'sawtooth')
}
function danger(on,title='',body=''){
 E('sceneAlert').classList.toggle('hidden',!on);
 if(on){E('alertTitle').textContent=title;E('alertDesc').textContent=body}
}
function spawn(){
 const d=M.data,r=ROUTES[S.route],mid=(d.bid+d.ask)/2;
 const alignment=r.side?(mid/S.order.startMid-1)*r.side:0;
 const opposing=r.side?(r.side===1?d.pressure<.44:d.pressure>.56):Math.abs(d.pressure-.5)>.15;
 const massive=d.largestTrade>2200000,storm=Number.isFinite(d.stormPercent)?d.stormPercent:0;
 const kind=opposing&&(alignment<-.00036||massive&&storm>.06)?'rei':
  opposing||storm>.078?'guardiao':Math.abs(d.pressure-.5)>.14?'soldado':'batedor';
 if(r.side&&alignment>.00013&&!opposing&&S.friends.length<2){
  S.friends.push({kind:'mago',x:S.hero.x+rand(-130,130),y:S.hero.y+rand(-20,20),t:0});
  say('Uma maga luminosa surgiu! O reino parece favorecer o seu juramento agora.',true)
 }else{
  const right=Math.random()>.5;
  S.foes.push({kind,x:clamp(S.hero.x+(right?1:-1)*rand(105,200),60,1030),
   y:clamp(S.hero.y+rand(-15,15),250,605),t:0,
   hp:kind==='rei'?4:kind==='guardiao'?3:kind==='soldado'?2:1});
  if(kind==='rei'){say('♛ O REI DAS SOMBRAS DESPERTOU! As forças opostas avançaram.',true);beep(175,.36,'sawtooth',.034)}
  else if(kind==='guardiao')say('Um guardião armado aparece diante do herói. Observe a direção do reino.',true)
 }
}
function spell(x,y,auto=false){
 if(S.phase!=='mission'||!M.fresh()||S.hero.cast>0)return;
 S.hero.cast=.46;
 let best=null,closest=auto?190:72;
 for(const f of S.foes){
  const d=Math.hypot(f.x-(auto?S.hero.x:x),f.y-(auto?S.hero.y:y));
  if(d<closest){closest=d;best=f}
 }
 const X=best?.x??x,Y=(best?.y??y)-38;
 S.rays.push({x:S.hero.x,y:S.hero.y-78,X,Y,t:.18});
 dust(X,Y,'#a3fff2',14,130);beep(820,.11);
 if(best){
  best.hp--;
  if(best.hp<=0){
   best.dead=true;S.kills++;
   const pts=best.kind==='rei'?50:best.kind==='guardiao'?29:best.kind==='soldado'?16:8;
   S.runes+=pts;dust(best.x,best.y-65,'#ca9aff',27,170);
   say('✦ '+best.kind.toUpperCase()+' VENCIDO! +'+pts+' cristais fictícios.',false)
  }
 }else say('A runa brilhou no vazio. Mire em um guardião ou use Espaço perto dele.',false)
}
function ward(){
 if(S.phase!=='mission'||!M.fresh())return;
 if(S.hero.wards<=0){say('A proteção se esgotou. O Vórtice continua aberto para recuar.');return}
 S.hero.wards--;S.hero.shield=Math.min(100,S.hero.shield+25);
 E('wardBtn').textContent='✦ ESCUDO MÍSTICO ('+S.hero.wards+' CARGAS)';
 if(!S.hero.wards)E('wardBtn').disabled=true;
 dust(S.hero.x,S.hero.y-69,'#abffe0',31,150);say('✦ Proteção restaurada! Seu herói ganha tempo para decidir.',true);beep(570,.26)
}
function updateMission(dt){
 if(S.phase!=='mission')return;
 if(!M.fresh()){
  S.stale=true;E('sceneMode').textContent='⚠ NÉVOA NO REINO · AGUARDANDO COTAÇÃO';
  danger(true,'NÉVOA NOS QUATRO CAMINHOS','Missão congelada. Nenhum resultado é inventado.');return
 }
 if(S.stale){S.stale=false;danger(false);say('O Oráculo voltou a escutar o mercado. A aventura continua!',true)}
 S.time+=dt;music(dt);
 if(S.time>=DURATION){conclude('concluida');return}
 const r=ROUTES[S.route],u=clamp(S.time/15,0,1),e=u*u*(3-2*u);
 S.hero.x=lerp(550,r.x,e)+(u===1?Math.sin(S.time*.9)*22:0);
 S.hero.y=lerp(575,r.y,e)+(u===1?Math.sin(S.time*2)*2:0);
 S.hero.cast=Math.max(0,S.hero.cast-dt);
 S.spawns-=dt;
 if(S.spawns<=0){
  spawn();const storm=Number.isFinite(M.data.stormPercent)?M.data.stormPercent:0;
  S.spawns=clamp(8-storm*16-(M.data.largestTrade>2e6?1:0),4,9)
 }
 for(const f of S.foes){
  if(f.dead)continue;
  f.t+=dt;const dx=S.hero.x-f.x,dy=S.hero.y-f.y,len=Math.hypot(dx,dy)||1;
  const speed=f.kind==='rei'?33:f.kind==='guardiao'?44:59;
  f.x+=dx/len*speed*dt;f.y+=dy/len*speed*.60*dt;
  if(len<36){
   S.hero.shield=Math.max(0,S.hero.shield-(f.kind==='rei'?20:f.kind==='guardiao'?13:7));
   dust(S.hero.x,S.hero.y-45,'#ffa1bb',15,190);
   f.dead=true;beep(123,.16,'sawtooth',.035);
   if(!S.hero.shield){conclude('derrota');return}
   say('Um guardião acertou seu escudo. Use sua magia ou recue antes de perder a trilha!',true)
  }
 }
 S.foes=S.foes.filter(f=>!f.dead);
 for(const a of S.friends)a.t+=dt;
 S.friends=S.friends.filter(a=>a.t<7);
 for(const ray of S.rays)ray.t-=dt;S.rays=S.rays.filter(ray=>ray.t>0);
 const remain=Math.max(0,Math.ceil(DURATION-S.time));
 E('missionTime').textContent=String(Math.floor(remain/60)).padStart(2,'0')+':'+String(remain%60).padStart(2,'0');
 E('missionRunes').textContent=S.runes;
 E('shieldValue').textContent=Math.round(S.hero.shield)+'%';
 E('shieldMeter').style.width=S.hero.shield+'%';
 E('sceneClock').textContent='◷ '+Math.ceil(DURATION-S.time)+'s';
 E('sceneMode').textContent=r.symbol+' '+r.name;
 E('missionBar').style.width=(67+S.time/DURATION*30)+'%';
 if(S.order){
  const mid=(M.data.bid+M.data.ask)/2;
  const adverse=(mid/S.order.startMid-1)*S.order.side;
  const oppose=S.order.side===1?M.data.pressure<.44:M.data.pressure>.56;
  if(adverse<-.0004&&oppose)danger(true,'POR ESTE CAMINHO, CUIDADO!','Forças opostas avançam e a energia recuou.');
  else if(S.foes.some(f=>f.kind==='rei'))danger(true,'O REI DAS SOMBRAS DESPERTOU','Um guardião poderoso protege o portal.');
  else danger(false)
 }else if(S.foes.some(f=>f.kind==='rei'))danger(true,'UM REI BLOQUEIA A PASSAGEM','O caminho de observação também tem desafios.');
 else danger(false)
}
function conclude(reason){
 if(S.phase!=='mission')return;
 if(S.order&&!M.fresh()){say('Uma névoa impede apurar o destino. Aguarde o sinal da Binance.',true);return}
 const result=S.order?M.close(S.order):null;
 if(S.order&&!result)return;
 if(result)db.wallet=clamp(db.wallet+result.net,0,1000000);
 db.crystals+=S.runes;db.journeys++;
 const record={time:Date.now(),route:S.route,status:reason,net:result?.net??null,
  runes:S.runes,questions:S.answers.filter(a=>a.correct).length,seconds:S.time,kills:S.kills,
  fees:result?.fees??0,change:result?.movementPct??null};
 db.history.unshift(record);db.history=db.history.slice(0,40);
 S.order=null;S.phase='result';save();wallet();flowUI();danger(false);
 E('questionPanel').classList.remove('hidden');E('expeditionPanel').classList.add('hidden');
 E('questionIcon').textContent=reason==='concluida'?'♛':reason==='recuo'?'↶':'✧';
 E('questionCount').textContent='DESFECHO DA JORNADA';
 E('questionTitle').textContent=reason==='concluida'?'A trilha foi conquistada!':reason==='recuo'?'O recuo também salva heróis.':'O escudo do herói se quebrou.';
 E('questionHint').textContent=(result?'Tesouro: '+(result.net>=0?'+':'')+num(result.net)+' créditos fictícios.':'Tesouro preservado: nenhum juramento.')+' Cristais obtidos: '+S.runes+'.';
 E('quizProgress').textContent='FIM';E('nextQuestion').classList.add('hidden');E('quizFeedback').classList.add('hidden');E('quizStart').classList.add('hidden');
 const a=E('answers');a.textContent='';const b=document.createElement('button');b.textContent='↻ INICIAR UM NOVO ENIGMA';b.onclick=restart;a.append(b);
 E('routeNote').querySelector('p').textContent=result?'Este desfecho foi apurado usando a cotação atual da Binance e custos hipotéticos. Veja o diário.':'A exploração sem juramento não altera seu tesouro fictício.';
 E('sceneMode').textContent='✦ CAPÍTULO ENCERRADO';E('sceneClock').textContent='◷ FIM';
 say(reason==='recuo'?'O herói voltou pelo Vórtice. Não é preciso insistir em uma trilha perigosa.':reason==='derrota'?'O escudo se partiu, mas o conhecimento ficou.':'O herói escreveu o fim de um capítulo. O reino já prepara outro mistério.',true);
 dust(S.hero.x,S.hero.y-80,result?.net>=0?'#a1ffe6':'#d5a5ff',45,190);
 beep(reason==='concluida'?830:340,.35)
}
function retreat(){if(S.phase!=='mission')return;if(!M.fresh()){say('A névoa cobre a passagem. O recuo precisa de uma cotação atual.');return}conclude('recuo')}
function restart(){
 if(S.phase==='mission'){
  if(!M.fresh()){say('O portal está sem cotação. Aguardando reconexão para concluir a missão.');return}
  if(!confirm('Encerrar esta jornada pelo Vórtice na cotação atual?'))return;
  conclude('recuo')
 }
 S.phase='observing';S.frozen=null;S.index=0;S.answered=false;S.answers=[];S.knowledge=0;
 S.route=null;S.order=null;S.time=0;S.foes=[];S.friends=[];S.rays=[];S.fx=[];
 S.hero={x:550,y:575,facing:1,shield:100,wards:2,cast:0};
 E('questionPanel').classList.remove('hidden');E('expeditionPanel').classList.add('hidden');
 E('questionIcon').textContent='?';E('questionCount').textContent='PRÓLOGO';
 E('questionTitle').textContent='O reino guarda quatro segredos.';
 E('questionHint').textContent='Estude as pistas do Oráculo antes de iniciar o mistério.';
 E('quizStart').classList.remove('hidden');E('nextQuestion').classList.add('hidden');E('quizFeedback').classList.add('hidden');
 E('answers').textContent='';E('quizProgress').textContent='0 / 4';E('sceneMode').textContent='MAPA DO REINO';E('sceneClock').textContent='◷ --:--';
 E('routeNote').querySelector('p').textContent='O caminho é uma escolha, não uma certeza. O presente não garante o futuro.';
 danger(false);flowUI();say('Uma nova história começou. Observe como as forças do reino mudaram.',true);
 const s=M.snapshot();if(s)clues(s)
}
function hero(t){
 const h=S.hero;g.save();g.translate(h.x,h.y);g.scale(h.facing||1,1);
 const active=S.phase==='mission',swing=active?Math.sin(t*11)*11:Math.sin(t*2)*2,bob=Math.abs(Math.sin(t*(active?11:2)))*3;
 g.fillStyle='#4affdc8c';g.beginPath();g.ellipse(0,5,25,7,0,0,TAU);g.fill();
 for(const [x,w] of [[-9,swing],[10,-swing]]){
  g.save();g.translate(x,-33);g.rotate(w*.03);g.fillStyle='#253a65';g.fillRect(-7,0,14,29);
  g.fillStyle='#17182c';g.fillRect(-9,22,19,10);g.fillStyle='#76eff1';g.fillRect(-7,26,16,3);g.restore()
 }
 const flap=Math.sin(t*8)*6;
 g.fillStyle='#19143b';g.strokeStyle='#a17eff';g.lineWidth=3;
 g.beginPath();g.moveTo(-19,-96);g.lineTo(20,-97);g.lineTo(32+flap,-35);g.lineTo(-38+flap,-37);g.closePath();g.fill();g.stroke();
 g.fillStyle='#174960';g.fillRect(-17,-97,34,61);
 g.strokeStyle='#65f4e7';g.lineWidth=4;g.beginPath();g.moveTo(-10,-88);g.lineTo(7,-71);g.lineTo(-5,-56);g.lineTo(-12,-71);g.stroke();
 g.strokeStyle='#296280';g.lineWidth=10;g.beginPath();g.moveTo(-21,-86);g.lineTo(-29,-58+swing*.24);g.moveTo(21,-86);g.lineTo(29,-58-swing*.24);g.stroke();
 g.fillStyle='#bd9294';g.beginPath();g.arc(0,-119-bob,19,0,TAU);g.fill();
 g.fillStyle='#122338';g.beginPath();g.arc(0,-127-bob,20,Math.PI,2*Math.PI);g.fill();
 g.fillStyle='#223b69';g.beginPath();g.moveTo(-19,-129-bob);g.lineTo(-9,-151-bob);g.lineTo(10,-151-bob);g.lineTo(21,-129-bob);g.closePath();g.fill();
 g.fillStyle='#80f6ff';g.fillRect(5,-120-bob,10,3);
 g.strokeStyle='#80ffed';g.lineWidth=2;g.beginPath();g.moveTo(18,-140-bob);g.lineTo(29,-161-bob);g.stroke();
 g.fillStyle='#b6fff1';g.beginPath();g.arc(29,-164-bob,5,0,TAU);g.fill();g.restore()
}
function actor(a,t){
 if(a.dead)return;
 const king=a.kind==='rei',guard=a.kind==='guardiao',mage=a.kind==='mago';
 const scale=king?1.42:guard?1.18:a.kind==='batedor'?.75:1;
 g.save();g.translate(a.x,a.y);g.scale(scale,scale);
 const step=Math.sin((a.t||t)*9)*7;
 g.fillStyle='#081a3880';g.beginPath();g.ellipse(0,4,26,8,0,0,TAU);g.fill();
 g.strokeStyle=mage?'#7fffc2':king?'#ffb280':guard?'#f2c08b':'#94bed7';g.lineWidth=9;
 g.beginPath();g.moveTo(-9,-34);g.lineTo(-12+step,-3);g.moveTo(10,-34);g.lineTo(14-step,-3);g.stroke();
 g.fillStyle=mage?'#257d8a':king?'#6b3954':guard?'#71527c':'#2e5a6c';
 g.beginPath();g.moveTo(-22,-100);g.lineTo(23,-100);g.lineTo(26,-36);g.lineTo(-25,-36);g.closePath();g.fill();
 g.strokeStyle=mage?'#8dffe2':'#bb8adb';g.lineWidth=3;g.stroke();
 g.fillStyle='#b59a9f';g.beginPath();g.arc(0,-117,18,0,TAU);g.fill();
 g.fillStyle=king?'#ffd78c':mage?'#a7ffdb':'#85c4e9';
 if(king){g.beginPath();g.moveTo(-22,-134);g.lineTo(-17,-154);g.lineTo(-3,-141);g.lineTo(0,-161);g.lineTo(13,-140);g.lineTo(21,-153);g.lineTo(21,-134);g.closePath();g.fill()}
 else if(guard){g.fillRect(-19,-143,39,8);g.fillRect(-10,-153,20,11)}
 else if(mage){g.beginPath();g.moveTo(-22,-132);g.lineTo(0,-163);g.lineTo(22,-132);g.closePath();g.fill()}
 else{g.fillRect(-20,-138,41,10)}
 g.strokeStyle=mage?'#8dffdb':'#ba899a';g.lineWidth=10;
 g.beginPath();g.moveTo(-22,-90);g.lineTo(-32,-58+step*.25);g.moveTo(22,-90);g.lineTo(34,-58-step*.25);g.stroke();
 if(mage){g.fillStyle='#b1ffe9';g.beginPath();g.arc(36,-67,10,0,TAU);g.fill()}
 g.restore()
}
function render(t){
 g.clearRect(0,0,W,H);
 const storm=S.phase==='mission'?M.data.stormPercent:S.frozen?.stormPercent;
 for(let i=0;i<45;i++){
  const x=(i*233+37+Math.sin(t*.6+i)*18)%W,y=(i*113+Math.sin(t+i)*12)%590+20;
  g.fillStyle=i%3===0?'#a6fff9aa':i%3===1?'#baa0ff99':'#7bcfff77';g.fillRect(x,y,i%5?2:4,i%5?2:4)
 }
 if(Number.isFinite(storm)&&storm>.02){
  g.globalAlpha=clamp(storm*4,0,.5);
  for(let i=0;i<17;i++){
   const x=(t*66+i*87)%1200-50,y=(i*71+t*33)%600;
   g.strokeStyle=i%2?'#bb9dff':'#89e7ff';g.lineWidth=1.8;
   g.beginPath();g.moveTo(x,y);g.lineTo(x+36,y-15);g.stroke()
  }
  g.globalAlpha=1
 }
 [[264,258,'#83ffbd'],[835,255,'#ffcb83'],[330,397,'#74e8ff'],[836,409,'#d8a3ff']].forEach(([x,y,col],i)=>{
  g.globalAlpha=.14+.1*Math.sin(t*2+i)**2;g.beginPath();g.arc(x,y,44+Math.sin(t*3+i)*8,0,TAU);
  g.strokeStyle=col;g.lineWidth=2;g.stroke();g.globalAlpha=1
 });
 if(S.phase==='mission'){
  S.friends.forEach(a=>actor(a,t));S.foes.forEach(a=>actor(a,t));
  for(const r of S.rays){
   g.strokeStyle='#aafff5';g.lineWidth=5;g.shadowColor='#80fff5';g.shadowBlur=17;
   g.beginPath();g.moveTo(r.x,r.y);g.lineTo(r.X,r.Y);g.stroke();g.shadowBlur=0
  }
 }
 hero(t);
 if(S.phase==='mission'&&S.order&&!S.stale&&M.fresh()){
  const mid=(M.data.ask+M.data.bid)/2,mov=(mid/S.order.startMid-1)*S.order.side;
  if(Math.abs(mov)>.0001){
   g.globalAlpha=clamp(Math.abs(mov)*260,.04,.22);
   g.fillStyle=mov>0?'#37ffad':'#ff517e';g.fillRect(0,0,W,H);g.globalAlpha=1
  }
 }
 for(const p of S.fx){g.fillStyle=p.col;g.globalAlpha=clamp(p.t/p.max,0,1);g.fillRect(p.x,p.y,p.r*2,p.r*2)}
 g.globalAlpha=1
}
function updateFX(dt){
 for(const p of S.fx){p.t-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96}
 S.fx=S.fx.filter(p=>p.t>0);
 for(const r of S.rays)r.t-=dt;S.rays=S.rays.filter(r=>r.t>0);
 if(S.bubble>0){S.bubble-=dt;if(S.bubble<=0)E('storyBubble').classList.add('hidden')}
}
function dialog(title,html){E('dialogTitle').textContent=title;E('dialogBody').innerHTML=html;E('dialogBack').classList.remove('hidden')}
function closeDialog(){E('dialogBack').classList.add('hidden')}
function rules(){
 const d=M.data,ok=M.fresh(),price=ok?num((d.bid+d.ask)/2):'sem cotação';
 const spread=ok?((d.ask-d.bid)/((d.ask+d.bid)/2)*100).toFixed(5)+'%':'sem leitura';
 dialog('O SEGREDO POR TRÁS DA MAGIA',
  '<h3>As pistas vêm de negociações reais</h3><p>O jogo recebe somente dados públicos BTC/USDT da Binance. Os quatro enigmas congelam a leitura no início. Os símbolos são observações, não promessas do que ocorrerá depois.</p>'+
  '<table><tr><th>SÍMBOLO</th><th>FATO OBSERVADO</th></tr>'+
  '<tr><td>Pressão Solar / Sombra</td><td>Distribuição de valor das agressões compradoras e vendedoras nos aggTrades recentes.</td></tr>'+
  '<tr><td>Tempestade</td><td>Amplitude dos preços recentes; o limiar é 0,065%.</td></tr>'+
  '<tr><td>Passagem estreita</td><td>Diferença percentual do melhor bid e ask; o limiar é 0,006%.</td></tr>'+
  '<tr><td>Energia aliada</td><td>A direção recente do preço concorda com a pressão dos negócios.</td></tr>'+
  '<tr><td>Trilha Aurora</td><td>Jornada hipotética de direção positiva: entra no ask, sai no bid.</td></tr>'+
  '<tr><td>Templo Eclipse</td><td>Jornada hipotética de direção negativa: entra no bid, sai no ask.</td></tr>'+
  '<tr><td>Caverna Eco / Ponte Vórtice</td><td>Exploração sem exposição fictícia; Vórtice também permite recuar e encerrar a jornada atual.</td></tr>'+
  '<tr><td>Reis, soldados e magos</td><td>Força oposta, oscilações e tamanho dos negócios alteram a dificuldade narrativa; isso não prevê o futuro.</td></tr></table>'+
  '<h3>O tesouro fictício</h3><p>Começa com 10.000 créditos. Cada juramento compromete 10% em simulação, até 1.000 créditos, sem alavancagem. Descontamos 0,05% por lado de taxa ilustrativa, 0,02% por lado de slippage fictício e o spread. Os cristais dos enigmas e combates não mudam a apuração de preço.</p>'+
  '<div class="note">BTC/USDT: '+price+' · Spread atual: '+spread+' · Fonte: '+d.source+'. Se a cotação ficar antiga, o relógio para e o jogo não inventa um resultado.</div>'+
  '<p><strong>Jogo educativo:</strong> sem dinheiro real, saques, depósitos, prêmios, chaves privadas, conta Binance ou envio de ordens.</p>')
}
function diary(){
 let trs='';
 for(const h of db.history){
  const r=ROUTES[h.route]?.name||'—',p=h.net==null?'NÃO APURADO':(h.net>=0?'+':'')+num(h.net);
  const cls=h.net==null?'':h.net>=0?'good':'bad';
  trs+='<tr><td>'+new Date(h.time).toLocaleString('pt-BR')+'</td><td>'+r+'</td><td class="'+cls+'">'+p+'</td><td>'+(h.runes||0)+'</td></tr>'
 }
 dialog('DIÁRIO DAS JORNADAS','<p>Registros salvos somente neste navegador. Uma jornada interrompida não recebe resultado financeiro fictício.</p>'+
  '<table><tr><th>DATA</th><th>TRILHA</th><th>TESOURO</th><th>CRISTAIS</th></tr>'+(trs||'<tr><td colspan="4">Sem jornadas ainda.</td></tr>')+'</table>'+
  '<p>Tesouro atual: <strong>'+num(db.wallet)+'</strong> créditos fictícios.</p>'+
  '<button class="inline" id="resetLedger">REINICIAR CAMPANHA</button>');
 E('resetLedger').onclick=()=>{
  if(S.phase==='mission'){alert('Conclua ou recue da missão antes de reiniciar.');return}
  if(!confirm('Apagar todo o progresso fictício e o diário deste navegador?'))return;
  db={version:1,wallet:10000,crystals:0,journeys:0,history:[],open:null};
  save();wallet();closeDialog();say('O primeiro livro do reino foi aberto novamente.',true)
 }
}
E('beginBtn').onclick=begin;E('quizStart').onclick=begin;
E('observeBtn').onclick=()=>{S.phase='observing';E('sceneCover').classList.add('hidden');flowUI();say('Agora você pode observar os portais e as pistas ao vivo.',true)};
E('nextQuestion').onclick=nextQuestion;
document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>choose(b.dataset.route));
E('wardBtn').onclick=ward;E('retreatBtn').onclick=retreat;
E('diaryBtn').onclick=diary;E('rulesBtn').onclick=rules;E('learnBtn').onclick=rules;E('newQuestBtn').onclick=restart;
E('dialogClose').onclick=closeDialog;E('dialogBack').onclick=e=>{if(e.target===E('dialogBack'))closeDialog()};
E('soundBtn').onclick=()=>{soundOn=!soundOn;E('soundBtn').textContent=soundOn?'♫':'♪';if(soundOn)beep(600,.1)};
C.addEventListener('pointerdown',e=>{
 if(S.phase!=='mission')return;const r=C.getBoundingClientRect();
 spell((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H,false)
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape')closeDialog();
 if(S.phase==='quiz'&&!S.answered){
  const n=Number(e.key);if(n>=1&&n<=QS[S.index].opts.length)answer(QS[S.index].opts[n-1][0])
 }else if(S.phase==='routes'){
  const n=Number(e.key);if(n>=1&&n<=4)choose(['aurora','eclipse','echo','vortex'][n-1])
 }else if(S.phase==='mission'){
  if(e.code==='Space'&&!e.repeat){e.preventDefault();spell(S.hero.x+60,S.hero.y,true)}
  if(e.key.toLowerCase()==='e'&&!e.repeat)ward();
  if(e.key.toLowerCase()==='r'&&!e.repeat)retreat()
 }
});
let last=0,refresh=0;
function frame(now){
 requestAnimationFrame(frame);const dt=last?Math.min(.05,(now-last)/1000):.016;last=now;
 S.t+=dt;updateFX(dt);if(S.phase==='mission')updateMission(dt);
 render(S.t);
 refresh+=dt;if(refresh>.8){refresh=0;status()}
}
M.init();wallet();flowUI();status();requestAnimationFrame(frame);
window.NEON_ENIGMA_TEST={
 version:'1.0',status:()=>({phase:S.phase,live:M.fresh(),reading:!!M.snapshot(),index:S.index,
 answers:S.answers.length,route:S.route,missionTime:S.time,hero:{x:S.hero.x,y:S.hero.y},
 enemies:S.foes.length,treasure:db.wallet,crystals:db.crystals,journeys:db.journeys}),
 begin,answer,choose,spell,ward,retreat,questions:()=>QS.map(q=>q.title)
};
})();