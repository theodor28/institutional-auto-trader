"""STEINER LINK CHAMADAS v1 — sinalizacao de voz e video WebRTC.
Sem chip/numero; precisa de conexao de rede entre os participantes.
Credenciais ficam somente no backend Python; browser nunca recebe tokens.
Protocolo de midia e P2P (STUN publico). Sem TURN, alguns NATs falham.
"""
import json
import threading
import time
import uuid
from urllib.parse import urlsplit,parse_qs

KINDS = frozenset(("offer","answer","candidate","hangup","reject"))
MAX_PAYLOAD = 12000

def install(base):
    if getattr(base, "_calls_installed", False):
        return
    base._calls_installed = True
    original_preparar=base.preparar_master
    def preparar_master(path):
        original_preparar(path)
        with base.conexao(path) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS call_events(
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                id TEXT UNIQUE NOT NULL,
                sender TEXT NOT NULL,
                target TEXT NOT NULL,
                call_id TEXT NOT NULL,
                kind TEXT NOT NULL,
                payload TEXT NOT NULL,
                created REAL NOT NULL
            )""")
            db.commit()
    base.preparar_master=preparar_master

    class CallMaster(base.MasterHandler):
        def do_GET(self):
            parts=urlsplit(self.path)
            if parts.path!="/calls/events":
                return super().do_GET()
            who=self.identidade()
            if who is None:
                return base.responder(self,401,{"erro":"Token invalido"})
            try:
                after=int(parse_qs(parts.query).get("after",["0"])[0])
                if after<0:raise ValueError()
            except (ValueError,TypeError):
                return base.responder(self,400,{"erro":"Cursor invalido"})
            with base.conexao(self.server.db) as db:
                rows=db.execute(
                    "SELECT seq,id,sender,call_id,kind,payload,created FROM call_events "
                    "WHERE target=? AND seq>? AND created>? ORDER BY seq LIMIT 90",
                    (who,after,time.time()-180)
                ).fetchall()
            events=[dict(x) for x in rows]
            for event in events:
                event["payload"]=json.loads(event["payload"])
            return base.responder(self,200,{"events":events})
        def do_POST(self):
            if urlsplit(self.path).path!="/calls/send":
                return super().do_POST()
            who=self.identidade()
            if who is None:
                return base.responder(self,401,{"erro":"Token invalido"})
            obj=base.ler_json(self,MAX_PAYLOAD+1500)
            if obj is None:
                return base.responder(self,400,{"erro":"JSON invalido"})
            try:
                mid=str(uuid.UUID(obj["id"]))
                cid=str(uuid.UUID(obj["call_id"]))
                kind=obj["kind"]
                payload=obj["payload"]
                raw=json.dumps(payload,ensure_ascii=False,separators=(",",":"))
                if kind not in KINDS or len(raw)>MAX_PAYLOAD or not isinstance(payload,dict):
                    raise ValueError()
            except (KeyError,ValueError,TypeError,AttributeError):
                return base.responder(self,400,{"erro":"Sinal invalido"})
            peer="b" if who=="a" else "a"
            with base.conexao(self.server.db) as db:
                old=db.execute("SELECT sender,call_id,kind,payload FROM call_events WHERE id=?", (mid,)).fetchone()
                if old and (old["sender"],old["call_id"],old["kind"],old["payload"]) != (who,cid,kind,raw):
                    return base.responder(self,409,{"erro":"ID conflitante"})
                db.execute("INSERT OR IGNORE INTO call_events(id,sender,target,call_id,kind,payload,created) VALUES(?,?,?,?,?,?,?)",
                    (mid,who,peer,cid,kind,raw,time.time()))
                # Prazo de retencao de sinalizacao: 30 minutos. Nao guarda audio/video.
                db.execute("DELETE FROM call_events WHERE created<?",(time.time()-1800,))
                db.commit()
            return base.responder(self,200,{"ok":True,"id":mid})

    class CallClient(base.ClientHandler):
        def destinations(self):
            srv=self.server
            if hasattr(srv,"cloud_master"):
                return {"local":srv.local_master, "cloud":srv.cloud_master}
            return {"master":srv.master}

        def call_state(self):
            s=self.server
            with s.lock:
                if not hasattr(s,"call_state"):
                    s.call_state={
                        "cursors":{}, "epochs":{}, "events":[],
                        "seen":set(), "seq":0,
                        "status":{}, "poll_lock":threading.Lock()
                    }
                return s.call_state

        def poll_calls(self):
            state=self.call_state()
            if not state["poll_lock"].acquire(blocking=False):
                return
            try:
                for name,server in self.destinations().items():
                    try:
                        health=base.chamar(server,self.server.token,"/health")
                        epoch=health["epoch"]
                        if state["epochs"].get(name)!=epoch:
                            state["epochs"][name]=epoch
                            state["cursors"][name]=0
                        cursor=state["cursors"].get(name,0)
                        received=base.chamar(server,self.server.token,"/calls/events?after="+str(cursor))["events"]
                        with self.server.lock:
                            for event in received:
                                eid=event["id"]
                                if eid not in state["seen"] and time.time()-event.get("created",0)<180:
                                    state["seq"]+=1
                                    state["events"].append(dict(event,client_seq=state["seq"]))
                                    state["seen"].add(eid)
                                state["cursors"][name]=max(state["cursors"].get(name,0),int(event["seq"]))
                            if len(state["events"])>300:
                                state["events"]=state["events"][-250:]
                                state["seen"]={e["id"] for e in state["events"]}
                            state["status"][name]=True
                    except Exception:
                        with self.server.lock:
                            state["status"][name]=False
            finally:
                state["poll_lock"].release()

        def do_GET(self):
            parts=urlsplit(self.path)
            if parts.path=="/api/calls/events":
                try:
                    after=int(parse_qs(parts.query).get("after",["0"])[0])
                    if after<0:raise ValueError()
                except (ValueError,TypeError):
                    return base.responder(self,400,{"erro":"Cursor invalido"})
                self.poll_calls()
                state=self.call_state()
                with self.server.lock:
                    events=[e for e in state["events"] if e["client_seq"]>after][:100]
                    status=dict(state["status"])
                return base.responder(self,200,{"events":events,"connected":status})
            return super().do_GET()

        def do_POST(self):
            if urlsplit(self.path).path!="/api/calls/send":
                return super().do_POST()
            if not self.check_origin():
                return base.responder(self,403,{"erro":"Origem nao permitida"})
            obj=base.ler_json(self,MAX_PAYLOAD+1500)
            if obj is None:
                return base.responder(self,400,{"erro":"JSON invalido"})
            try:
                cid=str(uuid.UUID(obj["call_id"]))
                kind=obj["kind"]
                payload=obj["payload"]
                if kind not in KINDS or not isinstance(payload,dict) or len(json.dumps(payload))>MAX_PAYLOAD:
                    raise ValueError()
            except (KeyError,ValueError,TypeError,AttributeError):
                return base.responder(self,400,{"erro":"Sinal invalido"})
            data={"id":str(uuid.uuid4()),"call_id":cid,"kind":kind,"payload":payload}
            ok=[]
            for name,url in self.destinations().items():
                try:
                    result=base.chamar(url,self.server.token,"/calls/send",data)
                    if result.get("ok"):
                        ok.append(name)
                except Exception:
                    pass
            return base.responder(self,200 if ok else 503,{
                "ok":bool(ok),"canais":ok,
                **({} if ok else {"erro":"Nenhum mestre de chamadas disponivel"})
            })
    import steiner_web
    import steiner_contatos
    base.MasterHandler=steiner_contatos.wrap_master(steiner_web.wrap_master(CallMaster,base),base)
    base.ClientHandler=CallClient
    base.UI=base.UI.replace("</main><script>",HTML+"</main><script>")
    base.UI=base.UI.replace("</script></body></html>","</script>"+JS+"</body></html>")

HTML=r'''
<style>
.call-controls{padding:11px 20px;display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid #34425a}
.call-controls button{padding:11px 15px;background:#3151a1;color:#fff}
.call-controls button:disabled{opacity:.4;cursor:not-allowed}
.call-card{margin:12px 20px;padding:15px;border:1px solid #486b86;border-radius:13px;background:#122840}
.call-card[hidden]{display:none}
.call-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.call-buttons button{padding:11px 15px}.call-buttons button.red{background:#bd4057;color:white}
.call-videos{display:flex;gap:8px;flex-wrap:wrap;margin:9px 0}
.call-videos video{max-width:100%;width:270px;min-height:145px;background:#0b1526;border-radius:9px}
.call-small{font-size:12px;color:#c5d3ee}
</style>
<section class="call-controls">
<button id="startVoice" type="button">📞 Ligar por voz</button>
<button id="startVideo" type="button">📹 Videochamada</button>
</section>
<section class="call-card" id="callBox" hidden>
<div id="callTitle" aria-live="polite">Chamada</div>
<div class="call-videos" id="videoBox" hidden>
<video id="selfVideo" autoplay muted playsinline></video>
<video id="friendVideo" autoplay playsinline></video>
</div>
<audio id="friendAudio" autoplay></audio>
<div class="call-buttons">
<button id="acceptCall" type="button" hidden>Aceitar</button>
<button id="rejectCall" type="button" class="red" hidden>Recusar</button>
<button id="hangupCall" type="button" class="red">Encerrar</button>
</div>
<p class="call-small" id="callInfo">Chamadas usam WebRTC e internet ou rede local. Sem chip. Acesso ao microfone/camera exige sua permissao.</p>
</section>
'''
JS=r'''<script>
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const title=el('callTitle'),box=el('callBox'),info=el('callInfo');
const yes=el('acceptCall'),no=el('rejectCall'),stop=el('hangupCall');
const a=el('friendAudio'),v=el('friendVideo'),self=el('selfVideo'),videos=el('videoBox');
let pc=null,media=null,callId=null,video=false,incoming=null,after=0,backlog=[],iceReady=false,earlyIce=[];
const ice={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
function show(message){box.hidden=false;title.textContent=message}
function state(active){el('startVoice').disabled=active;el('startVideo').disabled=active}
function incomingButtons(active){yes.hidden=!active;no.hidden=!active;stop.hidden=active}
async function emit(kind,payload={},cid=callId){
 if(!cid)return false;
 const r=await fetch('/api/calls/send',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({call_id:cid,kind,payload})});
 if(!r.ok)throw Error((await r.json()).erro||'Falha no sinal');
 return true;
}
function cleanup(message='Chamada encerrada'){
 if(pc){pc.onicecandidate=null;pc.ontrack=null;pc.onconnectionstatechange=null;pc.close()}
 if(media){media.getTracks().forEach(t=>t.stop())}
 pc=null;media=null;callId=null;incoming=null;backlog=[];earlyIce=[];iceReady=false;
 a.srcObject=null;v.srcObject=null;self.srcObject=null;videos.hidden=true;
 state(false);incomingButtons(false);title.textContent=message;
 info.textContent='Sem chip ou numero. Para chamadas distantes, ambos precisam de internet.';
 setTimeout(()=>{if(!callId)box.hidden=true},4000);
}
function makePeer(){
 pc=new RTCPeerConnection(ice);
 pc.onicecandidate=e=>{
  if(e.candidate&&callId){const c=e.candidate.toJSON();if(iceReady)emit('candidate',{candidate:c}).catch(console.warn);else earlyIce.push(c)}
 };
 pc.ontrack=e=>{
  const stream=e.streams[0]||new MediaStream([e.track]);
  if(video){v.srcObject=stream;v.play().catch(()=>{})}
  else{a.srcObject=stream;a.play().catch(()=>{})}
  show('Em chamada');info.textContent='Chamada em andamento. Encerrar para desligar.';
 };
 pc.onconnectionstatechange=()=>{
  if(!pc)return;
  if(['failed','closed'].includes(pc.connectionState)){
   const c=callId;
   cleanup('Conexao encerrada');
   if(c)emit('hangup',{},c).catch(()=>{});
  }
 };
 media.getTracks().forEach(t=>pc.addTrack(t,media));
}
async function prepare(useVideo){
 iceReady=false;earlyIce=[];video=useVideo;media=await navigator.mediaDevices.getUserMedia({audio:true,video:useVideo});
 videos.hidden=!useVideo;
 if(useVideo){self.srcObject=media;self.play().catch(()=>{})}
 makePeer();
}
async function outgoing(useVideo){
 if(callId||incoming)return;
 callId=crypto.randomUUID();state(true);incomingButtons(false);
 show(useVideo?'Chamando por video...':'Chamando por voz...');
 info.textContent='Aguardando resposta do outro participante...';
 try{
  await prepare(useVideo);
  const offer=await pc.createOffer();
  await pc.setLocalDescription(offer);
  await emit('offer',{sdp:pc.localDescription.sdp,video:useVideo});
  iceReady=true;for(const c of earlyIce.splice(0))emit('candidate',{candidate:c}).catch(console.warn);
 }catch(e){cleanup('Nao foi possivel ligar: '+e.message)}
}
async function accept(){
 if(!incoming)return;
 const evt=incoming;incoming=null;callId=evt.call_id;
 state(true);incomingButtons(false);show('Conectando chamada...');
 try{
  await prepare(Boolean(evt.payload.video));
  await pc.setRemoteDescription({type:'offer',sdp:evt.payload.sdp});
  for(const c of backlog.splice(0)){await pc.addIceCandidate(c)}
  const answer=await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await emit('answer',{sdp:pc.localDescription.sdp});
  iceReady=true;for(const c of earlyIce.splice(0))emit('candidate',{candidate:c}).catch(console.warn);
  show('Conectando ao outro participante...');
 }catch(e){await emit('reject',{}).catch(()=>{});cleanup('Falha: '+e.message)}
}
async function hangup(reject=false){
 const cid=callId||incoming?.call_id;
 if(cid)await emit(reject?'reject':'hangup',{},cid).catch(()=>{});
 cleanup(reject?'Chamada recusada':'Chamada encerrada')
}
async function handle(event){
 const {kind,call_id:id,payload}=event;
 if(kind==='offer'){
  if(callId||incoming){await emit('reject',{},id).catch(()=>{});return}
  if(!payload||typeof payload.sdp!=='string')return;
  incoming=event;callId=null;backlog=[];state(true);
  show(payload.video?'📹 Chamada de video recebida':'📞 Chamada de voz recebida');
  incomingButtons(true);
  info.textContent='Clique Aceitar para permitir acesso ao microfone ou camera.';
  return
 }
 if(id!==(callId||incoming?.call_id))return;
 if(kind==='reject'){cleanup('Chamada recusada');return}
 if(kind==='hangup'){cleanup('O outro participante desligou');return}
 if(kind==='candidate'&&payload?.candidate){
  if(!pc||!pc.remoteDescription){backlog.push(payload.candidate);return}
  await pc.addIceCandidate(payload.candidate).catch(console.warn);
 }
 if(kind==='answer'&&pc&&!pc.remoteDescription){
  await pc.setRemoteDescription({type:'answer',sdp:payload.sdp});
  for(const c of backlog.splice(0)){await pc.addIceCandidate(c).catch(console.warn)}
  show('Conectando chamada...');
 }
}
async function poll(){
 try{
  const r=await fetch('/api/calls/events?after='+after,{cache:'no-store'});
  if(!r.ok)throw Error('Sem sinal');
  const data=await r.json();
  for(const e of data.events){after=Math.max(after,e.client_seq);await handle(e).catch(console.warn)}
 }catch(e){if(callId)info.textContent='Sinalizacao indisponivel. Verifique sua conexao.'}
}
el('startVoice').onclick=()=>outgoing(false);
el('startVideo').onclick=()=>outgoing(true);
yes.onclick=()=>accept();
no.onclick=()=>hangup(true);
stop.onclick=()=>hangup(false);
window.addEventListener('beforeunload',()=>{if(pc)pc.close();if(media)media.getTracks().forEach(t=>t.stop())});
poll();setInterval(poll,1200);
})();
</script>'''
