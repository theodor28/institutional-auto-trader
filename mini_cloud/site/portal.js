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
  function loginPrompt(){
    resultPanel('Acesso seguro necessário','A Ponte está online, mas este navegador ainda não está autenticado. Abra Ponte Cloud pelo Mini Windows, conecte com sua chave particular e retorne ao Portal. Não coloque chaves no campo de missão.','Acesso protegido');
    addButton('🔌 Abrir Ponte Cloud para conectar',()=>unlockDesktop(true));
    addButton('Voltar ao campo',()=>{result.classList.remove('visible');input.focus();});
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
    addButton('Nova missão',()=>{result.classList.remove('visible');input.value='';input.focus();});
    if(data.path)addButton('Copiar caminho',()=>{navigator.clipboard?.writeText(data.path).then(()=>status.textContent='Caminho copiado').catch(()=>{});});
    addButton('Abrir Mini Windows',()=>unlockDesktop(false));
  }
  async function execute(action,args,intent){
    if(busy)return;
    busy=true;button.disabled=true;
    try{
      resultPanel('Preparando a missão','Consultando o computador autorizado...','Conectando');
      if(!sessionToken())return loginPrompt();
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
      if(err.message==='AUTH_REQUIRED'){loginPrompt();return;}
      resultPanel('Não foi possível concluir',shorten(err.message,900)+'\n\nNenhum sucesso foi declarado. Você pode tentar novamente.','Não concluído');
      addButton('Tentar novamente',()=>execute(action,args,intent));
    }finally{busy=false;button.disabled=false;}
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();const text=input.value.trim();if(!text||busy)return;
    const intent=describeIntent(text);
    if(intent.action){execute(intent.action,intent.args,intent);return;}
    resultPanel('Entendi seu pedido','Você escreveu: “'+shorten(text,240)+'”.\n\nNesta versão, a Ponte executa com comprovação: criar e testar sites demonstrativos, verificar o PC, listar projetos/resultados e salvar anotações. Não há uma IA conversacional geral conectada a este campo. Para outras missões, abra a Ponte Cloud e escolha uma ferramenta disponível.','Pedido recebido');
    addButton('Abrir Ponte Cloud',()=>unlockDesktop(true));
    addButton('Criar site de teste',()=>{input.value='Crie um site para '+text.slice(0,110);form.requestSubmit();});
  });
  Array.from(portal.querySelectorAll('[data-prompt]')).forEach(btn=>btn.addEventListener('click',()=>{input.value=btn.dataset.prompt;input.focus();form.requestSubmit();}));
  // Status indicator only: no polling of the private token outside its authenticated browser session.
  if(sessionToken())liveAgent();else setConnected(false);
})();
