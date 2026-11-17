"""STEINER CACADOR OAuth: recebe autorizacao e entrega tokens ao Windows sob HTTPS.
Nunca armazena segredos no GitHub nem expõe tokens em URL/log.
"""
import base64
import hashlib
import json
import os
import secrets
import threading
import time
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

CLIENT_ID = os.environ.get("ML_CLIENT_ID", "412633737688838")
CLIENT_SECRET = os.environ.get("ML_CLIENT_SECRET", "")
REDIRECT_URI = os.environ.get("ML_REDIRECT_URI", "")
BRIDGE_SECRET = os.environ.get("BRIDGE_SHARED_SECRET", "")
AUTH_URL = "https://auth.mercadolivre.com.br/authorization"
TOKEN_URL = "https://api.mercadolibre.com/oauth/token"
SESSIONS = {}
INBOX = {}
LOCK = threading.RLock()
STATE_TTL = 600
INBOX_TTL = 900
MAX_JSON = 4096


def b64url(blob):
    return base64.urlsafe_b64encode(blob).decode("ascii").rstrip("=")


def challenge(verifier):
    return b64url(hashlib.sha256(verifier.encode("ascii")).digest())


def ready():
    return bool(CLIENT_ID and CLIENT_SECRET and
                REDIRECT_URI.startswith("https://") and
                urlsplit(REDIRECT_URI).path == "/oauth/callback" and
                len(BRIDGE_SECRET) >= 32)


