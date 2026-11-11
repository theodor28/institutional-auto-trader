(function(){
"use strict";
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DATA_KEY="steiner_mini_os_drive_v1";
const PREF_KEY="steiner_mini_os_preferences_v1";
const APPS=[
{id:"explorer",name:"Arquivos",icon:"📁",w:750,h:490},
{id:"notepad",name:"Bloco de Notas",icon:"📝",w:680,h:480},
{id:"calculator",name:"Calculadora",icon:"🧮",w:390,h:510},
{id:"paint",name:"Paint",icon:"🎨",w:780,h:550},
{id:"terminal",name:"Terminal",icon:"⌨️",w:670,h:440},
{id:"browser",name:"Navegador",icon:"🌐",w:760,h:510},
{id:"settings",name:"Configurações",icon:"⚙️",w:570,h:510},
{id:"tasks",name:"Gerenciador",icon:"📊",w:570,h:470},
{id:"cloud",name:"Ponte Cloud",icon:"🔌",w:730,h:550},
{id:"about",name:"Sobre o sistema",icon:"💠",w:510,h:430}
];
const APP_BY_ID=Object.fromEntries(APPS.map(a=>[a.id,a]));
const stockFS=()=>({
"Área de Trabalho":{type:"folder"},"Documentos":{type:"folder"},"Imagens":{type:"folder"},"Downloads":{type:"folder"},
"Documentos/Bem-vindo.txt":{type:"text",content:"BEM-VINDO AO STEINER MINI OS\n\nEste é um mini desktop virtual que roda no navegador.\n\nAbra o Explorador para criar pastas e arquivos.\nNo Bloco de Notas, edite e salve documentos no disco virtual.\nNo Paint, desenhe e exporte PNGs.\nNa Calculadora, resolva contas.\nNo Terminal, use HELP para conhecer os comandos.\n\nSeus arquivos reais do Windows não são modificados.\nOs dados virtuais são guardados no armazenamento deste navegador.\nVocê pode exportar arquivos para guardá-los fora daqui.\n\nFeito com a STEINER-PONTE."},
"Área de Trabalho/LEIA-ME.txt":{type:"text",content:"STEINER MINI OS v1.0\n\nSeu sistema de bolso, com arquivos, janelas, aplicativos e personalização.\n\nDê dois cliques nos ícones para abrir.\nUse Iniciar para ver todos os aplicativos.\n\nIsto não executa programas .exe nem substitui o Windows original."}
});
function readJSON(key,fallback){try{const s=localStorage.getItem(key);return s?JSON.parse(s):fallback;}catch{return fallback;}}
let fs=readJSON(DATA_KEY,stockFS());
if(!fs||typeof fs!=="object"||Array.isArray(fs)){fs=stockFS();}
let prefs=readJSON(PREF_KEY,{theme:"dark",accent:"#61b9ff",wallpaper:"blue"});
let windows=new Map(),seq=0,z=50,toaster=null;
function toast(msg){const el=$("#toast");el.textContent=msg;el.style.display="block";clearTimeout(toaster);toaster=setTimeout(()=>el.style.display="none",3500);}
function persistFS(){try{localStorage.setItem(DATA_KEY,JSON.stringify(fs));return true;}catch{toast("Sem espaço para salvar no navegador. Exporte seus arquivos.");return false;}}
function persistPrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch{}}
function applyPrefs(){
document.body.classList.toggle("light",prefs.theme==="light");
document.documentElement.style.setProperty("--accent",prefs.accent||"#61b9ff");
const bg=prefs.wallpaper||"blue";
const colors=bg==="violet"?["#29205c","#160c38"]:bg==="sunset"?["#8a3561","#3c1a4f"]:bg==="forest"?["#05453e","#081e31"]:["#082e6f","#0b0f2b"];
document.documentElement.style.setProperty("--desktop1",colors[0]);
document.documentElement.style.setProperty("--desktop2",colors[1]);
}
function parentPath(path){const i=path.lastIndexOf("/");return i<0?"":path.substring(0,i);}
function baseName(path){return path.split("/").pop();}
function joinPath(p,name){return p?p+"/"+name:name;}
function validName(name){return !!name&&name.length<90&&!/[\\/\x00-\x1f]/.test(name)&&name!=="."&&name!=="..";}
function listFolder(path){return Object.entries(fs).filter(([p])=>parentPath(p)===path).sort((a,b)=>(a[1].type==="folder"?0:1)-(b[1].type==="folder"?0:1)||baseName(a[0]).localeCompare(baseName(b[0]),"pt-BR"));}
function removePath(p){for(const key of Object.keys(fs)){if(key===p||key.startsWith(p+"/"))delete fs[key];}persistFS();}
function renamePath(p,next){const updated={};for(const [key,obj] of Object.entries(fs)){if(key===p||key.startsWith(p+"/")){updated[next+key.slice(p.length)]=obj;}else updated[key]=obj;}fs=updated;persistFS();}
function pathDisplay(p){return p?"Este Computador / "+p:"Este Computador";}
function saveText(path,text){fs[path]={type:"text",content:text};return persistFS();}
function download(name,data,type="text/plain;charset=utf-8"){
const b=data instanceof Blob?data:new Blob([data],{type});
const link=document.createElement("a");link.href=URL.createObjectURL(b);link.download=name;document.body.append(link);link.click();setTimeout(()=>{URL.revokeObjectURL(link.href);link.remove();},1500);
}
function makeWindow(app,opts={}){
const meta=APP_BY_ID[app];if(!meta)return null;
$("#startMenu").classList.remove("open");
const id="w"+(++seq),layer=$("#windows");
const el=document.createElement("section");el.className="window";el.dataset.id=id;el.setAttribute("aria-label",meta.name);
const WW=Math.min(meta.w,Math.max(340,innerWidth-40)),HH=Math.min(meta.h,Math.max(260,innerHeight-110));
el.style.width=WW+"px";el.style.height=HH+"px";
el.style.left=Math.max(8,Math.min((innerWidth-WW)/2+(seq%5)*24,innerWidth-WW-8))+"px";
el.style.top=Math.max(7,Math.min(50+(seq%5)*18,innerHeight-HH-70))+"px";
el.innerHTML='<div class="win-title"><b>'+meta.icon+" "+escapeHTML(meta.name)+'</b><div class="win-actions"><button data-act="min" title="Minimizar">─</button><button data-act="max" title="Maximizar">▢</button><button class="close" data-act="close" title="Fechar">✕</button></div></div><div class="win-body"></div>';
layer.append(el);
const w={id,app,meta,el,body:$(".win-body",el),state:{...opts},minimized:false,maximized:false};
windows.set(id,w);
$$("[data-act]",el).forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();const action=btn.dataset.act;if(action==="close")closeWindow(id);else if(action==="min")minimizeWindow(id);else maximizeWindow(id);}));
el.addEventListener("pointerdown",()=>focusWindow(id));
const title=$(".win-title",el);let dragging=null;
title.addEventListener("pointerdown",e=>{
 if(e.target.closest("button")||w.maximized||e.button!==0)return;
 focusWindow(id);dragging={x:e.clientX,y:e.clientY,left:el.offsetLeft,top:el.offsetTop};
 title.setPointerCapture(e.pointerId);
});
title.addEventListener("pointermove",e=>{
 if(!dragging)return;
 const x=dragging.left+e.clientX-dragging.x,y=dragging.top+e.clientY-dragging.y;
 el.style.left=Math.max(0,Math.min(innerWidth-90,x))+"px";
 el.style.top=Math.max(0,Math.min(innerHeight-130,y))+"px";
});
const endDrag=()=>dragging=null;
title.addEventListener("pointerup",endDrag);title.addEventListener("pointercancel",endDrag);
focusWindow(id);
try{renderApp(w);}catch(e){w.body.textContent="Falha no aplicativo: "+e.message;}
renderTaskbar();return w;
}
function closeWindow(id){const w=windows.get(id);if(!w)return;w.el.remove();windows.delete(id);renderTaskbar();}
function minimizeWindow(id){const w=windows.get(id);if(!w)return;w.minimized=true;w.el.classList.add("minimized");renderTaskbar();}
function maximizeWindow(id){const w=windows.get(id);if(!w)return;w.maximized=!w.maximized;w.el.classList.toggle("maximized",w.maximized);focusWindow(id);}
function focusWindow(id){const w=windows.get(id);if(!w)return;w.minimized=false;w.el.classList.remove("minimized");w.el.style.zIndex=++z;renderTaskbar();}
function renderTaskbar(){
const bar=$("#taskApps");bar.innerHTML="";
for(const w of windows.values()){
const btn=document.createElement("button");
btn.className="task-item"+(w.el.style.zIndex==z&&!w.minimized?" active":"");
btn.title=w.meta.name;btn.innerHTML=w.meta.icon+"<small>"+escapeHTML(w.meta.name)+"</small>";
btn.addEventListener("click",()=>w.el.style.zIndex==z&&!w.minimized?minimizeWindow(w.id):focusWindow(w.id));bar.append(btn);
}
}
function renderApp(w){
const render={explorer:renderExplorer,notepad:renderNotepad,calculator:renderCalculator,paint:renderPaint,terminal:renderTerminal,browser:renderBrowser,settings:renderSettings,tasks:renderTasks,cloud:renderCloud,about:renderAbout}[w.app];
render(w);
}
function openFile(path){
const file=fs[path];if(!file){toast("Arquivo não encontrado");return;}
if(file.type==="folder"){makeWindow("explorer",{path});return;}
if(file.type==="text"){makeWindow("notepad",{path});return;}
if(file.type==="image"){makeWindow("paint",{path});return;}
toast("Tipo de arquivo ainda não suportado");
}
function renderExplorer(w){
const s=w.state;if(!("path" in s))s.path="";
const path=s.path;
const entries=listFolder(path);
w.body.innerHTML='<div class="toolbar"><button class="btn" data-cmd="up" '+(path?"":"disabled")+'>⬆ Voltar</button><button class="btn" data-cmd="folder">+ Pasta</button><button class="btn" data-cmd="file">+ Texto</button><button class="btn" data-cmd="rename">Renomear</button><button class="btn danger" data-cmd="delete">Excluir</button><button class="btn" data-cmd="export">Exportar</button><label class="btn" style="cursor:pointer">Importar <input type="file" data-cmd="upload" accept=".txt,.md,.csv,.json,.html,.js,.css,.png,.jpg,.jpeg,.webp,text/plain,image/*" style="display:none" multiple></label></div><div class="statusbar"><span>'+escapeHTML(pathDisplay(path))+'</span><span>'+entries.length+' item(ns)</span></div><div class="app-content"><div class="file-list">'+entries.map(([p,file])=>{
const ico=file.type==="folder"?"📁":file.type==="image"?"🖼️":"📄";
return '<button class="file-tile" data-path="'+escapeHTML(p)+'" title="Duplo clique para abrir"><span class="symbol">'+ico+'</span><span class="file-name">'+escapeHTML(baseName(p))+'</span></button>';
}).join("")+'</div></div><div class="statusbar"><span>Arquivos virtuais salvos no navegador</span><span>Duplo clique para abrir</span></div>';
let selected=null;
$$(".file-tile",w.body).forEach(b=>{
b.addEventListener("click",()=>{$$(".file-tile",w.body).forEach(x=>x.classList.remove("selected"));b.classList.add("selected");selected=b.dataset.path;});
b.addEventListener("dblclick",()=>{const p=b.dataset.path;if(fs[p]?.type==="folder"){s.path=p;renderExplorer(w);}else openFile(p);});
});
const command=cmd=>{
if(cmd==="up"){s.path=parentPath(path);renderExplorer(w);}
else if(cmd==="folder"||cmd==="file"){
let name=prompt(cmd==="folder"?"Nome da nova pasta:":"Nome do novo arquivo de texto:",cmd==="folder"?"Nova Pasta":"Novo Documento.txt");
if(name===null)return;name=name.trim();
if(cmd==="file"&&!name.includes("."))name+=".txt";
if(!validName(name)){toast("Nome de arquivo inválido");return;}
const p=joinPath(path,name);if(fs[p]){toast("Já existe um item com esse nome");return;}
if(cmd==="folder"){fs[p]={type:"folder"};persistFS();renderExplorer(w);}
else{saveText(p,"");renderExplorer(w);openFile(p);}
}else if(cmd==="delete"){
if(!selected||!fs[selected]){toast("Selecione um arquivo ou pasta");return;}
if(confirm("Excluir "+baseName(selected)+" do disco VIRTUAL?")){removePath(selected);renderExplorer(w);}
}else if(cmd==="rename"){
if(!selected||!fs[selected]){toast("Selecione um arquivo ou pasta");return;}
const name=prompt("Novo nome:",baseName(selected));
if(name===null)return;
const trimmed=name.trim();if(!validName(trimmed)){toast("Nome inválido");return;}
const newPath=joinPath(path,trimmed);if(newPath!==selected&&fs[newPath]){toast("Já existe esse nome");return;}
renamePath(selected,newPath);renderExplorer(w);
}else if(cmd==="export"){
if(!selected||!fs[selected]){toast("Selecione um documento ou imagem");return;}
const file=fs[selected];if(file.type==="folder"){toast("Abra a pasta e exporte os documentos separadamente");return;}
if(file.type==="text")download(baseName(selected),file.content);
else if(file.type==="image"){const link=document.createElement("a");link.href=file.content;link.download=baseName(selected);link.click();}
toast("Exportação iniciada");
}
};
$$("[data-cmd]",w.body).filter(b=>b.dataset.cmd!=="upload").forEach(b=>b.addEventListener("click",()=>command(b.dataset.cmd)));
const upload=$('input[data-cmd="upload"]',w.body);
upload.addEventListener("change",async e=>{
for(const file of Array.from(e.target.files||[])){
if(file.size>800000){toast("Arquivo muito grande: limite de 800 KB");continue;}
let name=file.name,p=joinPath(path,name);
if(!validName(name)){toast("Nome inválido");continue;}
if(fs[p]){if(!confirm("Substituir "+name+" no disco virtual?"))continue;}
if(file.type.startsWith("image/")){
if(!/^image\/(png|jpeg|webp)$/.test(file.type)){toast("Formato de imagem não suportado");continue;}
const content=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
fs[p]={type:"image",content};
}else{
const content=await file.text();fs[p]={type:"text",content};
}
persistFS();
}renderExplorer(w);
});
}
function renderNotepad(w){
const path=w.state.path||null,content=path&&fs[path]?.type==="text"?fs[path].content:(w.state.text||"");
w.body.innerHTML='<div class="toolbar"><button class="btn primary" data-cmd="save">💾 Salvar</button><button class="btn" data-cmd="saveas">Salvar como</button><button class="btn" data-cmd="new">Novo</button><button class="btn" data-cmd="download">Exportar TXT</button><span class="app-muted" id="noteFilename">'+escapeHTML(path||"Sem título")+'</span></div><textarea class="notepad" spellcheck="false" aria-label="Editor de texto"></textarea><div class="statusbar"><span id="noteState">Pronto</span><span id="noteCount">0 caracteres</span></div>';
const area=$("textarea",w.body);area.value=content;
const state=$("#noteState",w.body),count=$("#noteCount",w.body);
const dirty=()=>{state.textContent="Modificado, não salvo";count.textContent=area.value.length+" caracteres";};
area.addEventListener("input",dirty);dirty();state.textContent="Pronto";
function save(forceNew){
let path=w.state.path||"";
if(forceNew||!path){const name=prompt("Salvar no disco virtual em Documentos. Nome:",baseName(path)||"Nota.txt");if(name===null)return;const clean=name.trim();if(!validName(clean)){toast("Nome inválido");return;}path="Documentos/"+clean;if(fs[path]&&path!==w.state.path&&!confirm("Substituir este documento?"))return;}
if(saveText(path,area.value)){w.state.path=path;$("#noteFilename",w.body).textContent=path;state.textContent="Salvo ✓";toast("Documento salvo no Mini OS");}
}
$('[data-cmd="save"]',w.body).onclick=()=>save(false);
$('[data-cmd="saveas"]',w.body).onclick=()=>save(true);
$('[data-cmd="new"]',w.body).onclick=()=>makeWindow("notepad");
$('[data-cmd="download"]',w.body).onclick=()=>download(baseName(w.state.path||"Nota.txt"),area.value);
area.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save(false);}});
}
function evaluateMath(expression){
const source=String(expression).replace(/\s/g,"").replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-").replace(/,/g,".");
const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+|[()+\-*/%])/g);
if(!tokens||tokens.join("")!==source)throw Error("Expressão inválida");
let i=0;function atom(){let t=tokens[i++];if(t==="+")return atom();if(t==="-")return -atom();if(t==="("){const v=expr();if(tokens[i++]!==")")throw Error("Parênteses");return v;}const v=Number(t);if(!Number.isFinite(v))throw Error("Número inválido");return v;}
function term(){let v=atom();while(["*","/","%"].includes(tokens[i])){const op=tokens[i++],b=atom();if((op==="/"||op==="%")&&b===0)throw Error("Divisão por zero");v=op==="*"?v*b:op==="/"?v/b:v%b;}return v;}
function expr(){let v=term();while(tokens[i]==="+"||tokens[i]==="-"){const op=tokens[i++],b=term();v=op==="+"?v+b:v-b;}return v;}
const out=expr();if(i!==tokens.length||!Number.isFinite(out))throw Error("Expressão inválida");return String(Number(out.toPrecision(12)));
}
function renderCalculator(w){
w.state.calc=w.state.calc||"0";
w.body.innerHTML='<div class="calc-wrap"><div class="app-muted">CALCULADORA</div><div id="calcScreen" class="calc-screen"></div><div class="calc-grid">'+["C","⌫","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","(",")","0",".","="].map(key=>'<button class="calc-key '+(key==="="? "equal":"")+'" data-key="'+escapeHTML(key)+'">'+escapeHTML(key)+'</button>').join("")+'</div><p class="app-muted">Use +, −, ×, ÷, %, parênteses e decimais.</p></div>';
const screen=$("#calcScreen",w.body);screen.textContent=w.state.calc;
function input(key){
let v=w.state.calc;
if(key==="C")v="0";
else if(key==="⌫")v=v.length>1?v.slice(0,-1):"0";
else if(key==="="){try{v=evaluateMath(v);}catch(e){toast(e.message);return;}}
else{if(v==="0"&&/[0-9.]/.test(key)&&key!==".")v="";v+=key;}
w.state.calc=v;screen.textContent=v;
}
$$("[data-key]",w.body).forEach(b=>b.onclick=()=>input(b.dataset.key));
w.el.tabIndex=0;w.el.addEventListener("keydown",e=>{if(document.activeElement?.tagName==="INPUT")return;const key=e.key;
if(/^[0-9.+\-*/()%]$/.test(key)){e.preventDefault();input(key);}
else if(key==="Enter"){e.preventDefault();input("=");}
else if(key==="Backspace"){e.preventDefault();input("⌫");}
else if(key==="Escape"){input("C");}});
}
function renderPaint(w){
const file=w.state.path&&fs[w.state.path]?.type==="image"?fs[w.state.path]:null;
w.body.innerHTML='<div class="toolbar"><label class="app-muted">Cor <input id="paintColor" type="color" value="#146cfa" style="vertical-align:middle"></label><label class="app-muted">Pincel <input id="brush" type="range" min="1" max="38" value="5" style="vertical-align:middle;width:105px"></label><button class="btn" id="erase">Borracha</button><button class="btn" id="undoPaint">↶ Desfazer</button><button class="btn" id="clearPaint">Limpar</button><button class="btn primary" id="savePaint">💾 Salvar no Mini OS</button><button class="btn" id="pngPaint">Exportar PNG</button></div><div class="paint-wrap"><canvas class="paint-canvas" width="1000" height="550" aria-label="Quadro de desenho"></canvas></div><div class="statusbar"><span>Desenhe com mouse, toque ou caneta</span><span>1000 × 550 px</span></div>';
const canvas=$("canvas",w.body),ctx=canvas.getContext("2d"),color=$("#paintColor",w.body),brush=$("#brush",w.body);
let erase=false,draw=false,last=null,history=[];
function white(){ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);}
white();
if(file){const image=new Image();image.onload=()=>{ctx.drawImage(image,0,0,canvas.width,canvas.height);};image.src=file.content;}
function snapshot(){if(history.length>=12)history.shift();history.push(ctx.getImageData(0,0,canvas.width,canvas.height));}
function xy(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
canvas.addEventListener("pointerdown",e=>{e.preventDefault();snapshot();draw=true;last=xy(e);canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.fillStyle=erase?"#ffffff":color.value;ctx.arc(last.x,last.y,Number(brush.value)/2,0,Math.PI*2);ctx.fill();});
canvas.addEventListener("pointermove",e=>{if(!draw)return;const p=xy(e);ctx.beginPath();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=Number(brush.value);ctx.strokeStyle=erase?"#ffffff":color.value;ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;});
canvas.addEventListener("pointerup",()=>draw=false);canvas.addEventListener("pointercancel",()=>draw=false);
$("#erase",w.body).onclick=e=>{erase=!erase;e.target.textContent=erase?"Pincel":"Borracha";};
$("#undoPaint",w.body).onclick=()=>{if(history.length)ctx.putImageData(history.pop(),0,0);};
$("#clearPaint",w.body).onclick=()=>{if(confirm("Limpar a tela do Paint virtual?")){snapshot();white();}};
$("#savePaint",w.body).onclick=()=>{
const name=prompt("Salvar imagem na pasta Imagens:",baseName(w.state.path||"Meu Desenho.png"));
if(name===null)return;
let clean=name.trim();if(!clean.toLowerCase().endsWith(".png"))clean+=".png";
if(!validName(clean)){toast("Nome inválido");return;}
const path="Imagens/"+clean;
if(fs[path]&&path!==w.state.path&&!confirm("Substituir imagem virtual?"))return;
fs[path]={type:"image",content:canvas.toDataURL("image/png")};
if(persistFS()){w.state.path=path;toast("Imagem salva no Mini OS");}
};
$("#pngPaint",w.body).onclick=()=>{const link=document.createElement("a");link.href=canvas.toDataURL("image/png");link.download=baseName(w.state.path||"Desenho.png");link.click();};
}
function renderTerminal(w){
const s=w.state;s.cwd=s.cwd||"";s.history=s.history||["STEINER MINI TERMINAL v1.0","Ambiente VIRTUAL. Não executa comandos no Windows.","Digite HELP para conhecer os comandos.",""];
w.body.innerHTML='<div class="terminal"><div class="term-log" id="terminalLog"></div><form class="term-row" id="termForm"><span class="term-prompt" id="termPath"></span><input class="term-input" id="termInput" autocomplete="off" spellcheck="false"></form></div>';
const log=$("#terminalLog",w.body),input=$("#termInput",w.body),form=$("#termForm",w.body),terminal=$(".terminal",w.body),label=$("#termPath",w.body);
function render(){log.textContent=s.history.join("\n");label.textContent="C:\\Mini\\"+(s.cwd?s.cwd.replace(/\//g,"\\")+"\\":"")+">";terminal.scrollTop=terminal.scrollHeight;}
function run(text){
const args=text.trim().split(/\s+/),cmd=(args.shift()||"").toLowerCase(),tail=text.trim().slice(cmd.length).trim();
const pick=p=>{if(!p||p===".")return s.cwd;if(p==="..")return parentPath(s.cwd);if(p.startsWith("/"))return p.slice(1);return joinPath(s.cwd,p);};
let out="";
if(!cmd)return;
if(["help","ajuda"].includes(cmd))out="COMANDOS: HELP, DIR, CD, MKDIR, TYPE, ECHO, CLS, TREE, DATE, TIME, WHOAMI, VER, START, PWD, CALC.\nTudo acontece apenas no disco virtual.";
else if(["dir","ls"].includes(cmd))out=listFolder(s.cwd).map(([p,f])=>(f.type==="folder"?"<PASTA>  ":"<ARQUIVO>")+baseName(p)).join("\n")||"Pasta vazia";
else if(["cd","chdir"].includes(cmd)){const next=pick(tail);if(next===""||fs[next]?.type==="folder")s.cwd=next;else out="Pasta não encontrada";}
else if(cmd==="pwd")out=pathDisplay(s.cwd);
else if(cmd==="mkdir"){const name=tail;if(!validName(name))out="Nome inválido";else{const p=joinPath(s.cwd,name);if(fs[p])out="Já existe";else{fs[p]={type:"folder"};persistFS();out="Pasta criada";}}}
else if(cmd==="type"||cmd==="cat"){const f=fs[pick(tail)];out=f?.type==="text"?f.content:"Arquivo de texto não encontrado";}
else if(cmd==="echo")out=tail;
else if(cmd==="cls"){s.history=[];render();return;}
else if(cmd==="date")out=new Date().toLocaleDateString("pt-BR",{dateStyle:"full"});
else if(cmd==="time")out=new Date().toLocaleTimeString("pt-BR");
else if(cmd==="whoami")out="usuario\\SteinerMini";
else if(cmd==="ver")out="STEINER MINI OS 1.0 | Navegador";
else if(cmd==="tree")out=Object.keys(fs).sort().slice(0,150).join("\n");
else if(cmd==="start"){const app=APPS.find(a=>a.id===tail.toLowerCase()||a.name.toLowerCase()===tail.toLowerCase());if(app){makeWindow(app.id);out="Iniciando "+app.name;}else out="Use START notepad, explorer, paint, calculator, browser, settings ou tasks.";}
else if(cmd==="calc"){try{out=evaluateMath(tail);}catch(e){out=e.message;}}
else out="Comando desconhecido. Digite HELP.";
s.history.push("C:\\Mini\\"+s.cwd+"> "+text,out);
if(s.history.length>120)s.history=s.history.slice(-100);
}
render();
form.addEventListener("submit",e=>{e.preventDefault();const val=input.value;input.value="";run(val);render();input.focus();});
setTimeout(()=>input.focus(),80);
}
function renderBrowser(w){
w.body.innerHTML='<div class="toolbar"><input id="webAddress" type="text" placeholder="Digite um endereço HTTPS ou uma pesquisa"><button class="btn primary" id="goWeb">Abrir</button><button class="btn" id="webExternal">Nova guia ↗</button><button class="btn" id="webHome">Início</button></div><div class="browser-home" id="browserHome"><div style="font-size:55px">🌐</div><h2>Navegador Mini</h2><p class="app-muted">Abra sites na janela ou em nova guia. Alguns sites bloqueiam incorporação por segurança.</p><div class="link-grid"><button class="web-tile" data-url="https://www.wikipedia.org/">📚 Wikipedia</button><button class="web-tile" data-url="https://www.google.com/">🔎 Google</button><button class="web-tile" data-url="https://www.roblox.com/">🎮 Roblox</button><button class="web-tile" data-url="https://www.openstreetmap.org/">🗺️ OpenStreetMap</button></div></div><iframe id="webFrame" title="Site externo" referrerpolicy="no-referrer" style="display:none" sandbox="allow-forms allow-scripts allow-popups"></iframe>';
const address=$("#webAddress",w.body),frame=$("#webFrame",w.body),home=$("#browserHome",w.body);
let current="";
function resolve(input){
input=input.trim();if(!input)return "";
if(/^https:\/\//i.test(input))return input;
if(/^http:\/\//i.test(input))return "https://"+input.slice(7);
if(/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(input))return "https://"+input;
return "https://www.google.com/search?q="+encodeURIComponent(input);
}
function navigate(url){current=resolve(url);if(!current)return;address.value=current;home.style.display="none";frame.style.display="block";frame.src=current;toast("Alguns sites não abrem dentro de quadros; use Nova guia.");}
$("#goWeb",w.body).onclick=()=>navigate(address.value);
$("#webExternal",w.body).onclick=()=>{const url=current||resolve(address.value);if(!url){toast("Digite um endereço ou busca");return;}window.open(url,"_blank","noopener,noreferrer");};
$("#webHome",w.body).onclick=()=>{frame.removeAttribute("src");frame.style.display="none";home.style.display="block";current="";address.value="";};
address.addEventListener("keydown",e=>{if(e.key==="Enter")navigate(address.value);});
$$("[data-url]",w.body).forEach(b=>b.onclick=()=>navigate(b.dataset.url));
}
function renderSettings(w){
w.body.innerHTML='<div class="app-content"><div class="setting-banner"><b>⚙️ Personalize seu Mini OS</b>Ajustes deste ambiente virtual, sem afetar seu Windows.</div><div class="settings-group"><h3>☀️ Aparência</h3><button class="btn" data-theme="dark">🌙 Escuro</button> <button class="btn" data-theme="light">☀️ Claro</button><h3 style="margin-top:18px">🎨 Cor de destaque</h3><div class="settings-grid">'+["#61b9ff","#48d9aa","#c79aff","#ffbd65","#ff778c"].map(c=>'<button class="color-swatch" style="background:'+c+'" data-accent="'+c+'" title="'+c+'"></button>').join("")+'</div></div><div class="settings-group"><h3>🖼️ Papel de parede</h3><div class="settings-grid">'+["blue","violet","sunset","forest"].map((c,i)=>'<button class="btn" data-wall="'+c+'">'+["🌊 Azul","🌌 Violeta","🌅 Pôr do sol","🌿 Verde"][i]+'</button>').join("")+'</div></div><div class="settings-group"><h3>💽 Armazenamento</h3><p class="app-muted">'+Object.keys(fs).length+' itens no disco virtual. Arquivos permanecem neste navegador até você limpar os dados.</p><button class="btn danger" id="resetDisk">Reiniciar disco virtual</button></div></div>';
$$("[data-theme]",w.body).forEach(b=>b.onclick=()=>{prefs.theme=b.dataset.theme;persistPrefs();applyPrefs();});
$$("[data-accent]",w.body).forEach(b=>b.onclick=()=>{prefs.accent=b.dataset.accent;persistPrefs();applyPrefs();});
$$("[data-wall]",w.body).forEach(b=>b.onclick=()=>{prefs.wallpaper=b.dataset.wall;persistPrefs();applyPrefs();});
$("#resetDisk",w.body).onclick=()=>{if(confirm("APAGAR somente os arquivos do Mini OS guardados neste navegador? Esta ação não tem volta. Seus arquivos reais do Windows não serão alterados.")){fs=stockFS();persistFS();toast("Disco virtual restaurado");renderSettings(w);}};
}
function renderTasks(w){
const others=Array.from(windows.values());
w.body.innerHTML='<div class="toolbar"><button class="btn" id="refreshTasks">↻ Atualizar</button><span class="app-muted">Apenas aplicativos do Mini OS, não processos reais do Windows</span></div><div class="app-content"><h3>Aplicativos em execução</h3>'+others.map(a=>'<div class="file-tile" style="margin-bottom:8px;justify-content:space-between"><span>'+a.meta.icon+' '+escapeHTML(a.meta.name)+'</span><button class="btn" data-close="'+a.id+'" '+(a.id===w.id?"disabled":"")+'>Encerrar</button></div>').join("")+'<div class="settings-group"><b>ℹ️ Monitoramento</b><p class="app-muted">Não acessa RAM, disco, CPU ou serviços reais do computador. Gerencia apenas as janelas deste simulador.</p></div></div>';
$("#refreshTasks",w.body).onclick=()=>renderTasks(w);
$$("[data-close]",w.body).forEach(b=>b.onclick=()=>{closeWindow(b.dataset.close);renderTasks(w);});
}
function renderCloud(w){
 const hostOk=location.protocol==="https:"||location.hostname==="127.0.0.1"||location.hostname==="localhost";
 w.body.innerHTML='<div class="toolbar"><span class="app-muted">🔒 Ponte Cloud 2.0 • conexão autenticada e saída HTTPS do PC</span><button class="btn" id="cloudLogout">Sair</button></div><div class="app-content" style="display:flex;flex-direction:column;gap:12px">'
 +'<div class="settings-group" style="margin:0"><h3>Chave de administrador</h3><p class="app-muted">A chave está no arquivo CLOUD_ACESSO_PRIVADO.txt do seu Windows. Não compartilhe.</p><div style="display:flex;gap:8px"><input id="cloudToken" type="password" autocomplete="off" style="min-width:80px;flex:1;padding:11px;background:var(--panel2);color:var(--text);border:1px solid var(--stroke);border-radius:10px" placeholder="Cole sua chave privada"><button class="btn primary" id="cloudLogin">Conectar</button></div><div class="app-muted" id="cloudConnection" style="margin-top:8px">Não autenticado</div></div>'
 +'<div class="settings-group" style="margin:0"><h3>Computadores autorizados</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="cloudAgent" value="pc-principal" placeholder="Identificador do PC" style="flex:1;min-width:130px;padding:10px;background:var(--panel2);color:var(--text);border:1px solid var(--stroke);border-radius:9px"><button class="btn" id="cloudAgents">Atualizar</button><button class="btn" id="cloudStatus">Verificar PC</button></div><div id="cloudAgentList" class="app-muted" style="margin-top:8px">Nenhum agente conectado ainda.</div></div>'
 +'<div class="settings-group" style="margin:0"><h3>Missão segura</h3><input id="cloudTitle" maxlength="100" placeholder="Nome do projeto ou anotação" style="width:100%;padding:11px;margin-bottom:8px;background:var(--panel2);color:var(--text);border:1px solid var(--stroke);border-radius:9px"><textarea id="cloudDetail" maxlength="8000" rows="3" placeholder="Descrição do site ou conteúdo da anotação" style="width:100%;padding:11px;resize:vertical;background:var(--panel2);color:var(--text);border:1px solid var(--stroke);border-radius:9px"></textarea><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" id="cloudMission">🚀 Criar + testar + fotografar</button><button class="btn" id="cloudSite">Criar site simples</button><button class="btn" id="cloudNote">Salvar anotação</button><button class="btn" id="cloudProjects">Listar projetos</button><button class="btn" id="cloudOutputs">Resultados criados</button></div><div style="display:flex;gap:8px;align-items:center;margin-top:9px"><input id="cloudReadPath" placeholder="Ex.: sites/site-123/index.html" style="flex:1;min-width:0;padding:9px;background:var(--panel2);color:var(--text);border:1px solid var(--stroke);border-radius:9px"><button class="btn" id="cloudRead">Ler resultado</button></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px"><button class="btn" id="cloudInspect">📷 Inspecionar site</button><button class="btn" id="cloudRepair">🛠 Corrigir e testar novamente</button></div><p class="app-muted">Visão do site criado, não da sua tela pessoal. Resultado e prints ficam na pasta CLOUD_OUTPUTS/missions.</p></div>'
 +'<div class="settings-group" style="margin:0"><h3>Prova de execução</h3><pre id="cloudResult" style="max-height:230px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12px;color:var(--muted)">Aguardando conexão.</pre><img id="cloudVision" alt="Print real do site gerado no navegador isolado" style="display:none;max-width:100%;max-height:360px;object-fit:contain;border:1px solid var(--stroke);border-radius:10px;margin-top:10px"><iframe id="cloudPreview" sandbox="" title="Prévia isolada do site gerado" style="display:none;height:220px;width:100%;background:white;border-radius:9px"></iframe></div>'
 +'<p class="app-muted">O servidor apenas retransmite tarefas autorizadas. O PC precisa estar ligado e o agente local ativo. Não é um controle remoto irrestrito do Windows.</p></div>';
 const el=id=>$("#"+id,w.body),display=el("cloudResult"),status=el("cloudConnection"),preview=el("cloudPreview"),vision=el("cloudVision");
 let token="";try{token=sessionStorage.getItem("steiner_cloud_admin")||"";}catch{}
 if(token)el("cloudToken").value=token;
 const show=data=>{display.textContent=typeof data==="string"?data:JSON.stringify(data,null,2);};
 async function req(method,url,payload){
  if(!token)throw Error("Informe sua chave de administrador.");
  const response=await fetch(url,{method,headers:{"Authorization":"Bearer "+token,...(payload?{"Content-Type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined,cache:"no-store",credentials:"omit"});
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)throw Error((data.error||"Erro HTTP")+" ("+response.status+")");
  return data;
 }
 const showError=e=>{status.textContent="Erro: "+e.message;show("Falha: "+e.message);};
 async function agents(){
  const d=await req("GET","/api/agents");
  const xs=d.agents||[];
  el("cloudAgentList").textContent=xs.length?xs.map(a=>a.id+" • "+(a.online?"ONLINE":"desconectado")+" • "+a.pending+" pendente(s)").join("  |  "):"Agente ainda não apareceu. Inicie cloud_agent.py no Windows.";
  status.textContent="Conectado ao servidor • "+xs.length+" PC(s) registrado(s)";
 }
 async function task(action,args={}){
  const id=el("cloudAgent").value.trim();
  if(!/^[a-zA-Z0-9_-]{1,32}$/.test(id))throw Error("Identificador de computador inválido.");
  preview.style.display="none";vision.style.display="none";
  show("Solicitando "+action+" para "+id+"...");
  const res=await req("POST","/api/jobs",{agent:id,action,args});
  const jobId=res.job.id;
  const deadline=Date.now()+180000;
  while(Date.now()<deadline){
   if(!w.el.isConnected)return;
   const check=await req("GET","/api/jobs/"+jobId);
   if(check.job.status==="done"){
    const result=check.job.result||{};
    const visibleResult={...result};delete visibleResult.screenshot_data_uri;
    show({"job":check.job.id,"action":action,"status":"CONCLUÍDO","result":visibleResult});
    if(typeof result.screenshot_data_uri==="string"&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.screenshot_data_uri)&&result.screenshot_data_uri.length<65000){vision.src=result.screenshot_data_uri;vision.style.display="block";}
    if(typeof result.preview_html==="string"){
      preview.srcdoc=result.preview_html;preview.style.display="block";
    }else if(action==="read_output"&&typeof result.content==="string"&&String(result.path).endsWith(".html")){
      preview.srcdoc=result.content;preview.style.display="block";
    }
    toast("Missão concluída pelo PC "+id);
    return;
   }
   if(check.job.status==="failed"){throw Error(check.job.error||"Falha no agente");}
   show("Tarefa "+jobId.slice(0,8)+" • "+check.job.status+" • aguardando agente "+id+"...");
   await new Promise(resolve=>setTimeout(resolve,2700));
  }
  show("Tarefa aceita e ainda pendente. Código: "+jobId+". Consulte novamente quando o PC estiver conectado.");
 }
 el("cloudLogin").onclick=async()=>{
  token=el("cloudToken").value.trim();
  if(token.length<32){showError(Error("Chave curta ou ausente"));return;}
  try{await agents();sessionStorage.setItem("steiner_cloud_admin",token);toast("Conectado à Ponte Cloud");}
  catch(e){token="";showError(e);}
 };
 el("cloudLogout").onclick=()=>{token="";el("cloudToken").value="";sessionStorage.removeItem("steiner_cloud_admin");status.textContent="Chave removida desta guia";show("Sessão encerrada");};
 el("cloudAgents").onclick=()=>agents().catch(showError);
 const actions=[
  ["cloudStatus","status",()=>({})],
  ["cloudSite","create_site",()=>({title:el("cloudTitle").value.trim(),description:el("cloudDetail").value.trim()})],
  ["cloudMission","mission_site",()=>({title:el("cloudTitle").value.trim(),description:el("cloudDetail").value.trim()})],
  ["cloudInspect","inspect_site",()=>({path:el("cloudReadPath").value.trim()})],
  ["cloudRepair","repair_site",()=>({path:el("cloudReadPath").value.trim()})],
  ["cloudNote","create_note",()=>({title:el("cloudTitle").value.trim(),text:el("cloudDetail").value.trim()})],
  ["cloudProjects","list_projects",()=>({})],
  ["cloudOutputs","list_outputs",()=>({})],
  ["cloudRead","read_output",()=>({path:el("cloudReadPath").value.trim()})]
 ];
 for(const [button,action,args] of actions){
   el(button).onclick=()=>task(action,args()).catch(showError);
 }
 if(!hostOk)status.textContent="Modo local. Publique em HTTPS para utilizar a Ponte Cloud.";
 else if(token)agents().catch(showError);
}

function renderAbout(w){
w.body.innerHTML = '<div class="app-content">'+
'<div class="setting-banner"><b>💠 STEINER MINI OS + PONTE CLOUD 3.0</b>Desktop virtual online com Visão, Executor e Autocorreção de sites de teste.</div>'+
'<div class="settings-group"><h3>🚀 Módulos da Ponte 3.0</h3>'+
'<p>🔌 Conectar ao PC autorizado.<br>⚙️ Criar sites e arquivos no workspace.<br>📷 Examinar sites gerados em navegador isolado e registrar prints.<br>🛠 Corrigir falhas simples de HTML e verificar novamente.<br>📑 Guardar relatórios e provas de execução.</p>'+
'<button class="btn primary" id="openCloudFromAbout">🔌 Abrir Ponte Cloud 3.0</button>'+
'<p class="app-muted">No modo Visitante, será necessário autenticar com sua chave privada. Para entrada automática, use o atalho no Windows.</p></div>'+
'<h3>Apps do Mini OS</h3><p>📁 Arquivos virtuais • 📝 Bloco de Notas • 🧮 Calculadora • 🎨 Paint • ⌨️ Terminal virtual • 🌐 Navegador • ⚙️ Configurações • 📊 Gerenciador de janelas.</p>'+
'<h3>Limitações</h3><p class="app-muted">Não é o Windows original: não executa EXEs ou drivers. A Visão 3.0 captura sites gerados no navegador isolado, não suas abas pessoais. Autocorreção limitada a problemas conhecidos; comandos remotos são autenticados e restritos.</p></div>';
$("#openCloudFromAbout",w.body).onclick=()=>makeWindow("cloud");
}
function initDesktop(){
$("#icons").innerHTML=APPS.filter(a=>a.id!=="about").map(a=>'<button class="desktop-icon" data-app="'+a.id+'" title="Duplo clique para abrir"><span class="app-glyph">'+a.icon+'</span><span>'+escapeHTML(a.name)+'</span></button>').join("");
$$(".desktop-icon").forEach(b=>{b.addEventListener("dblclick",()=>makeWindow(b.dataset.app));b.addEventListener("click",()=>{b.classList.add("selected");setTimeout(()=>b.classList.remove("selected"),500);});});
function fillStart(query=""){
$("#startApps").innerHTML=APPS.filter(a=>a.name.toLowerCase().includes(query.toLowerCase())).map(a=>'<button class="start-app" data-app="'+a.id+'"><b>'+a.icon+'</b><span>'+escapeHTML(a.name)+'</span></button>').join("")||'<div class="app-muted">Nenhum aplicativo encontrado</div>';
$$(".start-app").forEach(b=>b.onclick=()=>makeWindow(b.dataset.app));
}
fillStart();
$("#startBtn").onclick=()=>{const menu=$("#startMenu");menu.classList.toggle("open");if(menu.classList.contains("open"))$("#appSearch").focus();};
$("#appSearch").addEventListener("input",e=>fillStart(e.target.value));
document.addEventListener("pointerdown",e=>{if(!e.target.closest("#startMenu")&&!e.target.closest("#startBtn"))$("#startMenu").classList.remove("open");});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#startMenu").classList.remove("open");});
function clock(){const now=new Date();$("#clockBtn").innerHTML=now.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+"<br>"+now.toLocaleDateString("pt-BR");$("#desktopClock").textContent=now.toLocaleString("pt-BR",{dateStyle:"full",timeStyle:"short"});}
clock();setInterval(clock,10000);
$("#clockBtn").onclick=()=>toast(new Date().toLocaleString("pt-BR",{dateStyle:"full",timeStyle:"medium"}));
applyPrefs();
makeWindow("about");
}
initDesktop();
})();