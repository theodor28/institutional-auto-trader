# -*- coding: utf-8 -*-
"""STEINER CONVERSA - private two-person web messenger, demo.
Python standard library, HTTPS behind Render. No WhatsApp integration or E2EE.
Secrets MUST be set via environment; never commit them.
"""
from __future__ import annotations
import os,re,json,sqlite3,threading,time,base64,binascii,hmac,secrets
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs
from contextlib import contextmanager

ROOT=Path(__file__).resolve().parent
DATADIR=Path(os.environ.get("STEINER_CHAT_DATA",str(ROOT/"dados")))
DB=DATADIR/"conversa.sqlite3"
HOST=os.environ.get("HOST","127.0.0.1")
PORT=int(os.environ.get("PORT","5314"))
LOCK=threading.RLock()
MAX_POST=1800000
MAX_FILE=1000000
MAX_MSG=4000
ALLOWED={"image/jpeg","image/png","image/webp","audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/wav"}
STATIC={"":("index.html","text/html; charset=utf-8"),"/":("index.html","text/html; charset=utf-8"),"/app.js":("app.js","text/javascript; charset=utf-8"),"/style.css":("style.css","text/css; charset=utf-8"),"/manifest.json":("manifest.json","application/manifest+json")}
def milliseconds():return int(time.time()*1000)
def verify_config():
 owner=os.getenv("CHAT_OWNER_TOKEN","")
 guest=os.getenv("CHAT_GUEST_TOKEN","")
 if len(owner)<32 or len(guest)<32 or hmac.compare_digest(owner,guest):
  raise RuntimeError("CHAT_OWNER_TOKEN e CHAT_GUEST_TOKEN distintos e longos sao obrigatorios")
def role_for(header):
 if not header or not header.startswith("Bearer "):return None
 token=header[7:]
 if len(token)>256:return None
 for role,key in (("owner","CHAT_OWNER_TOKEN"),("guest","CHAT_GUEST_TOKEN")):
  env=os.environ.get(key,"")
  if env and hmac.compare_digest(token,env):return role
 return None
def other(role):return "guest" if role=="owner" else "owner"
@contextmanager
def db():
 DATADIR.mkdir(parents=True,exist_ok=True)
 conn=sqlite3.connect(DB,timeout=15)
 conn.row_factory=sqlite3.Row
 conn.execute("PRAGMA busy_timeout=15000")
 try:
  yield conn
  conn.commit()
 except Exception:conn.rollback();raise
 finally:conn.close()
def init():
 with LOCK,db() as c:
  c.execute("PRAGMA journal_mode=WAL")
  c.executescript("""
   CREATE TABLE IF NOT EXISTS messages(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN('owner','guest')),
    kind TEXT NOT NULL CHECK(kind IN('text','image','audio')),
    body TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    blob BLOB,
    created INTEGER NOT NULL,
    read_at INTEGER);
   CREATE TABLE IF NOT EXISTS presence(
    role TEXT PRIMARY KEY, last_seen INTEGER NOT NULL, typing INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS signals(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,target TEXT NOT NULL,
    type TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS ix_msg_created ON messages(created);
   CREATE INDEX IF NOT EXISTS ix_signal_target ON signals(target,id);
  """)
def touch(role,typing=None):
 now=milliseconds()
 with db() as c:
  if typing is None:
   c.execute("INSERT INTO presence(role,last_seen,typing) VALUES(?,?,0) ON CONFLICT(role) DO UPDATE SET last_seen=excluded.last_seen",(role,now))
  else:
   c.execute("INSERT INTO presence(role,last_seen,typing) VALUES(?,?,?) ON CONFLICT(role) DO UPDATE SET last_seen=excluded.last_seen,typing=excluded.typing",(role,now,int(typing)))
def peer_status(role):
 with db() as c:
  row=c.execute("SELECT last_seen,typing FROM presence WHERE role=?",(other(role),)).fetchone()
 if not row:return {"online":False,"typing":False}
 online=milliseconds()-row["last_seen"]<22000
 return {"online":online,"typing":bool(row["typing"]) and online}
def msg_data(r):
 return {"id":r["id"],"from":r["role"],"kind":r["kind"],"text":r["body"],
         "mime":r["mime"],"file_id":r["id"] if r["blob"] is not None else None,
         "created":r["created"],"read_at":r["read_at"]}
