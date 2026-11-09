(() => {
"use strict";
document.documentElement.classList.add('has-js');
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const phone='5511972247766';
const menu=$('#menuToggle'), mobile=$('#mobileNav');
function setMenu(open){
  if(!menu||!mobile)return;
  menu.setAttribute('aria-expanded',String(open));
  menu.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');
  mobile.hidden=!open;
  document.body.classList.toggle('nav-open',open);
}
if(menu && mobile){
  menu.addEventListener('click',()=>setMenu(menu.getAttribute('aria-expanded')!=='true'));
  $$('#mobileNav a').forEach(link=>link.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
  document.addEventListener('click',e=>{
    if(menu.getAttribute('aria-expanded')==='true'&&!menu.contains(e.target)&&!mobile.contains(e.target))setMenu(false);
  });
}
const year=$('#year');if(year)year.textContent=String(new Date().getFullYear());
const service=$('#service'),destination=$('#destinationField'),stairs=$('#stairsField');
const error=$('#formError'),form=$('#quoteForm'),consent=$('#privacyConsent');
function updateService(){
  const isTransport=(service?.value||'').includes('Transporte');
  if(destination)destination.hidden=!isTransport;
  if(stairs)stairs.hidden=!isTransport;
  if(!isTransport){
    const dest=$('#destination'),access=$('#stairs');
    if(dest)dest.value='';if(access)access.value='';
  }
}
if(service)service.addEventListener('change',updateService);
$$('[data-pick]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if(service){service.value=btn.dataset.pick;updateService()}
    const target=$('#orcamento');
    if(target)target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    window.setTimeout(()=>service?.focus({preventScroll:true}),550);
  });
});
function clean(v){return String(v??'').replace(/[\u0000-\u001f\u007f]+/g,' ').trim().slice(0,850)}
function buildMessage(data){
  const lines=[
    'Olá, Piano Express! Gostaria de solicitar um atendimento.',
    '',
    'SERVIÇO: '+data.service,
    'NOME: '+data.name,
    'TIPO DE PIANO: '+(data.piano||'Não informado'),
    'CIDADE / BAIRRO: '+data.city
  ];
  if(data.service.includes('Transporte')){
    lines.push('DESTINO: '+(data.destination||'A confirmar'));
    lines.push('ACESSO: '+(data.stairs||'A confirmar'));
  }
  if(data.details)lines.push('OBSERVAÇÕES: '+data.details);
  lines.push('','Mensagem preparada pelo site Piano Express.');
  return lines.join('\n');
}
if(form){
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data={
      name:clean($('#customerName')?.value),
      service:clean(service?.value),
      piano:clean($('#pianoType')?.value),
      city:clean($('#city')?.value),
      destination:clean($('#destination')?.value),
      stairs:clean($('#stairs')?.value),
      details:clean($('#details')?.value)
    };
    let invalid=null;
    if(!data.name)invalid=$('#customerName');
    else if(!data.service)invalid=service;
    else if(!data.city)invalid=$('#city');
    else if(!consent?.checked)invalid=consent;
    if(invalid){
      if(error)error.hidden=false;
      invalid.focus();
      return;
    }
    if(error)error.hidden=true;
    const message=buildMessage(data);
    const url='https://wa.me/'+phone+'?text='+encodeURIComponent(message);
    // Open only in direct response to the user's form submission.
    // The visitor must still approve and send the message in WhatsApp.
    const windowRef=window.open(url,'_blank','noopener,noreferrer');
    if(!windowRef){window.location.assign(url)}
  });
}
$$('#quoteForm input, #quoteForm select, #quoteForm textarea').forEach(el=>
  el.addEventListener('input',()=>{if(error)error.hidden=true})
);
$$('.faq-list details').forEach(current=>{
  current.addEventListener('toggle',()=>{
    if(current.open)$$('.faq-list details').filter(d=>d!==current&&d.open).forEach(d=>d.open=false);
  });
});
const reveals=$$('.reveal');
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('visible');io.unobserve(entry.target)}
    });
  },{rootMargin:'0px 0px -40px 0px',threshold:.10});
  reveals.forEach(el=>io.observe(el));
}else reveals.forEach(el=>el.classList.add('visible'));
$$('.service-image img, .care-image img').forEach(img=>{
  img.addEventListener('error',()=>{
    img.style.visibility='hidden';
    img.parentElement?.classList.add('image-unavailable');
  });
});
window.PIANO_EXPRESS_SITE={
  version:'1.0',
  phone,
  buildMessage,
  selectService(name){
    if(service){service.value=name;updateService()}
    return service?.value||'';
  },
  getQuoteState:()=>({
    service:service?.value||'',
    transportFieldsVisible:!!destination&&!destination.hidden,
    mobileMenuOpen:menu?.getAttribute('aria-expanded')==='true'
  })
};
})();