def exchange(params):
    body = urlencode(params).encode("utf-8")
    req = Request(TOKEN_URL, data=body, method="POST", headers={
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    with urlopen(req, timeout=20) as res:
        payload = json.load(res)
    if not isinstance(payload, dict) or not payload.get("access_token"):
        raise ValueError("Resposta de token sem access_token")
    return payload


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # O caminho nunca inclui query string de autorizacao, codigo ou state.
        print("HTTP", self.command, urlsplit(self.path).path, flush=True)

    def send(self, status, message, content_type="text/plain; charset=utf-8", headers=None):
        data = message.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        for key, val in (headers or {}).items():
            self.send_header(key, val)
        self.end_headers()
        self.wfile.write(data)

    def json(self, status, obj):
        self.send(status, json.dumps(obj, ensure_ascii=False),
                  "application/json; charset=utf-8")

    def redirect(self, to, clear_cookie=False):
        self.send_response(303)
        self.send_header("Location", to)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        if clear_cookie:
            self.send_header("Set-Cookie", "ml_oauth_session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/")
        self.end_headers()

    def authed(self):
        value = self.headers.get("Authorization", "")
        return bool(ready() and value.startswith("Bearer ") and
                    secrets.compare_digest(value[7:], BRIDGE_SECRET))

    def read_body(self):
        try:
            count = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if not 0 < count <= MAX_JSON:
            return None
        try:
            obj = json.loads(self.rfile.read(count))
            return obj if isinstance(obj, dict) else None
        except (ValueError, UnicodeDecodeError):
            return None

    def do_GET(self):
        uri = urlsplit(self.path)
        path = uri.path
        if path == "/health":
            self.json(200, {"service": "STEINER_ML_OAUTH", "online": True,
                            "configured": ready(), "mode": "windows_token_vault"})
        elif path == "/":
            self.send(200, "STEINER CACADOR: OAuth / Windows Bridge.\n"
                           "Conectar: /oauth/start. Estado: /health.\n")
        elif path == "/oauth/start":
            self.start_auth()
        elif path == "/oauth/callback":
            self.callback(parse_qs(uri.query))
        elif path == "/oauth/done":
            self.send(200, "Mercado Livre autorizado.\n"
                           "O computador STEINER-PONTE precisa receber e guardar "
                           "a autorizacao. Acesse o ChatGPT para confirmar o teste.\n")
        elif path == "/bridge/status":
            if not self.authed():
                self.json(401, {"error": "nao_autorizado"})
                return
            with LOCK:
                present = bool(INBOX and time.time() - INBOX.get("created", 0) <= INBOX_TTL)
            self.json(200, {"configured": ready(), "pending_delivery": present})
        elif path == "/bridge/pull":
            if not self.authed():
                self.json(401, {"error": "nao_autorizado"})
                return
            with LOCK:
                if not INBOX or time.time() - INBOX.get("created", 0) > INBOX_TTL:
                    self.json(200, {"pending": False})
                else:
                    self.json(200, {"pending": True, "delivery_id": INBOX["delivery_id"],
                                    "tokens": INBOX["tokens"]})
        else:
            self.send(404, "Rota desconhecida.")

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in ("/bridge/ack", "/bridge/refresh") or not self.authed():
            self.json(401, {"error": "nao_autorizado"})
            return
        body = self.read_body()
        if not body:
            self.json(400, {"error": "dados_invalidos"})
            return
        if path == "/bridge/ack":
            delivery_id = str(body.get("delivery_id", ""))
            with LOCK:
                if INBOX and secrets.compare_digest(delivery_id, INBOX.get("delivery_id", "")):
                    INBOX.clear()
                    self.json(200, {"ack": True})
                else:
                    self.json(404, {"ack": False})
            return
        refresh_token = body.get("refresh_token")
        if not isinstance(refresh_token, str) or not 10 < len(refresh_token) < 2048:
            self.json(400, {"error": "refresh_token_invalido"})
            return
        try:
            result = exchange({"grant_type": "refresh_token",
                               "client_id": CLIENT_ID,
                               "client_secret": CLIENT_SECRET,
                               "refresh_token": refresh_token})
            self.json(200, {"ok": True, "tokens": result})
        except (HTTPError, URLError, TimeoutError, ValueError):
            self.json(502, {"ok": False, "error": "falha_renovacao_ml"})

    def start_auth(self):
        if not ready():
            self.send(503, "Servico ainda nao configurado.")
            return
        state, nonce, verifier = (secrets.token_urlsafe(32),
                                  secrets.token_urlsafe(32),
                                  secrets.token_urlsafe(64))
        with LOCK:
            for key in list(SESSIONS):
                if time.time() - SESSIONS[key]["created"] > STATE_TTL:
                    del SESSIONS[key]
            SESSIONS[state] = {"nonce": nonce, "verifier": verifier,
                               "created": time.time()}
        url = AUTH_URL + "?" + urlencode({
            "response_type": "code", "client_id": CLIENT_ID,
            "redirect_uri": REDIRECT_URI, "state": state,
            "code_challenge": challenge(verifier), "code_challenge_method": "S256"
        })
        self.send_response(302)
        self.send_header("Location", url)
        self.send_header("Set-Cookie", "ml_oauth_session=" + nonce +
                         "; Max-Age=600; HttpOnly; Secure; SameSite=Lax; Path=/")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def callback(self, query):
        code = (query.get("code") or [""])[0]
        state = (query.get("state") or [""])[0]
        if not code or not state or len(query.get("code", [])) != 1 or len(query.get("state", [])) != 1:
            self.send(400, "Retorno OAuth incompleto.")
            return
        try:
            cookies = SimpleCookie()
            cookies.load(self.headers.get("Cookie", ""))
            nonce = cookies["ml_oauth_session"].value if "ml_oauth_session" in cookies else ""
        except Exception:
            nonce = ""
        with LOCK:
            session = SESSIONS.pop(state, None)
        if not session or time.time() - session["created"] > STATE_TTL or not secrets.compare_digest(nonce, session["nonce"]):
            self.send(403, "Sessao OAuth invalida ou expirada.")
            return
        try:
            tokens = exchange({
                "grant_type": "authorization_code",
                "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI, "code": code,
                "code_verifier": session["verifier"],
            })
            with LOCK:
                INBOX.clear()
                INBOX.update({"delivery_id": secrets.token_urlsafe(24),
                              "tokens": tokens, "created": time.time()})
            self.redirect("/oauth/done", clear_cookie=True)
        except (HTTPError, URLError, TimeoutError, ValueError):
            self.send(502, "Mercado Livre nao concluiu a troca do codigo.")


if __name__ == "__main__":
    print("STEINER ML OAuth bridge iniciado; pronto:", ready(), flush=True)
    ThreadingHTTPServer((os.environ.get("BIND_HOST", "127.0.0.1"),
                         int(os.environ.get("PORT", "5106"))), Handler).serve_forever()