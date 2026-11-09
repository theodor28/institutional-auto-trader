"use strict";
/* STEINER Conecta — app de conversa a dois, sem bibliotecas de terceiros. */
const $=id=>document.getElementById(id);
let token="",myRole="",lastMessageId=0,lastSignalId=0;
let busy=false,online=false,shown=new Map(),mediaUrls=new Map();
let recorder=null,recordStream=null,recordTimer=null,recordChunks=[];
let rtc=null,localStream=null,pendingOffer=null,queuedIce=[],pollBusy=false,pollSignalsBusy=false;
let lastTyping=0,reportedRead=0,callMode="audio";
function toast(text){
 const box=$("toast");box.textContent=text;box.classList.remove("hidden");
 clearTimeout(toast._timer);toast._timer=setTimeout(()=>box.classList.add("hidden"),5000);
}
function welcome(error=""){
 $("welcome").classList.remove("hidden");$("chatApp").classList.add("hidden");
 $("welcomeError").textContent=error;
}
function setStatus(peer){
 const status=$("presence");online=!!peer?.online;
 status.textContent=peer?.typing?"digitando...":online?"online agora":"aguardando a outra pessoa";
 status.classList.toggle("is-online",online);
}
async function api(path,options={}){
 const headers={"Authorization":"Bearer "+token,"Accept":"application/json",...options.headers};
 let body=options.body;
 if(body&&typeof body!=="string"){body=JSON.stringify(body);headers["Content-Type"]="application/json";}
 const res=await fetch(path,{method:options.method||"GET",headers,body,cache:"no-store"});
 if(!res.ok){let msg="Erro "+res.status;try{msg=(await res.json()).error||msg;}catch{}throw new Error(msg);}
 return res.json();
}
function formatTime(ms){return new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date(ms));}
function elt(tag,cls,text){
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
}
function nearBottom(){
 const box=$("chatScroll");return box.scrollHeight-box.scrollTop-box.clientHeight<165;
}
async function loadBlob(id,mime){
 const res=await fetch("/api/file/"+id,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 if(!res.ok)throw new Error("Arquivo indisponível");
 const blob=await res.blob();return URL.createObjectURL(blob);
}
function renderMessage(m){
 if(shown.has(m.id)){
  const time=shown.get(m.id).querySelector(".tick");
  if(time)time.classList.toggle("read",!!m.read_at);
  return;
 }
 const scroll=$("chatScroll");const stick=nearBottom();
 const intro=scroll.querySelector(".starter");if(intro)intro.remove();
 const mine=m.from===myRole;
 const bubble=elt("article","msg"+(mine?" mine":""));
 bubble.setAttribute("aria-label",mine?"Minha mensagem":"Mensagem recebida");
 if(m.kind==="text"){
  bubble.appendChild(elt("div","bodytext",m.text));
 }else if(m.kind==="image"){
  const img=elt("img");img.alt=m.text||"Foto enviada";img.loading="lazy";
  img.addEventListener("click",()=>{if(img.src)window.open(img.src,"_blank","noopener,noreferrer");});
  bubble.appendChild(img);
  if(m.text)bubble.appendChild(elt("div","caption",m.text));
  loadBlob(m.file_id,m.mime).then(url=>{mediaUrls.set(m.id,url);img.src=url;}).catch(()=>{img.alt="Foto indisponível";});
 }else if(m.kind==="audio"){
  const audio=elt("audio");audio.controls=true;audio.preload="none";bubble.appendChild(audio);
  loadBlob(m.file_id,m.mime).then(url=>{mediaUrls.set(m.id,url);audio.src=url;}).catch(()=>{bubble.appendChild(elt("div","caption","Áudio indisponível"));});
  if(m.text)bubble.appendChild(elt("div","caption",m.text));
 }
 const timetag=elt("time","",formatTime(m.created));
 if(mine){const ticks=elt("span","tick"+(m.read_at?" read":""),m.read_at?"✓✓":"✓");timetag.appendChild(ticks);}
 bubble.appendChild(timetag);scroll.appendChild(bubble);shown.set(m.id,bubble);
 if(stick||mine)scroll.scrollTop=scroll.scrollHeight;
 if(!mine && m.id>reportedRead && !document.hidden)sendRead(m.id);
}
async function sendRead(id){
 if(id<=reportedRead)return;reportedRead=id;
 try{await api("/api/read",{method:"POST",body:{last_id:id}});}catch{}
}
async function poll(){
 if(pollBusy||!token)return;pollBusy=true;
 try{
  const result=await api("/api/poll?after="+lastMessageId);
  setStatus(result.peer);
  (result.messages||[]).forEach(m=>{renderMessage(m);lastMessageId=Math.max(lastMessageId,m.id);});
  if(!document.hidden){
   const received=(result.messages||[]).filter(m=>m.from!==myRole);
   if(received.length)sendRead(received[received.length-1].id);
  }
  if(result.receipts){
   result.receipts.forEach(r=>{
    const msg=shown.get(r.id);if(!msg)return;
    const tick=msg.querySelector(".tick");
    if(tick&&r.read_at){tick.classList.add("read");tick.textContent="✓✓";}
   });
  }
 }catch(e){if(e.message.includes("Acesso privado")){localStorage.removeItem("STEINER_CHAT_KEY");welcome(e.message);token="";}else{$("presence").textContent="Reconectando...";}}
 finally{pollBusy=false;}
}
async function sendText(e){
 e.preventDefault();if(busy)return;
 const input=$("message");const content=input.value.trim();if(!content)return;
 busy=true;$("sendBtn").disabled=true;
 try{
  await api("/api/send",{method:"POST",body:{kind:"text",text:content}});
  input.value="";input.focus();await api("/api/typing",{method:"POST",body:{typing:false}});
  await poll();
 }catch(e){toast(e.message);}
 finally{busy=false;$("sendBtn").disabled=false;}
}
function asBase64(blob){
 return new Promise((resolve,reject)=>{const reader=new FileReader();
 reader.onload=()=>resolve(String(reader.result).split(",")[1]);
 reader.onerror=()=>reject(new Error("Não foi possível ler o arquivo"));
 reader.readAsDataURL(blob);});
}
async function optimizePhoto(file){
 const blob=await createImageBitmap(file).catch(()=>null);
 if(!blob){if(file.size<=1000000)return file;throw new Error("Formato da foto não suportado");}
 let width=blob.width,height=blob.height;
 const factor=Math.min(1,1440/Math.max(width,height));
 width=Math.round(width*factor);height=Math.round(height*factor);
 const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
 canvas.getContext("2d").drawImage(blob,0,0,width,height);blob.close?.();
 return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Falha ao comprimir foto")),"image/jpeg",.75));
}
async function sendAttachment(kind,blob,caption=""){
 if(busy)return;busy=true;$("sendBtn").disabled=true;
 $("uploadProgress").textContent=kind==="image"?"Preparando foto...":"Enviando áudio...";
 try{
  if(blob.size>1000000)throw new Error("Arquivo acima de 1 MB");
  const data=await asBase64(blob),mime=blob.type.split(";")[0];
  await api("/api/send",{method:"POST",body:{kind,mime,data,text:caption}});
  $("uploadProgress").textContent="Enviado ✓";await poll();
 }catch(e){toast(e.message);$("uploadProgress").textContent="";}
 finally{busy=false;$("sendBtn").disabled=false;setTimeout(()=>$("uploadProgress").textContent="",2000);}
}
async function handlePhoto(e){
 const file=e.target.files?.[0];e.target.value="";if(!file)return;
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)){toast("Escolha JPG, PNG ou WebP");return;}
 try{await sendAttachment("image",await optimizePhoto(file));}catch(e){toast(e.message);}
}
async function toggleRecording(){
 if(recorder&&recorder.state==="recording"){recorder.stop();return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast("Este navegador não oferece gravação de áudio");return;}
 try{
  recordStream=await navigator.mediaDevices.getUserMedia({audio:true});
  const mime=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg"].find(x=>MediaRecorder.isTypeSupported(x));
  recorder=mime?new MediaRecorder(recordStream,{mimeType:mime}):new MediaRecorder(recordStream);
  recordChunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
  recorder.onstop=async()=>{
   $("recordBtn").classList.remove("recording");$("recordBtn").textContent="◉";
   clearTimeout(recordTimer);
   const type=recorder.mimeType||recordChunks[0]?.type||"audio/webm";
   const file=new Blob(recordChunks,{type});
   recordStream?.getTracks().forEach(t=>t.stop());
   recorder=null;recordStream=null;recordChunks=[];
   if(file.size>40)await sendAttachment("audio",file);
  };
  recorder.start(1000);$("recordBtn").classList.add("recording");$("recordBtn").textContent="■";
  toast("Gravando... toque no quadrado para enviar. Máximo de 25 segundos.");
  recordTimer=setTimeout(()=>{if(recorder?.state==="recording")recorder.stop();},25000);
 }catch(e){recordStream?.getTracks().forEach(t=>t.stop());toast("Não foi possível acessar o microfone");}
}
async function sendTyping(){
 if(Date.now()-lastTyping<2200||!token)return;
 lastTyping=Date.now();
 try{await api("/api/typing",{method:"POST",body:{typing:true}});}catch{}
}
async function sendSignal(type,payload={}){
 return api("/api/signal",{method:"POST",body:{type,payload}});
}
async function setupRTC(video){
 localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:!!video});
 callMode=video?"video":"audio";
 rtc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
 localStream.getTracks().forEach(t=>rtc.addTrack(t,localStream));
 $("localVideo").srcObject=localStream;
 $("localVideo").classList.toggle("hidden",!video);
 $("remoteVideo").classList.toggle("hidden",!video);
 rtc.ontrack=e=>{
  const stream=e.streams[0]||new MediaStream([e.track]);
  $("remoteVideo").srcObject=stream;
  $("remoteVideo").muted=false;
  $("remoteVideo").play().catch(()=>{});
  $("callStatus").textContent="Conectando áudio/vídeo...";
 };
 rtc.onicecandidate=e=>{if(e.candidate)sendSignal("candidate",{candidate:e.candidate.toJSON()}).catch(()=>{});};
 rtc.onconnectionstatechange=()=>{
  if(!rtc)return;
  const st=rtc.connectionState;
  $("callStatus").textContent=st==="connected"?"Conectados ❤️":st==="failed"?"Conexão direta falhou — tente novamente":st==="disconnected"?"Reconectando...":"Estabelecendo conexão...";
  if(st==="failed")toast("Essa rede pode exigir um servidor TURN para chamadas.");
 };
 for(const candidate of queuedIce.splice(0)){
  try{if(rtc.remoteDescription)await rtc.addIceCandidate(candidate);else queuedIce.push(candidate);}catch{}
 }
}
function showCall(title,status,incoming=false){
 $("callOverlay").classList.remove("hidden");
 $("callTitle").textContent=title;$("callStatus").textContent=status;
 $("acceptCall").classList.toggle("hidden",!incoming);
}
async function startCall(video=false){
 if(!token)return;
 if(rtc||pendingOffer){toast("Já existe uma chamada");return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){toast("Este navegador não oferece chamadas");return;}
 try{
  showCall(video?"Videochamada":"Chamada de voz","Chamando... aguardando a outra pessoa.");
  await setupRTC(video);
  const offer=await rtc.createOffer();
  await rtc.setLocalDescription(offer);
  await sendSignal("offer",{sdp:rtc.localDescription,video:!!video});
 }catch(e){toast("Não foi possível iniciar a chamada: "+e.message);cleanupCall();}
}
async function acceptCall(){
 if(!pendingOffer)return;
 try{
  $("acceptCall").classList.add("hidden");
  const offer=pendingOffer;pendingOffer=null;
  await setupRTC(!!offer.video);
  await rtc.setRemoteDescription(offer.sdp);
  const answer=await rtc.createAnswer();
  await rtc.setLocalDescription(answer);
  await sendSignal("answer",{sdp:rtc.localDescription});
  for(const ice of queuedIce.splice(0)){try{await rtc.addIceCandidate(ice);}catch{}}
 }catch(e){toast("Falha ao atender: "+e.message);await endCall();}
}
async function endCall(){
 try{if(rtc||pendingOffer)await sendSignal("hangup",{});}catch{}
 cleanupCall();
}
function cleanupCall(){
 pendingOffer=null;
 try{rtc?.close();}catch{}rtc=null;
 localStream?.getTracks().forEach(t=>t.stop());localStream=null;
 for(const x of ["remoteVideo","localVideo"]){const video=$(x);video.pause();video.srcObject=null;}
 $("callOverlay").classList.add("hidden");
 queuedIce=[];
}
async function handleSignal(s){
 if(s.created<Date.now()-40000 && !rtc && !pendingOffer)return;
 if(s.type==="offer"){
  if(rtc||pendingOffer){await sendSignal("reject",{}).catch(()=>{});return;}
  pendingOffer=s.payload;
  showCall(s.payload.video?"Videochamada recebida":"Chamada de voz recebida","Toque para atender.",true);
 }else if(s.type==="answer"){
  if(rtc&&!rtc.remoteDescription){
   try{await rtc.setRemoteDescription(s.payload.sdp);
    for(const ice of queuedIce.splice(0)){try{await rtc.addIceCandidate(ice);}catch{}}
   }catch(e){toast("Resposta de chamada inválida");}
  }
 }else if(s.type==="candidate"){
  const candidate=s.payload.candidate;
  if(candidate&&rtc?.remoteDescription){try{await rtc.addIceCandidate(candidate);}catch{}}
  else if(candidate)queuedIce.push(candidate);
 }else if(s.type==="hangup"||s.type==="reject"){
  cleanupCall();toast(s.type==="reject"?"A chamada não foi atendida":"A chamada foi encerrada");
 }
}
async function pollSignals(){
 if(pollSignalsBusy||!token)return;pollSignalsBusy=true;
 try{
  const res=await api("/api/signals?after="+lastSignalId);
  for(const s of(res.signals||[])){lastSignalId=Math.max(lastSignalId,s.id);await handleSignal(s);}
 }catch{}
 finally{pollSignalsBusy=false;}
}
async function begin(){
 const params=new URLSearchParams(location.hash.replace(/^#/,""));
 const fromLink=params.get("owner")||params.get("guest");
 if(fromLink){
  token=fromLink;
  localStorage.setItem("STEINER_CHAT_KEY",token);
  history.replaceState(null,"",location.pathname);
 }else token=localStorage.getItem("STEINER_CHAT_KEY")||"";
 if(!token){welcome();return;}
 try{
  const me=await api("/api/me");
  myRole=me.role;setStatus(me.peer);
  $("peerName").textContent=myRole==="owner"?"Sua convidada":"Sua pessoa especial";
  $("sidebarPeer").textContent=$("peerName").textContent;
  $("chatApp").classList.remove("hidden");$("welcome").classList.add("hidden");
  await poll();await pollSignals();
  setInterval(poll,1600);setInterval(pollSignals,1700);
 }catch(e){localStorage.removeItem("STEINER_CHAT_KEY");token="";welcome("Não foi possível abrir seu convite: "+e.message);}
}
$("composer").addEventListener("submit",sendText);
$("message").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit();}});
$("message").addEventListener("input",sendTyping);
$("attachBtn").addEventListener("click",()=>$("fileInput").click());
$("fileInput").addEventListener("change",handlePhoto);
$("recordBtn").addEventListener("click",toggleRecording);
$("emojiBtn").addEventListener("click",()=>$("emojiTray").classList.toggle("hidden"));
$("emojiTray").addEventListener("click",e=>{if(e.target.tagName==="BUTTON"){$("message").value+=e.target.textContent;$("emojiTray").classList.add("hidden");$("message").focus();}});
$("infoBtn").addEventListener("click",()=>toast("Chat privado por convite. Criptografia HTTPS no transporte, sem criptografia ponta a ponta. Histórico temporário: pode desaparecer após reinício do servidor gratuito."));
$("audioCall").addEventListener("click",()=>startCall(false));
$("videoCall").addEventListener("click",()=>startCall(true));
$("acceptCall").addEventListener("click",acceptCall);
$("endCall").addEventListener("click",endCall);
document.addEventListener("visibilitychange",()=>{if(!document.hidden){poll();pollSignals();}});
window.addEventListener("beforeunload",()=>{for(const url of mediaUrls.values())URL.revokeObjectURL(url);localStream?.getTracks().forEach(x=>x.stop());});
begin();
