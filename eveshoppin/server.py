# -*- coding: utf-8 -*-
"""EveShoppin | Marketplace demonstrativo e funcional, sem pagamentos reais.
Python standard library / SQLite. Em hospedagem gratuita o SQLite é efêmero.
"""
import os,json,re,sqlite3,secrets,hmac,hashlib,time,datetime,urllib.parse,threading,sys,webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from http.cookies import SimpleCookie
from contextlib import contextmanager

BASE=Path(__file__).resolve().parent
DATA=Path(os.environ.get("EVESHOPPIN_DATA_DIR",str(BASE/"dados")))
DATA.mkdir(parents=True,exist_ok=True)
DB=DATA/"eveshoppin.sqlite3"
PORT=int(os.environ.get("PORT","5260"))
HOST=os.environ.get("HOST","0.0.0.0")
START=time.time()
SESSIONS_LIMIT=86400*10
FAILS={}
CATEGORIES=[
 ("Eletrônicos","headphones","Fones, smartwatches e gadgets"),
 ("Moda","shirt","Roupas e acessórios"),
 ("Casa","house","Tudo para seu lar"),
 ("Beleza","sparkles","Autocuidado e cosméticos"),
 ("Pets","paw-print","Para o melhor amigo"),
 ("Esportes","dumbbell","Treinos e movimento"),
 ("Games","gamepad-2","Diversão e jogos"),
 ("Bebê","baby","Cuidado com os pequenos"),
 ("Acessórios","shopping-bag","Detalhes do seu estilo")]
