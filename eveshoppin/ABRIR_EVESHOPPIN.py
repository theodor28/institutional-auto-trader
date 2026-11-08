"""Abre a EveShoppin funcional no Windows (somente localhost)."""
import os,sys,time,webbrowser,urllib.request,subprocess
from pathlib import Path
BASE=Path(__file__).resolve().parent
URL="http://127.0.0.1:5260/"
def ready():
 try:
  with urllib.request.urlopen(URL+"api/health",timeout=2) as r:
   import json
   return json.load(r).get("ok",False)
 except Exception:return False
if not ready():
 exe=Path(sys.executable)
 if exe.name.lower()=="python.exe" and exe.with_name("pythonw.exe").exists():exe=exe.with_name("pythonw.exe")
 kwargs={"cwd":str(BASE),"stdin":subprocess.DEVNULL,"stdout":subprocess.DEVNULL,"stderr":subprocess.DEVNULL,"close_fds":True}
 if os.name=="nt":kwargs["creationflags"]=subprocess.DETACHED_PROCESS|subprocess.CREATE_NEW_PROCESS_GROUP
 subprocess.Popen([str(exe),str(BASE/"server.py"),"--no-open"],**kwargs)
 for _ in range(50):
  time.sleep(.25)
  if ready():break
if not ready():raise RuntimeError("EveShoppin não iniciou. Verifique a porta 5260 e o Python.")
webbrowser.open(URL)
print("EVESHOPPIN_APP_ABERTO="+URL,flush=True)
print("BANCO_DEMO="+str(BASE/"dados"/"eveshoppin.sqlite3"),flush=True)
