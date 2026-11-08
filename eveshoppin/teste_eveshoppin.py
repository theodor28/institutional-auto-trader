"""EveShoppin - teste HTTP isolado sem tocar no banco do usuário."""
import server as app
import tempfile,threading,urllib.request,urllib.error,http.cookiejar,json,sys
from pathlib import Path
from http.server import ThreadingHTTPServer
checks=[]
def ok(name,predicate):checks.append((name,bool(predicate)))
with tempfile.TemporaryDirectory(prefix="eveshoppin_tests_") as temp:
 app.DB=Path(temp)/"test.sqlite3"
 app.init()
 server=ThreadingHTTPServer(("127.0.0.1",0),app.Handler)
 th=threading.Thread(target=server.serve_forever,daemon=True);th.start()
 root="http://127.0.0.1:"+str(server.server_address[1])
 def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 guest=client();buyer=client();seller=client()
 def req(c,path,body=None):
  kw={} if body is None else {"data":json.dumps(body).encode("utf-8"),"headers":{"Content-Type":"application/json"}}
  with c.open(urllib.request.Request(root+path,**kw),timeout=6) as response:
   raw=response.read()
   return raw.decode() if "text/html" in response.headers.get("Content-Type","") else json.loads(raw)
 try:
  ok("health",req(guest,"/api/health")["ok"])
  ok("html","EveShoppin" in req(guest,"/"))
  products=req(guest,"/api/products")
  ok("32_produtos",len(products["items"])==24 and products["total"]==32)
  ok("nove_categorias",len(req(guest,"/api/categories")["categories"])==9)
  cats=req(guest,"/api/products?category=Games")
  ok("filtro_categoria",cats["total"]==3 and all(x["category"]=="Games" for x in cats["items"]))
  ok("busca_texto",req(guest,"/api/products?q=Bluetooth")["total"]>=1)
  sortedp=req(guest,"/api/products?sort=lowest")["items"]
  ok("ordenacao_preco",all(a["price"]<=b["price"] for a,b in zip(sortedp,sortedp[1:])))
  p=req(guest,"/api/product/1")["product"]
  ok("detalhe_produto",p["title"]=="Fone Bluetooth ProBass X")
  shopping=[{"product_id":1,"qty":2}]
  qt=req(guest,"/api/cart/quote",{"items":shopping,"coupon":"EVE10"})
  ok("calculo_cupom",qt["subtotal"]==17980 and qt["discount"]==1798 and qt["shipping"]==1990)
  ok("total_exato",qt["total"]==18172 and qt["simulated"])
  try:req(guest,"/api/cart/quote",{"items":[{"product_id":1,"qty":999}]});bad=False
  except urllib.error.HTTPError as e:bad=e.code==400
  ok("limite_quantidade",bad)
  try:req(guest,"/api/orders");bad=False
  except urllib.error.HTTPError as e:bad=e.code==401
  ok("pedido_exige_login",bad)
  usr=req(buyer,"/api/register",{"name":"Cliente Teste","email":"cliente@example.com","password":"SenhaExemplo!123","role":"buyer"})
  ok("registro_comprador",usr["ok"])
  sell=req(seller,"/api/register",{"name":"Minha Loja Teste","email":"vendedor@example.com","password":"SenhaExemplo!456","role":"seller"})
  ok("registro_vendedor",sell["ok"])
  ok("sessao_cookie",req(buyer,"/api/session")["user"]["role"]=="buyer")
  fav=req(buyer,"/api/favorites",{"product_id":1})
  ok("favorito_salvo",fav["favorited"] and 1 in req(buyer,"/api/favorites")["favorites"])
  fav=req(buyer,"/api/favorites",{"product_id":1})
  ok("favorito_removido",not fav["favorited"])
  try:req(buyer,"/api/seller/product",{"title":"Teste","category":"Games","price":2500,"old_price":5000,"stock":2});denied=False
  except urllib.error.HTTPError as e:denied=e.code==403
  ok("vender_exige_perfil",denied)
  new=req(seller,"/api/seller/product",{"title":"Produto Teste de Vendedor","category":"Games","price":2590,"old_price":3990,"stock":3,"emoji":"🎮","blurb":"Item demonstrativo adicionado por vendedor"})
  ok("anuncio_novo",new["ok"] and new["id"]>32)
  ok("anuncio_na_vitrine",req(guest,"/api/products?q=Produto Teste de Vendedor")["total"]==1)
  before=req(guest,"/api/product/1")["product"]["stock"]
  order=req(buyer,"/api/checkout",{"items":shopping,"coupon":"EVE10","recipient":"Cliente Teste","city":"São Paulo","state":"SP","zip_code":"01001000","address":"Rua exemplo 100","method":"pix_demo"})
  ok("checkout_simulado",order["ok"] and not order["payment_real"] and not order["delivery_real"])
  after=req(guest,"/api/product/1")["product"]["stock"]
  ok("estoque_decrementado",after==before-2)
  ok("pedido_gravado",len(req(buyer,"/api/orders")["orders"])==1)
  review=req(buyer,"/api/review",{"product_id":1,"rating":5,"comment":"Recebido como pedido de teste, gostei do fluxo"})
  ok("avaliacao_pos_pedido",review["ok"])
  check=req(guest,"/api/product/1")
  ok("avaliacao_publica",len(check["reviews"])==1)
  try:req(guest,"/api/checkout",{"items":shopping,"recipient":"x"});unauth=False
  except urllib.error.HTTPError as e:unauth=e.code==401
  ok("checkout_bloqueio_anonimo",unauth)
  seller_cart=req(buyer,"/api/checkout",{"items":[{"product_id":new["id"],"qty":1}],"recipient":"Cliente Teste","city":"Rio","state":"RJ","zip_code":"20000000","address":"Rua teste 1","method":"boleto_demo"})
  ok("pedido_produto_vendedor",seller_cart["ok"])
  sales=req(seller,"/api/seller/orders")
  ok("vendedor_ve_seu_pedido",len(sales["lines"])==1 and sales["lines"][0]["title"]=="Produto Teste de Vendedor")
  ok("atualizacao_estoque_vendedor",req(seller,"/api/seller/stock",{"product_id":new["id"],"stock":8})["ok"])
  ok("logout",req(buyer,"/api/logout",{})["ok"] and req(buyer,"/api/session")["user"] is None)
 finally:server.shutdown();server.server_close()
print(json.dumps({"passed":sum(v for _,v in checks),"total":len(checks),"checks":checks},ensure_ascii=False),flush=True)
sys.exit(0 if all(v for _,v in checks) else 1)
