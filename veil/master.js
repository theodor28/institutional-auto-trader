/* VEIL — ORÁCULO MESTRE V (Autonomous arcade player)
 * Browser only. All decision-making is local and rules-based.
 * Never calls any Binance order API. Uses the existing game engine's actions.
 * A "master" is highly skilled at this game's known clues and controls,
 * NOT omniscient about future BTC price movements.
 */
(()=>{
'use strict';
const KEY='veil-autopilot-master-v1';
const E=id=>document.getElementById(id);
const engine=window.VEIL_ENGINE,market=window.RIFT_MARKET;
if(!engine||!market)return;
const format=n=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let persisted={enabled:true,decisions:[],totalQuestions:0};
try{
 const parsed=JSON.parse(localStorage.getItem(KEY)||'null');
 if(parsed&&typeof parsed==='object'){
  persisted.enabled=parsed.enabled!==false;
  persisted.decisions=Array.isArray(parsed.decisions)?parsed.decisions.slice(-45):[];
  persisted.totalQuestions=Number.isFinite(parsed.totalQuestions)?parsed.totalQuestions:0;
 }
}catch(e){}
const ai={enabled:persisted.enabled,decisions:persisted.decisions,totalQuestions:persisted.totalQuestions,
  currentPhase:null,phaseSince:Date.now(),lastQ:-1,qSince:Date.now(),answerAt:0,lastAction:0,
  lastEnemyAction:0,lastLog:0,lastResultKey:null,sessionRounds:0,currentPlan:null,
  peakNet:-Infinity,lastMessage:'Aguardando negociações verdadeiras...',startAfter:0};
const init=engine.state();
ai.lastResultKey=init.latest?init.latest.time+'|'+init.adventures:null;
function store(){
 try{localStorage.setItem(KEY,JSON.stringify({
  enabled:ai.enabled,decisions:ai.decisions.slice(-45),totalQuestions:ai.totalQuestions
 }))}catch(e){}
}
function log(kind,note,extra={}){
 ai.decisions.push({at:Date.now(),kind,note,...extra});
 if(ai.decisions.length>45)ai.decisions.splice(0,ai.decisions.length-45);
 store()
}
function display(title,message){
 if(title)E('masterTitle').textContent=title;
 if(message&&message!==ai.lastMessage){ai.lastMessage=message;E('masterReason').textContent=message}
 E('masterLamp').classList.toggle('off',!ai.enabled);
 E('masterToggle').classList.toggle('off',!ai.enabled);
 E('masterToggle').setAttribute('aria-pressed',String(ai.enabled));
 E('masterToggle').textContent=ai.enabled?'Ⅱ PAUSAR IA':'▶ ATIVAR IA';
}
function activeMessage(msg){display('MODO MESTRE · AUTÔNOMO',msg)}
function disable(){
 ai.enabled=false;store();display('MODO MESTRE · PAUSADO','O jogador assume os comandos.')
}
function enable(){
 ai.enabled=true;ai.phaseSince=Date.now();ai.qSince=Date.now();ai.lastAction=0;
 store();activeMessage('Controle automático retomado.')
}
function toggle(){if(ai.enabled)disable();else enable()}

/* Select direction only on actual evidence.
   The score is a heuristic of CONVICTION, not a win probability.
   Recent realized simulated losses tighten thresholds, not predictive weights.
*/
function selectRoad(reading,history=[]){
 if(!reading)return {route:'watch',confidence:0,reason:'Nenhuma leitura verificável: mirante seguro.'};
 const p=Number(reading.sunRatio),mom=Number(reading.momentumPercent);
 const storm=Number(reading.stormPercent),spread=Number(reading.spreadPercent);
 const flows=Number(reading.tradeNotional);
 if(![p,mom,storm,spread,flows].every(Number.isFinite)||flows<=0)
  return {route:'watch',confidence:0,reason:'Leitura incompleta: observando no mirante.'};
 const recent=history.filter(x=>x.net!=null&&Number.isFinite(x.net)&&x.road!=='watch').slice(0,8);
 const losses=recent.filter(x=>x.net<0).length;
 const tight=recent.length>=4&&losses>=3?1:0;
 const pressureEdge=Math.abs(p-.5);
 const expectedSide=p>.5?1:-1;
 const aligned=reading.alignment==='aliada'&&Math.sign(mom)===expectedSide;
 const evidenceCount=Number(reading.trades)||0;
 const quality=Math.round(clamp((pressureEdge-.07)*230+Math.abs(mom)*950+
   Math.min(25,Math.log10(Math.max(1,flows))*3)-spread*210,0,100));
 const minimumPressure=.085+tight*.035;
 const minimumMomentum=.007+tight*.004;
 const lowSpread=spread<=.008;
 const boundedStorm=storm<=.20;
 const sufficient=evidenceCount>=15;
 if(aligned&&pressureEdge>=minimumPressure&&Math.abs(mom)>=minimumMomentum&&
    boundedStorm&&lowSpread&&sufficient){
  const choice=expectedSide===1?'light':'shadow';
  const reason=(choice==='light'?'Luz':'Sombra')+
   ': força '+(p*100).toFixed(0)+'%, movimento coerente e passagem estreita.';
  return {route:choice,confidence:quality,reason,
    details:{pressureEdge,momentumPercent:mom,stormPercent:storm,spreadPercent:spread,aligned}}
 }
 const why=!sufficient?'amostra pequena':!aligned?'ventos contraditórios':!boundedStorm?
   'tempestade intensa':!lowSpread?'passagem cara':'força insuficiente';
 return {route:'watch',confidence:quality,reason:'Mirante: '+why+'; nenhum voto financeiro.',
  details:{pressureEdge,momentumPercent:mom,stormPercent:storm,spreadPercent:spread,aligned}}
}
/* Exit is a deterministic tactical decision on LIVE hypothetical unrealized PnL
   and survivability. Estimates do not reveal future prices. */
function exitAdvice(view,peakNet){
 if(view.phase!=='journey')return null;
 if(view.hero.shield<=17&&view.hero.wards===0)
  return {reason:'Escudo crítico: recuo de sobrevivência.'};
 if(view.road==='watch')return null;
 if(!Number.isFinite(view.unrealized))return null;
 const net=view.unrealized;
 if(view.elapsed>=10&&net>=2.5)
  return {reason:'Tesouro simulado protegido após ganho favorável.'};
 if(view.elapsed>=10&&net<=-4.5)
  return {reason:'Limite de risco fictício atingido; recuo.'};
 if(view.elapsed>=13&&peakNet>=2.0&&net<=peakNet-2.15)
  return {reason:'O ganho fictício recuou; preservando o que resta.'};
 const pressure=view.currentMarket?.pressure;
 const against=view.road==='light'?pressure<.39:pressure>.61;
 if(view.elapsed>=19&&against&&net<-1.9)
  return {reason:'A oposição domina; o caminho deixou de compensar.'};
 if(view.elapsed>=24&&view.hero.shield<=45&&view.hero.wards===0&&net<0)
  return {reason:'A proteção falhou e a trilha está adversa.'};
 return null
}
function trackNewResult(v){
 if(!v.latest||v.phase!=='end')return;
 const key=v.latest.time+'|'+v.adventures;
 if(key===ai.lastResultKey)return;
 ai.lastResultKey=key;ai.sessionRounds++;
 const net=v.latest.net;
 const content=net==null?'Tesouro intacto':(net>=0?'+':'−')+format(Math.abs(net))+' fictícios';
 log('desfecho',content,{net,road:v.latest.road});
 ai.startAfter=Date.now()+4200;
 ai.peakNet=-Infinity;ai.currentPlan=null;
 activeMessage('Capítulo concluído: '+content+'. Novo enigma em instantes.')
}
function findThreat(v){
 const alive=v.enemies.filter(e=>!e.dead);
 if(!alive.length)return null;
 const hero=v.hero;
 alive.sort((a,b)=>{
  const distA=Math.hypot(a.x-hero.x,a.y-hero.y);
  const distB=Math.hypot(b.x-hero.x,b.y-hero.y);
  const weight=x=>x.kind==='king'?75:x.kind==='guardian'?35:0;
  return distA-weight(a)-(distB-weight(b))
 });
 return alive[0]
}
function tick(){
 const now=Date.now(),v=engine.state();
 if(v.phase!==ai.currentPhase){
  ai.currentPhase=v.phase;ai.phaseSince=now;ai.lastQ=-1;
  if(v.phase==='journey'){ai.peakNet=-Infinity;ai.lastEnemyAction=0}
  if(v.phase==='end')trackNewResult(v)
 }
 if(!ai.enabled){return}
 if(document.hidden){activeMessage('Tela inativa: controle automático temporariamente suspenso.');return}
 if(v.modal){activeMessage('Diário aberto: aguardando fechar.');return}
 if(!v.quoteFresh){
  activeMessage('Aguardando cotação atual da Binance; nada será simulado.');
  return
 }
 // Four questions are solved against the START-OF-QUIZ FROZEN real reading.
 if(v.phase==='cover'){
  if(v.availableReading&&now-ai.phaseSince>=800){
   activeMessage('Iniciando a análise dos quatro segredos.');
   engine.actions.start();ai.lastAction=now
  }else activeMessage('Reunindo negociações para o primeiro enigma.');
  return
 }
 if(v.phase==='observe'){
  activeMessage('Contemplação: aguardando fim da abertura.');
  return
 }
 if(v.phase==='quiz'){
  if(v.quizIndex!==ai.lastQ){ai.lastQ=v.quizIndex;ai.qSince=now;ai.answerAt=0}
  if(!v.quizAnswered&&v.questionTruth!=null&&now-ai.qSince>=650){
   engine.actions.answer(v.questionTruth);ai.totalQuestions++;ai.answerAt=now;
   activeMessage('Segredo '+(v.quizIndex+1)+'/4 decifrado pelos dados registrados.');
   log('enigma','Segredo '+(v.quizIndex+1)+' resolvido com a leitura congelada.');
  }else if(v.quizAnswered&&now-ai.answerAt>=800){
   engine.actions.next();ai.lastAction=now
  }
  return
 }
 if(v.phase==='roads'){
  if(!v.availableReading){activeMessage('As trilhas esperam uma leitura recente.');return}
  if(now-ai.phaseSince<1400)return;
  const decision=selectRoad(v.availableReading,v.history);
  const route=decision.route;
  ai.currentPlan={...decision,marketAt:Date.now()};
  activeMessage(decision.reason);
  log('estratégia',decision.reason,{road:route,confidence:decision.confidence});
  engine.actions.choose(route);ai.lastAction=now;
  return
 }
 if(v.phase==='journey'){
  if(v.stale){activeMessage('Névoa: jornada congelada até uma cotação recente.');return}
  if(Number.isFinite(v.unrealized))ai.peakNet=Math.max(ai.peakNet,v.unrealized);
  const exit=exitAdvice(v,ai.peakNet);
  if(exit&&now-ai.lastAction>1200){
   activeMessage(exit.reason);
   log('recuo',exit.reason,{road:v.road,net:v.unrealized});
   ai.lastAction=now;engine.actions.retreat();return
  }
  // Protect from likely contact with an enemy; do not squander ward charges at full health.
  const threat=findThreat(v),distance=threat?Math.hypot(threat.x-v.hero.x,threat.y-v.hero.y):Infinity;
  if(v.hero.wards>0&&v.hero.shield<=67&&
     (distance<125||v.hero.shield<=42)&&now-ai.lastAction>450){
   engine.actions.ward();ai.lastAction=now;
   activeMessage('Escudo reforçado: defendendo o viajante.');
  }
  if(threat&&v.hero.attackCd<=0&&now-ai.lastEnemyAction>420){
   engine.actions.spell(threat.x,threat.y,false);ai.lastEnemyAction=now;
   if(threat.kind==='king')activeMessage('Rei identificado: concentrando runas na ameaça.');
   else if(v.hero.shield<60)activeMessage('Destruindo os guardiões mais próximos.');
   else if(now-ai.lastLog>3500){activeMessage('Patrulha detectada: eliminando a ameaça.');ai.lastLog=now}
  }else if(!threat&&now-ai.lastLog>3200){
   activeMessage(v.road==='watch'?'Explorando o Mirante sem arriscar tesouro.':
     'Percorrendo a trilha e protegendo o voto fictício.');ai.lastLog=now
  }
  return
 }
 if(v.phase==='end'){
  trackNewResult(v);
  if(now>=ai.startAfter&&ai.startAfter>0){
   ai.startAfter=0;ai.phaseSince=now;engine.actions.restart();
   activeMessage('Novo capítulo iniciado automaticamente.')
  }else activeMessage('Lendo o desfecho antes do próximo capítulo.');
 }
}
function appendDiary(root){
 if(!root||root.querySelector('#masterDiagnostics'))return;
 const summary=engine.summarize(),head=document.createElement('div');
 head.className='master-statline';head.id='masterDiagnostics';
 const title=document.createElement('strong');title.textContent='◈ MODO MESTRE · RELATÓRIO REAL DE PARTIDAS';
 const desc=document.createElement('p');desc.textContent=
  'Agente determinístico local: resolve os quatro enigmas pela leitura capturada, avalia alinhamento dos sinais, ataca, usa escudo, recua quando necessário e reinicia enquanto esta página estiver aberta. Não prevê o futuro nem aprende novos parâmetros do BTC.';
 const stats=document.createElement('div');stats.className='master-metrics';
 const metrics=[
  'Jornadas desta sessão: '+ai.sessionRounds,
  'Enigmas respondidos: '+ai.totalQuestions,
  'Votos positivos: '+summary.wins,
  'Votos negativos: '+summary.losses,
  'Resultado fictício acumulado: '+(summary.net>=0?'+':'−')+format(Math.abs(summary.net))
 ];
 for(const m of metrics){const span=document.createElement('span');span.textContent=m;stats.append(span)}
 head.append(title,desc,stats);
 const sub=document.createElement('p');sub.textContent='Últimas decisões:';
 head.append(sub);
 for(const d of ai.decisions.slice(-7).reverse()){
  const p=document.createElement('p');p.textContent=new Date(d.at).toLocaleTimeString('pt-BR')+' · '+d.note;
  p.style.margin='4px 0';head.append(p)
 }
 root.append(head)
}
E('masterToggle').onclick=toggle;
display(ai.enabled?'MODO MESTRE · AUTÔNOMO':'MODO MESTRE · PAUSADO',
  ai.enabled?'Interpretando o reino por conta própria.':'Modo manual: use os controles do jogo.');
// Always stop automatic actions when inactive, stale, or a modal is open.
// On reload the agent restarts from the new cover, never settles an old price.
const interval=setInterval(tick,450);
window.VEIL_MASTER={
 enabled:()=>ai.enabled,toggle,start:enable,stop:disable,
 appendDiary,
 decision:selectRoad,exitAdvice,
 stats:()=>({enabled:ai.enabled,sessionRounds:ai.sessionRounds,questions:ai.totalQuestions,
  phase:ai.currentPhase,currentPlan:ai.currentPlan,
  decisions:ai.decisions.slice(-10)}),
 tick
};
})();