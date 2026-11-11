(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const portal=$('steiner-portal');
  if(!portal)return;
  const input=$('portalPrompt'),form=$('portalForm'),button=$('portalSubmit');
  const result=$('portalResults'),status=$('portalResultStatus'),title=$('portalResultTitle'),detail=$('portalResultText');
  const actions=$('portalResultActions'),shot=$('portalShot'),preview=$('portalPreview'),connection=$('portalConnection');
  const AGENT='pc-principal';
  const timeout=ms=>new Promise(r=>setTimeout(r,ms));
  let busy=false;
  const sessionToken=()=>{try{return sessionStorage.getItem('steiner_cloud_admin')||'';}catch{return '';}};
  const setConnected=(online)=>{
    const dot=connection.querySelector('.portal-dot');
    if(dot)dot.classList.toggle('online',Boolean(online));
    connection.lastChild.textContent=online?' PC conectado':' Ponte protegida';
  };
  const resetMedia=()=>{shot.style.display='none';shot.removeAttribute('src');preview.style.display='none';preview.removeAttribute('srcdoc');};
  function addButton(label,handler){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',handler);actions.appendChild(b);}
  function resultPanel(heading,text,state='Informação'){
    result.classList.add('visible');title.textContent=heading;detail.textContent=text;
    status.textContent=state;actions.replaceChildren();resetMedia();
  }
  function unlockDesktop(openCloud){
    location.href='/mini-os'+(openCloud?'?cloud=1':'');
  }
  $('portalDesktop').addEventListener('click',()=>unlockDesktop(false));
  // The original desktop stays usable. Return to this portal using a small taskbar shortcut.
  let returnButton=document.getElementById('portalReturn');
  if(!returnButton){returnButton=document.createElement('button');returnButton.id='portalReturn';returnButton.className='task-item';returnButton.textContent='✧';returnButton.title='Voltar ao Portal';
    returnButton.addEventListener('click',()=>document.body.classList.add('portal-mode'));
    const zone=document.getElementById('taskApps');if(zone)zone.parentNode.insertBefore(returnButton,zone);
  }
  function loginPrompt(pending){
    resultPanel('Conectar a Ponte','Este navegador ainda não tem autorização. Cole a chave privada uma única vez aqui embaixo; a tela VIP continuará aberta. Não escreva sua chave no campo de missão.','Conexão protegida');
    const wrap=document.createElement('div');wrap.className='portal-inline-auth';
    const field=document.createElement('input');field.type='password';field.autocomplete='off';field.spellcheck=false;
    field.placeholder='Chave privada da Ponte';field.setAttribute('aria-label','Chave privada da Ponte');
    const connect=document.createElement('button');connect.type='button';connect.textContent='Conectar e continuar';
    const hint=document.createElement('small');hint.textContent='A chave fica somente nesta sessão do navegador. Para login sem digitar, abra pelo atalho STEINER MINI CLOUD no seu Windows.';
    const submit=async()=>{
      const key=field.value.trim();
      if(key.length<32){hint.textContent='Chave inválida ou incompleta.';return;}
      connect.disabled=true;hint.textContent='Verificando a autorização...';
      try{
        const response=await fetch('/api/agents',{headers:{Authorization:'Bearer '+key},credentials:'omit',cache:'no-store'});
        if(!response.ok)throw Error('Chave não autorizada (HTTP '+response.status+').');
        sessionStorage.setItem('steiner_cloud_admin',key);
        field.value='';await liveAgent();
        resultPanel('Conexão autorizada','Seu acesso foi validado. Agora a Ponte executará o pedido e mostrará a resposta aqui mesmo.','Conectado');
        if(pending)execute(pending.action,pending.args,pending.intent);
      }catch(e){hint.textContent=e.message;connect.disabled=false;}
    };
    connect.addEventListener('click',submit);
    field.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
    wrap.append(field,connect,hint);detail.append(wrap);
    field.focus();
  }
  async function api(method,path,data){
    const token=sessionToken();
    if(!token||token.length<32)throw new Error('AUTH_REQUIRED');
    const res=await fetch(path,{method,headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',credentials:'omit'});
    let body={};try{body=await res.json();}catch{}
    if(res.status===401)throw new Error('AUTH_REQUIRED');
    if(!res.ok)throw new Error(String(body.error||'Erro de conexão')+' (HTTP '+res.status+')');
    return body;
  }
  async function liveAgent(){
    try{const data=await api('GET','/api/agents');
      const ok=(data.agents||[]).some(a=>a.id===AGENT&&a.online);
      setConnected(ok);return ok;
    }catch{setConnected(false);return false;}
  }
  function shorten(s,max=1600){return String(s||'').slice(0,max);}
  function describeIntent(text){
    const lower=text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(/\b(site|pagina|landing page|website|pagina web)\b/.test(lower)&&/\b(cri|faz|mont|ger|constru|precis|quero|site)\w*/.test(lower)){
      let siteTitle=text.replace(/^(por favor\s*)?(crie|criar|faça|fazer|monte|montar|quero|preciso de)\s*(um|uma)?\s*(site|pagina|landing page|website)\s*(para|de|do|da)?\s*/i,'').trim();
      if(!siteTitle||siteTitle.length<4)siteTitle='Meu novo site';
      return {action:'mission_site',args:{title:siteTitle.slice(0,92),description:('Site solicitado pelo usuário: '+text).slice(0,780)},label:'Criação e verificação de site'};
    }
    if(/(computador|meu pc|status|conexao|online|ponte funciona|verificar pc)/.test(lower))return {action:'status',args:{},label:'Diagnóstico do computador'};
    if(/(projeto|pasta)/.test(lower))return {action:'list_projects',args:{},label:'Projetos no workspace'};
    if(/(resultados|arquivos criados|ultimas tarefas|historico)/.test(lower))return {action:'list_outputs',args:{},label:'Arquivos produzidos'};
    if(/(nota|anotacao|lembrete|anote|registrar texto|salve o texto)/.test(lower))return {action:'create_note',args:{title:'Anotação pelo Portal',text:text.slice(0,2000)},label:'Salvando uma anotação'};
    return {action:null,label:'Pedido recebido'};
  }
  // ZIP sem dependências, montado apenas com o HTML gerado e uma instrução de uso.
  // Não traz arquivos privados do Windows, tokens ou dados de outras tarefas.
  function zipFiles(entries){
    const encoder=new TextEncoder();const chunks=[];const directory=[];
    let offset=0;
    function crc32(bytes){
      let c=0xffffffff;
      for(const byte of bytes){
        c^=byte;
        for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);
      }
      return (c^0xffffffff)>>>0;
    }
    function little(view,offset,value,size){
      if(size===2)view.setUint16(offset,value,true);
      else view.setUint32(offset,value>>>0,true);
    }
    for(const [name,content] of entries){
      const filename=encoder.encode(name);
      const data=encoder.encode(content);
      const crc=crc32(data);
      const local=new Uint8Array(30+filename.length);
      const lv=new DataView(local.buffer);
      little(lv,0,0x04034b50,4);little(lv,4,20,2);little(lv,6,0x0800,2);
      little(lv,8,0,2);little(lv,10,0,2);little(lv,12,0,2);
      little(lv,14,crc,4);little(lv,18,data.length,4);little(lv,22,data.length,4);
      little(lv,26,filename.length,2);little(lv,28,0,2);local.set(filename,30);
      chunks.push(local,data);
      const central=new Uint8Array(46+filename.length),cv=new DataView(central.buffer);
      little(cv,0,0x02014b50,4);little(cv,4,20,2);little(cv,6,20,2);
      little(cv,8,0x0800,2);little(cv,10,0,2);little(cv,12,0,2);little(cv,14,0,2);
      little(cv,16,crc,4);little(cv,20,data.length,4);little(cv,24,data.length,4);
      little(cv,28,filename.length,2);little(cv,30,0,2);little(cv,32,0,2);
      little(cv,34,0,2);little(cv,36,0,2);little(cv,38,0,4);
      little(cv,42,offset,4);central.set(filename,46);directory.push(central);
      offset+=local.length+data.length;
    }
    const size=directory.reduce((sum,item)=>sum+item.length,0);
    const end=new Uint8Array(22),ev=new DataView(end.buffer);
    little(ev,0,0x06054b50,4);little(ev,4,0,2);little(ev,6,0,2);
    little(ev,8,directory.length,2);little(ev,10,directory.length,2);
    little(ev,12,size,4);little(ev,16,offset,4);little(ev,20,0,2);
    return new Blob([...chunks,...directory,end],{type:'application/zip'});
  }
  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function presentResult(intent,data){
    const action=intent.action;let message='';let heading='Missão concluída';
    const previewHTML=data&&typeof data.preview_html==='string'?data.preview_html:'';
    if(action==='mission_site'){
      heading=data.status==='verified'?'Site criado e verificado':'Site criado: revisão necessária';
      message='Arquivo gerado no PC: '+shorten(data.path,220)+'\n'+
      'Verificação: '+(data.status==='verified'?'aprovada':'pendências detectadas')+'.\n'+
      'Problemas detectados: '+(data.final_issues?.length?data.final_issues.join(', '):'nenhum no conjunto de testes')+'\n'+
      'Prints: '+(data.screenshots?.length||0)+' • Relatório: '+shorten(data.report_path,180)+'\n\n'+
      'Observação: é uma página demonstrativa gerada por modelo local, não um site comercial completo nem publicado automaticamente.';
    }else if(action==='status'){
      heading='Computador verificado';message='Agente: '+shorten(data.agent_id,50)+'\nSistema: '+shorten(data.os,50)+'\nPython: '+shorten(data.python,60)+'\nWorkspace disponível: '+(data.workspace_ready?'sim':'não')+'\nModo protegido: '+(data.safe_mode?'ativo':'indisponível');
    }else if(action==='list_projects'){
      heading='Projetos encontrados';message=(Array.isArray(data.projects)&&data.projects.length?data.projects.map(p=>'▹ '+p).join('\n'):'Nenhum projeto encontrado.')+'\n\nTotal: '+(data.total||0);
    }else if(action==='list_outputs'){
      heading='Resultados existentes';message=(Array.isArray(data.files)&&data.files.length?data.files.map(p=>'▹ '+p).join('\n'):'Nenhum resultado encontrado ainda.');
    }else if(action==='create_note'){
      heading='Anotação salva no computador';message='Arquivo: '+shorten(data.relative_path,240)+'\nBytes: '+(data.bytes||0)+'\nIntegridade SHA-256 verificada pelo agente.';
    }else message='Tarefa concluída.\n'+JSON.stringify(data,null,2).slice(0,1500);
    resultPanel(heading,message,'Concluído ✓');
    if(typeof data.screenshot_data_uri==='string'&&/^data:image\/jpeg;base64,[\w+/=]{100,65000}$/.test(data.screenshot_data_uri)){
      shot.src=data.screenshot_data_uri;shot.style.display='block';
    }
    if(previewHTML){preview.srcdoc=previewHTML.slice(0,14000);preview.style.display='block';}
    if(previewHTML&&(action==='mission_site'||action==='create_site')){
      addButton('⬇ Baixar meu site em ZIP',()=>{
        const note='STEINER-PONTE VIP — SITE GERADO\n\nAbra index.html no navegador.\nEste arquivo é um protótipo local, ainda não publicado.\nResultado: '+String(data.status||'criado')+'\n';
        const blob=zipFiles([['index.html',previewHTML],['LEIA-ME.txt',note]]);
        const base=String(data.path||'site').split('/').slice(-2,-1)[0]||'site-steiner';
        downloadBlob(blob,base+'.zip');
        status.textContent='ZIP pronto ✓';
      });
    }else if(action==='create_note'&&data.relative_path){
      addButton('⬇ Baixar anotação',()=>downloadBlob(new Blob([String(intent.args?.text||'')],{type:'text/plain;charset=utf-8'}),'anotacao-steiner.txt'));
    }
    addButton('Nova missão',()=>{result.classList.remove('visible');input.value='';input.focus();});
    if(data.path)addButton('Copiar caminho',()=>{navigator.clipboard?.writeText(data.path).then(()=>status.textContent='Caminho copiado').catch(()=>{});});
    // Todos os resultados aparecem aqui. O Mini Windows permanece opcional, nunca uma etapa obrigatória.
  }
  async function execute(action,args,intent){
    if(busy)return;
    busy=true;button.disabled=true;
    try{
      resultPanel('Preparando a missão','Consultando o computador autorizado...','Conectando');
      if(!sessionToken())return loginPrompt({action,args,intent});
      if(!await liveAgent()){
        resultPanel('Computador não disponível','Não encontrei o agente pc-principal online. Quando o Windows estiver ligado e o agente conectado, a execução pode ser repetida.','Offline');
        addButton('Tentar novamente',()=>execute(action,args,intent));return;
      }
      const answer=await api('POST','/api/jobs',{agent:AGENT,action,args});
      const id=answer.job?.id;if(!id)throw new Error('Servidor não retornou identificador da missão.');
      const start=Date.now(),max=150000;
      while(Date.now()-start<max){
        const state=(await api('GET','/api/jobs/'+encodeURIComponent(id))).job;
        if(!state)throw new Error('Resposta de missão inválida.');
        if(state.status==='done'){presentResult(intent,state.result||{});return;}
        if(state.status==='failed')throw new Error(shorten(state.error,250)||'Falha informada pelo agente.');
        detail.textContent='Pedido aceito e enviado ao PC.\nEstado: '+state.status+'\nCódigo: '+id.slice(0,12)+'\n\nAguardando resultado verificável...';
        status.textContent=state.status==='running'?'Executando':'Na fila';
        await timeout(2600);
      }
      resultPanel('Missão ainda em processamento','A Ponte recebeu a tarefa, mas ela não terminou dentro do período de consulta. Confira os resultados quando o PC estiver disponível.','Pendente');
    }catch(err){
      if(err.message==='AUTH_REQUIRED'){loginPrompt({action,args,intent});return;}
      resultPanel('Não foi possível concluir',shorten(err.message,900)+'\n\nNenhum sucesso foi declarado. Você pode tentar novamente.','Não concluído');
      addButton('Tentar novamente',()=>execute(action,args,intent));
    }finally{busy=false;button.disabled=false;}
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();const text=input.value.trim();if(!text||busy)return;
    const intent=describeIntent(text);
    if(intent.action){execute(intent.action,intent.args,intent);return;}
    resultPanel('Entendi seu pedido','Você escreveu: “'+shorten(text,240)+'”.\n\nNesta versão, a Ponte executa com comprovação: criar e testar sites demonstrativos, verificar o PC, listar projetos/resultados e salvar anotações. Não há uma IA conversacional geral conectada a este campo. Para outras missões, abra a Ponte Cloud e escolha uma ferramenta disponível.','Pedido recebido');
    addButton('Ver comandos disponíveis',()=>{resultPanel('O que a Ponte executa agora','• Crie um site para meu negócio\n• Verifique meu computador\n• Mostre meus projetos\n• Mostre meus resultados\n• Salve uma anotação\n\nOutras solicitações precisam de uma ferramenta integrada; não serão marcadas como concluídas sem execução.','Ajuda');});
    addButton('Criar site de teste',()=>{input.value='Crie um site para '+text.slice(0,110);form.requestSubmit();});
  });
  Array.from(portal.querySelectorAll('[data-prompt]')).forEach(btn=>btn.addEventListener('click',()=>{input.value=btn.dataset.prompt;input.focus();form.requestSubmit();}));
  // Status indicator only: no polling of the private token outside its authenticated browser session.
  if(sessionToken())liveAgent();else setConnected(false);
})();
