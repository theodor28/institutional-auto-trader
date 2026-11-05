"""STEINER LINK WEB — Interface HTTPS e convite unico de acesso.
As senhas nunca entram no HTML, GitHub nem no link de convite.
O servidor tem acesso aos tokens A/B por variaveis de ambiente.
"""
import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from urllib.parse import urlsplit

APP = r'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>STEINER LINK • Chat e chamadas</title>
<style>
:root{font-family:system-ui,-apple-system,Segoe UI,Arial;background:#090f1c;color:#edf4ff;color-scheme:dark}
*{box-sizing:border-box}body{margin:0}main{width:min(850px,100%);min-height:100vh;margin:auto;background:#121e30;border-inline:1px solid #273b56}
header{padding:17px 20px;border-bottom:1px solid #33435a;display:flex;align-items:center;justify-content:space-between;gap:12px}
header strong{font-size:19px}small,.muted{color:#9cb0ca}button,input{font:inherit}
button{background:#30c49d;color:#071910;border:0;border-radius:10px;padding:11px 17px;cursor:pointer;font-weight:700}
button:disabled{opacity:.48;cursor:not-allowed}.secondary{background:#314a6e;color:#fff}.danger{background:#b33d54;color:#fff}
input,select{padding:12px;background:#0b1423;color:#fff;border:1px solid #566783;border-radius:10px;width:100%}
label{display:block;margin:12px 0 5px;color:#b8c9e2;font-size:13px}
section.auth{max-width:500px;margin:8vh auto;padding:22px;border:1px solid #304665;border-radius:16px}
section.auth h2{margin:0}.guide{font-size:13px;line-height:1.5;color:#bac8df;margin-top:14px}
.notice{padding:11px 13px;background:#20324b;border-radius:9px;color:#c5d7fa;font-size:13px}
#app[hidden],#login[hidden],#callBox[hidden],#media[hidden],#incomingButtons[hidden]{display:none}
.status{font-size:12px;color:#b6cce9}
#messages{height:52vh;min-height:230px;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.bubble{max-width:80%;padding:11px 13px;border-radius:14px;background:#273c57;align-self:flex-start;overflow-wrap:anywhere;white-space:pre-wrap}
.bubble.mine{align-self:flex-end;background:#14614f}
.bubble small{display:block;margin-top:5px;font-size:11px}
#form{display:flex;gap:9px;padding:15px;border-top:1px solid #31445e}
#form input{flex:1;min-width:0}.bar{display:flex;gap:8px;flex-wrap:wrap;padding:13px 16px;border-top:1px solid #31445e;align-items:center}
.bar button{padding:9px 13px}.bar .muted{flex:1;font-size:12px}
#callBox{border:1px solid #375b79;border-radius:13px;padding:13px;margin:12px 15px;background:#162b43}
#media{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px}
video{width:min(46%,350px);min-width:200px;background:#040c18;border-radius:10px;aspect-ratio:4/3}
.flex{display:flex;gap:9px;flex-wrap:wrap;margin-top:13px}#alert{font-size:12px;color:#ffc4aa;margin:0;padding:0 16px}
@media(max-width:600px){#form{padding:10px}#messages{height:48vh}header{padding:13px}video{width:100%}}
</style></head><body><main>
<header><div><strong>STEINER LINK</strong><div class="muted" style="font-size:12px">Mensagens • Voz • Vídeo • Sem chip</div></div><div id="who" class="status">HTTPS</div></header>
<section id="login" class="auth">
<h2>Entrar no STEINER LINK</h2>
<p class="guide">Abra este link em qualquer computador ou celular com internet. Não precisa de número de telefone.</p>
<div id="inviteNotice" class="notice" hidden>Convite recebido. Verificando...</div>
<div id="manual">
<label for="role">Quem está entrando?</label><select id="role"><option value="a">Eu — Chat A</option><option value="b">Meu irmão — Chat B</option></select>
<label for="token">Chave privada deste chat</label><input id="token" type="password" autocomplete="off" placeholder="Cole a chave de acesso">
<div class="flex"><button id="enter" type="button">Entrar</button></div>
</div>
<p id="loginError" class="guide" role="alert"></p>
<p class="guide">Para convidar outra pessoa sem digitar chave, entre como Chat A e clique em <b>Gerar convite</b>.</p>
</section>
<section id="app" hidden>
<div class="bar"><span class="muted" id="connection">Conectando...</span>
<button id="invite" class="secondary" type="button">🔗 Gerar convite para meu irmão</button>
<button id="logout" class="secondary" type="button">Sair</button></div>
<div id="inviteResult" class="notice" hidden style="margin:8px 15px"></div>
<div id="messages" role="log" aria-live="polite"></div>
<form id="form"><input id="message" maxlength="2000" placeholder="Escreva uma mensagem..." required autocomplete="off">
<button type="submit">Enviar</button></form>
<p id="alert" role="alert"></p>
<div class="bar"><button type="button" id="voice" class="secondary">📞 Ligar por voz</button>
<button type="button" id="video" class="secondary">📹 Videochamada</button>
<span class="muted">Acesso ao microfone/câmera só com sua permissão.</span></div>
<div id="callBox" hidden>
<strong id="callTitle">Chamada</strong><div id="media" hidden>
<video id="mine" autoplay muted playsinline></video><video id="remote" autoplay playsinline></video>
</div><audio id="remoteAudio" autoplay></audio>
<div class="flex"><span id="incomingButtons" hidden><button type="button" id="accept">Aceitar</button>
<button type="button" id="reject" class="danger">Recusar</button></span>
<button type="button" id="hangup" class="danger">Encerrar</button></div>
<p class="guide" id="callInfo"></p>
</div>
<p class="guide" style="padding:0 16px">Protótipo: exige internet para pessoas distantes. Pode falhar em algumas redes sem servidor TURN. Não usar para conversas confidenciais até rotacionar as chaves antigas e concluir auditoria de segurança.</p>
</section></main>
<script>
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let role=sessionStorage.getItem('sl_role')||'',token=sessionStorage.getItem('sl_token')||'';
let data={messages:[],outbox:[],recv:0,receipts:0,epoch:'',lastCall:0};
let ready=false,syncBusy=false,callBusy=false,peer=null,stream=null,callId='',incoming=null,candidates=[],iceStarted=false,earlyCandidates=[],wantsVideo=false;
const saved=sessionStorage.getItem('sl_chat_state');
if(saved){try{data=Object.assign(data,JSON.parse(saved))}catch(e){}}
function save(){sessionStorage.setItem('sl_chat_state',JSON.stringify(data))}
function alertText(t){$('alert').textContent=t}
function request(path,body=null){
 const options={headers:{'X-Steiner-Token':token},cache:'no-store'};
 if(body!==null){options.method='POST';options.headers['Content-Type']='application/json';options.body=JSON.stringify(body)}
 return fetch(path,options).then(async r=>{const result=await r.json();if(!r.ok)throw Error(result.erro||'Erro HTTP '+r.status);return result})
}
function render(){
 const pane=$('messages'),atBottom=pane.scrollHeight-pane.scrollTop-pane.clientHeight<90;
 pane.replaceChildren();
 for(const m of data.messages.slice(-250)){
  const d=document.createElement('div');d.className='bubble'+(m.mine?' mine':'');
  const t=document.createElement('div');t.textContent=m.text;d.appendChild(t);
  const meta=document.createElement('small');meta.textContent=(m.mine?'Você':'Contato')+' • '+(m.state||'recebido');d.appendChild(meta);
  pane.appendChild(d)
 }
 if(atBottom)pane.scrollTop=pane.scrollHeight;
}
function loggedIn(){
 $('login').hidden=true;$('app').hidden=false;
 $('who').textContent='Chat '+role.toUpperCase();
 $('invite').hidden=role!=='a';render();ready=true;
}
function logout(){
 token='';role='';ready=false;sessionStorage.removeItem('sl_token');
 sessionStorage.removeItem('sl_role');sessionStorage.removeItem('sl_chat_state');
 data={messages:[],outbox:[],recv:0,receipts:0,epoch:'',lastCall:0};
 if(callId||incoming)finishCall('Sessão encerrada');
 $('app').hidden=true;$('login').hidden=false;$('manual').hidden=false;$('inviteNotice').hidden=true
}
async function login(r,t){
 role=r;token=t;
 try{
  const h=await request('/health');if(!h.ok)throw Error('Mestre indisponível');
  await request('/status?after=0');
  sessionStorage.setItem('sl_role',role);sessionStorage.setItem('sl_token',token);
  if(data.epoch!==h.epoch){data.recv=0;data.receipts=0;data.lastCall=0;data.epoch=h.epoch}
  save();loggedIn();$('loginError').textContent='';await sync();
 }catch(e){token='';role='';$('loginError').textContent='Acesso não autorizado ou serviço indisponível: '+e.message}
}
async function getInvite(code){
 $('inviteNotice').hidden=false;$('manual').hidden=true;
 try{
  const r=await fetch('/web/redeem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
  const result=await r.json();if(!r.ok)throw Error(result.erro||'Convite inválido');
  $('inviteNotice').textContent='Convite aceito. Entrando no Chat B...';
  await login(result.role,result.token);
 }catch(e){$('inviteNotice').textContent='Convite inválido ou expirado: '+e.message;$('manual').hidden=false}
}
if(location.hash.startsWith('#join=')){
 const code=decodeURIComponent(location.hash.substring(6));history.replaceState(null,'',location.pathname);
 getInvite(code);
}else if(role&&token){login(role,token)}
$('enter').onclick=()=>login($('role').value,$('token').value.trim());
$('logout').onclick=logout;
$('invite').onclick=async()=>{
 try{
  const d=await request('/web/invite',{role:'b'});
  const url=location.origin+'/#join='+encodeURIComponent(d.code);
  $('inviteResult').hidden=false;$('inviteResult').replaceChildren();
  const label=document.createElement('span');label.textContent='Convite de uso único (10 minutos): ';
  const input=document.createElement('input');input.readOnly=true;input.value=url;
  const button=document.createElement('button');button.textContent='Copiar link';
  button.onclick=async()=>{try{await navigator.clipboard.writeText(url);button.textContent='Copiado!'}catch(e){input.select();alert('Copie o link selecionado')}}
  $('inviteResult').append(label,input,button);
 }catch(e){alertText('Não foi possível gerar convite: '+e.message)}
};
$('form').onsubmit=e=>{
 e.preventDefault();
 const body=$('message').value.trim();if(!body||!role)return;
 const id=crypto.randomUUID();
 data.messages.push({id,text:body,mine:true,state:'pendente'});
 data.outbox.push({id,body});save();render();$('message').value='';sync();
};
async function sync(){
 if(!ready||syncBusy)return;syncBusy=true;
 try{
  const health=await request('/health');
  if(data.epoch!==health.epoch){data.epoch=health.epoch;data.recv=0;data.receipts=0}
  for(const msg of data.outbox.slice(0,20)){
   await request('/push',{id:msg.id,corpo:msg.body});
   data.outbox=data.outbox.filter(x=>x.id!==msg.id);
   const row=data.messages.find(x=>x.id===msg.id);if(row&&row.state==='pendente')row.state='no mestre';
  }
  const incoming=await request('/pull?after='+data.recv);
  for(const msg of incoming.mensagens){
   if(!data.messages.some(x=>x.id===msg.id))data.messages.push({id:msg.id,text:msg.corpo,mine:false,state:'recebido'});
   data.recv=Math.max(data.recv,msg.seq);
  }
  if(incoming.mensagens.length)await request('/ack',{ids:incoming.mensagens.map(x=>x.id)});
  const receipts=await request('/status?after='+data.receipts);
  for(const item of receipts.recibos){
   const msg=data.messages.find(x=>x.id===item.msg_id);if(msg)msg.state='entregue';
   data.receipts=Math.max(data.receipts,item.seq)
  }
  $('connection').textContent='🟢 Mestre online • pendentes: '+data.outbox.length;
  save();render();alertText('');
 }catch(e){$('connection').textContent='🔴 Sem conexão • mensagens pendentes: '+data.outbox.length;alertText('Tentando reconectar automaticamente.')}
 finally{syncBusy=false}
}
function showCall(t){$('callBox').hidden=false;$('callTitle').textContent=t}
function callButtons(inbound){$('incomingButtons').hidden=!inbound;$('hangup').hidden=inbound;$('voice').disabled=Boolean(callId||incoming);$('video').disabled=Boolean(callId||incoming)}
async function signal(kind,payload={},cid=callId){
 if(!cid)throw Error('Sem chamada');
 return request('/calls/send',{id:crypto.randomUUID(),call_id:cid,kind,payload})
}
function finishCall(t){
 if(peer){peer.ontrack=null;peer.onicecandidate=null;peer.onconnectionstatechange=null;peer.close()}
 if(stream)stream.getTracks().forEach(track=>track.stop());
 peer=null;stream=null;callId='';incoming=null;candidates=[];earlyCandidates=[];iceStarted=false;
 $('mine').srcObject=null;$('remote').srcObject=null;$('remoteAudio').srcObject=null;
 $('media').hidden=true;callButtons(false);showCall(t);$('callInfo').textContent='';
 setTimeout(()=>{if(!callId&&!incoming)$('callBox').hidden=true},4000);
}
function buildPeer(){
 peer=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
 peer.onicecandidate=e=>{
  if(!e.candidate||!callId)return;
  const c=e.candidate.toJSON();if(iceStarted)signal('candidate',{candidate:c}).catch(console.warn);
  else earlyCandidates.push(c)
 };
 peer.ontrack=e=>{
  const media=e.streams[0]||new MediaStream([e.track]);
  if(wantsVideo){$('remote').srcObject=media;$('remote').play().catch(()=>{})}
  else{$('remoteAudio').srcObject=media;$('remoteAudio').play().catch(()=>{})}
 };
 peer.onconnectionstatechange=()=>{
  if(!peer)return;
  const status=peer.connectionState;
  if(status==='connected'){showCall('🟢 Chamada conectada');$('callInfo').textContent='Áudio e vídeo via WebRTC.'}
  if(status==='failed'){showCall('Conexão de mídia falhou');$('callInfo').textContent='Esta rede pode exigir um servidor TURN.'}
 };
 stream.getTracks().forEach(t=>peer.addTrack(t,stream));
}
async function mediaStart(video){
 wantsVideo=video;
 stream=await navigator.mediaDevices.getUserMedia({audio:true,video});
 $('media').hidden=!video;
 if(video){$('mine').srcObject=stream;$('mine').play().catch(()=>{})}
 buildPeer();
}
async function startCall(video){
 if(callId||incoming)return;
 callId=crypto.randomUUID();callButtons(false);
 showCall(video?'📹 Chamando por vídeo...':'📞 Chamando por voz...');
 try{
  await mediaStart(video);
  const offer=await peer.createOffer();await peer.setLocalDescription(offer);
  await signal('offer',{sdp:peer.localDescription.sdp,video});
  iceStarted=true;for(const c of earlyCandidates.splice(0))signal('candidate',{candidate:c}).catch(()=>{})
  $('callInfo').textContent='Aguardando seu contato aceitar.';
 }catch(e){finishCall('Não foi possível ligar: '+e.message)}
}
async function acceptCall(){
 if(!incoming)return;const evt=incoming;incoming=null;callId=evt.call_id;
 showCall('Conectando...');callButtons(false);
 try{
  await mediaStart(Boolean(evt.payload.video));
  await peer.setRemoteDescription({type:'offer',sdp:evt.payload.sdp});
  for(const c of candidates.splice(0))await peer.addIceCandidate(c);
  const ans=await peer.createAnswer();await peer.setLocalDescription(ans);
  await signal('answer',{sdp:peer.localDescription.sdp});
  iceStarted=true;for(const c of earlyCandidates.splice(0))signal('candidate',{candidate:c}).catch(()=>{})
  $('callInfo').textContent='Conectando a mídia...';
 }catch(e){await signal('reject').catch(()=>{});finishCall('Falha ao atender: '+e.message)}
}
async function endCall(reject){
 const cid=callId||(incoming&&incoming.call_id);
 if(cid)await signal(reject?'reject':'hangup',{},cid).catch(()=>{});
 finishCall('Chamada encerrada');
}
async function eventCall(e){
 if(e.kind==='offer'){
  if(callId||incoming){await signal('reject',{},e.call_id).catch(()=>{});return}
  if(!e.payload||typeof e.payload.sdp!=='string')return;
  incoming=e;callId='';candidates=[];callButtons(true);
  showCall(e.payload.video?'📹 Videochamada recebida':'📞 Chamada de voz recebida');
  $('callInfo').textContent='Aceitar autoriza o microfone ou a câmera.';
  return
 }
 if(e.call_id!==(callId||(incoming&&incoming.call_id)))return;
 if(e.kind==='hangup'||e.kind==='reject'){finishCall(e.kind==='reject'?'Chamada recusada':'Contato desligou');return}
 if(e.kind==='candidate'&&e.payload&&e.payload.candidate){
  if(!peer||!peer.remoteDescription){candidates.push(e.payload.candidate);return}
  await peer.addIceCandidate(e.payload.candidate).catch(console.warn)
 }
 if(e.kind==='answer'&&peer&&!peer.remoteDescription){
  await peer.setRemoteDescription({type:'answer',sdp:e.payload.sdp});
  for(const c of candidates.splice(0))await peer.addIceCandidate(c).catch(console.warn);
  showCall('Estabelecendo conexão...');
 }
}
async function pollCalls(){
 if(!ready||callBusy)return;callBusy=true;
 try{
  const x=await request('/calls/events?after='+data.lastCall);
  for(const event of x.events){data.lastCall=Math.max(data.lastCall,event.seq);await eventCall(event)}
  save()
 }catch(e){}
 finally{callBusy=false}
}
$('voice').onclick=()=>startCall(false);$('video').onclick=()=>startCall(true);
$('accept').onclick=acceptCall;$('reject').onclick=()=>endCall(true);$('hangup').onclick=()=>endCall(false);
window.addEventListener('beforeunload',()=>{if(stream)stream.getTracks().forEach(t=>t.stop());if(peer)peer.close()});
setInterval(sync,1600);setInterval(pollCalls,1300);
})();
</script></body></html>'''

def wrap_master(parent, base):
    original_prepare=base.preparar_master
    def preparar_master(path):
        original_prepare(path)
        with base.conexao(path) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS web_invites(
                hash TEXT PRIMARY KEY, role TEXT NOT NULL,
                expires REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0)""")
            db.commit()
    base.preparar_master=preparar_master

    class PublicMaster(parent):
        def do_GET(self):
            path=urlsplit(self.path).path
            if path in ("/","/app","/index.html"):
                encoded=APP.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type","text/html; charset=utf-8")
                self.send_header("Cache-Control","no-store")
                self.send_header("X-Content-Type-Options","nosniff")
                self.send_header("Referrer-Policy","no-referrer")
                self.send_header("X-Frame-Options","DENY")
                self.send_header("Content-Security-Policy","frame-ancestors 'none'; base-uri 'self'; object-src 'none'")
                self.send_header("Content-Length",str(len(encoded)))
                self.end_headers();self.wfile.write(encoded)
                return
            return super().do_GET()

        def do_POST(self):
            path=urlsplit(self.path).path
            if path=="/web/invite":
                if self.identidade()!="a":
                    return base.responder(self,403,{"erro":"Somente Chat A pode convidar"})
                obj=base.ler_json(self,1024)
                if obj is None or obj.get("role")!="b":
                    return base.responder(self,400,{"erro":"Convite invalido"})
                code=secrets.token_urlsafe(32)
                digest=hashlib.sha256(code.encode("ascii")).hexdigest()
                now=time.time()
                with base.conexao(self.server.db) as db:
                    db.execute("DELETE FROM web_invites WHERE expires<? OR used=1",(now,))
                    db.execute("INSERT INTO web_invites(hash,role,expires) VALUES(?,?,?)",(digest,"b",now+600))
                    db.commit()
                return base.responder(self,200,{"ok":True,"code":code,"expires_in":600})
            if path=="/web/redeem":
                obj=base.ler_json(self,1000)
                code=obj.get("code") if obj else None
                if not isinstance(code,str) or not (32<=len(code)<=64):
                    return base.responder(self,400,{"erro":"Convite invalido"})
                digest=hashlib.sha256(code.encode("utf-8")).hexdigest()
                with base.conexao(self.server.db) as db:
                    db.execute("BEGIN IMMEDIATE")
                    row=db.execute(
                        "SELECT role FROM web_invites WHERE hash=? AND used=0 AND expires>?",
                        (digest,time.time())).fetchone()
                    if not row:
                        db.rollback()
                        return base.responder(self,410,{"erro":"Convite expirado ou ja utilizado"})
                    role=row["role"]
                    db.execute("UPDATE web_invites SET used=1 WHERE hash=?",(digest,))
                    db.commit()
                return base.responder(self,200,{"ok":True,"role":role,"token":self.server.tokens[role]})
            return super().do_POST()
    return PublicMaster