# Fotos genéricas ilustrativas do Unsplash — NÃO representam os produtos exatos.
PHOTO={
 "tech":"photo-1505740420928-5e560c06d30e","watch":"photo-1523275335684-37898b6baf30",
 "laptop":"photo-1496181133206-80ce9b88a853","camera":"photo-1516035069371-29a1b244cc32",
 "keyboard":"photo-1587829741301-dc798b83add3","mouse":"photo-1527814050087-3793815479db",
 "shoe":"photo-1542291026-7eec264c27ff","fashion":"photo-1483985988355-763728e1935b",
 "bag":"photo-1553062407-98eeb64c6a62","home":"photo-1556911220-bff31c812dba",
 "coffee":"photo-1442512595331-e89e73853f31","skincare":"photo-1608248543803-ba4f8c70ae0b",
 "lipstick":"photo-1586495777744-4413f21062fa","pet":"photo-1583337130417-3346a1be7dee",
 "fitness":"photo-1571019613454-1cb2f99b2d8b","baby":"photo-1515488042361-ee00e0ddd4e4",
 "speaker":"photo-1608043152269-423dbba4e7e1","game":"photo-1535223289827-42f1e9919769"
}
# title, category, price cents, old cents, stock, emoji, photo key, seller demo, highlight, popularity
SEED=[
 ("Fone Bluetooth ProBass X","Eletrônicos",8990,14990,65,"🎧","tech","Eve Tech","Áudio premium",98),
 ("Relógio Smart Active Fit","Eletrônicos",11990,19990,38,"⌚","watch","NovaTech Shop","Mais procurado",95),
 ("Mini projetor portátil HD","Eletrônicos",32990,49990,16,"📽️","laptop","Eve Tech","Cinema em casa",82),
 ("Mouse sem fio ergonômico","Eletrônicos",4590,7990,120,"🖱️","mouse","NovaTech Shop","Prático",78),
 ("Teclado mecânico RGB","Eletrônicos",16990,28990,34,"⌨️","keyboard","Gamer Station","Oferta especial",88),
 ("Caixa de som compacta BT","Eletrônicos",9990,17990,45,"🔊","speaker","Eve Tech","Som envolvente",89),
 ("Câmera digital compacta","Eletrônicos",45990,69990,13,"📷","camera","Foto Club","Criatividade",73),
 ("Tênis urbano leve Comfort","Moda",13990,23990,70,"👟","shoe","Style Eve","Conforto diário",96),
 ("Bolsa tiracolo feminina","Moda",7990,13990,41,"👜","bag","Style Eve","Coleção nova",84),
 ("Camiseta básica algodão","Moda",3990,6990,250,"👕","fashion","Moda Brasil","Essencial",91),
 ("Jaqueta corta-vento casual","Moda",12990,19990,55,"🧥","fashion","Moda Brasil","Estilo urbano",74),
 ("Organizador de cozinha 4 peças","Casa",4990,8990,77,"🍽️","home","Casa Viva","Casa organizada",83),
 ("Jogo de canecas cerâmica","Casa",5990,10990,84,"☕","coffee","Casa Viva","Seu momento",87),
 ("Luminária LED articulável","Casa",7490,12990,62,"💡","home","Casa Viva","Decoração",86),
 ("Travesseiro macio premium","Casa",6990,11990,58,"🛏️","home","Lar Feliz","Mais conforto",79),
 ("Garrafa térmica inox 750ml","Casa",5490,9990,86,"🥤","home","Lar Feliz","Hidratação",90),
 ("Sérum facial vitamina C","Beleza",5890,9990,104,"🧴","skincare","Beleza Eve","Rotina diária",97),
 ("Kit maquiagem pincéis","Beleza",4690,8990,88,"💄","lipstick","Beleza Eve","Mais vendido",92),
 ("Máscara capilar nutrição","Beleza",4290,7990,67,"✨","skincare","Beleza Eve","Autocuidado",85),
 ("Escova massageadora pet","Pets",3590,6990,93,"🐾","pet","Pet Mundo","Cuidado animal",91),
 ("Bebedouro automático pet","Pets",13990,21990,24,"🐶","pet","Pet Mundo","Bem-estar",90),
 ("Coleira ajustável acolchoada","Pets",2990,5990,128,"🦮","pet","Pet Mundo","Dia a dia",77),
 ("Kit elásticos fitness","Esportes",4990,9490,102,"💪","fitness","Sport Club","Treino em casa",89),
 ("Garrafa squeeze esportiva","Esportes",3490,6990,119,"🏃","fitness","Sport Club","Energia",74),
 ("Tapete yoga antiderrapante","Esportes",7990,13990,37,"🧘","fitness","Sport Club","Seu bem-estar",85),
 ("Controle gamer sem fio","Games",18990,29990,35,"🎮","game","Gamer Station","Jogabilidade",94),
 ("Headset gamer com microfone","Games",14990,24990,46,"🎧","tech","Gamer Station","Foco total",86),
 ("Luz RGB para setup gamer","Games",6790,9990,52,"🌈","game","Gamer Station","Seu setup",75),
 ("Kit babador impermeável","Bebê",3790,6990,77,"🍼","baby","Mini Mundo","Dia a dia",81),
 ("Mochila maternidade leve","Bebê",11990,19990,29,"🎒","bag","Mini Mundo","Praticidade",80),
 ("Bolsa organizadora travel","Acessórios",6490,11990,73,"🎒","bag","Style Eve","Para viajar",78),
 ("Óculos de sol casual UV","Acessórios",5390,9990,65,"🕶️","fashion","Style Eve","Para completar",83)
]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
@contextmanager
def connection():
 con=sqlite3.connect(DB,timeout=20)
 con.row_factory=sqlite3.Row
 con.execute("PRAGMA foreign_keys=ON")
 try:yield con;con.commit()
 except:con.rollback();raise
 finally:con.close()
def q(sql,args=()):
 with connection() as con:return [dict(r) for r in con.execute(sql,args).fetchall()]
def one(sql,args=()):
 v=q(sql,args);return v[0] if v else None
def edit(sql,args=()):
 with connection() as con:return con.execute(sql,args).lastrowid
