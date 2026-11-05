"""STEINER CONTATOS 3.0 — cadastros por numero, sem digitar token.
Acoplado ao master existente somente em /contatos. Demais rotas preservadas.
Sem SMS significa numero NAO VERIFICADO. Nao confundir com identidade comprovada.
SQLite da instancia gratuita do Render pode ser apagado em redeploy.
"""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
import uuid
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, parse_qs
from steiner_contatos_ui import PAGE

VERSION="3.0-beta"
PREFIX="/contatos"
COOKIE="steiner_contatos_v3"
SESS_DURATION=14*24*3600
RATE={}
RATE_LOCK=threading.Lock()

def normalize(value):
    if not isinstance(value,str):
        return ""
    num=re.sub(r"\D","",value)
    if len(num) in (10,11):
        num="55"+num
    if not (12<=len(num)<=15):
        return ""
    return num

def password_digest(password,salt):
    return hashlib.scrypt(password.encode("utf-8"),salt=salt,n=2**14,r=8,p=1,dklen=32)

def check_rate(ip,kind,threshold=20):
    key=(ip,kind)
    now=time.time()
    with RATE_LOCK:
        events=[x for x in RATE.get(key,[]) if now-x<300]
        if len(events)>=threshold:
            RATE[key]=events
            return False
        events.append(now)
        RATE[key]=events
        if len(RATE)>10000:
            RATE.clear()
    return True

