# STEINER LINK - MVP local verificavel / Python 3, apenas biblioteca padrao.
# Nao cria conectividade fisica. Master/clients usam rede que ja exista.
import argparse
from contextlib import contextmanager
import hmac
import json
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from urllib.request import Request, urlopen

def agora():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

@contextmanager
def conexao(path):
    c = sqlite3.connect(str(path), timeout=8)
    try:
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA busy_timeout=8000")
        c.execute("PRAGMA journal_mode=WAL")
        yield c
    finally:
        c.close()

def preparar_master(path):
    with conexao(path) as db:
        db.execute("CREATE TABLE IF NOT EXISTS mensagens (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, origem TEXT NOT NULL, destino TEXT NOT NULL, corpo TEXT NOT NULL, criado TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS recibos (seq INTEGER PRIMARY KEY AUTOINCREMENT, msg_id TEXT UNIQUE NOT NULL, origem TEXT NOT NULL, criado TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)")
        db.execute("INSERT OR IGNORE INTO meta(chave,valor) VALUES('epoch',?)", (str(uuid.uuid4()),))
        db.commit()

def preparar_cliente(path):
    with conexao(path) as db:
        db.execute("CREATE TABLE IF NOT EXISTS mensagens (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, direcao TEXT NOT NULL, corpo TEXT NOT NULL, criado TEXT NOT NULL, estado TEXT NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)")
        db.commit()

def responder(handler, codigo, dados):
    b = json.dumps(dados, ensure_ascii=False).encode("utf-8")
    handler.send_response(codigo)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(b)))
    handler.end_headers()
    handler.wfile.write(b)

def ler_json(handler, limite=16000):
    try:
        n = int(handler.headers.get("Content-Length", "0"))
        if n <= 0 or n > limite:
            raise ValueError("Tamanho invalido")
        obj = json.loads(handler.rfile.read(n))
        if not isinstance(obj, dict):
            raise ValueError("Objeto JSON esperado")
        return obj
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None

class BaseHandler(BaseHTTPRequestHandler):
    server_version = "SteinerLink/1.0"
    def log_message(self, fmt, *args):
        return
    def encerramento(self):
        if not hmac.compare_digest(self.headers.get("X-Steiner-Stop", ""), self.server.stop_token):
            return responder(self, 403, {"erro": "Nao autorizado"})
        responder(self, 200, {"ok": True, "parando": True})
        threading.Thread(target=self.server.shutdown, daemon=True).start()

class MasterHandler(BaseHandler):
    def identidade(self):
        recebido = self.headers.get("X-Steiner-Token", "")
        for nome, token in self.server.tokens.items():
            if hmac.compare_digest(token, recebido):
                return nome
        return None

    def do_GET(self):
        rota = urlsplit(self.path)
        if rota.path == "/health":
            return responder(self, 200, {"ok": True, "servico": "master", "epoch": self.server.epoch})
        identidade = self.identidade()
        if not identidade:
            return responder(self, 401, {"erro": "Token invalido"})
        q = parse_qs(rota.query)
        after = q.get("after", ["0"])[0]
        try:
            after = max(0, int(after))
        except ValueError:
            return responder(self, 400, {"erro": "Cursor invalido"})
        with conexao(self.server.db) as db:
            if rota.path == "/pull":
                linhas = db.execute("SELECT seq,id,origem,corpo,criado FROM mensagens WHERE destino=? AND seq>? ORDER BY seq LIMIT 100", (identidade, after)).fetchall()
                return responder(self, 200, {"mensagens": [dict(x) for x in linhas]})
            if rota.path == "/status":
                linhas = db.execute("SELECT seq,msg_id FROM recibos WHERE origem=? AND seq>? ORDER BY seq LIMIT 100", (identidade, after)).fetchall()
                return responder(self, 200, {"recibos": [dict(x) for x in linhas]})
        return responder(self, 404, {"erro": "Rota inexistente"})

    def do_POST(self):
        rota = urlsplit(self.path).path
        if rota == "/stop":
            return self.encerramento()
        identidade = self.identidade()
        if not identidade:
            return responder(self, 401, {"erro": "Token invalido"})
        obj = ler_json(self)
        if obj is None:
            return responder(self, 400, {"erro": "JSON invalido"})
        if rota == "/push":
            mid, corpo = obj.get("id"), obj.get("corpo")
            if not isinstance(mid, str) or not isinstance(corpo, str) or not (1 <= len(corpo) <= 2000):
                return responder(self, 400, {"erro": "Mensagem invalida"})
            try:
                uuid.UUID(mid)
            except (ValueError, AttributeError):
                return responder(self, 400, {"erro": "ID invalido"})
            destino = "b" if identidade == "a" else "a"
            with conexao(self.server.db) as db:
                antiga = db.execute("SELECT origem,corpo FROM mensagens WHERE id=?", (mid,)).fetchone()
                if antiga and (antiga["origem"] != identidade or antiga["corpo"] != corpo):
                    return responder(self, 409, {"erro": "ID em conflito"})
                db.execute("INSERT OR IGNORE INTO mensagens(id,origem,destino,corpo,criado) VALUES(?,?,?,?,?)", (mid, identidade, destino, corpo, agora()))
                db.commit()
            return responder(self, 200, {"ok": True, "id": mid})
        if rota == "/ack":
            ids = obj.get("ids")
            if not isinstance(ids, list) or len(ids) > 100 or not all(isinstance(x, str) and len(x) <= 50 for x in ids):
                return responder(self, 400, {"erro": "Recibos invalidos"})
            with conexao(self.server.db) as db:
                for mid in ids:
                    row = db.execute("SELECT origem FROM mensagens WHERE id=? AND destino=?", (mid, identidade)).fetchone()
                    if row:
                        db.execute("INSERT OR IGNORE INTO recibos(msg_id,origem,criado) VALUES(?,?,?)", (mid, row["origem"], agora()))
                db.commit()
            return responder(self, 200, {"ok": True})
        return responder(self, 404, {"erro": "Rota inexistente"})

