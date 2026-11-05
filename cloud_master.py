"""Entrada do servidor mestre para hospedagem externa com HTTPS reverso.
NUNCA inclua tokens no repositório nem no código-fonte.
"""
import os
import sys
from steiner_link import executar

def main():
    keys = ("STEINER_TOKEN_A", "STEINER_TOKEN_B", "STEINER_STOP_TOKEN")
    missing = [k for k in keys if len(os.environ.get(k, "")) < 24]
    if missing:
        raise SystemExit("Faltam variaveis secretas (min. 24 caracteres): " + ", ".join(missing))
    if os.environ["STEINER_TOKEN_A"] == os.environ["STEINER_TOKEN_B"]:
        raise SystemExit("Tokens de A e B devem ser diferentes")
    port = int(os.environ.get("PORT", "10000"))
    path = os.environ.get("STEINER_DB", "/tmp/steiner_master.sqlite3")
    sys.argv = [sys.argv[0], "master", "--bind", "0.0.0.0", "--db", path,
        "--port", str(port),
        "--token-a", os.environ["STEINER_TOKEN_A"],
        "--token-b", os.environ["STEINER_TOKEN_B"],
        "--stop-token", os.environ["STEINER_STOP_TOKEN"]]
    executar()

if __name__ == "__main__":
    main()