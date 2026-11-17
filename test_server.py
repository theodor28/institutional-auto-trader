"""Testes isolados do receptor OAuth sem expor credenciais."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import server


class TestOAuth(unittest.TestCase):
    def test_pkce_s256(self):
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        self.assertEqual(server.challenge(verifier),
                         "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")

    def test_ready_validation(self):
        old = server.CLIENT_SECRET, server.REDIRECT_URI, server.BRIDGE_SECRET
        try:
            server.CLIENT_SECRET = "placeholder-for-test"
            server.BRIDGE_SECRET = "x" * 48
            server.REDIRECT_URI = "https://steiner-cacador-oauth.onrender.com/oauth/callback"
            self.assertTrue(server.ready())
            server.BRIDGE_SECRET = ""
            self.assertFalse(server.ready())
            server.BRIDGE_SECRET = "x" * 48
            server.REDIRECT_URI = "http://invalid/oauth/callback"
            self.assertFalse(server.ready())
        finally:
            server.CLIENT_SECRET, server.REDIRECT_URI, server.BRIDGE_SECRET = old

    def test_public_health_and_private_bridge(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            prefix = f"http://127.0.0.1:{httpd.server_port}"
            with urlopen(prefix + "/health", timeout=3) as res:
                resp = json.load(res)
            self.assertTrue(resp["online"])
            self.assertEqual(resp["mode"], "windows_token_vault")
            with self.assertRaises(HTTPError) as e:
                urlopen(prefix + "/bridge/pull", timeout=3)
            self.assertEqual(e.exception.code, 401)
        finally:
            httpd.shutdown()
            httpd.server_close()


if __name__ == "__main__":
    unittest.main()