'use strict';
const $ = id => document.getElementById(id);
const state = {user:null,csrf:null,posts:[],filter:'all',view:'inicio',gpsWatch:null,gps:null,selectedRide:null,offerId:null,authMode:'login',map:null,pickMap:null,markers:[],gpsMarker:null,routeLine:null,pickMarkers:[],pickMode:null};
const escapeHTML = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const date = t => new Date(Number(t)*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const coord = (lat,lon) => `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`;
const kindLabel=k=>k==='ride'?'🚘 VIAGEM':'📦 ENCOMENDA';
const mapsLink=p=>`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(p.start_lat+','+p.start_lon)}&destination=${encodeURIComponent(p.end_lat+','+p.end_lon)}&travelmode=driving`;
let toastTimer;
function toast(t){const box=$('toast');box.textContent=t;box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),4500)}
function message(id,txt,ok=false){const e=$(id);e.textContent=txt;e.className='feedback '+(ok?'success':'error')}
async function api(path,opts={}){
 const method=opts.method||'GET';const headers={'Accept':'application/json'};
 if(opts.body)headers['Content-Type']='application/json';
 if(method!=='GET'&&state.csrf)headers['X-CSRF-Token']=state.csrf;
 let res;
 try{res=await fetch(path,{credentials:'same-origin',method,headers,body:opts.body?JSON.stringify(opts.body):undefined})}
 catch {throw new Error('Não foi possível conectar. Confira a conexão e tente novamente.')}
 let data={};try{data=await res.json()}catch{throw new Error('Resposta inesperada do servidor.')}
 if(!res.ok)throw new Error(data.error||`Falha ${res.status}`);
 return data;
}
function requireAccount(){if(state.user)return true;openAuth();toast('Entre para publicar e trocar mensagens.');return false}
function setView(name){
 if(!['inicio','publicar','minhas','conversas'].includes(name))name='inicio';
 state.view=name;
 document.querySelectorAll('.view').forEach(e=>e.classList.toggle('active',e.id==='view-'+name));
 document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===name));
 location.hash=name;
 if(name==='inicio'){initMap();renderPosts();setTimeout(()=>state.map?.invalidateSize(),200)}
 if(name==='publicar'){initPickMap();setTimeout(()=>state.pickMap?.invalidateSize(),200)}
 if(name==='minhas')loadMine();
 if(name==='conversas')loadOffers();
 window.scrollTo({top:0,behavior:'smooth'});
}
function updateAccount(){
 $('accountBtn').textContent=state.user?`@${state.user.handle} · Sair`:'Entrar / Criar conta';
}
async function refreshMe(){const r=await api('/api/me');state.user=r.user;state.csrf=r.csrf;updateAccount()}
function openAuth(){ $('authModal').classList.remove('hidden'); $('handle').focus()}
function closeAuth(){$('authModal').classList.add('hidden');message('authFeedback','')}
function authTab(mode){state.authMode=mode;
 $('tabLogin').classList.toggle('selected',mode==='login');$('tabRegister').classList.toggle('selected',mode==='register');
 $('registerConsent').classList.toggle('hidden',mode!=='register');
 $('authHeading').textContent=mode==='register'?'Crie sua conta':'Entre no CONEXA';
 $('authSubmit').textContent=mode==='register'?'Criar conta':'Entrar';
 $('password').autocomplete=mode==='register'?'new-password':'current-password';
 message('authFeedback','');}
async function handleAuth(e){e.preventDefault();const f=new FormData(e.currentTarget);
 try{const r=await api(state.authMode==='register'?'/api/register':'/api/login',{method:'POST',body:{handle:f.get('handle'),password:f.get('password'),adult:f.get('adult')==='on',terms:f.get('terms')==='on'}});
 state.user=r.user;state.csrf=r.csrf;updateAccount();closeAuth();$('authForm').reset();toast(`Bem-vindo, @${state.user.handle}!`);
 if(state.view==='minhas')loadMine();if(state.view==='conversas')loadOffers();}
 catch(err){message('authFeedback',err.message)}}
