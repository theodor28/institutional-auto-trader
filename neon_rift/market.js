/* NEON RIFT — Binance public spot telemetry. No keys, no private endpoints. */
(function(){
"use strict";
const m={bid:NaN,ask:NaN,last:NaN,quoteAt:0,lastAt:0,source:"OFF",socket:null,trades:[],samples:[],pressure:.5,storm:0,intensity:1,flow:"SEM LEITURA",lastTradeAt:0,connected:false,retries:0,timer:null,polling:false};
const now=()=>Date.now(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function fresh(){return Number.isFinite(m.bid)&&Number.isFinite(m.ask)&&m.bid>0&&m.ask>=m.bid&&now()-m.quoteAt<10000}
function quote(bid,ask,source){
 bid=Number(bid);ask=Number(ask);
 if(!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<bid)return;
 m.bid=bid;m.ask=ask;m.quoteAt=now();m.source=source;
 if(now()-(m.samples.at(-1)?.time||0)>800){m.samples.push({time:now(),price:(bid+ask)/2});if(m.samples.length>120)m.samples.shift()}
}
function trade(d){
 const p=Number(d.p),q=Number(d.q),time=Number(d.T||d.E||now());
 if(!(p>0)||!(q>0)||Math.abs(time-now())>45000)return;
 if(d.a!=null&&m.trades.some(x=>x.id===d.a))return;
 m.trades.push({id:d.a,time,buy:d.m===false,value:Math.min(2e7,p*q)});
 if(m.trades.length>1400)m.trades.splice(0,m.trades.length-1400);
 m.last=p;m.lastAt=now();m.lastTradeAt=now()
}
function ingest(raw){
 const d=raw?.data||raw;
 if(!d||typeof d!=="object")return;
 if(d.e==="aggTrade")trade(d);
 else if(d.s==="BTCUSDT"&&d.b&&d.a)quote(d.b,d.a,"WEBSOCKET");
 else if(d.e==="24hrMiniTicker"){let p=Number(d.c);if(p>0){m.last=p;m.lastAt=now()}}
}
function update(){
 const cutoff=now()-24000;
 while(m.trades.length&&m.trades[0].time<cutoff)m.trades.shift();
 let buys=0,sells=0;
 for(const t of m.trades){if(t.buy)buys+=t.value;else sells+=t.value}
 m.pressure=(buys+sells)>0?buys/(buys+sells):.5;
 const s=m.samples.filter(x=>x.time>cutoff);
 let sum=0;
 for(let i=1;i<s.length;i++)sum+=Math.abs(s[i].price/s[i-1].price-1)*10000;
 const vol=s.length>1?sum/(s.length-1):0;
 m.storm=clamp(vol*1.15+Math.min(2,(buys+sells)/3500000),0,5);
 m.intensity=clamp(1+(buys+sells)/2000000,1,2.4);
 m.flow=!fresh()?"SEM DADO ATUAL":buys+sells<=0?"SEM NEGOCIAÇÕES":m.pressure>.58?"IMPULSO SOLAR":m.pressure<.42?"MARÉ SOMBRIA":"FORÇAS DIVIDIDAS"
}
async function rest(){
 if(m.polling)return;
 m.polling=true;
 try{
  const req=await fetch("https://data-api.binance.vision/api/v3/ticker/bookTicker?symbol=BTCUSDT",{cache:"no-store",signal:AbortSignal.timeout(7000)});
  if(!req.ok)throw Error("REST "+req.status);
  const j=await req.json();
  if(!fresh()||m.source!=="WEBSOCKET"||now()-m.quoteAt>2500)quote(j.bidPrice,j.askPrice,"REST");
  if(now()-m.lastTradeAt>17000){
   const trades=await fetch("https://data-api.binance.vision/api/v3/aggTrades?symbol=BTCUSDT&limit=90",{cache:"no-store",signal:AbortSignal.timeout(7000)});
   if(trades.ok){const arr=await trades.json();if(Array.isArray(arr))arr.forEach(trade)}
  }
 }catch(e){}finally{m.polling=false}
}
function reconnect(){
 if(m.timer)return;
 const ms=Math.min(30000,1600*Math.pow(2,Math.min(5,m.retries++)));
 m.timer=setTimeout(()=>{m.timer=null;connect()},ms)
}
function connect(){
 if(m.socket&&m.socket.readyState<=1)return;
 try{
  const ws=new WebSocket("wss://data-stream.binance.vision/stream?streams=btcusdt@aggTrade/btcusdt@bookTicker/btcusdt@miniTicker");
  m.socket=ws;
  ws.onopen=()=>{m.connected=true;m.retries=0};
  ws.onmessage=e=>{try{ingest(JSON.parse(e.data))}catch(err){}};
  ws.onerror=()=>{m.connected=false};
  ws.onclose=()=>{m.connected=false;if(m.socket===ws)m.socket=null;reconnect()}
 }catch(e){reconnect()}
}
function snapshot(side,notional=1000){
 if(!fresh())return null;
 const entryRaw=side===1?m.ask:m.bid,entry=entryRaw*(1+side*.0002);
 return {side,startedAt:now(),entry,entryRaw,notional,qty:notional/entry}
}
function settlement(order){
 if(!order||!fresh())return null;
 const raw=order.side===1?m.bid:m.ask,exit=raw*(1-order.side*.0002);
 const gross=order.qty*(exit-order.entry)*order.side;
 const fees=.0005*(order.notional+exit*order.qty);
 return {exit,gross,fees,net:gross-fees,changePct:100*((m.bid+m.ask)/2/order.entryRaw-1)}
}
function start(){connect();rest();setInterval(update,850);setInterval(()=>{if(!fresh()||m.source==="REST")rest()},9000)}
window.NRMarket={data:m,fresh,update,rest,start,snapshot,settlement,ingest,quote,trade};
})();