def add_tables(base,path):
    with base.conexao(path) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS sl3_users(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          salt TEXT NOT NULL,
          passhash TEXT NOT NULL,
          created REAL NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sl3_sessions(
          digest TEXT PRIMARY KEY,uid INTEGER NOT NULL,expires REAL NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sl3_contacts(
          owner INTEGER NOT NULL, phone TEXT NOT NULL, alias TEXT NOT NULL,
          PRIMARY KEY(owner,phone)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sl3_requests(
          sender INTEGER NOT NULL,receiver INTEGER NOT NULL,status TEXT NOT NULL,
          created REAL NOT NULL, PRIMARY KEY(sender,receiver)
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sl3_messages(
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT UNIQUE NOT NULL,sender INTEGER NOT NULL,receiver INTEGER NOT NULL,
          body TEXT NOT NULL,created REAL NOT NULL
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS sl3_calls(
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT UNIQUE NOT NULL,sender INTEGER NOT NULL,receiver INTEGER NOT NULL,
          call_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,created REAL NOT NULL
        )""")
        db.execute("CREATE INDEX IF NOT EXISTS sl3_msgs_users ON sl3_messages(sender,receiver,seq)")
        db.execute("CREATE INDEX IF NOT EXISTS sl3_calls_receiver ON sl3_calls(receiver,seq)")
        db.commit()

def wrap_master(parent,base):
    prepare=base.preparar_master
    def prepare_with_contacts(path):
        prepare(path)
        add_tables(base,path)
    base.preparar_master=prepare_with_contacts

    class ContactsHandler(parent):
        def reply(self,status,payload,cookie=None):
            b=json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type","application/json; charset=utf-8")
            self.send_header("Cache-Control","no-store")
            self.send_header("X-Content-Type-Options","nosniff")
            self.send_header("Referrer-Policy","no-referrer")
            if cookie:
                secure="; Secure" if not self.headers.get("Host","").startswith(("127.0.0.1:","localhost:")) else ""
                self.send_header("Set-Cookie",f"{COOKIE}={cookie}; Path={PREFIX}; HttpOnly; SameSite=Strict{secure}")
            self.send_header("Content-Length",str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def fail(self,status,msg):
            self.reply(status,{"ok":False,"erro":msg})

        def post_object(self,max_size=17000):
            if not self.headers.get("Content-Type","").lower().startswith("application/json"):
                raise ValueError("Content-Type deve ser application/json")
            origin=self.headers.get("Origin","")
            if origin:
                o=urlsplit(origin)
                if o.netloc!=self.headers.get("Host") or o.scheme not in ("http","https"):
                    raise PermissionError("Origem nao autorizada")
            length=int(self.headers.get("Content-Length","0"))
            if not 1<=length<=max_size:
                raise ValueError("Tamanho invalido")
            payload=json.loads(self.rfile.read(length))
            if not isinstance(payload,dict):
                raise ValueError("Objeto JSON esperado")
            return payload

        def auth(self):
            cookie=SimpleCookie()
            try: cookie.load(self.headers.get("Cookie",""))
            except Exception: return None
            item=cookie.get(COOKIE)
            if item is None: return None
            token=item.value
            if len(token)>128 or len(token)<32:
                return None
            digest=hashlib.sha256(token.encode("utf-8")).hexdigest()
            with base.conexao(self.server.db) as db:
                row=db.execute(
                    "SELECT u.id,u.phone,u.name FROM sl3_sessions s JOIN sl3_users u ON u.id=s.uid "
                    "WHERE s.digest=? AND s.expires>?",(digest,time.time())
                ).fetchone()
                return dict(row) if row else None

        def peer(self,db,phone):
            if not (phone:=normalize(phone)):
                return None
            return db.execute("SELECT id,phone,name FROM sl3_users WHERE phone=?",(phone,)).fetchone()

        def linked(self,db,uid,other):
            row=db.execute(
                "SELECT 1 FROM sl3_requests WHERE status='accepted' AND "
                "((sender=? AND receiver=?) OR (sender=? AND receiver=?)) LIMIT 1",
                (uid,other,other,uid)
            ).fetchone()
            return bool(row)

        def contacts_state(self,me):
            with base.conexao(self.server.db) as db:
                entries=db.execute(
                    "SELECT c.phone,c.alias,u.id AS peer_id,u.name AS public_name "
                    "FROM sl3_contacts c LEFT JOIN sl3_users u ON u.phone=c.phone "
                    "WHERE c.owner=? ORDER BY c.alias COLLATE NOCASE LIMIT 1000",
                    (me["id"],)
                ).fetchall()
                people=[]
                for e in entries:
                    status="nao_cadastrado"
                    if e["peer_id"] is not None:
                        status="conectado" if self.linked(db,me["id"],e["peer_id"]) else "aguardando"
                    people.append({"phone":e["phone"],"alias":e["alias"],"status":status})
                pending=db.execute(
                    "SELECT u.phone,u.name FROM sl3_requests r JOIN sl3_users u ON u.id=r.sender "
                    "WHERE r.receiver=? AND r.status='pending' ORDER BY r.created DESC LIMIT 100",
                    (me["id"],)
                ).fetchall()
            return {"ok":True,"me":{"phone":me["phone"],"name":me["name"],"verified":False},
                    "contacts":people,"requests":[dict(x) for x in pending]}

        def web_do_get(self,path,parts):
            if path in (PREFIX,PREFIX+"/",PREFIX+"/index.html"):
                b=PAGE.encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type","text/html; charset=utf-8")
                self.send_header("Cache-Control","no-store")
                self.send_header("X-Content-Type-Options","nosniff")
                self.send_header("Referrer-Policy","no-referrer")
                self.send_header("X-Frame-Options","DENY")
                self.send_header("Content-Security-Policy","frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
                self.send_header("Content-Length",str(len(b)))
                self.end_headers();self.wfile.write(b);return
            if path==PREFIX+"/api/ping":
                return self.reply(200,{"ok":True,"version":VERSION,"number_verified":False})
            me=self.auth()
            if not me:
                return self.fail(401,"Entre para acessar seus contatos")
            if path==PREFIX+"/api/me":
                return self.reply(200,self.contacts_state(me))
            if path==PREFIX+"/api/messages":
                q=parse_qs(parts.query)
                p=self.parse_peer(q.get("phone",[""])[0],me)
                if p is None:return self.fail(403,"Contato precisa aceitar o convite")
                try:
                    after=max(0,int(q.get("after",["0"])[0]))
                except ValueError:return self.fail(400,"Cursor invalido")
                with base.conexao(self.server.db) as db:
                    rows=db.execute(
                        "SELECT seq,id,sender,body,created FROM sl3_messages "
                        "WHERE seq>? AND ((sender=? AND receiver=?) OR (sender=? AND receiver=?)) "
                        "ORDER BY seq LIMIT 100",
                        (after,me["id"],p["id"],p["id"],me["id"])
                    ).fetchall()
                return self.reply(200,{"ok":True,"messages":[
                    {"seq":x["seq"],"id":x["id"],"mine":x["sender"]==me["id"],
                     "text":x["body"],"created":x["created"]} for x in rows]})
            if path==PREFIX+"/api/calls":
                q=parse_qs(parts.query)
                try:after=max(0,int(q.get("after",["0"])[0]))
                except ValueError:return self.fail(400,"Cursor invalido")
                with base.conexao(self.server.db) as db:
                    rows=db.execute(
                        "SELECT e.seq,e.id,u.phone AS phone,e.call_id,e.kind,e.payload,e.created "
                        "FROM sl3_calls e JOIN sl3_users u ON u.id=e.sender "
                        "WHERE e.receiver=? AND e.seq>? AND e.created>? ORDER BY e.seq LIMIT 80",
                        (me["id"],after,time.time()-120)
                    ).fetchall()
                return self.reply(200,{"ok":True,"events":[
                    {**dict(x),"payload":json.loads(x["payload"])} for x in rows]})
            return self.fail(404,"Rota nao encontrada")

        def parse_peer(self,phone,me):
            with base.conexao(self.server.db) as db:
                p=self.peer(db,phone)
                if not p:return None
                if not self.linked(db,me["id"],p["id"]):
                    return None
                return dict(p)

        def web_do_post(self,path):
            ip=self.client_address[0]
            try: obj=self.post_object()
            except PermissionError as e:return self.fail(403,str(e))
            except Exception:return self.fail(400,"JSON invalido")
            if path==PREFIX+"/api/register":
                if not check_rate(ip,"register",10):
                    return self.fail(429,"Muitas tentativas. Tente mais tarde")
                phone=normalize(obj.get("phone"))
                pwd=obj.get("password")
                name=obj.get("name")
                if not phone or not isinstance(pwd,str) or not 10<=len(pwd)<=128 or not isinstance(name,str) or not 2<=len(name.strip())<=48:
                    return self.fail(400,"Informe numero valido, nome e senha de 10 a 128 caracteres")
                salt=secrets.token_bytes(16)
                digest=password_digest(pwd,salt).hex()
                with base.conexao(self.server.db) as db:
                    try:
                        db.execute("INSERT INTO sl3_users(phone,name,salt,passhash,created) VALUES(?,?,?,?,?)",
                                   (phone,name.strip(),salt.hex(),digest,time.time()))
                        uid=db.execute("SELECT last_insert_rowid()").fetchone()[0]
                        # Ativa convites ja adicionados por outros contatos
                        for row in db.execute(
                            "SELECT DISTINCT owner FROM sl3_contacts WHERE phone=? AND owner<>?",(phone,uid)
                        ).fetchall():
                            db.execute(
                                "INSERT OR IGNORE INTO sl3_requests(sender,receiver,status,created) VALUES(?,?,?,?)",
                                (row["owner"],uid,"pending",time.time()))
                        db.commit()
                    except sqlite3.IntegrityError:
                        return self.fail(409,"Numero ja cadastrado. Use Entrar")
                return self.create_session(uid,phone,name.strip())
            if path==PREFIX+"/api/login":
                if not check_rate(ip,"login",20):
                    return self.fail(429,"Muitas tentativas. Tente mais tarde")
                phone=normalize(obj.get("phone"))
                pwd=obj.get("password")
                if not phone or not isinstance(pwd,str) or not 1<=len(pwd)<=128:
                    return self.fail(400,"Numero e senha obrigatorios")
                with base.conexao(self.server.db) as db:
                    row=db.execute(
                        "SELECT id,phone,name,salt,passhash FROM sl3_users WHERE phone=?", (phone,)
                    ).fetchone()
                # Executa mesmo quando numero nao cadastrado, reduzindo enumeracao
                salt=bytes.fromhex(row["salt"]) if row else b"\x00"*16
                expected=row["passhash"] if row else "0"*64
                try:result=password_digest(pwd,salt).hex()
                except Exception:return self.fail(400,"Senha invalida")
                if not hmac.compare_digest(result,expected) or not row:
                    return self.fail(401,"Numero ou senha incorretos")
                return self.create_session(row["id"],row["phone"],row["name"])
            me=self.auth()
            if not me:return self.fail(401,"Sessao expirada. Entre novamente")
            if path==PREFIX+"/api/logout":
                cookie=SimpleCookie()
                try:cookie.load(self.headers.get("Cookie",""))
                except Exception:pass
                if COOKIE in cookie:
                    digest=hashlib.sha256(cookie[COOKIE].value.encode()).hexdigest()
                    with base.conexao(self.server.db) as db:
                        db.execute("DELETE FROM sl3_sessions WHERE digest=?",(digest,));db.commit()
                return self.reply(200,{"ok":True},cookie="invalid; Max-Age=0")
            if path==PREFIX+"/api/add":
                phone=normalize(obj.get("phone"))
                alias=obj.get("alias","")
                if not phone or phone==me["phone"] or not isinstance(alias,str) or not 1<=len(alias.strip())<=48:
                    return self.fail(400,"Informe numero e nome do contato")
                with base.conexao(self.server.db) as db:
                    db.execute(
                        "INSERT INTO sl3_contacts(owner,phone,alias) VALUES(?,?,?) "
                        "ON CONFLICT(owner,phone) DO UPDATE SET alias=excluded.alias",
                        (me["id"],phone,alias.strip())
                    )
                    target=self.peer(db,phone)
                    if target:
                        db.execute(
                            "INSERT OR IGNORE INTO sl3_requests(sender,receiver,status,created) VALUES(?,?,?,?)",
                            (me["id"],target["id"],"pending",time.time())
                        )
                    db.commit()
                return self.reply(200,{"ok":True,"status":"convite_enviado" if target else "aguardando_cadastro"})
            if path==PREFIX+"/api/accept":
                phone=normalize(obj.get("phone"))
                with base.conexao(self.server.db) as db:
                    target=self.peer(db,phone)
                    if not target:return self.fail(404,"Contato inexistente")
                    row=db.execute(
                        "SELECT status FROM sl3_requests WHERE sender=? AND receiver=?",
                        (target["id"],me["id"])
                    ).fetchone()
                    if not row or row["status"]!="pending":
                        return self.fail(404,"Convite nao encontrado")
                    db.execute(
                        "UPDATE sl3_requests SET status='accepted' WHERE sender=? AND receiver=?",
                        (target["id"],me["id"])
                    )
                    db.execute(
                        "INSERT OR IGNORE INTO sl3_contacts(owner,phone,alias) VALUES(?,?,?)",
                        (me["id"],target["phone"],target["name"])
                    )
                    db.commit()
                return self.reply(200,{"ok":True})
            if path==PREFIX+"/api/send":
                phone=obj.get("phone")
                body=obj.get("text")
                mid=obj.get("id")
                if not isinstance(body,str) or not 1<=len(body.strip())<=3000:
                    return self.fail(400,"Mensagem de 1 a 3000 caracteres")
                try:mid=str(uuid.UUID(mid))
                except Exception:return self.fail(400,"ID de mensagem invalido")
                p=self.parse_peer(phone,me)
                if not p:return self.fail(403,"Contato precisa aceitar o convite")
                with base.conexao(self.server.db) as db:
                    try:
                        db.execute("INSERT INTO sl3_messages(id,sender,receiver,body,created) VALUES(?,?,?,?,?)",
                                   (mid,me["id"],p["id"],body.strip(),time.time()))
                        db.commit()
                    except sqlite3.IntegrityError:
                        row=db.execute("SELECT sender,receiver,body FROM sl3_messages WHERE id=?",(mid,)).fetchone()
                        if not row or row["sender"]!=me["id"] or row["receiver"]!=p["id"] or row["body"]!=body.strip():
                            return self.fail(409,"ID ja utilizado")
                return self.reply(200,{"ok":True,"id":mid})
            if path==PREFIX+"/api/call":
                phone=obj.get("phone")
                kind=obj.get("kind")
                payload=obj.get("payload")
                mid=obj.get("id")
                cid=obj.get("call_id")
                try:
                    mid=str(uuid.UUID(mid));cid=str(uuid.UUID(cid))
                    if kind not in ("offer","answer","candidate","hangup","reject") or not isinstance(payload,dict):
                        raise ValueError()
                    raw=json.dumps(payload,ensure_ascii=False,separators=(",",":"))
                    if len(raw)>12500:raise ValueError()
                except Exception:return self.fail(400,"Sinal invalido")
                p=self.parse_peer(phone,me)
                if not p:return self.fail(403,"Contato nao autorizado")
                with base.conexao(self.server.db) as db:
                    try:
                        db.execute(
                            "INSERT INTO sl3_calls(id,sender,receiver,call_id,kind,payload,created) "
                            "VALUES(?,?,?,?,?,?,?)",
                            (mid,me["id"],p["id"],cid,kind,raw,time.time())
                        )
                        db.execute("DELETE FROM sl3_calls WHERE created<?",(time.time()-1800,))
                        db.commit()
                    except sqlite3.IntegrityError:
                        return self.fail(409,"Sinal duplicado")
                return self.reply(200,{"ok":True,"id":mid})
            return self.fail(404,"Rota nao encontrada")

        def create_session(self,uid,phone,name):
            tok=secrets.token_urlsafe(36)
            dg=hashlib.sha256(tok.encode()).hexdigest()
            with base.conexao(self.server.db) as db:
                db.execute(
                    "INSERT INTO sl3_sessions(digest,uid,expires) VALUES(?,?,?)",
                    (dg,uid,time.time()+SESS_DURATION)
                )
                db.commit()
            return self.reply(200,{"ok":True,"me":{"phone":phone,"name":name,"verified":False}},
                              cookie=tok+"; Max-Age="+str(SESS_DURATION))

        def do_GET(self):
            parts=urlsplit(self.path)
            if parts.path==PREFIX or parts.path.startswith(PREFIX+"/"):
                return self.web_do_get(parts.path,parts)
            return super().do_GET()
        def do_POST(self):
            parts=urlsplit(self.path)
            if parts.path.startswith(PREFIX+"/"):
                return self.web_do_post(parts.path)
            return super().do_POST()

    return ContactsHandler