function updateKind(kind){const f=$('postForm');f.elements.kind.value=kind;document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('selected',b.dataset.kind===kind));
 $('capacityLabel').textContent=kind==='ride'?'Capacidade disponível (kg)':'Peso da encomenda (kg)';
 $('vehicleField').classList.toggle('hidden',kind!=='ride');$('detourField').classList.toggle('hidden',kind!=='ride');
 $('priceLabel').textContent=kind==='ride'?'Valor indicativo para combinar (R$)':'Valor que oferece pelo transporte (R$)';
 $('dimensionsLabel').textContent=kind==='ride'?'Espaço útil livre para a carga (cm) — meça antes de publicar':'Dimensões da encomenda (cm) — informe medidas reais';
}
function getFormPost(form){const f=new FormData(form);const kind=f.get('kind');const departure=Math.floor(new Date(String(f.get('departure'))).getTime()/1000);
 return {kind,title:f.get('title'),start_name:f.get('start_name'),end_name:f.get('end_name'),
 start_lat:Number(f.get('start_lat')),start_lon:Number(f.get('start_lon')),end_lat:Number(f.get('end_lat')),end_lon:Number(f.get('end_lon')),
 departure,capacity_kg:Number(f.get('capacity_kg')),length_cm:Number(f.get('length_cm')),width_cm:Number(f.get('width_cm')),height_cm:Number(f.get('height_cm')),max_detour_km:kind==='ride'?Number(f.get('max_detour_km')):0,
 price:Number(f.get('price')),vehicle:kind==='ride'?(f.get('vehicle')||'Não informado'):'Encomenda',details:f.get('details')||'Sem observações'};
}
async function handlePublish(e){e.preventDefault();if(!requireAccount())return;
 try{const r=await api('/api/posts',{method:'POST',body:getFormPost(e.currentTarget)});message('postFeedback','Publicado com sucesso! ID #'+r.id,true);toast('Sua publicação agora aparece na lista de oportunidades.');e.currentTarget.reset();updateKind('ride');await refreshPosts();setView('minhas')}
 catch(err){message('postFeedback',err.message)}}
async function refreshPosts(){try{const r=await api('/api/posts');state.posts=r.posts;$('postCount').textContent=String(state.posts.length);renderPosts();}
 catch(err){$('postsList').textContent=err.message;toast(err.message)}}
function cardPost(p,context='public'){
 const el=document.createElement('div');el.className=context==='public'?'post-item':'card';
 const myself=state.user?.id===p.user_id;
 const status=p.status==='active'?'ATIVO':'ENCERRADO';
 const buttons=context==='mine'?`<button class="mini-btn" data-action="matches" data-id="${p.id}" ${p.kind==='ride'&&p.status==='active'?'':'disabled'}>Encontrar candidatos</button><button class="mini-btn outline" data-action="close" data-id="${p.id}" ${p.status==='active'?'':'disabled'}>Encerrar</button>`:
 `<button class="mini-btn" data-action="offer" data-id="${p.id}" ${myself?'disabled':''}>Tenho interesse</button><button class="mini-btn outline" data-action="navigate" data-id="${p.id}">Ver pontos</button>`;
 el.innerHTML=`<div class="post-meta"><span class="pill ${p.kind==='ride'?'blue':''}">${kindLabel(p.kind)}</span><span>@${escapeHTML(p.handle)}</span><span>· ${context==='mine'?status:date(p.departure)}</span></div>
 <h3>${escapeHTML(p.title)}</h3><p><strong>${escapeHTML(p.start_name)}</strong> → <strong>${escapeHTML(p.end_name)}</strong></p>
 <p>${p.kind==='ride'?'Capacidade':'Peso'}: ${escapeHTML(p.capacity_kg)} kg · ${p.kind==='ride'?escapeHTML(p.vehicle)+' · Máx. desvio geométrico '+escapeHTML(p.max_detour_km)+' km':escapeHTML(p.details)}</p>
 <p>Dimensões ${escapeHTML(p.length_cm)} × ${escapeHTML(p.width_cm)} × ${escapeHTML(p.height_cm)} cm</p>
 <div class="post-foot"><span class="price">${money(p.price)}</span><div class="card-actions">${buttons}</div></div>
 ${context==='mine'?`<div id="matches-${p.id}" class="match-results"></div>`:''}`;
 el.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>dispatchPost(b.dataset.action,p)));
 return el;
}
function renderPosts(){
 const list=$('postsList');list.replaceChildren();
 const posts=state.posts.filter(p=>state.filter==='all'||p.kind===state.filter);
 if(!posts.length){list.innerHTML='<div class="empty"><strong>Nenhuma oportunidade publicada neste filtro.</strong><br>O CONEXA não inventa anúncios. Seja uma das primeiras pessoas a cadastrar uma viagem ou encomenda.</div>'}
 else posts.forEach(p=>list.append(cardPost(p)));
 drawMap(state.posts.filter(p=>state.filter==='all'||p.kind===state.filter));
}
async function dispatchPost(action,p){
 if(action==='navigate'){window.open(mapsLink(p),'_blank','noopener,noreferrer');focusPost(p);return}
 if(!requireAccount())return;
 if(action==='offer'){
   const messageText=prompt(`Sua proposta para “${p.title}” (mínimo 10 caracteres). Não envie CPF, senhas ou pagamento antecipado.`);
   if(messageText===null)return;
   try{await api('/api/offers',{method:'POST',body:{post_id:p.id,message:messageText}});toast('Proposta enviada! Acompanhe em Conversas.');setView('conversas')}
   catch(err){toast(err.message)}
 }else if(action==='close'){
   if(!confirm('Encerrar esta publicação?'))return;
   try{await api('/api/close',{method:'POST',body:{post_id:p.id}});toast('Publicação encerrada.');loadMine();refreshPosts()}
   catch(err){toast(err.message)}
 }else if(action==='matches')findMatches(p);
}
async function loadMine(){const target=$('myPosts');target.replaceChildren();if(!state.user){target.innerHTML='<div class="empty">Entre para gerenciar suas publicações.</div>';return}
 try{const {posts}=await api('/api/my-posts');if(!posts.length){target.innerHTML='<div class="empty">Você ainda não publicou nada. Cadastre uma viagem ou encomenda para começar.</div>';return}
 posts.forEach(p=>target.append(cardPost(p,'mine')))}catch(err){target.textContent=err.message}}
