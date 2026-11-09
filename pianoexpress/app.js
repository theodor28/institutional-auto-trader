"use strict";
const SETTINGS={contactWhatsapp:"5511972247766",contactEmail:"",brand:"Piano Express",verifiedContact:true};
function toast(m){const box=document.getElementById("toast");if(!box)return;box.textContent=m;box.classList.remove("hidden");clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.add("hidden"),5500);}
function toClean(value){return String(value||"").trim().replace(/[<>]/g,"");}
function messageFromForm(form){
 const data=new FormData(form),service=toClean(data.get("servico")),district=toClean(data.get("bairro")),type=toClean(data.get("tipo")),details=toClean(data.get("detalhes"));
 if(!service||!district||!type)throw new Error("Preencha serviço, bairro/cidade e tipo de piano.");
 return ["Olá! Quero solicitar um orçamento da Piano Express.","","Serviço: "+service,"Região: "+district,"Instrumento: "+type,"Detalhes: "+(details||"A combinar."),"","Aguardo informações sobre avaliação e disponibilidade."].join("\n");
}
async function copyText(value){if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return;}const t=document.createElement("textarea");t.value=value;t.style.position="fixed";t.style.left="-9999px";document.body.appendChild(t);t.select();const ok=document.execCommand("copy");t.remove();if(!ok)throw new Error("Selecione e copie manualmente o texto.");}
document.addEventListener("DOMContentLoaded",()=>{
 const f=document.getElementById("orcamento");
 if(f)f.addEventListener("submit",async e=>{
  e.preventDefault();
  const status=document.getElementById("formStatus"),result=document.getElementById("resultBox"),output=document.getElementById("requestText");
  try{
   const msg=messageFromForm(f);result.classList.add("open");output.value=msg;
   if(SETTINGS.verifiedContact&&/^[0-9]{12,13}$/.test(SETTINGS.contactWhatsapp)){
    window.open("https://wa.me/"+SETTINGS.contactWhatsapp+"?text="+encodeURIComponent(msg),"_blank","noopener,noreferrer");
    status.textContent="Abriu o WhatsApp. Confira e envie a mensagem.";
   }else{
    await copyText(msg);status.textContent="Pedido preparado e copiado. O WhatsApp comercial será vinculado após confirmação do número.";
   }
  }catch(err){status.textContent=err.message;}
 });
 const b=document.getElementById("copyRequest");
 if(b)b.addEventListener("click",async()=>{try{await copyText(document.getElementById("requestText").value);toast("Mensagem copiada.");}catch{toast("Selecione a mensagem e copie manualmente.");}});
});
