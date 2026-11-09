# -*- coding: utf-8 -*-
"""15+ isolated integration tests, no external network, no real personal data."""
import os,sys,json,base64,threading,tempfile,urllib.request,urllib.error,unittest
from pathlib import Path
os.environ["CHAT_OWNER_TOKEN"]="TEST_OWNER_"+("a"*42)
os.environ["CHAT_GUEST_TOKEN"]="TEST_GUEST_"+("b"*42)
sys.path.insert(0,str(Path(__file__).resolve().parent))
import server
class ChatTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory()
  server.DATADIR=Path(cls.tmp.name)
  server.DB=server.DATADIR/"test.sqlite3"
  server.verify_config()
  server.init()
  cls.web=server.ThreadingHTTPServer(("127.0.0.1",0),server.Handler)
  cls.url=f"http://127.0.0.1:{cls.web.server_address[1]}"
  cls.thread=threading.Thread(target=cls.web.serve_forever,daemon=True)
  cls.thread.start()
 @classmethod
 def tearDownClass(cls):
  cls.web.shutdown();cls.web.server_close();cls.thread.join(timeout=5);cls.tmp.cleanup()
 def request(self,method,path,body=None,role="owner",extra=None):
  headers={"Accept":"application/json"}
  if role=="owner":headers["Authorization"]="Bearer "+os.environ["CHAT_OWNER_TOKEN"]
  elif role=="guest":headers["Authorization"]="Bearer "+os.environ["CHAT_GUEST_TOKEN"]
  elif role=="wrong":headers["Authorization"]="Bearer "+"n"*50
  if extra:headers.update(extra)
  raw=None
  if body is not None:
   raw=json.dumps(body).encode("utf-8")
   headers["Content-Type"]="application/json"
  req=urllib.request.Request(self.url+path,data=raw,headers=headers,method=method)
  try:
   with urllib.request.urlopen(req,timeout=5) as resp:return resp.status,resp.read(),dict(resp.headers)
  except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers)
 def j(self,method,path,body=None,role="owner",extra=None):
  status,raw,headers=self.request(method,path,body,role,extra)
  return status,json.loads(raw.decode("utf-8")),headers
 def test_01_health(self):
  s,d,_=self.j("GET","/api/health",role=None);self.assertEqual(s,200);self.assertTrue(d["ok"])
 def test_02_unauthorized(self):
  self.assertEqual(self.j("GET","/api/poll",role=None)[0],401)
 def test_03_wrong_token(self):
  self.assertEqual(self.j("GET","/api/me",role="wrong")[0],401)
 def test_04_role_owner(self):
  self.assertEqual(self.j("GET","/api/me")[1]["role"],"owner")
 def test_05_role_guest(self):
  self.assertEqual(self.j("GET","/api/me",role="guest")[1]["role"],"guest")
 def test_06_post_message(self):
  s,r,_=self.j("POST","/api/send",{"kind":"text","text":"Oi, tudo bem?"});self.assertEqual(s,201)
  x=self.j("GET","/api/poll",role="guest")[1]["messages"]
  self.assertIn(r["id"],[m["id"] for m in x])
 def test_07_reply_two_way(self):
  s,r,_=self.j("POST","/api/send",{"text":"Resposta do celular"},"guest");self.assertEqual(s,201)
  x=self.j("GET","/api/poll")[1]["messages"]
  self.assertIn(r["id"],[m["id"] for m in x])
 def test_08_read_receipt(self):
  s,r,_=self.j("POST","/api/send",{"text":"Conferir leitura"},"owner")
  self.assertEqual(self.j("POST","/api/read",{"last_id":r["id"]},"guest")[0],200)
  a=self.j("GET","/api/poll",role="owner")[1]["receipts"]
  self.assertIn(r["id"],[i["id"] for i in a])
 def test_09_typing(self):
  self.j("POST","/api/typing",{"typing":True},"owner")
  x=self.j("GET","/api/poll",role="guest")[1]["peer"]
  self.assertTrue(x["online"]);self.assertTrue(x["typing"])
 def test_10_image(self):
  png=b"\x89PNG\r\n\x1a\n"+b"x"*150
  s,r,_=self.j("POST","/api/send",{"kind":"image","text":"Foto de teste","mime":"image/png","data":base64.b64encode(png).decode()},"guest")
  self.assertEqual(s,201)
  status,raw,h=self.request("GET",f"/api/file/{r['id']}","",role="owner")
  self.assertEqual(status,200);self.assertEqual(raw,png)
 def test_11_bad_image(self):
  s,_,_=self.j("POST","/api/send",{"kind":"image","mime":"image/png","data":base64.b64encode(b"a"*150).decode()});self.assertEqual(s,400)
 def test_12_file_without_authorization(self):
  s,_,_=self.request("GET","/api/file/1",role=None);self.assertEqual(s,401)
 def test_13_signaling_offer(self):
  s,r,_=self.j("POST","/api/signal",{"type":"offer","payload":{"sdp":{"type":"offer","sdp":"v=0"}}},"owner")
  self.assertEqual(s,201)
  x=self.j("GET","/api/signals",role="guest")[1]["signals"]
  self.assertIn(r["id"],[i["id"] for i in x])
 def test_14_signaling_reply(self):
  s,_,_=self.j("POST","/api/signal",{"type":"answer","payload":{"sdp":{"type":"answer","sdp":"v=0"}}},"guest")
  self.assertEqual(s,201)
 def test_15_csp(self):
  status,_,headers=self.request("GET","/",role=None)
  self.assertEqual(status,200);self.assertIn("Content-Security-Policy",headers)
 def test_16_reject_cross_origin(self):
  s,_,_=self.j("POST","/api/send",{"text":"no"},"owner",{"Origin":"https://evil.example"})
  self.assertEqual(s,403)
 def test_17_unknown_route(self):
  self.assertEqual(self.j("GET","/api/missing")[0],404)
 def test_18_no_token_in_html(self):
  _,html,_=self.request("GET","/",role=None)
  self.assertNotIn(os.environ["CHAT_OWNER_TOKEN"].encode(),html)
  self.assertNotIn(os.environ["CHAT_GUEST_TOKEN"].encode(),html)
 def test_19_message_limit(self):
  self.assertEqual(self.j("POST","/api/send",{"text":"x"*4100})[0],400)
 def test_20_bad_mime(self):
  self.assertEqual(self.j("POST","/api/send",{"kind":"audio","mime":"application/javascript","data":"eA=="})[0],400)
 def test_21_no_automatic_phone(self):
  text=(Path(__file__).resolve().parent/"server.py").read_text(encoding="utf-8")
  self.assertNotIn("954792433",text)
 def test_22_cookie_not_used(self):
  _,raw,_=self.request("GET","/",role=None)
  self.assertIn(b"STEINER",raw)
 def test_23_files_private(self):
  self.assertEqual(self.j("GET","/api/file/999999",role="owner")[0],404)
if __name__=="__main__":unittest.main(verbosity=2)