def init():
 with connection() as c:
  c.executescript("""
  create table if not exists users(id integer primary key,name text not null,email text unique not null,passhash text not null,role text not null default 'buyer',created text not null);
  create table if not exists sessions(tokenhash text primary key,user_id integer not null,expires real not null);
  create table if not exists products(id integer primary key,title text not null,category text not null,price integer not null,old_price integer not null,stock integer not null,emoji text,photo text,shop text,blurb text,popularity integer not null default 1,rating real not null default 4.7,review_count integer not null default 0,owner_id integer,created text not null,is_demo integer not null default 1);
  create table if not exists favorites(user_id integer not null,product_id integer not null,primary key(user_id,product_id));
  create table if not exists orders(id integer primary key,user_id integer not null,subtotal integer not null,discount integer not null,shipping integer not null,total integer not null,method text not null,status text not null,recipient text not null,city text not null,state text not null,zip_code text not null,address text not null,created text not null,tracking text not null);
  create table if not exists order_lines(id integer primary key,order_id integer not null,product_id integer,title text not null,unit_price integer not null,quantity integer not null,owner_id integer);
  create table if not exists reviews(id integer primary key,user_id integer not null,product_id integer not null,rating integer not null,comment text not null,created text not null,unique(user_id,product_id));
  create index if not exists idx_products_cat on products(category);
  create index if not exists idx_orders_user on orders(user_id);
  """)
  if c.execute("select count(*) from products").fetchone()[0]==0:
   for i,(title,cat,price,old,stock,emoji,photo,shop,blurb,pop) in enumerate(SEED):
    url="https://images.unsplash.com/"+PHOTO[photo]+"?auto=format&fit=crop&w=650&q=78"
    c.execute("insert into products(title,category,price,old_price,stock,emoji,photo,shop,blurb,popularity,rating,review_count,created) values(?,?,?,?,?,?,?,?,?,?,?,?,?)",
     (title,cat,price,old,stock,emoji,url,shop,blurb,pop,round(4.4+(i%7)*.09,1),(i*37)%650,now()))
def hashpass(p,salt=None):
 salt=salt or secrets.token_hex(16)
 return salt+":"+hashlib.pbkdf2_hmac("sha256",p.encode(),bytes.fromhex(salt),230000).hex()
def checkpass(p,stored):
 try:return hmac.compare_digest(hashpass(p,stored.split(":")[0]),stored)
 except:return False
def user_from(req):
 c=SimpleCookie()
 try:c.load(req.headers.get("Cookie",""))
 except:return None
 token=c.get("evesid")
 if not token:return None
 digest=hashlib.sha256(token.value.encode()).hexdigest()
 return one("select u.id,u.name,u.email,u.role from sessions s join users u on u.id=s.user_id where s.tokenhash=? and s.expires>?",(digest,time.time()))
def valid_text(data,k,maxlen=150,required=True):
 v=str(data.get(k,"")).strip()[:maxlen]
 if required and not v:raise ValueError("Preencha "+k)
 return v
def cents(x):
 try:v=int(x)
 except:raise ValueError("Valor inválido")
 if not 0<=v<=10_000_000:raise ValueError("Valor fora do limite")
 return v
def safe_product(x):
 return {k:x[k] for k in ("id","title","category","price","old_price","stock","emoji","photo","shop","blurb","popularity","rating","review_count","owner_id","created","is_demo") if k in x}
