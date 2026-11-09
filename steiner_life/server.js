'use strict';
/* STEINER LIFE — multiplayer social world. Original implementation. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {WebSocketServer,WebSocket}=require('ws');
const PORT=Number(process.env.PORT||10000);
const ROOT=path.join(__dirname,'public');
const SAVE=path.join(__dirname,'world.json');
const players=new Map(),buildings=[];
const MAX_WORLD_OBJECTS=160, MAX_PLAYER_OBJECTS=12;
let buildSaveTimer=null;
try{
  const saved=JSON.parse(fs.readFileSync(SAVE,'utf8'));
  if(Array.isArray(saved)) for(const x of saved.slice(0,MAX_WORLD_OBJECTS)){
    if(x&&['house','tree','bench','art','lamp','garden'].includes(x.type)&&Number.isFinite(x.x)&&Number.isFinite(x.z)){
      buildings.push({id:String(x.id||crypto.randomUUID()).slice(0,90),type:x.type,x:Math.max(-185,Math.min(185,x.x)),z:Math.max(-185,Math.min(185,x.z)),rotation:Number.isFinite(x.rotation)?x.rotation:0,creator:String(x.creator||'Explorador').slice(0,24)});
    }
  }
}catch(e){}
function persist(){
  clearTimeout(buildSaveTimer);
  buildSaveTimer=setTimeout(()=>{
    const tmp=SAVE+'.temp';
    try{fs.writeFileSync(tmp,JSON.stringify(buildings));fs.renameSync(tmp,SAVE)}catch(e){console.warn('Persistencia temporaria indisponivel:',e.message)}
  },800);
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  let raw;
  try{raw=new URL(req.url,'http://localhost').pathname}catch(e){res.writeHead(400).end();return}
  if(raw==='/health'){
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({ok:true,app:'STEINER LIFE',online:players.size,objects:buildings.length,mode:'multiplayer'}));return;
  }
  const allowed={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css'};
  if(!allowed[raw]){res.writeHead(404).end('Not found');return}
  let p=path.join(ROOT,allowed[raw]);
  fs.readFile(p,(err,data)=>{
    if(err){res.writeHead(404).end('Not found');return}
    const headers={'content-type':mime[path.extname(p)]||'application/octet-stream',
      'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin',
      'cache-control':'no-cache',
      'content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net wss: ws:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
    res.writeHead(200,headers);res.end(data);
  });
});
const wss=new WebSocketServer({server,path:'/live',maxPayload:3500,perMessageDeflate:false,
  verifyClient(info,cb){
    const origin=info.origin||'';
    const host=info.req.headers.host||'';
    if(!origin){cb(false,403,'Origin required');return}
    try{
      const url=new URL(origin);
      if((url.protocol==='https:'||url.protocol==='http:')&&url.host===host){cb(true);return}
    }catch(e){}
    cb(false,403,'Origin not allowed');
  }
});
function cleanText(v,max){return String(v||'').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,max)}
function validColor(v){return /^#[0-9a-f]{6}$/i.test(v)?v:'#62baff'}
function send(ws,msg){if(ws.readyState===WebSocket.OPEN)try{ws.send(JSON.stringify(msg))}catch(e){}}
function broadcast(msg,except){const data=JSON.stringify(msg);for(const ws of wss.clients)if(ws!==except&&ws.readyState===WebSocket.OPEN)try{ws.send(data)}catch(e){}}
function pub(p){return {id:p.id,name:p.name,color:p.color,hair:p.hair,outfit:p.outfit,x:p.x,y:p.y,z:p.z,heading:p.heading,emote:p.emote}}
function clamp(v,min,max){return Math.min(max,Math.max(min,v))}
wss.on('connection',(ws)=>{
  const state={id:crypto.randomUUID().slice(0,12),name:'',color:'#62baff',hair:0,outfit:0,x:0,y:0,z:5,heading:0,emote:'',joined:false,
    lastChat:0,lastMove:0,lastBuild:0,objects:0,msgBurst:0,burstAt:Date.now(),isAlive:true};
  ws.isAlive=true;
  ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',(input)=>{
    let packet;
    try{packet=JSON.parse(input.toString())}catch(e){return}
    if(!packet||typeof packet!=='object'||Array.isArray(packet))return;
    if(packet.type==='join'){
      if(state.joined)return;
      const name=cleanText(packet.name,20);
      if(name.length<2||name.length>20){send(ws,{type:'error',message:'Escolha um nome de 2 a 20 caracteres.'});return}
      state.name=name;state.color=validColor(packet.color);
      state.hair=clamp(Math.floor(Number(packet.hair)||0),0,5);
      state.outfit=clamp(Math.floor(Number(packet.outfit)||0),0,4);
      state.joined=true;players.set(state.id,state);
      send(ws,{type:'welcome',id:state.id,users:[...players.values()].filter(p=>p.id!==state.id).map(pub),
        objects:buildings,online:players.size,motd:'Bem-vindo ao STEINER LIFE! Este é um mundo social em desenvolvimento.'});
      broadcast({type:'join',player:pub(state),online:players.size},ws);
      return;
    }
    if(!state.joined)return;
    if(packet.type==='move'){
      const t=Date.now();if(t-state.lastMove<65)return;state.lastMove=t;
      const x=Number(packet.x),y=Number(packet.y),z=Number(packet.z),h=Number(packet.heading);
      if(![x,y,z,h].every(Number.isFinite))return;
      const d=Math.hypot(x-state.x,z-state.z);
      if(d>18)return; // ignores sudden teleport, use action portal
      state.x=clamp(x,-195,195);state.z=clamp(z,-195,195);
      state.y=clamp(y,0,7);state.heading=h%(Math.PI*2);
      broadcast({type:'move',id:state.id,x:state.x,y:state.y,z:state.z,heading:state.heading},ws);
    }else if(packet.type==='teleport'){
      const points={plaza:[0,0,6],beach:[-100,0,-80],forest:[87,0,-94],club:[112,0,87],homes:[-91,0,91]};
      if(!Object.hasOwn(points,packet.place))return;
      [state.x,state.y,state.z]=points[packet.place];
      broadcast({type:'move',id:state.id,x:state.x,y:state.y,z:state.z,heading:0},ws);
      send(ws,{type:'teleport',x:state.x,y:state.y,z:state.z});
    }else if(packet.type==='chat'){
      const t=Date.now();if(t-state.lastChat<650)return;state.lastChat=t;
      const message=cleanText(packet.message,240);if(!message)return;
      broadcast({type:'chat',id:state.id,name:state.name,message,time:t});
    }else if(packet.type==='dm'){
      const t=Date.now();if(t-state.lastChat<800)return;state.lastChat=t;
      const dest=String(packet.to||'');
      const message=cleanText(packet.message,220);if(!message)return;
      const target=[...wss.clients].find(other=>other!==ws&&other.steinerId===dest);
      if(target){send(target,{type:'dm',from:state.id,name:state.name,message});send(ws,{type:'dm',from:state.id,to:dest,name:state.name,message,own:true})}
      else send(ws,{type:'error',message:'Pessoa não encontrada.'});
    }else if(packet.type==='emote'){
      if(!['wave','dance','sit','cheer','none'].includes(packet.emote))return;
      state.emote=packet.emote;
      broadcast({type:'emote',id:state.id,emote:state.emote},ws);
    }else if(packet.type==='build'){
      const t=Date.now();if(t-state.lastBuild<1800)return;state.lastBuild=t;
      const type=packet.object;
      const x=Number(packet.x),z=Number(packet.z),rotation=Number(packet.rotation)||0;
      if(!['house','tree','bench','art','lamp','garden'].includes(type)||![x,z].every(Number.isFinite))return;
      if(buildings.length>=MAX_WORLD_OBJECTS||state.objects>=MAX_PLAYER_OBJECTS){send(ws,{type:'error',message:'Limite de construções atingido.'});return}
      if(Math.hypot(x-state.x,z-state.z)>18){send(ws,{type:'error',message:'Construa perto do seu avatar.'});return}
      if(Math.abs(x)<28&&Math.abs(z)<28){send(ws,{type:'error',message:'A praça central é protegida.'});return}
      const obj={id:crypto.randomUUID().slice(0,16),type,x:clamp(x,-185,185),z:clamp(z,-185,185),rotation,creator:state.name};
      buildings.push(obj);state.objects++;persist();broadcast({type:'build',object:obj});
    }
  });
  ws.steinerId=state.id;
  ws.on('close',()=>{
    if(state.joined){players.delete(state.id);broadcast({type:'leave',id:state.id,online:players.size})}
  });
  send(ws,{type:'hello',message:'Servidor social online'});
});
const ping=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;try{ws.ping()}catch(e){}}},30000);
server.listen(PORT,'0.0.0.0',()=>console.log('STEINER LIFE online porta',PORT));
process.on('SIGTERM',()=>{clearInterval(ping);server.close(()=>process.exit(0))});