async function findMatches(p){const target=$('matches-'+p.id);if(!target)return;target.textContent='Calculando candidatos geométricos...';
 try{const result=await api('/api/matches',{method:'POST',body:{ride_id:p.id}});target.replaceChildren();
   const progress=(a,b,c)=>{const dx=b[0]-a[0],dy=(b[1]-a[1])*Math.cos(a[0]*Math.PI/180);const px=c[0]-a[0],py=(c[1]-a[1])*Math.cos(a[0]*Math.PI/180);return (dx*px+dy*py)/(dx*dx+dy*dy||1)};
   const nowProgress=state.gps?progress([p.start_lat,p.start_lon],[p.end_lat,p.end_lon],state.gps):-1;
   const matches=result.matches.filter(m=>!state.gps || progress([p.start_lat,p.start_lon],[p.end_lat,p.end_lon],[m.post.start_lat,m.post.start_lon])>=nowProgress-0.02);
   const title=document.createElement('p');title.className='hint';title.textContent=`${matches.length} candidato(s) ${state.gps?'à frente da sua posição aproximada':'na viagem cadastrada'}. GPS fica no aparelho; distância extra é limite inferior geométrico — não km rodoviário nem minutos.`;target.append(title);
   if(!matches.length){const x=document.createElement('p');x.className='hint';x.textContent='Nenhuma encomenda compatível neste momento. Volte quando houver novos pedidos reais.';target.append(x)}
   matches.forEach(m=>{const el=document.createElement('div');el.className='card';el.style.marginTop='10px';const d=document.createElement('strong');d.textContent=m.post.title;const note=document.createElement('p');note.textContent=`${m.post.start_name} → ${m.post.end_name} | Limite inferior de desvio: ${m.compatibility.lower_bound_extra_km} km, exige confirmar o trajeto.`;const btn=document.createElement('button');btn.className='mini-btn';btn.textContent='Falar com a pessoa';btn.onclick=()=>dispatchPost('offer',m.post);el.append(d,note,btn);target.append(el)})}
 catch(err){target.textContent=err.message}}
async function loadOffers(){const target=$('offersList');target.replaceChildren();if(!state.user){target.innerHTML='<div class="empty">Entre para receber ou enviar propostas.</div>';return}
 try{const {offers}=await api('/api/offers');if(!offers.length){target.innerHTML='<div class="empty">Ainda não há propostas. Converse com outro usuário através de um anúncio real.</div>';return}
 offers.forEach(o=>{const mine=o.owner_id===state.user.id;const el=document.createElement('div');el.className='card';
 const h=document.createElement('h3');h.textContent=o.title;const p=document.createElement('p');p.textContent=`${mine?'Proposta de @'+o.from_handle:'Sua proposta para @'+o.to_handle} · ${o.status==='pending'?'Aguardando':o.status==='accepted'?'Aceita':'Recusada'}`;
 const quote=document.createElement('p');quote.textContent='“'+o.message+'”';quote.style.marginTop='7px';el.append(h,p,quote);
 const row=document.createElement('div');row.className='card-actions';const chat=document.createElement('button');chat.className='mini-btn outline';chat.textContent='Abrir conversa';chat.onclick=()=>openChat(o);row.append(chat);
 if(mine && o.status==='pending')for(const [status,label] of [['accepted','Aceitar'],['rejected','Recusar']]){const btn=document.createElement('button');btn.className='mini-btn';btn.textContent=label;btn.onclick=async()=>{if(!confirm(`${label} proposta? O aplicativo não processa pagamentos.`))return;try{await api('/api/respond',{method:'POST',body:{offer_id:o.id,status}});loadOffers();toast('Resposta registrada.')}catch(err){toast(err.message)}};row.append(btn)}
 el.append(row);target.append(el)})}catch(err){target.textContent=err.message}}
