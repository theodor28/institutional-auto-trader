"""Interface STEINER CONTATOS 3.0 em HTML/CSS/JS, sem dependencias."""
PAGE=r'''<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>STEINER LINK • Contatos</title>
<style>
:root{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;color-scheme:dark;background:#070d16;color:#eef7ff}
[hidden]{display:none!important}
*{box-sizing:border-box}body{margin:0}button,input{font:inherit}button{cursor:pointer;border:0}
button:disabled{opacity:.5;cursor:default}input{width:100%;background:#091422;border:1px solid #3d506a;color:#eef7ff;padding:12px;border-radius:10px}
input:focus,button:focus-visible{outline:2px solid #31c69b;outline-offset:2px}
button.primary{background:#31c69b;color:#09221c;font-weight:750;padding:12px 18px;border-radius:10px}
button.small{padding:9px 11px;border-radius:9px;background:#29465d;color:#fff}
button.danger{background:#a43550;color:white;border-radius:9px;padding:11px}
button.iconButton{background:#273d55;color:#f0fbff;border-radius:10px;padding:10px 12px}
header.top{height:62px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;background:#111f31;border-bottom:1px solid #294056}
header.top strong{font-size:18px}header.top span{font-size:12px;color:#a8c1d1}
#gate{min-height:calc(100dvh - 62px);display:grid;place-items:center;padding:15px}
.loginBox{width:min(435px,100%);padding:28px;border:1px solid #334a63;background:#152235;border-radius:20px}
.loginBox h2{margin-top:0}.loginBox label{display:block;color:#b6cee0;font-size:13px;margin:16px 0 6px}
.loginBox .tabs{display:flex;gap:8px;margin-bottom:18px}.loginBox .tabs button{flex:1}
p.help{font-size:12px;line-height:1.6;color:#aac0d5}
#warning,#gateError{font-size:13px;color:#ffd2ae;padding-top:8px}
#shell{display:flex;height:calc(100dvh - 62px);width:min(1250px,100%);margin:auto;background:#101b2b;border-left:1px solid #1b334a;border-right:1px solid #1b334a}
#sidebar{width:340px;min-width:275px;border-right:1px solid #29435d;display:flex;flex-direction:column}
#profile{padding:13px 15px;border-bottom:1px solid #24394d}
#profile b{display:block}#profile small{color:#a7c3d4}
#sidebarActions{display:flex;gap:7px;padding:11px 12px}#sidebarActions button{flex:1;font-size:12px}
#addPanel{padding:0 12px 12px;border-bottom:1px solid #29425b}
#addPanel[hidden]{display:none}#addPanel label{display:block;margin:8px 0 4px;font-size:12px}
#addPanel button{margin-top:9px}
#requests{padding:9px 12px;border-bottom:1px solid #29425b}
#requests:empty{display:none}.request{border:1px solid #57788a;padding:9px;border-radius:10px;margin-bottom:6px;font-size:13px}
.request button{margin-top:7px}
#contactList{overflow-y:auto;flex:1;padding:7px}
.contact{width:100%;display:flex;align-items:center;gap:11px;border-radius:11px;background:transparent;color:white;text-align:left;padding:11px;min-height:64px}
.contact:hover,.contact.active{background:#223952}
.avatar{width:42px;height:42px;flex:none;border-radius:50%;display:grid;place-items:center;background:#2e607b;font-weight:750;font-size:16px}
.contact .detail{overflow:hidden;flex:1}.contact .detail strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.contact .detail span{color:#acc5d8;font-size:11px}
#mainChat{flex:1;min-width:0;display:flex;flex-direction:column}
#chatHeader{padding:13px 18px;min-height:66px;background:#17283d;border-bottom:1px solid #29405b;display:flex;justify-content:space-between;align-items:center;gap:10px}
#chatHeader strong{display:block}#chatHeader small{color:#abc3d4}
#callButtons{display:flex;gap:8px}#callButtons button{font-size:13px}
#messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:16px}
.bubble{align-self:flex-start;background:#263c55;border-radius:14px;padding:10px 14px;white-space:pre-wrap;overflow-wrap:anywhere;max-width:min(75%,540px);font-size:14px}
.bubble.mine{align-self:flex-end;background:#146251}
.bubble small{color:#c7d5df;display:block;margin-top:5px;font-size:10px}
.empty{margin:auto;text-align:center;max-width:280px;color:#92aec0;line-height:1.6}
#composer{border-top:1px solid #28415a;padding:13px;display:flex;gap:8px}
#composer input{flex:1}#composer button{padding-inline:19px}
#flash{font-size:12px;padding:0 15px;color:#ffd6bc;min-height:19px}
#callPane{background:#102b44;border:1px solid #426a7f;border-radius:14px;padding:13px;margin:12px}
#callPane[hidden]{display:none}
#videoRow{display:flex;flex-wrap:wrap;gap:10px;padding:12px 0}
#videoRow[hidden]{display:none}
video{width:min(46%,260px);aspect-ratio:4/3;background:#000;border-radius:10px}
#callActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:10px}
#incomingActions[hidden],#videoRow[hidden]{display:none}
#callNote{font-size:12px;color:#bad1df}
#backBtn{display:none}
#exportText{font-size:12px;color:#a6c3d1;padding:11px}
@media(max-width:760px){
 #sidebar{width:100%;min-width:0}#mainChat{display:none}
 #shell.chatOpen #sidebar{display:none}
 #shell.chatOpen #mainChat{display:flex;width:100%}
 #backBtn{display:inline-block}#chatHeader{padding:11px}
 #callButtons button{padding:8px 9px}
 .bubble{max-width:88%}
}
</style></head><body>
<header class="top"><div><strong>STEINER LINK</strong><span> • Seus contatos, seu número, sem chip</span></div><span id="topState">3.0 BETA</span></header>
<section id="gate">
<div class="loginBox">
<h2>Converse sem copiar tokens</h2>
<p class="help">Use seu número como identificador e proteja sua conta com uma senha. Pode adicionar vários contatos como em um mensageiro.</p>
<div class="tabs"><button class="small" id="loginTab">Entrar</button><button class="small" id="registerTab">Criar conta</button></div>
<div id="nameField" hidden><label>Seu nome</label><input id="displayName" maxlength="48" placeholder="Como quer ser chamado"></div>
<label>Seu número de celular</label><input id="phone" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999">
<label>Sua senha</label><input id="password" type="password" autocomplete="current-password" placeholder="Mínimo 10 caracteres">
<p><button class="primary" id="submitGate">Entrar</button></p>
<div id="gateError" role="alert"></div>
<p class="help">O número é um identificador, não uma linha telefônica. **Ainda não fazemos confirmação por SMS ou verificação de titularidade.** Não use para comprovar a identidade de alguém.</p>
</div>
</section>
<div id="shell" hidden>
<aside id="sidebar">
<div id="profile"><b id="myName"></b><small id="myPhone"></small></div>
<div id="sidebarActions">
<button class="small" id="addToggle">+ Novo contato</button>
<button class="small" id="shareLink">Convidar</button>
<button class="small" id="importContacts">Importar agenda</button>
<button class="small" id="exportContacts">Salvar contatos</button>
<button class="small" id="logout">Sair</button>
<input id="importFile" type="file" accept=".vcf,.csv,.json,text/vcard" hidden>
</div>
<div id="addPanel" hidden>
<label>Número de quem você quer chamar</label><input id="addNumber" inputmode="tel" placeholder="(11) 99999-9999">
<label>Nome na sua agenda</label><input id="addAlias" maxlength="48" placeholder="Irmão, família, cliente...">
<button class="primary" id="saveContact">Adicionar contato</button>
<p class="help">Seu contato recebe um convite no app. Se ainda não estiver cadastrado, ele receberá o convite ao criar a conta com esse número.</p>
</div>
<div id="requests"></div>
<div id="contactList"><p class="help">Seus contatos aparecerão aqui.</p></div>
<div id="exportText">Beta: os dados no Render gratuito podem desaparecer após reiniciar. Use “Salvar contatos” para guardar sua agenda.</div>
</aside>
<section id="mainChat">
<div id="chatHeader">
<button id="backBtn" class="small">←</button>
<div style="flex:1;min-width:0"><strong id="chatName">Selecione um contato</strong><small id="chatSub">Converse com amigos, família e clientes.</small></div>
<div id="callButtons"><button class="iconButton" id="voice" disabled>📞 Voz</button><button class="iconButton" id="video" disabled>📹 Vídeo</button></div>
</div>
<div id="messages"><div class="empty">Escolha alguém da lista ou adicione um novo número para começar.</div></div>
<div id="callPane" hidden>
<strong id="callTitle">Chamada</strong>
<div id="videoRow" hidden><video id="localVideo" autoplay muted playsinline></video><video id="remoteVideo" autoplay playsinline></video></div>
<audio id="remoteAudio" autoplay></audio>
<div id="callActions">
<div id="incomingActions" hidden><button class="primary" id="accept">Aceitar</button> <button class="danger" id="reject">Recusar</button></div>
<button class="danger" id="hangup">Encerrar</button>
</div><div id="callNote"></div>
</div>
<div id="flash" role="status"></div>
<form id="composer"><input id="textMessage" maxlength="3000" autocomplete="off" placeholder="Escreva uma mensagem..." disabled required>
<button class="primary" id="send" disabled>Enviar</button></form>
</section>
</div>
<script>
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let mode='login',me=null,contacts=[],requests=[],selected='',cursors={},messages={},sending=false;
let pollMeBusy=false,pollMsgBusy=false,pollCallBusy=false,callCursor=0,connection=null,localMedia=null,callId='',callPhone='',incomingCall=null,videoMode=false;
let waitRemoteIce=[],waitLocalIce=[],sentOffer=false;
const api='/contatos/api';
const states={conectado:'✓ Conectado',aguardando:'Aguardando aceitação',nao_cadastrado:'Ainda não cadastrado'};
function notice(msg){$('flash').textContent=msg;setTimeout(()=>{if($('flash').textContent===msg)$('flash').textContent=''},5000)}
async function req(url,method='GET',data){
 const opts={method,credentials:'same-origin',cache:'no-store',headers:{}};
 if(data!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(data)}
 const res=await fetch(api+url,opts);
 let out;try{out=await res.json()}catch{throw Error('Resposta inválida do servidor')}
 if(!res.ok)throw Error(out.erro||('HTTP '+res.status));
 return out
}
function phoneDisplay(p){return '+'+p}
function setMode(value){
 mode=value;$('nameField').hidden=(mode!=='register');
 $('submitGate').textContent=mode==='register'?'Criar conta':'Entrar';
 $('loginTab').style.background=mode==='login'?'#168266':'';
 $('registerTab').style.background=mode==='register'?'#168266':'';
 $('gateError').textContent='';
 $('password').autocomplete=mode==='register'?'new-password':'current-password'
}
$('loginTab').onclick=()=>setMode('login');
$('registerTab').onclick=()=>setMode('register');
function loggedIn(info){
 me=info.me;$('gate').hidden=true;$('shell').hidden=false;$('myName').textContent=me.name;
 $('myPhone').textContent=phoneDisplay(me.phone)+' • Número não verificado';
 $('topState').textContent='🟢 Online';fetchContacts()
}
function loggedOut(){
 me=null;selected='';contacts=[];requests=[];cursors={};messages={};callCursor=0;
 $('shell').hidden=true;$('gate').hidden=false;$('topState').textContent='3.0 BETA';
 $('password').value='';$('phone').value='';setMode('login')
}
async function authSubmit(){
 $('gateError').textContent='';$('submitGate').disabled=true;
 const data={phone:$('phone').value,password:$('password').value};
 if(mode==='register')data.name=$('displayName').value;
 try{
  const r=await req(mode==='register'?'/register':'/login','POST',data);loggedIn(r);
 }catch(e){$('gateError').textContent=e.message}
 finally{$('submitGate').disabled=false}
}
$('submitGate').onclick=authSubmit;
$('password').onkeydown=e=>{if(e.key==='Enter')authSubmit()};
$('logout').onclick=async()=>{try{await req('/logout','POST',{})}finally{endCall(false,false);loggedOut()}};
async function restore(){
 try{const d=await req('/me');loggedIn(d)}
 catch{loggedOut()}
}
function contactByPhone(p){return contacts.find(c=>c.phone===p)}
function activeContact(){return contactByPhone(selected)}
function escapeDownload(name,content){
 const blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json'});
 const a=document.createElement('a');const url=URL.createObjectURL(blob);
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)
}
$('exportContacts').onclick=()=>{
 if(!me)return;
 escapeDownload('STEINER_CONTATOS_'+me.phone+'.json',{
   exportado_em:new Date().toISOString(),proprietario:me.phone,contatos:contacts.map(c=>({numero:c.phone,nome:c.alias,status:c.status}))
 });
 notice('Sua agenda foi salva em Downloads.')
};
$('importContacts').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 if(file.size>1024*1024){notice('Arquivo maior que 1 MB. Exporte uma agenda menor.');return}
 let contactsToAdd=[];
 try{
  const raw=await file.text();
  if(file.name.toLowerCase().endsWith('.json')){
   const d=JSON.parse(raw);const rows=Array.isArray(d)?d:d.contatos;
   if(!Array.isArray(rows))throw Error('JSON sem lista de contatos');
   contactsToAdd=rows.map(c=>({alias:c.nome||c.alias||c.name||'',phone:c.numero||c.phone||c.telefone||''}));
  }else if(file.name.toLowerCase().endsWith('.vcf')){
   const normalized=raw.replace(/\r?\n[ \t]/g,'').replace(/\r/g,'');
   for(const card of normalized.split(/END:VCARD/i)){
    const name=card.match(/(?:^|\n)FN(?:;[^\n:]*)?:([^\n]+)/i);
    const phone=card.match(/(?:^|\n)(?:item\d+\.)?TEL(?:;[^\n:]*)?:([^\n]+)/i);
    if(name&&phone)contactsToAdd.push({alias:name[1].replace(/\\[,;]/g,' ').trim(),phone:phone[1]})
   }
  }else{
   const lines=raw.replace(/\r/g,'').split('\n').filter(x=>x.trim());
   for(const line of lines){
    const cells=line.split(/[;,\t]/).map(s=>s.replace(/^["']|["']$/g,'').trim());
    if(cells.length<2)continue;
    const phoneIndex=cells.findIndex(s=>/^\+?[\d()\s-]{10,20}$/.test(s));
    if(phoneIndex<0)continue;
    const nameIndex=phoneIndex===0?1:0;
    contactsToAdd.push({phone:cells[phoneIndex],alias:cells[nameIndex]})
   }
  }
 }catch(err){notice('Não foi possível ler a agenda: '+err.message);return}
 contactsToAdd=contactsToAdd.filter(c=>typeof c.phone==='string'&&String(c.alias).trim().length>0);
 contactsToAdd=contactsToAdd.slice(0,100);
 if(!contactsToAdd.length){notice('Nenhum contato com nome e número identificado.');return}
 if(!confirm('Importar '+contactsToAdd.length+' contatos? Isso também envia solicitações de contato aos usuários já cadastrados.'))return;
 let added=0,errors=0;
 for(const c of contactsToAdd){
  try{await req('/add','POST',{phone:String(c.phone),alias:String(c.alias).slice(0,48)});added++}
  catch{errors++}
 }
 await fetchContacts();notice('Agenda importada: '+added+' adicionados, '+errors+' não aceitos.');
};
$('addToggle').onclick=()=>{$('addPanel').hidden=!$('addPanel').hidden};
$('shareLink').onclick=async()=>{
 const url=location.origin+'/contatos';
 try{await navigator.clipboard.writeText(url);notice('Link do aplicativo copiado! Envie para seu contato.')}
 catch{prompt('Copie o endereço para convidar:',url)}
};
$('saveContact').onclick=async()=>{
 try{
  const d=await req('/add','POST',{phone:$('addNumber').value,alias:$('addAlias').value});
  $('addNumber').value='';$('addAlias').value='';$('addPanel').hidden=true;await fetchContacts();
  notice(d.status==='convite_enviado'?'Convite enviado pelo aplicativo.':'Contato salvo. Avise a pessoa para criar uma conta.')
 }catch(e){notice(e.message)}
};
async function acceptContact(phone){
 try{await req('/accept','POST',{phone});notice('Contato aceito! Agora vocês podem conversar.');await fetchContacts()}
 catch(e){notice(e.message)}
}
function renderContacts(){
 const list=$('contactList');list.replaceChildren();
 if(!contacts.length){const p=document.createElement('p');p.className='help';p.textContent='Adicione um contato pelo número para começar.';list.appendChild(p)}
 for(const c of contacts){
  const btn=document.createElement('button');btn.type='button';btn.className='contact'+(c.phone===selected?' active':'');
  const pic=document.createElement('div');pic.className='avatar';pic.textContent=c.alias.trim().charAt(0).toUpperCase()||'?';
  const dt=document.createElement('div');dt.className='detail';const title=document.createElement('strong');title.textContent=c.alias;
  const sub=document.createElement('span');sub.textContent=phoneDisplay(c.phone)+' • '+(states[c.status]||c.status);
  dt.append(title,sub);btn.append(pic,dt);btn.onclick=()=>selectContact(c.phone);list.append(btn)
 }
 const r=$('requests');r.replaceChildren();
 for(const c of requests){
  const box=document.createElement('div');box.className='request';
  const txt=document.createElement('div');txt.textContent='📨 '+c.name+' ('+phoneDisplay(c.phone)+') quer conversar';
  const button=document.createElement('button');button.className='primary';button.textContent='Aceitar convite';
  button.onclick=()=>acceptContact(c.phone);
  box.append(txt,button);r.append(box)
 }
}
async function fetchContacts(){
 if(!me||pollMeBusy)return;pollMeBusy=true;
 try{
  const d=await req('/me');contacts=d.contacts;requests=d.requests;
  renderContacts();
  if(selected){const c=activeContact();if(c)showContactInfo(c)}
 }catch(e){if(e.message.includes('Entre')){loggedOut()}else $('topState').textContent='Sem conexão'}
 finally{pollMeBusy=false}
}
function showContactInfo(c){
 $('chatName').textContent=c.alias;
 $('chatSub').textContent=phoneDisplay(c.phone)+' • '+(states[c.status]||c.status);
 const enabled=c.status==='conectado';
 $('textMessage').disabled=!enabled;$('send').disabled=!enabled;
 $('voice').disabled=!enabled||Boolean(callId||incomingCall);
 $('video').disabled=!enabled||Boolean(callId||incomingCall);
 $('textMessage').placeholder=enabled?'Escreva uma mensagem...':'Aguardando aceite do contato';
}
function selectContact(phone){
 const c=contactByPhone(phone);if(!c)return;
 selected=phone;$('shell').classList.add('chatOpen');renderContacts();showContactInfo(c);
 if(!messages[phone])messages[phone]=[];
 if(c.status==='conectado')pollMessages();
 renderMessages();
}
$('backBtn').onclick=()=>$('shell').classList.remove('chatOpen');
function renderMessages(){
 const list=$('messages');const shouldScroll=list.scrollHeight-list.scrollTop-list.clientHeight<120;
 list.replaceChildren();
 if(!selected){const d=document.createElement('div');d.className='empty';d.textContent='Escolha um contato para conversar.';list.append(d);return}
 const all=messages[selected]||[];
 if(!all.length){const d=document.createElement('div');d.className='empty';d.textContent='Nenhuma mensagem nesta conversa ainda.';list.append(d)}
 for(const m of all.slice(-400)){
  const e=document.createElement('div');e.className='bubble'+(m.mine?' mine':'');
  const txt=document.createElement('div');txt.textContent=m.text;
  const meta=document.createElement('small');meta.textContent=(m.mine?'Você':'Contato')+' • '+(m.pending?'Pendente':new Date(m.created*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));
  e.append(txt,meta);list.append(e)
 }
 if(shouldScroll)list.scrollTop=list.scrollHeight
}
async function pollMessages(){
 if(!me||!selected||pollMsgBusy||activeContact()?.status!=='conectado')return;
 const phone=selected;pollMsgBusy=true;
 try{
  for(let i=0;i<3;i++){
   const d=await req('/messages?phone='+encodeURIComponent(phone)+'&after='+(cursors[phone]||0));
   if(!messages[phone])messages[phone]=[];
   for(const m of d.messages){
    if(!messages[phone].some(e=>e.id===m.id))messages[phone].push(m);
    cursors[phone]=Math.max(cursors[phone]||0,m.seq)
   }
   if(d.messages.length<100)break
  }
  if(selected===phone)renderMessages()
 }catch(e){notice('Sem conexão. Tentando novamente...')}
 finally{pollMsgBusy=false}
}
$('composer').onsubmit=async e=>{
 e.preventDefault();const text=$('textMessage').value.trim(),phone=selected;
 if(!text||!phone||sending)return;
 sending=true;const id=crypto.randomUUID();
 if(!messages[phone])messages[phone]=[];
 const entry={id,text,mine:true,pending:true,created:Date.now()/1000};
 messages[phone].push(entry);$('textMessage').value='';renderMessages();
 try{await req('/send','POST',{phone,id,text});entry.pending=false;await pollMessages()}
 catch(e){notice('Falha ao enviar: '+e.message+' (mensagem preservada nesta página)')}
 finally{sending=false;renderMessages()}
};
// Chamada de voz/video com WebRTC. Servidor faz apenas sinalizacao.
function callUI(text){$('callPane').hidden=false;$('callTitle').textContent=text}
function callButtonState(){
 const active=Boolean(callId||incomingCall),c=activeContact();
 $('voice').disabled=active||!c||c.status!=='conectado';
 $('video').disabled=active||!c||c.status!=='conectado'
}
function incomingActions(show){$('incomingActions').hidden=!show;$('hangup').hidden=show}
async function sendSignal(kind,payload={},cid=callId,phone=callPhone){
 if(!cid||!phone)throw Error('Chamada sem destino');
 return req('/call','POST',{id:crypto.randomUUID(),call_id:cid,kind,payload,phone})
}
function resetCall(message='Chamada encerrada'){
 if(connection){connection.onicecandidate=null;connection.ontrack=null;connection.onconnectionstatechange=null;connection.close()}
 if(localMedia)localMedia.getTracks().forEach(t=>t.stop());
 connection=null;localMedia=null;callId='';callPhone='';incomingCall=null;waitRemoteIce=[];waitLocalIce=[];sentOffer=false;
 $('localVideo').srcObject=null;$('remoteVideo').srcObject=null;$('remoteAudio').srcObject=null;
 $('videoRow').hidden=true;incomingActions(false);callButtonState();callUI(message);
 $('callNote').textContent='';
 setTimeout(()=>{if(!callId&&!incomingCall)$('callPane').hidden=true},3500)
}
async function endCall(reject=false,notify=true){
 const id=callId||(incomingCall&&incomingCall.call_id);
 const phone=callPhone||(incomingCall&&incomingCall.phone);
 if(notify&&id&&phone)await sendSignal(reject?'reject':'hangup',{},id,phone).catch(()=>{});
 resetCall(reject?'Chamada recusada':'Chamada encerrada')
}
function peerCreate(){
 connection=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
 connection.onicecandidate=e=>{
  if(!e.candidate||!callId)return;
  const candidate=e.candidate.toJSON();
  if(sentOffer)sendSignal('candidate',{candidate}).catch(console.warn);
  else waitLocalIce.push(candidate)
 };
 connection.ontrack=e=>{
  const s=e.streams[0]||new MediaStream([e.track]);
  if(videoMode){$('remoteVideo').srcObject=s;$('remoteVideo').play().catch(()=>{})}
  else{$('remoteAudio').srcObject=s;$('remoteAudio').play().catch(()=>{})}
 };
 connection.onconnectionstatechange=()=>{
  if(!connection)return;
  const state=connection.connectionState;
  if(state==='connected'){callUI('🟢 Chamada conectada');$('callNote').textContent='Microfone e câmera ativados só com sua permissão.'}
  if(state==='failed'){callUI('Conexão de mídia falhou');$('callNote').textContent='Sua rede pode precisar de servidor TURN.'}
 };
 localMedia.getTracks().forEach(t=>connection.addTrack(t,localMedia))
}
async function getMedia(video){
 videoMode=video;localMedia=await navigator.mediaDevices.getUserMedia({audio:true,video});
 $('videoRow').hidden=!video;
 if(video){$('localVideo').srcObject=localMedia;$('localVideo').play().catch(()=>{})}
 peerCreate()
}
async function dial(video){
 const c=activeContact();if(!c||c.status!=='conectado'||callId||incomingCall)return;
 callPhone=c.phone;callId=crypto.randomUUID();callButtonState();incomingActions(false);
 callUI(video?'📹 Chamando por vídeo...':'📞 Chamando por voz...');
 try{
  await getMedia(video);
  const offer=await connection.createOffer();await connection.setLocalDescription(offer);
  await sendSignal('offer',{sdp:connection.localDescription.sdp,video});
  sentOffer=true;for(const c of waitLocalIce.splice(0))sendSignal('candidate',{candidate:c}).catch(console.warn);
  $('callNote').textContent='Aguardando o contato atender...'
 }catch(e){resetCall('Não foi possível iniciar: '+e.message)}
}
async function answer(){
 const ev=incomingCall;if(!ev)return;
 incomingCall=null;callId=ev.call_id;callPhone=ev.phone;
 selectContact(callPhone);callButtonState();incomingActions(false);callUI('Conectando...');
 try{
  await getMedia(Boolean(ev.payload.video));
  await connection.setRemoteDescription({type:'offer',sdp:ev.payload.sdp});
  for(const c of waitRemoteIce.splice(0))await connection.addIceCandidate(c).catch(console.warn);
  const a=await connection.createAnswer();await connection.setLocalDescription(a);
  await sendSignal('answer',{sdp:connection.localDescription.sdp});
  sentOffer=true;for(const c of waitLocalIce.splice(0))sendSignal('candidate',{candidate:c}).catch(console.warn);
  $('callNote').textContent='Conectando a mídia...'
 }catch(e){await sendSignal('reject',{},callId,callPhone).catch(()=>{});resetCall('Falha ao atender: '+e.message)}
}
async function handleEvent(e){
 const kind=e.kind;
 if(kind==='offer'){
  if(callId||incomingCall){await sendSignal('reject',{},e.call_id,e.phone).catch(()=>{});return}
  if(!e.payload||typeof e.payload.sdp!=='string')return;
  incomingCall=e;callPhone=e.phone;waitRemoteIce=[];callButtonState();incomingActions(true);
  const c=contactByPhone(e.phone);
  callUI((e.payload.video?'📹 Videochamada':'📞 Chamada de voz')+' de '+(c?.alias||phoneDisplay(e.phone)));
  $('callNote').textContent='Clique Aceitar para liberar seu microfone/câmera.'
  return
 }
 if(e.call_id!==(callId||incomingCall?.call_id))return;
 if(kind==='hangup'||kind==='reject'){resetCall(kind==='reject'?'Contato recusou':'Contato desligou');return}
 if(kind==='candidate'&&e.payload?.candidate){
  if(!connection||!connection.remoteDescription){waitRemoteIce.push(e.payload.candidate);return}
  await connection.addIceCandidate(e.payload.candidate).catch(console.warn)
 }
 if(kind==='answer'&&connection&&!connection.remoteDescription){
  await connection.setRemoteDescription({type:'answer',sdp:e.payload.sdp});
  for(const c of waitRemoteIce.splice(0))await connection.addIceCandidate(c).catch(console.warn);
  callUI('Conectando chamada...')
 }
}
async function pollCalls(){
 if(!me||pollCallBusy)return;pollCallBusy=true;
 try{
  const d=await req('/calls?after='+callCursor);
  for(const event of d.events){callCursor=Math.max(callCursor,event.seq);await handleEvent(event)}
 }catch(e){}
 finally{pollCallBusy=false}
}
$('voice').onclick=()=>dial(false);
$('video').onclick=()=>dial(true);
$('accept').onclick=answer;
$('reject').onclick=()=>endCall(true);
$('hangup').onclick=()=>endCall(false);
window.addEventListener('beforeunload',()=>{if(localMedia)localMedia.getTracks().forEach(t=>t.stop());if(connection)connection.close()});
setMode('login');restore();
setInterval(fetchContacts,5500);setInterval(pollMessages,1800);setInterval(pollCalls,1400);
})();
</script>
</body></html>'''