class Handler(BaseHTTPRequestHandler):
 server_version="SteinerConversa/1.0"
 def log_message(self,*args):pass
 def security_headers(self):
  self.send_header("Cache-Control","no-store")
  self.send_header("X-Content-Type-Options","nosniff")
  self.send_header("Referrer-Policy","no-referrer")
  self.send_header("X-Frame-Options","DENY")
  self.send_header("Permissions-Policy","camera=(self), microphone=(self), geolocation=()")
  self.send_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
 def send_bytes(self,status,data,mime):
  self.send_response(status);self.send_header("Content-Type",mime)
  self.security_headers();self.send_header("Content-Length",str(len(data)));self.end_headers()
  try:self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError):pass
 def send_json(self,status,value):
  self.send_bytes(status,json.dumps(value,ensure_ascii=False,separators=(",",":")).encode("utf-8"),"application/json; charset=utf-8")
 def auth(self):
  role=role_for(self.headers.get("Authorization",""))
  if not role:self.send_json(401,{"error":"Acesso privado. Abra seu convite individual."})
  return role
 def body(self):
  try:
   size=int(self.headers.get("Content-Length","-1"))
   if size<2 or size>MAX_POST:raise ValueError("Conteúdo vazio ou acima do limite")
   if self.headers.get("Content-Type","").split(";")[0]!="application/json":raise ValueError("Formato inválido")
   data=self.rfile.read(size)
   obj=json.loads(data)
   if not isinstance(obj,dict):raise ValueError("Objeto JSON esperado")
   return obj
  except (ValueError,json.JSONDecodeError) as e:raise ValueError(str(e)[:100])
 def do_GET(self):
  route=urlsplit(self.path).path
  if route in STATIC:
   path=ROOT/STATIC[route][0]
   try:return self.send_bytes(200,path.read_bytes(),STATIC[route][1])
   except OSError:return self.send_json(404,{"error":"Arquivo indisponível"})
  if route=="/api/health":return self.send_json(200,{"ok":True,"app":"STEINER CONVERSA","storage":"ephemeral-demo"})
  role=self.auth()
  if not role:return
  try:
   if route=="/api/me":
    touch(role)
    return self.send_json(200,{"role":role,"name":"Você" if role=="owner" else "Convidada","peer":peer_status(role),"features":["text","image","audio","video-call-beta"]})
   if route=="/api/poll":
    q=parse_qs(urlsplit(self.path).query)
    after=int(q.get("after",["0"])[0]);after=max(0,min(after,2000000000))
    touch(role)
    with db() as c:
     if after==0:
      msgs=c.execute("SELECT * FROM (SELECT * FROM messages ORDER BY id DESC LIMIT 150) q ORDER BY id").fetchall()
     else:
      msgs=c.execute("SELECT * FROM messages WHERE id>? ORDER BY id LIMIT 150",(after,)).fetchall()
     receipts=c.execute("SELECT id,read_at FROM messages WHERE role=? AND read_at IS NOT NULL ORDER BY id DESC LIMIT 150",(role,)).fetchall()
    return self.send_json(200,{"messages":[msg_data(row) for row in msgs],"peer":peer_status(role),"receipts":[dict(r) for r in receipts],"now":milliseconds()})
   if route.startswith("/api/file/"):
    try:mid=int(route.rsplit("/",1)[-1])
    except ValueError:return self.send_json(404,{"error":"Arquivo inválido"})
    touch(role)
    with db() as c:r=c.execute("SELECT mime,blob FROM messages WHERE id=? AND kind IN('image','audio')",(mid,)).fetchone()
    if not r or r["blob"] is None:return self.send_json(404,{"error":"Arquivo não encontrado"})
    return self.send_bytes(200,r["blob"],r["mime"])
   if route=="/api/signals":
    q=parse_qs(urlsplit(self.path).query);after=max(0,int(q.get("after",["0"])[0]))
    after=min(after,2000000000);touch(role)
    with db() as c:
     a=c.execute("SELECT id,source,type,payload,created FROM signals WHERE target=? AND id>? ORDER BY id LIMIT 120",(role,after)).fetchall()
    return self.send_json(200,{"signals":[{"id":x["id"],"from":x["source"],"type":x["type"],"payload":json.loads(x["payload"]),"created":x["created"]} for x in a]})
   return self.send_json(404,{"error":"Rota inexistente"})
  except (ValueError,OverflowError):
   return self.send_json(400,{"error":"Parâmetro inválido"})
  except Exception:
   return self.send_json(500,{"error":"Erro interno; tente novamente"})
 def do_POST(self):
  route=urlsplit(self.path).path
  role=self.auth()
  if not role:return
  origin=self.headers.get("Origin","")
  host=self.headers.get("Host","")
  if origin and origin not in {"https://"+host,"http://"+host}:
   return self.send_json(403,{"error":"Origem não autorizada"})
  try:
   data=self.body()
   if route=="/api/send":
    kind=data.get("kind","text")
    if kind not in ("text","image","audio"):raise ValueError("Tipo inválido")
    body=data.get("text","")
    if not isinstance(body,str) or len(body)>MAX_MSG:raise ValueError("Mensagem muito grande")
    body=body.strip()
    mime="";blob=None
    if kind=="text":
     if not body:raise ValueError("Escreva uma mensagem")
    else:
     mime=data.get("mime","")
     if mime not in ALLOWED:raise ValueError("Tipo de arquivo não permitido")
     raw=data.get("data","")
     if not isinstance(raw,str) or len(raw)>1390000:raise ValueError("Arquivo muito grande")
     try:blob=base64.b64decode(raw,validate=True)
     except (binascii.Error,ValueError):raise ValueError("Arquivo inválido")
     if len(blob)<32 or len(blob)>MAX_FILE:raise ValueError("Arquivo deve ter no máximo 1 MB")
     if mime=="image/jpeg" and not blob.startswith(b"\xff\xd8\xff"):raise ValueError("JPEG inválido")
     if mime=="image/png" and not blob.startswith(b"\x89PNG\r\n\x1a\n"):raise ValueError("PNG inválido")
     if mime=="image/webp" and not (blob[:4]==b"RIFF" and blob[8:12]==b"WEBP"):raise ValueError("WebP inválido")
     if mime=="audio/webm" and not blob.startswith(b"\x1aE\xdf\xa3"):raise ValueError("WebM inválido")
     if mime=="audio/ogg" and not blob.startswith(b"OggS"):raise ValueError("OGG inválido")
     if mime=="audio/mp4" and blob[4:8]!=b"ftyp":raise ValueError("M4A inválido")
     if mime=="audio/wav" and not(blob[:4]==b"RIFF" and blob[8:12]==b"WAVE"):raise ValueError("WAV inválido")
     if mime=="audio/mpeg" and not(blob.startswith(b"ID3") or blob[0]==255):raise ValueError("MP3 inválido")
    with db() as c:
     count=c.execute("SELECT count(*) FROM messages WHERE role=? AND created>?",(role,milliseconds()-30000)).fetchone()[0]
     if count>=25:return self.send_json(429,{"error":"Muitas mensagens. Aguarde um pouco."})
     cur=c.execute("INSERT INTO messages(role,kind,body,mime,blob,created) VALUES(?,?,?,?,?,?)",
                   (role,kind,body,mime,blob,milliseconds()))
     mid=cur.lastrowid
    touch(role,False)
    return self.send_json(201,{"ok":True,"id":mid})
   if route=="/api/read":
    mid=int(data.get("last_id",0))
    with db() as c:
     c.execute("UPDATE messages SET read_at=? WHERE role=? AND id<=? AND read_at IS NULL",(milliseconds(),other(role),max(0,mid)))
    touch(role)
    return self.send_json(200,{"ok":True})
   if route=="/api/typing":
    touch(role,bool(data.get("typing",False)))
    return self.send_json(200,{"ok":True})
   if route=="/api/signal":
    ty=data.get("type","")
    if ty not in ("offer","answer","candidate","hangup","reject"):raise ValueError("Sinal desconhecido")
    payload=data.get("payload",{})
    if not isinstance(payload,dict):raise ValueError("Sinal inválido")
    serialized=json.dumps(payload,separators=(",",":"))
    if len(serialized)>9000:raise ValueError("Sinal acima do limite")
    with db() as c:
     c.execute("DELETE FROM signals WHERE created<?",(milliseconds()-86400000,))
     count=c.execute("SELECT count(*) FROM signals WHERE source=? AND created>?",(role,milliseconds()-60000)).fetchone()[0]
     if count>=250:return self.send_json(429,{"error":"Sinais em excesso"})
     cur=c.execute("INSERT INTO signals(source,target,type,payload,created) VALUES(?,?,?,?,?)",
                   (role,other(role),ty,serialized,milliseconds()))
     mid=cur.lastrowid
    touch(role)
    return self.send_json(201,{"ok":True,"id":mid})
   return self.send_json(404,{"error":"Rota inexistente"})
  except (ValueError,OverflowError) as e:return self.send_json(400,{"error":str(e)[:140]})
  except Exception:return self.send_json(500,{"error":"Erro interno; tente novamente"})
def run():
 verify_config();init()
 # Prova real de dois clientes via HTTP local, usando banco temporario.
 import subprocess,sys
 proc=subprocess.run([sys.executable,str(ROOT/"teste_chat.py")],capture_output=True,text=True,timeout=45)
 print("STEINER_CHAT_TESTS_EXIT="+str(proc.returncode),flush=True)
 print((proc.stderr or proc.stdout)[-2600:],flush=True)
 if proc.returncode!=0:
  raise RuntimeError("Testes HTTP de chat falharam; nao iniciar a aplicacao")
 print("STEINER_CHAT_TESTS_PASS=23",flush=True)
 print(f"STEINER_CONVERSA_ONLINE={HOST}:{PORT}",flush=True)
 with ThreadingHTTPServer((HOST,PORT),Handler) as http:http.serve_forever(poll_interval=.3)
if __name__=="__main__":run()