async function openChat(o){state.offerId=o.id;$('conversationTitle').textContent=`Conversa · ${o.title}`;$('conversation').classList.remove('hidden');await loadChat();$('conversation').scrollIntoView({behavior:'smooth'})}
async function loadChat(){if(!state.offerId)return;const area=$('messageList');area.replaceChildren();try{const {messages}=await api('/api/messages?offer_id='+encodeURIComponent(state.offerId));if(!messages.length){area.innerHTML='<div class="empty">Sem mensagens ainda. Combine detalhes com cuidado e não faça pagamentos antecipados.</div>'}else{messages.forEach(m=>{const b=document.createElement('div');b.className='message'+(m.sender_id===state.user.id?' mine':'');const v=document.createElement('div');v.textContent=m.body;const meta=document.createElement('small');meta.textContent=`@${m.handle} · ${date(m.created_at)}`;b.append(v,meta);area.append(b)})}area.scrollTop=area.scrollHeight}catch(err){area.textContent=err.message}}
async function sendMessage(e){e.preventDefault();if(!state.offerId)return;const body=$('messageInput').value;try{await api('/api/messages',{method:'POST',body:{offer_id:state.offerId,body}});$('messageInput').value='';loadChat()}catch(err){toast(err.message)}}
function initMap(){if(state.map||!window.L)return;state.map=L.map('map',{scrollWheelZoom:false}).setView([-23.45,-46.75],9);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.map);drawMap(state.posts)}
function drawMap(posts){if(!state.map)return;state.markers.forEach(x=>state.map.removeLayer(x));state.markers=[];
 posts.forEach(p=>{const color=p.kind==='ride'?'#3273ba':'#098b5f';const m=L.circleMarker([p.start_lat,p.start_lon],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:.95}).addTo(state.map);m.bindPopup(`<strong>${escapeHTML(p.title)}</strong><br>${escapeHTML(p.start_name)} → ${escapeHTML(p.end_name)}<br>${money(p.price)}`);state.markers.push(m)})}
function focusPost(p){setView('inicio');setTimeout(()=>{if(!state.map)return;state.map.setView([p.start_lat,p.start_lon],11);if(state.routeLine)state.map.removeLayer(state.routeLine);state.routeLine=L.polyline([[p.start_lat,p.start_lon],[p.end_lat,p.end_lon]],{color:'#12a978',dashArray:'6 8',weight:4}).addTo(state.map);toast('Linha reta ilustrativa. Confira a rota rodoviária na aba aberta.')},140)}
function initPickMap(){if(state.pickMap||!window.L)return;state.pickMap=L.map('pickMap',{scrollWheelZoom:false}).setView([-23.45,-46.75],9);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(state.pickMap);
 state.pickMap.on('click',e=>{if(!state.pickMode){$('pickStatus').textContent='Escolha primeiro “Marcar origem” ou “Marcar destino”.';return}const prefix=state.pickMode;setCoords(prefix,e.latlng.lat,e.latlng.lng);$('pickStatus').textContent=`Ponto ${prefix==='start'?'de origem':'de destino'} marcado aproximadamente: ${coord(e.latlng.lat,e.latlng.lng)}.`;state.pickMode=null})}