def products_filter(params):
 term=str(params.get("q","")).strip()[:100];cat=str(params.get("category",""))[:60];sort=str(params.get("sort","popular"))
 clauses=[];args=[]
 if term:
  clauses.append("(title like ? or category like ? or shop like ?)")
  args+=["%"+term+"%"]*3
 if cat and cat!="Tudo":
  clauses.append("category=?");args.append(cat)
 if params.get("min"):
  clauses.append("price>=?");args.append(max(0,int(float(params["min"])*100)))
 if params.get("max"):
  clauses.append("price<=?");args.append(max(0,int(float(params["max"])*100)))
 where=(" where "+" and ".join(clauses)) if clauses else ""
 order={"popular":"popularity desc,id","lowest":"price asc,id","highest":"price desc,id","newest":"id desc","rating":"rating desc,id"}.get(sort,"popularity desc,id")
 page=min(500,max(0,int(params.get("page",0))));size=24
 total=one("select count(*) n from products"+where,args)["n"]
 rows=q("select * from products"+where+" order by "+order+" limit ? offset ?",args+[size,page*size])
 return {"items":[safe_product(r) for r in rows],"total":total,"page":page,"page_size":size}
def quote(items,coupon=""):
 if not isinstance(items,list) or not 1<=len(items)<=60:raise ValueError("Carrinho vazio ou muito grande")
 merged={}
 for r in items:
  if not isinstance(r,dict):raise ValueError("Item inválido")
  pid=int(r.get("product_id",0));qty=int(r.get("qty",0))
  if not 1<=qty<=20:raise ValueError("Quantidade inválida")
  merged[pid]=merged.get(pid,0)+qty
  if merged[pid]>20:raise ValueError("Quantidade por produto excedida")
 if len(merged)>35:raise ValueError("Muitos produtos")
 values=[];subtotal=0
 for pid,n in merged.items():
  p=one("select * from products where id=?",(pid,))
  if not p:raise ValueError("Produto não encontrado: "+str(pid))
  if p["stock"]<n:raise ValueError("Estoque insuficiente de "+p["title"])
  values.append({"product_id":pid,"title":p["title"],"unit_price":p["price"],"qty":n,"line_total":p["price"]*n,"stock":p["stock"],"photo":p["photo"],"emoji":p["emoji"]})
  subtotal+=p["price"]*n
 if subtotal>10_000_000:raise ValueError("Carrinho excede o limite demonstrativo")
 coupon=valid_text({"coupon":coupon},"coupon",35,False).upper()
 if coupon and coupon!="EVE10":raise ValueError("Cupom não encontrado")
 if coupon=="EVE10" and subtotal<7000:raise ValueError("EVE10 exige R$ 70,00")
 discount=min(3000,round(subtotal*.10)) if coupon=="EVE10" else 0
 shipping=0 if subtotal-discount>=19990 else 1990
 return {"items":values,"subtotal":subtotal,"discount":discount,"shipping":shipping,"total":subtotal-discount+shipping,"coupon":coupon,"currency":"BRL","simulated":True,"disclaimer":"Compra fictícia: nenhuma cobrança, entrega ou pagamento real."}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,obj,status=200,cookie=None):
  raw=json.dumps(obj,ensure_ascii=False,default=str).encode()
  self.send_response(status);self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Content-Length",str(len(raw)));self.send_header("Cache-Control","no-store");self.send_header("X-Content-Type-Options","nosniff");self.send_header("Referrer-Policy","strict-origin-when-cross-origin")
  if cookie:self.send_header("Set-Cookie",cookie)
  self.end_headers();self.wfile.write(raw)
 def do_GET(self):
  p=urllib.parse.urlsplit(self.path).path
  if p in ("/","/app","/checkout","/vender"):
   raw=(BASE/"index.html").read_bytes()
   self.send_response(200);self.send_header("Content-Type","text/html; charset=utf-8");self.send_header("Content-Length",str(len(raw)));self.send_header("Cache-Control","no-store")
   self.send_header("Content-Security-Policy","default-src 'self' 'unsafe-inline'; img-src 'self' https://images.unsplash.com data:; connect-src 'self'; frame-ancestors 'none'")
   self.end_headers();return self.wfile.write(raw)
  if p=="/favicon.ico":
   self.send_response(204);self.end_headers();return
  if p=="/api/health":return self.send({"ok":True,"name":"EveShoppin","mode":"demo","payment_real":False,"uptime_seconds":int(time.time()-START)})
  if p=="/api/session":return self.send({"user":user_from(self)})
  if p=="/api/categories":return self.send({"categories":[{"name":x,"icon":y,"description":z} for x,y,z in CATEGORIES]})
  if p=="/api/products":
   try:return self.send(products_filter({k:v[0] for k,v in urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).items()}))
   except (ValueError,TypeError):return self.send({"error":"Filtros inválidos"},400)
  if p.startswith("/api/product/"):
   try:pid=int(p.split("/")[-1])
   except:return self.send({"error":"Produto inválido"},400)
   pr=one("select * from products where id=?",(pid,))
   if not pr:return self.send({"error":"Não encontrado"},404)
   reviews=q("select r.rating,r.comment,r.created,u.name from reviews r join users u on u.id=r.user_id where product_id=? order by r.id desc limit 40",(pid,))
   return self.send({"product":safe_product(pr),"reviews":reviews})
  u=user_from(self)
  if p=="/api/stats":
   return self.send({"products":one("select count(*) n from products")["n"],"categories":len(CATEGORIES),"sample_shops":len(set(x[7] for x in SEED)),"orders":"pedidos apenas simulados","note":"Vendas, avaliações iniciais e lojas são ilustrações"})
  if not u:return self.send({"error":"Faça login"},401)
  if p=="/api/orders":
   orders=q("select id,subtotal,discount,shipping,total,method,status,created,tracking,city from orders where user_id=? order by id desc limit 80",(u["id"],))
   return self.send({"orders":orders})
  if p=="/api/seller/products":
   return self.send({"products":[safe_product(x) for x in q("select * from products where owner_id=? order by id desc",(u["id"],))]})
  if p=="/api/seller/orders":
   if u["role"]!="seller":return self.send({"error":"Perfil de vendedor necessário"},403)
   return self.send({"lines":q("select l.title,l.quantity,l.unit_price,o.id as order_id,o.status,o.created from order_lines l join orders o on o.id=l.order_id where l.owner_id=? order by o.id desc limit 100",(u["id"],))})
  if p=="/api/favorites":
   return self.send({"favorites":[x["product_id"] for x in q("select product_id from favorites where user_id=?",(u["id"],))]})
  return self.send({"error":"Rota inexistente"},404)
 def do_POST(self):
  try:
   origin=self.headers.get("Origin","")
   if origin:
    o=urllib.parse.urlsplit(origin)
    if o.netloc!=self.headers.get("Host","") or o.scheme not in ("http","https"):return self.send({"error":"Origem bloqueada"},403)
   length=int(self.headers.get("Content-Length","0"))
   if not 0<=length<=45000:raise ValueError("Requisição grande demais")
   data=json.loads(self.rfile.read(length) or b"{}")
   if not isinstance(data,dict):raise ValueError("JSON deve ser objeto")
   p=urllib.parse.urlsplit(self.path).path
   if p=="/api/cart/quote":return self.send(quote(data.get("items",[]),data.get("coupon","")))
   if p=="/api/register":
    name=valid_text(data,"name",100);email=valid_text(data,"email",160).lower();password=valid_text(data,"password",120)
    role=valid_text(data,"role",20,False) or "buyer"
    if role not in ("buyer","seller") or "@" not in email or len(password)<10:raise ValueError("Informe e-mail e senha de pelo menos 10 caracteres")
    try:uid=edit("insert into users(name,email,passhash,role,created) values(?,?,?,?,?)",(name,email,hashpass(password),role,now()))
    except sqlite3.IntegrityError:return self.send({"error":"E-mail já cadastrado"},409)
    return self.login(uid)
   if p=="/api/login":
    email=valid_text(data,"email",160).lower();password=valid_text(data,"password",120)
    ip=self.client_address[0];recent=[a for a in FAILS.get(ip,[]) if time.time()-a<600]
    if len(recent)>=12:return self.send({"error":"Limite de tentativas; aguarde"},429)
    usr=one("select id,passhash from users where email=?",(email,))
    if not usr or not checkpass(password,usr["passhash"]):
     recent.append(time.time());FAILS[ip]=recent
     return self.send({"error":"E-mail ou senha incorretos"},401)
    FAILS.pop(ip,None);return self.login(usr["id"])
   u=user_from(self)
   if not u:return self.send({"error":"Faça login"},401)
   if p=="/api/logout":
    c=SimpleCookie()
    try:c.load(self.headers.get("Cookie",""))
    except:pass
    if c.get("evesid"):edit("delete from sessions where tokenhash=?",(hashlib.sha256(c["evesid"].value.encode()).hexdigest(),))
    return self.send({"ok":True},cookie="evesid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
   if p=="/api/favorites":
    pid=int(data.get("product_id",0))
    if not one("select id from products where id=?",(pid,)):raise ValueError("Produto inexistente")
    old=one("select product_id from favorites where user_id=? and product_id=?",(u["id"],pid))
    if old:edit("delete from favorites where user_id=? and product_id=?",(u["id"],pid));value=False
    else:edit("insert into favorites(user_id,product_id) values(?,?)",(u["id"],pid));value=True
    return self.send({"ok":True,"favorited":value})
   if p=="/api/checkout":
    quoted=quote(data.get("items",[]),data.get("coupon",""))
    recipient=valid_text(data,"recipient",100);city=valid_text(data,"city",100);state=valid_text(data,"state",2).upper();zip_code=re.sub(r"\D","",valid_text(data,"zip_code",12));address=valid_text(data,"address",180)
    if len(state)!=2 or len(zip_code)!=8:raise ValueError("Informe UF e CEP válido (8 dígitos)")
    method=valid_text(data,"method",30)
    if method not in ("pix_demo","boleto_demo","cartao_demo"):raise ValueError("Método demonstrativo inválido")
    with connection() as c:
     # Serializa reservas de estoque durante o checkout.
     c.execute("BEGIN IMMEDIATE")
     for item in quoted["items"]:
      cur=c.execute("update products set stock=stock-? where id=? and stock>=?",(item["qty"],item["product_id"],item["qty"]))
      if cur.rowcount!=1:raise ValueError("Estoque mudou; revise carrinho")
     cur=c.execute("insert into orders(user_id,subtotal,discount,shipping,total,method,status,recipient,city,state,zip_code,address,created,tracking) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (u["id"],quoted["subtotal"],quoted["discount"],quoted["shipping"],quoted["total"],method,"pedido_demo_confirmado",recipient,city,state,zip_code,address,now(),"EVE-DEMO-"+secrets.token_hex(4).upper()))
     oid=cur.lastrowid
     for item in quoted["items"]:
      p2=c.execute("select owner_id from products where id=?",(item["product_id"],)).fetchone()
      c.execute("insert into order_lines(order_id,product_id,title,unit_price,quantity,owner_id) values(?,?,?,?,?,?)",(oid,item["product_id"],item["title"],item["unit_price"],item["qty"],p2["owner_id"]))
    return self.send({"ok":True,"order_id":oid,"tracking":"EVED-"+str(oid).zfill(6),"total":quoted["total"],"status":"pedido_demo_confirmado","payment_real":False,"delivery_real":False,"message":"Pedido demonstrativo registrado. Nenhum pagamento ou entrega reais ocorrerão."})
   if p=="/api/seller/product":
    if u["role"]!="seller":return self.send({"error":"Registre-se como vendedor"},403)
    title=valid_text(data,"title",150);cat=valid_text(data,"category",60);blurb=valid_text(data,"blurb",260,False);emoji=valid_text(data,"emoji",8,False) or "📦"
    if cat not in [c[0] for c in CATEGORIES]:raise ValueError("Categoria inválida")
    price=cents(data.get("price",0));old=cents(data.get("old_price",0));stock=int(data.get("stock",0))
    if not 100<=price<=5000000 or not 0<=stock<=10000:raise ValueError("Preço ou estoque fora do limite")
    photo=valid_text(data,"photo",500,False)
    if photo:
     parsed=urllib.parse.urlsplit(photo)
     if parsed.scheme!="https" or parsed.hostname!="images.unsplash.com":raise ValueError("Foto ilustrativa precisa ser Unsplash HTTPS")
    else:photo="https://images.unsplash.com/"+PHOTO["bag"]+"?auto=format&fit=crop&w=650&q=70"
    ident=edit("insert into products(title,category,price,old_price,stock,emoji,photo,shop,blurb,popularity,rating,review_count,owner_id,created,is_demo) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
       (title,cat,price,old,stock,emoji,photo,u["name"],blurb,1,0,0,u["id"],now(),1))
    return self.send({"ok":True,"id":ident,"notice":"Anúncio demonstrativo cadastrado; sem vendas reais."})
   if p=="/api/seller/stock":
    if u["role"]!="seller":return self.send({"error":"Perfil de vendedor necessário"},403)
    pid=int(data.get("product_id",0));stock=int(data.get("stock",-1))
    if not 0<=stock<=10000:raise ValueError("Estoque inválido")
    old=one("select id from products where id=? and owner_id=?",(pid,u["id"]))
    if not old:raise ValueError("Seu anúncio não foi encontrado")
    edit("update products set stock=? where id=? and owner_id=?",(stock,pid,u["id"]))
    return self.send({"ok":True})
   if p=="/api/review":
    pid=int(data.get("product_id",0));rating=int(data.get("rating",0));comment=valid_text(data,"comment",500)
    if not 1<=rating<=5 or len(comment)<8:raise ValueError("Nota 1 a 5 e comentário de 8+ caracteres")
    if not one("select id from products where id=?",(pid,)):raise ValueError("Produto inexistente")
    if not one("select 1 from order_lines l join orders o on o.id=l.order_id where o.user_id=? and l.product_id=?",(u["id"],pid)):raise ValueError("Avaliações exigem pedido demonstrativo anterior")
    try:edit("insert into reviews(user_id,product_id,rating,comment,created) values(?,?,?,?,?)",(u["id"],pid,rating,comment,now()))
    except sqlite3.IntegrityError:raise ValueError("Você já avaliou este produto")
    return self.send({"ok":True,"demo_only":True})
   return self.send({"error":"Rota inválida"},404)
  except (ValueError,TypeError) as e:return self.send({"error":str(e)[:210]},400)
  except Exception as e:return self.send({"error":"Erro: "+type(e).__name__},503)
 def login(self,uid):
  token=secrets.token_urlsafe(32);hashed=hashlib.sha256(token.encode()).hexdigest()
  edit("insert into sessions(tokenhash,user_id,expires) values(?,?,?)",(hashed,uid,time.time()+SESSIONS_LIMIT))
  u=one("select id,name,email,role from users where id=?",(uid,))
  secure="; Secure" if self.headers.get("X-Forwarded-Proto","").lower()=="https" else ""
  return self.send({"ok":True,"user":u},cookie="evesid="+token+"; HttpOnly; SameSite=Strict; Path=/; Max-Age="+str(SESSIONS_LIMIT)+secure)
def serve():
 init()
 http=ThreadingHTTPServer((HOST,PORT),Handler)
 url="http://127.0.0.1:"+str(PORT)+"/"
 print("EVESHOPPIN_ONLINE="+url,flush=True)
 if "--no-open" not in sys.argv and os.environ.get("RENDER") is None:threading.Timer(1,lambda:webbrowser.open(url)).start()
 try:http.serve_forever()
 except KeyboardInterrupt:pass
 finally:http.server_close()
if __name__=="__main__":serve()
