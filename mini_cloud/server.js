"use strict";
/* STEINER MINI CLOUD 2.0
   HTTPS relay for one or more opt-in local agents.
   No remote shell, no direct LAN ingress, no public file access.
   Uses standard Node.js only; queue is transient on free hosting.
*/
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.join(__dirname,"site");
const ADMIN_TOKEN=process.env.STEINER_ADMIN_TOKEN||"";
const AGENT_TOKEN=process.env.STEINER_AGENT_TOKEN||"";
if(ADMIN_TOKEN.length<32||AGENT_TOKEN.length<32||ADMIN_TOKEN===AGENT_TOKEN){
  throw Error("Missing/weak STEINER_ADMIN_TOKEN or STEINER_AGENT_TOKEN.");
}
const PORT=Number(process.env.PORT||3000);
const jobs=new Map();
const agents=new Map();
const limits=new Map();
const ACTIONS=new Set(["status","list_projects","list_outputs","read_output","create_note","create_site","mission_site","inspect_site","repair_site"]);
const AGENT_RE=/^[a-zA-Z0-9_-]{1,32}$/;
const ID_RE=/^[a-f0-9]{32}$/i;
const HEADERS={
  "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
  "X-Frame-Options":"DENY","Cache-Control":"no-store",
  "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src https:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"
};
function send(res,status,body){
  const out=JSON.stringify(body);
  res.writeHead(status,{...HEADERS,"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(out)});
  res.end(out);
}
function compare(input,expected){
  if(typeof input!=="string")return false;
  const a=Buffer.from(input),b=Buffer.from(expected);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function authenticated(req,kind){
  const h=req.headers.authorization||"";
  return h.startsWith("Bearer ")&&compare(h.slice(7),kind==="agent"?AGENT_TOKEN:ADMIN_TOKEN);
}
function body(req,limit=16000){
  return new Promise((resolve,reject)=>{
    const chunks=[];let n=0;let ended=false;
    req.on("data",c=>{n+=c.length;if(n>limit){ended=true;reject(Error("Body too large"));req.destroy();}else if(!ended)chunks.push(c);});
    req.on("end",()=>{if(ended)return;try{const v=JSON.parse(Buffer.concat(chunks).toString("utf8"));if(!v||typeof v!=="object"||Array.isArray(v))throw Error("Invalid JSON");resolve(v);}catch(e){reject(e);}});
    req.on("error",reject);
  });
}
function clean(){
  const now=Date.now();
  for(const [id,j] of jobs)if(now-j.created>1000*60*40)jobs.delete(id);
  for(const [id,t] of limits)if(now-t.since>60000)limits.delete(id);
  for(const [id,a] of agents)if(now-a.seen>1000*60*60)agents.delete(id);
}
function rate(name,max=70){
  const now=Date.now(),x=limits.get(name);
  if(!x||now-x.since>60000){limits.set(name,{since:now,count:1});return true;}
  x.count++;return x.count<=max;
}
function agentId(v){return typeof v==="string"&&AGENT_RE.test(v);}
function jobView(j){return {id:j.id,agent:j.agent,action:j.action,status:j.status,createdAt:new Date(j.created).toISOString(),updatedAt:new Date(j.updated).toISOString(),result:j.result||null,error:j.error||null};}
function mime(filename){return ({"/":"text/html; charset=utf-8","index.html":"text/html; charset=utf-8","portal.html":"text/html; charset=utf-8","style.css":"text/css; charset=utf-8","portal.css":"text/css; charset=utf-8","app.js":"application/javascript; charset=utf-8","portal.js":"application/javascript; charset=utf-8"})[filename]||"application/octet-stream";}
function staticFile(req,res,pathname){
  const allowed={"/":"portal.html","/index.html":"portal.html","/portal":"portal.html","/portal.html":"portal.html","/mini-os":"index.html","/style.css":"style.css","/app.js":"app.js","/portal.css":"portal.css","/portal.js":"portal.js"};
  const file=allowed[pathname];if(!file){send(res,404,{error:"Not found"});return;}
  const loc=path.join(root,file);
  fs.readFile(loc,(err,data)=>{
    if(err){send(res,404,{error:"Not found"});return;}
    res.writeHead(200,{...HEADERS,"Cache-Control":"public,max-age=120","Content-Type":mime(file),"Content-Length":data.length});
    if(req.method==="HEAD")res.end();else res.end(data);
  });
}
async function handler(req,res){
  clean();
  const u=new URL(req.url,"http://localhost"),p=u.pathname;
  const verb=req.method;
  if(verb==="GET"&&p==="/api/health"){
    send(res,200,{service:"STEINER MINI CLOUD",version:"2.0.0",online:true,storage:"volatile-relay",agentRequired:true});
    return;
  }
  if(!p.startsWith("/api/")){
    if(verb!=="GET"&&verb!=="HEAD"){send(res,405,{error:"Method not allowed"});return;}
    staticFile(req,res,p);return;
  }
  const isAgent=p.startsWith("/api/agent/");
  if(!authenticated(req,isAgent?"agent":"admin")){send(res,401,{error:"Unauthorized"});return;}
  if(!rate((isAgent?"agent:":"admin:")+(req.socket.remoteAddress||"unknown"),isAgent?240:120)){
    send(res,429,{error:"Rate limit"});return;
  }
  if(verb==="GET"&&p==="/api/agents"){
    const view=[...agents].map(([id,a])=>({
      id,lastSeen:new Date(a.seen).toISOString(),
      online:Date.now()-a.seen<45000,
      system:a.system,
      pending:[...jobs.values()].filter(j=>j.agent===id&&j.status==="queued").length
    }));
    send(res,200,{agents:view,storage:"volatile; reconnect after instance restart"});return;
  }
  if(verb==="POST"&&p==="/api/jobs"){
    const input=await body(req);
    if(!agentId(input.agent)||!ACTIONS.has(input.action)){
      send(res,400,{error:"Invalid agent/action"});return;
    }
    if(!input.args||typeof input.args!=="object"||Array.isArray(input.args))input.args={};
    const queued=[...jobs.values()].filter(j=>j.agent===input.agent&&["queued","running"].includes(j.status));
    if(queued.length>=25){send(res,429,{error:"Agent queue is full"});return;}
    const id=crypto.randomBytes(16).toString("hex");
    const now=Date.now();
    const j={id,agent:input.agent,action:input.action,args:input.args,
      status:"queued",created:now,updated:now,result:null,error:null};
    jobs.set(id,j);send(res,202,{job:jobView(j)});return;
  }
  if(verb==="GET"&&p.startsWith("/api/jobs/")){
    const id=p.slice("/api/jobs/".length);
    if(!ID_RE.test(id)||!jobs.has(id)){send(res,404,{error:"Job not found or expired"});return;}
    send(res,200,{job:jobView(jobs.get(id))});return;
  }
  if(verb==="POST"&&p==="/api/agent/poll"){
    const input=await body(req,2000);
    if(!agentId(input.agent_id)){send(res,400,{error:"Bad agent"});return;}
    agents.set(input.agent_id,{seen:Date.now(),system:
      typeof input.system==="string"?input.system.slice(0,80):"Windows"});
    const queued=[...jobs.values()]
      .filter(j=>j.agent===input.agent_id&&j.status==="queued").slice(0,4);
    for(const j of queued){j.status="running";j.updated=Date.now();}
    send(res,200,{jobs:queued.map(j=>({id:j.id,action:j.action,args:j.args})),serverTime:new Date().toISOString()});return;
  }
  if(verb==="POST"&&p==="/api/agent/result"){
    const input=await body(req,90000);
    if(!agentId(input.agent_id)||!ID_RE.test(String(input.job_id||""))){
      send(res,400,{error:"Bad agent/job ID"});return;
    }
    const j=jobs.get(input.job_id);
    if(!j||j.agent!==input.agent_id||j.status!=="running"){
      send(res,404,{error:"No matching running job"});return;
    }
    j.status=input.ok===true?"done":"failed";
    j.updated=Date.now();
    if(j.status==="done")j.result=input.result==null?{}:input.result;
    else j.error=String(input.error||"Agent error").slice(0,2000);
    send(res,200,{accepted:true});return;
  }
  send(res,404,{error:"Not found"});
}
const server=http.createServer((req,res)=>{
  Promise.resolve(handler(req,res)).catch(err=>{
    if(!res.headersSent)send(res,400,{error:err.message==="Body too large"?"Request too large":"Invalid request"});
    else res.destroy();
  });
});
server.requestTimeout=20000;
server.headersTimeout=10000;
server.listen(PORT,"0.0.0.0",()=>console.log("STEINER MINI CLOUD listening on "+PORT));