function setCoords(prefix,lat,lon){$(prefix+'_lat').value=Number(lat).toFixed(2);$(prefix+'_lon').value=Number(lon).toFixed(2);if(state.pickMap){const idx=prefix==='start'?0:1;if(state.pickMarkers[idx])state.pickMap.removeLayer(state.pickMarkers[idx]);state.pickMarkers[idx]=L.marker([Number(lat).toFixed(2),Number(lon).toFixed(2)]).addTo(state.pickMap)}}
function haversine(a,b){const r=Math.PI/180;const d1=(b[0]-a[0])*r,d2=(b[1]-a[1])*r;const q=Math.sin(d1/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(d2/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(q)))}
function gpsStart(){if(!navigator.geolocation){toast('GPS não disponível neste navegador.');return}if(state.gpsWatch!==null){navigator.geolocation.clearWatch(state.gpsWatch);state.gpsWatch=null;state.gps=null;if(state.map&&state.gpsMarker){state.map.removeLayer(state.gpsMarker);state.gpsMarker=null;}$('gpsBtn').textContent='◎ Ativar meu GPS';$('gpsState').textContent='GPS desativado';$('gpsDetail').textContent='Localização desligada; nenhum rastreio continua.';return}
 $('gpsState').textContent='Solicitando permissão...';state.gpsWatch=navigator.geolocation.watchPosition(pos=>{
 const {latitude,longitude,accuracy}=pos.coords;state.gps=[latitude,longitude];$('gpsBtn').textContent='◼ Desativar meu GPS';$('gpsState').textContent=`GPS ativo · precisão ±${Math.round(accuracy)} m`;
 $('gpsDetail').textContent=`Posição vista apenas neste dispositivo: ${coord(latitude,longitude)}. Não é compartilhada com outros usuários nem gravada pelo servidor.`;
 if(state.map){if(state.gpsMarker)state.map.removeLayer(state.gpsMarker);state.gpsMarker=L.circleMarker([latitude,longitude],{radius:10,fillColor:'#18bf7a',color:'#fff',weight:3,fillOpacity:1}).addTo(state.map)}
 }, err=>{$('gpsState').textContent='GPS indisponível';$('gpsDetail').textContent=err.code===1?'Você não autorizou o acesso à localização.':'Erro ao obter localização; use pontos manuais.';navigator.geolocation.clearWatch(state.gpsWatch);state.gpsWatch=null;$('gpsBtn').textContent='◎ Ativar meu GPS'}, {enableHighAccuracy:true,maximumAge:8000,timeout:20000})}
function useGpsOrigin(){if(!state.gps){toast('Ative primeiro o GPS no início e permita a localização.');return}setCoords('start',...state.gps);toast('Origem aproximada definida. Revise o ponto antes de publicar.');if(state.pickMap)state.pickMap.setView(state.gps,12)}
function initialize(){
 document.querySelectorAll('[data-view]').forEach(e=>e.addEventListener('click',()=>setView(e.dataset.view)));
 document.querySelectorAll('[data-filter]').forEach(e=>e.addEventListener('click',()=>{state.filter=e.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===e));renderPosts()}));
 document.querySelectorAll('[data-kind]').forEach(e=>e.addEventListener('click',()=>updateKind(e.dataset.kind)));
 $('authForm').addEventListener('submit',handleAuth);$('postForm').addEventListener('submit',handlePublish);$('messageForm').addEventListener('submit',sendMessage);
 $('tabLogin').addEventListener('click',()=>authTab('login'));$('tabRegister').addEventListener('click',()=>authTab('register'));
 $('closeAuth').addEventListener('click',closeAuth);$('authModal').addEventListener('click',e=>{if(e.target===$('authModal'))closeAuth()});
 $('accountBtn').addEventListener('click',async()=>{if(!state.user){openAuth();return}if(!confirm('Sair da conta?'))return;try{await api('/api/logout',{method:'POST',body:{}});state.user=null;state.csrf=null;updateAccount();toast('Sessão encerrada.');setView('inicio')}catch(err){toast(err.message)}});
 $('gpsBtn').addEventListener('click',gpsStart);$('refreshBtn').addEventListener('click',refreshPosts);
 $('resetMap').addEventListener('click',()=>state.map?.setView([-23.45,-46.75],9));
 $('originPick').addEventListener('click',()=>{initPickMap();state.pickMode='start';$('pickStatus').textContent='Agora clique no mapa para selecionar a origem.'});
 $('destPick').addEventListener('click',()=>{initPickMap();state.pickMode='end';$('pickStatus').textContent='Agora clique no mapa para selecionar o destino.'});
 $('useGpsOrigin').addEventListener('click',useGpsOrigin);
 $('closeChat').addEventListener('click',()=>{$('conversation').classList.add('hidden');state.offerId=null});
 updateKind('ride');refreshMe().catch(err=>toast(err.message));refreshPosts();
 const requested=location.hash.replace('#','');setView(['inicio','publicar','minhas','conversas'].includes(requested)?requested:'inicio');
 if(!window.L)toast('Mapa indisponível: continue usando as listas e formulários.');
}
window.addEventListener('DOMContentLoaded', initialize);