UI = r'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>STEINER LINK</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:system-ui,Segoe UI,sans-serif;background:#080f20;color:#eaf2ff}
main{max-width:780px;margin:25px auto;background:#131d32;border:1px solid #34425a;border-radius:20px;overflow:hidden;box-shadow:0 20px 70px #0005}
header{padding:22px;background:#192740;border-bottom:1px solid #34425a;display:flex;justify-content:space-between;gap:15px;align-items:center}
h1{font-size:23px;margin:0;letter-spacing:.5px}.sub{color:#a8b7d0;font-size:13px;margin-top:7px}
#status{font-size:13px;border-radius:20px;padding:8px 12px;background:#3b2931;color:#ffd2cc}
#status.on{background:#173c32;color:#8ef0bf}
#messages{height:55vh;min-height:310px;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:12px}
.msg{max-width:83%;padding:12px 15px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;background:#27354d;align-self:flex-start}
.msg.me{background:#115c4c;align-self:flex-end}.meta{color:#becce0;font-size:11px;margin-top:7px}
form{padding:16px 20px;border-top:1px solid #34425a;display:flex;gap:12px}input{flex:1;min-width:0;border:1px solid #51627e;border-radius:12px;background:#0b1425;color:white;padding:14px;font:inherit}
button{background:#34bf94;color:#061d15;border:0;border-radius:12px;padding:0 24px;font-weight:700;cursor:pointer}
footer{font-size:12px;color:#96a9c6;padding:0 20px 18px}.hint{font-size:13px;color:#9caec8;text-align:center;margin:auto}
@media(max-width:500px){main{margin:0;border-radius:0;min-height:100vh}header{padding:17px}button{padding:0 13px}}
</style></head><body><main><header><div><h1>STEINER LINK</h1><div class="sub">Cliente __NAME__ · Chat local com entrega automatica</div></div><span id="status">Verificando...</span></header>
<section id="messages"><div class="hint">Carregando mensagens...</div></section>
<form id="form"><input id="body" autofocus maxlength="2000" autocomplete="off" placeholder="Escreva sua mensagem..." required><button>Enviar</button></form>
<footer id="info">O chat funciona offline. Mensagens ficam pendentes ate existir uma conexao com o mestre.</footer>
</main><script>
const box=document.getElementById('messages'),status=document.getElementById('status'),info=document.getElementById('info');
let signature='';
async function refresh(){
 try{
   const response=await Promise.all([fetch('/api/messages'),fetch('/api/status')]);
   if(!response[0].ok||!response[1].ok)throw Error('Falha local');
   const ms=await response[0].json(),st=await response[1].json();
   const sig=JSON.stringify(ms.mensagens);
   if(sig!==signature){let nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<100;signature=sig;box.replaceChildren();
     if(!ms.mensagens.length){const e=document.createElement('div');e.className='hint';e.textContent='Comece uma conversa. As mensagens ficam salvas neste PC.';box.append(e);}
     for(const m of ms.mensagens){const d=document.createElement('div');d.className='msg'+(m.direcao==='enviada'?' me':'');
       const t=document.createElement('div');t.textContent=m.corpo;d.append(t);
       const x=document.createElement('div');x.className='meta';x.textContent=(m.direcao==='enviada'?'Voce':'Outro computador')+' · '+m.estado;d.append(x);box.append(d)}
     if(nearBottom)box.scrollTop=box.scrollHeight;
   }
   status.textContent=st.online?'Mestre conectado':'Modo offline';status.className=st.online?'on':'';
   info.textContent='Pendentes: '+st.pendentes+' · Recebidas: '+st.recebidas+' · '+(st.online?'Sincronizacao ativa':'Historico salvo localmente');
 }catch(e){status.textContent='Cliente indisponivel';status.className='';}
}
document.getElementById('form').addEventListener('submit',async e=>{
 e.preventDefault();const input=document.getElementById('body'),body=input.value.trim();if(!body)return;
 const r=await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({corpo:body})});
 if(r.ok){input.value='';await refresh();input.focus();}else alert('Nao foi possivel salvar a mensagem');
});
refresh();setInterval(refresh,1400);
</script></body></html>'''

class ClientHandler(BaseHandler):
    def check_origin(self):
        origin = self.headers.get("Origin", "")
        return not origin or origin in ("http://127.0.0.1:"+str(self.server.server_port), "http://localhost:"+str(self.server.server_port))
    def do_GET(self):
        rota = urlsplit(self.path).path
        if rota in ("/", "/index.html"):
            page = UI.replace("__NAME__", self.server.identity.upper()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)
            return
        if rota == "/health":
            return responder(self, 200, {"ok": True, "servico": "client", "id": self.server.identity})
        if rota == "/api/messages":
            with conexao(self.server.db) as db:
                ls = db.execute("SELECT id,direcao,corpo,criado,estado FROM mensagens ORDER BY seq DESC LIMIT 200").fetchall()
            return responder(self, 200, {"mensagens": [dict(x) for x in reversed(ls)]})
        if rota == "/api/status":
            with conexao(self.server.db) as db:
                p = db.execute("SELECT COUNT(*) FROM mensagens WHERE direcao='enviada' AND estado='pendente'").fetchone()[0]
                n = db.execute("SELECT COUNT(*) FROM mensagens WHERE direcao='recebida'").fetchone()[0]
            with self.server.lock:
                online = self.server.online
            return responder(self, 200, {"online": online, "pendentes": p, "recebidas": n})
        return responder(self, 404, {"erro": "Rota inexistente"})
    def do_POST(self):
        rota = urlsplit(self.path).path
        if rota == "/stop":
            return self.encerramento()
        if not self.check_origin():
            return responder(self, 403, {"erro": "Origem nao permitida"})
        if rota == "/api/send":
            obj = ler_json(self, 6000)
            corpo = obj.get("corpo") if obj else None
            if not isinstance(corpo, str) or not (1 <= len(corpo.strip()) <= 2000):
                return responder(self, 400, {"erro": "Mensagem invalida"})
            mid = str(uuid.uuid4())
            with conexao(self.server.db) as db:
                db.execute("INSERT INTO mensagens(id,direcao,corpo,criado,estado) VALUES(?,?,?,?,?)", (mid,"enviada",corpo.strip(),agora(),"pendente"))
                db.commit()
            return responder(self, 200, {"ok": True, "id": mid})
        return responder(self, 404, {"erro": "Rota inexistente"})

def chamar(master, token, rota, dados=None):
    url = master.rstrip("/") + rota
    payload = json.dumps(dados, ensure_ascii=False).encode("utf-8") if dados is not None else None
    headers = {"X-Steiner-Token": token}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, data=payload, headers=headers, method="POST" if payload is not None else "GET")
    with urlopen(req, timeout=2.5) as response:
        return json.load(response)

def cursor(db, chave):
    row = db.execute("SELECT valor FROM meta WHERE chave=?", (chave,)).fetchone()
    return int(row[0]) if row else 0

def gravar_cursor(db, chave, valor):
    db.execute("INSERT INTO meta(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor", (chave, str(valor)))

def sincronizar(s):
    # Reconciliacao: se o master perder o SQLite temporario, os clientes
    # reconstroem mensagens ainda nao entregues e reiniciam os cursores.
    health = chamar(s.master, s.token, "/health")
    epoch = health.get("epoch")
    if not isinstance(epoch, str) or not epoch:
        raise ValueError("Mestre sem identidade valida")
    with conexao(s.db) as db:
        antiga = db.execute("SELECT valor FROM meta WHERE chave='master_epoch'").fetchone()
        if not antiga or antiga[0] != epoch:
            gravar_cursor(db, "master_epoch", epoch)
            gravar_cursor(db, "recebidas_seq", 0)
            gravar_cursor(db, "recibos_seq", 0)
            db.execute("UPDATE mensagens SET estado='recebido' WHERE direcao='recebida' AND estado='confirmado'")
            db.commit()
            s.last_sent.clear()
        pendentes = db.execute("SELECT id,corpo FROM mensagens WHERE direcao='enviada' AND estado IN ('pendente','no mestre') ORDER BY seq LIMIT 100").fetchall()
    instante = time.monotonic()
    for row in pendentes:
        if instante - s.last_sent.get(row["id"], -1e10) < 12:
            continue
        chamar(s.master, s.token, "/push", {"id":row["id"], "corpo":row["corpo"]})
        s.last_sent[row["id"]] = instante
        with conexao(s.db) as db:
            db.execute("UPDATE mensagens SET estado='no mestre' WHERE id=? AND estado='pendente'", (row["id"],))
            db.commit()
    with conexao(s.db) as db:
        ultimo = cursor(db, "recebidas_seq")
    recebidas = chamar(s.master, s.token, "/pull?after="+str(ultimo))["mensagens"]
    if recebidas:
        with conexao(s.db) as db:
            for m in recebidas:
                db.execute("INSERT OR IGNORE INTO mensagens(id,direcao,corpo,criado,estado) VALUES(?,?,?,?,?)", (m["id"], "recebida", m["corpo"], m["criado"], "recebido"))
                ultimo = max(ultimo, int(m["seq"]))
            gravar_cursor(db, "recebidas_seq", ultimo)
            db.commit()
    with conexao(s.db) as db:
        confirmar = [r[0] for r in db.execute("SELECT id FROM mensagens WHERE direcao='recebida' AND estado='recebido' LIMIT 100").fetchall()]
    if confirmar:
        chamar(s.master, s.token, "/ack", {"ids": confirmar})
        with conexao(s.db) as db:
            db.executemany("UPDATE mensagens SET estado='confirmado' WHERE id=?", ((mid,) for mid in confirmar))
            db.commit()
    with conexao(s.db) as db:
        ultimo = cursor(db, "recibos_seq")
    recibos = chamar(s.master, s.token, "/status?after="+str(ultimo))["recibos"]
    if recibos:
        with conexao(s.db) as db:
            for r in recibos:
                db.execute("UPDATE mensagens SET estado='entregue' WHERE id=? AND direcao='enviada'", (r["msg_id"],))
                s.last_sent.pop(r["msg_id"], None)
                ultimo = max(ultimo, int(r["seq"]))
            gravar_cursor(db, "recibos_seq", ultimo)
            db.commit()

def loop_sync(s):
    while not s.stopped.is_set():
        try:
            sincronizar(s)
            with s.lock:
                s.online = True
        except Exception:
            with s.lock:
                s.online = False
        s.stopped.wait(1.2)

def executar():
    ap = argparse.ArgumentParser(description="STEINER LINK: chat offline-first com servidor mestre")
    ap.add_argument("modo", choices=["master","client"])
    ap.add_argument("--db", required=True)
    ap.add_argument("--port", type=int, required=True)
    ap.add_argument("--bind", default="127.0.0.1")
    ap.add_argument("--token-a")
    ap.add_argument("--token-b")
    ap.add_argument("--name", choices=["a","b"])
    ap.add_argument("--master", default="http://127.0.0.1:5180")
    ap.add_argument("--token")
    ap.add_argument("--stop-token", required=True)
    opt = ap.parse_args()
    path = Path(opt.db).resolve()
    path.parent.mkdir(parents=True,exist_ok=True)
    if opt.modo == "master":
        if not opt.token_a or not opt.token_b or opt.token_a == opt.token_b:
            ap.error("Tokens distintos sao obrigatorios")
        preparar_master(path)
        h = MasterHandler
    else:
        if not opt.name or not opt.token:
            ap.error("Nome e token obrigatorios")
        preparar_cliente(path)
        h = ClientHandler
    if opt.modo == "client" and not (opt.master.startswith("https://") or opt.master.startswith("http://127.0.0.1:") or opt.master.startswith("http://localhost:")):
        ap.error("Mestre remoto precisa usar HTTPS")
    server = ThreadingHTTPServer((opt.bind, opt.port), h)
    server.daemon_threads = True
    server.db = path
    server.stop_token = opt.stop_token
    if opt.modo == "master":
        server.tokens = {"a": opt.token_a, "b": opt.token_b}
        with conexao(path) as db:
            server.epoch = db.execute("SELECT valor FROM meta WHERE chave='epoch'").fetchone()[0]
    else:
        server.identity = opt.name
        server.master = opt.master
        server.token = opt.token
        server.lock = threading.Lock()
        server.online = False
        server.stopped = threading.Event()
        server.last_sent = {}
        threading.Thread(target=loop_sync, args=(server,), daemon=True).start()
    print("STEINER LINK", opt.modo, opt.port, "ONLINE", flush=True)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        if opt.modo == "client":
            server.stopped.set()
        server.server_close()

import sys as _steiner_sys
import steiner_calls as _steiner_calls
_steiner_calls.install(_steiner_sys.modules[__name__])

if __name__ == "__main__":
    executar()