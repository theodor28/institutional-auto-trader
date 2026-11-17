"""Testes locais de sintaxe, PKCE e endpoints sem credenciais reais."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
import server


class TestOAuth(unittest.TestCase):
    def test_pkce_s256(self):
        # Vetor conhecido RFC 7636, secao 4.2.
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        expected = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        self.assertEqual(server.challenge(verifier), expected)

    def test_redirect_validation(self):
        original_uri, original_secret = server.REDIRECT_URI, server.CLIENT_SECRET
        try:
            server.CLIENT_SECRET = "dummy-for-test-only"
            for uri, expected in [
                ("https://example.onrender.com/oauth/callback", True),
                ("https://example.onrender.com/invalid", False),
                ("http://example.onrender.com/oauth/callback", False),
            ]:
                server.REDIRECT_URI = uri
                self.assertEqual(server.ready(), expected)
        finally:
            server.REDIRECT_URI, server.CLIENT_SECRET = original_uri, original_secret

    def test_health_without_real_secrets(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            with urlopen(f"http://127.0.0.1:{httpd.server_port}/health", timeout=3) as resp:
                payload = json.load(resp)
            self.assertTrue(payload["online"])
            self.assertEqual(payload["service"], "STEINER_ML_OAUTH")
        finally:
            httpd.shutdown()
            httpd.server_close()


if __name__ == "__main__":
    unittest.main()