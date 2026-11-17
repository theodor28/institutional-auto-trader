"""STEINER CACADOR: receptor OAuth Mercado Livre (MVP, sem gravar credenciais)."""
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
PENDING = {}
CONNECTED = {}
LOCK = threading.Lock()
STATE_TTL = 600
AUTH_URL = "https://auth.mercadolivre.com.br/authorization"
TOKEN_URL = "https://api.mercadolibre.com/oauth/token"


def b64url(blob):
    return base64.urlsafe_b64encode(blob).decode("ascii").rstrip("=")


def challenge(verifier):
    return b64url(hashlib.sha256(verifier.encode("ascii")).digest())


def ready():
    return bool(CLIENT_ID and CLIENT_SECRET and
                REDIRECT_URI.startswith("https://") and
                urlsplit(REDIRECT_URI).path == "/oauth/callback")


def make_auth_params(state, verifier):
    return {
        "response_type": "code",
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "code_challenge": challenge(verifier),
        "code_challenge_method": "S256",
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # Nunca registrar "code", "state", tokens ou URLs completas.
        print("HTTP", self.command, urlsplit(self.path).path, flush=True)

    def send(self, status, body, content_type="text/plain; charset=utf-8", extra=None):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        for name, value in (extra or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlsplit(self.path)
        path = url.path
        if path == "/health":
            self.send(200, json.dumps({"service": "STEINER_ML_OAUTH",
                                       "online": True,
                                       "configured": ready()}),
                      "application/json; charset=utf-8")
        elif path == "/":
            self.send(200, "STEINER CACADOR - Receptor OAuth\n"
                           "Configure ML_CLIENT_SECRET e ML_REDIRECT_URI no servidor.\n"
                           "Para autorizar, visite /oauth/start.\n")
        elif path == "/oauth/start":
            self.start_auth()
        elif path == "/oauth/callback":
            self.callback(parse_qs(url.query))
        else:
            self.send(404, "Rota inexistente.")

    def start_auth(self):
        if not ready():
            self.send(503, "Integracao ainda nao configurada no servidor.")
            return
        state = secrets.token_urlsafe(32)
        browser_nonce = secrets.token_urlsafe(32)
        verifier = secrets.token_urlsafe(64)
        with LOCK:
            now = time.time()
            for old in list(PENDING):
                if now - PENDING[old]["created"] > STATE_TTL:
                    del PENDING[old]
            PENDING[state] = {
                "nonce": browser_nonce, "verifier": verifier, "created": now
            }
        auth_link = AUTH_URL + "?" + urlencode(make_auth_params(state, verifier))
        self.send_response(302)
        self.send_header("Location", auth_link)
        self.send_header("Set-Cookie", "ml_oauth_session=" + browser_nonce +
                         "; Max-Age=600; HttpOnly; Secure; SameSite=Lax; Path=/")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()

    def callback(self, qs):
        state = (qs.get("state") or [""])[0]
        code = (qs.get("code") or [""])[0]
        if not state or not code or len(qs.get("state", [])) != 1:
            self.send(400, "Retorno OAuth incompleto ou recusado.")
            return
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except Exception:
            self.send(400, "Cookie OAuth invalido.")
            return
        nonce = cookies["ml_oauth_session"].value if "ml_oauth_session" in cookies else ""
        with LOCK:
            session = PENDING.pop(state, None)
        if (not session or time.time() - session["created"] > STATE_TTL or
                not secrets.compare_digest(nonce, session["nonce"])):
            self.send(403, "Sessao OAuth invalida ou expirada. Reinicie a autorizacao.")
            return
        if not ready():
            self.send(503, "Servidor nao configurado.")
            return
        body = urlencode({
            "grant_type": "authorization_code",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code": code,
            "code_verifier": session["verifier"],
        }).encode("utf-8")
        request = Request(TOKEN_URL, data=body, method="POST", headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        })
        try:
            with urlopen(request, timeout=15) as resp:
                payload = json.load(resp)
            if "access_token" not in payload:
                self.send(502, "Mercado Livre nao retornou token.")
                return
            with LOCK:
                CONNECTED.clear()
                CONNECTED.update(payload)
            self.send(200, "Mercado Livre conectado com sucesso.\n"
                           "Tokens mantidos apenas na memoria deste servidor.\n"
                           "Nao feche o servico ate configurar armazenamento seguro.\n")
        except (HTTPError, URLError, ValueError, TimeoutError):
            # Nunca exibir/registrar corpo da resposta, tokens ou credenciais.
            self.send(502, "Falha na troca do codigo OAuth. Verifique configuracoes.")


if __name__ == "__main__":
    host = os.environ.get("BIND_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "5106"))
    print("STEINER ML OAuth iniciado; pronto:", ready(), flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()