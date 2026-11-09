/* NEON RIFT — public BTC/USDT telemetria. Read-only; no API key, no orders. */
(()=>{'use strict';
const D={bid:NaN,ask:NaN,quoteAt:0,source:'SEM SINAL',ws:null,connected:false,
 trades:[],seen:new Set(),samples:[],lastTradeAt:0,lastUpdate:0,attempt:0,polling:false,retryTimer:null,
 pressure:.5,tradeNotional:0,stormPercent:NaN,spreadPercent:NaN,momentumPercent:NaN,
 alignment:'nevoa',flow:'SEM LEITURA',lastEvent:0,largestTrade:0};
const NOW=()=>Date.now(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fresh=()=>Number.isFinite(D.bid)&&Number.isFinite(D.ask)&&D.bid>0&&D.ask>=D.bid&&(NOW()-D.quoteAt)<10000;
function quote(bid,ask,source){
 bid=Number(bid);ask=Number(ask);
 if(!(bid>0)||!(ask>=bid)||!Number.isFinite(bid)||!Number.isFinite(ask))return false;
 D.bid=bid;D.ask=ask;D.quoteAt=NOW();D.source=source;
 const mid=(bid+ask)/2;
 if(NOW()-(D.samples.at(-1)?.time||0)>850){
  D.samples.push({time:NOW(),price:mid});
  if(D.samples.length>190)D.samples.splice(0,D.samples.length-190)
 }
 return true
}
function trade(t){
 const id=Number(t.a),price=Number(t.p),qty=Number(t.q),time=Number(t.T||t.E||NOW());
 if(!Number.isFinite(price)||!(price>0)||!(qty>0)||Math.abs(time-NOW())>90000)return false;
 if(Number.isFinite(id)&&D.seen.has(id))return false;
 const notional=Math.min(price*qty,1e8);
 if(Number.isFinite(id))D.seen.add(id);
 D.trades.push({id,time,price,notional,sun:t.m===false});
 if(D.trades.length>2200){
  const out=D.trades.splice(0,D.trades.length-1600);for(const a of out)D.seen.delete(a.id)
 }
 D.lastTradeAt=NOW();return true
}
function ingest(raw){
 const msg=raw?.data||raw;if(!msg||typeof msg!=='object')return;
 if(msg.e==='aggTrade')trade(msg);
 else if(msg.s==='BTCUSDT'&&msg.b&&msg.a)quote(msg.b,msg.a,'WEB SOCKET')
}
function recalc(){
 const now=NOW(),cut=now-45000;
 while(D.trades.length&&D.trades[0].time<cut){const t=D.trades.shift();D.seen.delete(t.id)}
 let solar=0,shadow=0,maxTrade=0;
 for(const a of D.trades){
  if(a.sun)solar+=a.notional;else shadow+=a.notional;
  maxTrade=Math.max(maxTrade,a.notional)
 }
 D.tradeNotional=solar+shadow;D.largestTrade=maxTrade;
 D.pressure=solar+shadow>0?solar/(solar+shadow):.5;
 if(fresh())D.spreadPercent=(D.ask-D.bid)/((D.bid+D.ask)/2)*100;
 else D.spreadPercent=NaN;
 const quotes=D.samples.filter(x=>x.time>=now-65000);
 const trades=D.trades.filter(x=>x.time>=now-65000);
 const series=quotes.length>=6?quotes.map(x=>x.price):trades.map(x=>x.price);
 if(series.length>=5){
  const lo=Math.min(...series),hi=Math.max(...series),first=series[0],last=series[series.length-1];
  D.stormPercent=(hi-lo)/first*100;
  D.momentumPercent=(last-first)/first*100
 }else{D.stormPercent=NaN;D.momentumPercent=NaN}
 const meaningful=Math.abs(D.momentumPercent)>0.007&&D.tradeNotional>0;
 const side=D.pressure>.56?1:D.pressure<.44?-1:0;
 const momentum=meaningful?Math.sign(D.momentumPercent):0;
 D.alignment=side===0||momentum===0?'nevoa':side===momentum?'aliada':'conflito';
 D.flow=!fresh()?'SEM LEITURA':D.tradeNotional===0?'SEM NEGÓCIOS':D.pressure>.56?'LUMINOSO':D.pressure<.44?'SOMBRIO':'EQUILIBRADO';
 D.lastUpdate=now;
}
function snapshot(){
 recalc();
 if(!fresh()||D.trades.length<5||NOW()-D.lastTradeAt>30000)return null;
 const dominant=D.pressure>.56?'aurora':D.pressure<.44?'eclipse':'equilibrio';
 return Object.freeze({
  capturedAt:NOW(),bid:D.bid,ask:D.ask,mid:(D.bid+D.ask)/2,
  sunRatio:D.pressure,tradeNotional:D.tradeNotional,largestTrade:D.largestTrade,
  stormPercent:D.stormPercent,spreadPercent:D.spreadPercent,momentumPercent:D.momentumPercent,
  dominant,storm:Number.isFinite(D.stormPercent)&&D.stormPercent>=.065?'tempestade':'brisa',
  passage:D.spreadPercent<=.006?'estreita':'traiçoeira',
  alignment:D.alignment,flow:D.flow,source:D.source,trades:D.trades.length
 })
}
function enter(side,notional){
 if(!fresh()||![1,-1].includes(side)||!Number.isFinite(notional)||notional<=0)return null;
 const mid=(D.bid+D.ask)/2,raw=side===1?D.ask:D.bid;
 const execution=raw*(1+side*.0002);
 return {side,notional,raw,execution,qty:notional/execution,feeIn:notional*.0005,
   startAt:NOW(),startMid:mid,source:D.source}
}
function close(order){
 if(!fresh()||!order||![1,-1].includes(order.side))return null;
 const raw=order.side===1?D.bid:D.ask,execution=raw*(1-order.side*.0002);
 const gross=order.qty*(execution-order.execution)*order.side;
 const feeOut=order.qty*execution*.0005;
 const net=gross-order.feeIn-feeOut;
 return {raw,execution,gross,fees:order.feeIn+feeOut,net,
  mid:(D.bid+D.ask)/2,
  movementPct:(((D.bid+D.ask)/2)/order.startMid-1)*100,
  durationSec:(NOW()-order.startAt)/1000}
}
async function rest(){
 if(D.polling)return;D.polling=true;
 try{
  const book=await fetch('https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=BTCUSDT',
    {cache:'no-store',signal:AbortSignal.timeout(9000)});
  if(book.ok){const b=await book.json();if(!fresh()||D.source!=='WEB SOCKET'||NOW()-D.quoteAt>2600)quote(b.bidPrice,b.askPrice,'REST')}
  if(NOW()-D.lastTradeAt>15000){
   const res=await fetch('https://data-api.binance.vision/api/v3/aggTrades?symbol=BTCUSDT&limit=260',
    {cache:'no-store',signal:AbortSignal.timeout(9000)});
   if(res.ok){const list=await res.json();if(Array.isArray(list))for(const t of list)trade(t)}
  }
 }catch(e){}finally{D.polling=false;recalc()}
}
function retry(){
 if(D.retryTimer)return;
 const delay=Math.min(30000,1100*2**Math.min(5,D.attempt++));
 D.retryTimer=setTimeout(()=>{D.retryTimer=null;connect()},delay)
}
function connect(){
 if(D.ws&&D.ws.readyState<=1)return;
 try{
  const ws=new WebSocket('wss://data-stream.binance.vision/stream?streams=btcusdt@bookTicker/btcusdt@aggTrade');
  D.ws=ws;ws.onopen=()=>{D.connected=true;D.attempt=0};
  ws.onmessage=e=>{try{ingest(JSON.parse(e.data))}catch(err){}};
  ws.onerror=()=>{D.connected=false};
  ws.onclose=()=>{D.connected=false;if(D.ws===ws)D.ws=null;retry()}
 }catch(e){retry()}
}
function init(){connect();rest();setInterval(recalc,800);setInterval(()=>{if(!fresh()||D.source==='REST')rest()},7000)}
window.RIFT_MARKET={data:D,fresh,snapshot,enter,close,recalc,init,ingest,quote,trade,rest};
})();