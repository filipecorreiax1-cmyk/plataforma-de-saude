const $=s=>document.querySelector(s);
const api=async(u,o={})=>{const r=await fetch(u,{...o,credentials:"same-origin",headers:{"Content-Type":"application/json",...(o.headers||{})}}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Não foi possível concluir.");return d};
const toast=m=>{const t=$("#staff-toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3500)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let currentUser=null,pending2faId=null;
async function init(){try{const d=await api("/api/auth/me");currentUser=d.user;if(currentUser.role==="PATIENT"){location.replace("/");return}$("#staff-identity").textContent=currentUser.name+" · "+currentUser.role;$("#staff-title").textContent="Olá, "+currentUser.name.split(" ")[0];$("#staff-description").textContent="Gerencie as tarefas autorizadas para seu perfil.";
if(currentUser.role==="DOCTOR"){$("#doctor-area").hidden=false;await loadDoctorAppointments()}
if(currentUser.role==="ADMIN"){
 $("#admin-area").hidden=false;
 if(!currentUser.twoFactorOn){
  $("#staff-select").innerHTML='<option value="'+currentUser.id+'">Minha conta administradora</option>';
  $("#staff-form").hidden=true;$("#slot-form").parentElement.hidden=true;$("#admin-appointments").parentElement.hidden=true;
  $("#twofa-message").textContent="Antes de administrar o sistema, ative o segundo fator da sua própria conta.";
 }else{
  await Promise.all([loadStaff(),loadDoctors(),loadAdminAppointments()]);
 }
}
if(currentUser.role==="NURSE")$("#vaccine-area").hidden=false;
if(currentUser.role==="ADMIN"&&currentUser.twoFactorOn)$("#vaccine-area").hidden=false;
}catch{location.replace("/?login=required")}}
$("#logout").onclick=async()=>{try{await api("/api/auth/logout",{method:"POST"})}finally{location.replace("/")}};
async function loadDoctorAppointments(){const d=await api("/api/appointments");$("#doctor-appointments").innerHTML=d.appointments.length?d.appointments.map(a=>'<article class="appointment-row"><b>'+esc(a.patient?.name||"Paciente")+'</b><p>'+new Date(a.startsAt).toLocaleString("pt-BR")+' · '+esc(a.specialty)+' · '+esc(a.unit)+'</p><p>CPF: '+esc(a.patient?.cpf||"—")+' · Cartão SUS: '+esc(a.patient?.susCard||"—")+'</p><p>Telefone: '+esc(a.patient?.phone||"—")+' · Status: '+esc(a.status)+'</p></article>').join(""):"<p>Nenhum atendimento vinculado à sua agenda.</p>"}
async function loadAdminAppointments(){const d=await api("/api/appointments");$("#admin-appointments").innerHTML=d.appointments.map(a=>'<article class="appointment-row"><b>'+esc(a.patient?.name||"Paciente")+'</b><p>'+new Date(a.startsAt).toLocaleString("pt-BR")+' · '+esc(a.doctor)+' · '+esc(a.unit)+'</p><p>CPF: '+esc(a.patient?.cpf||"—")+' · Status: '+esc(a.status)+'</p></article>').join("")||"<p>Nenhum agendamento cadastrado.</p>"}
async function loadStaff(){const d=await api("/api/admin/staff");$("#staff-select").innerHTML='<option value="">Selecione</option>'+d.staff.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.role)+' · 2FA: '+(x.twoFactorOn?"ativo":"pendente")+'</option>').join("")}
async function loadDoctors(){const d=await api("/api/staff/doctors");const options='<option value="">Selecione</option>'+d.doctors.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");$("#slot-doctor").innerHTML=options}
$("#staff-form").onsubmit=async e=>{e.preventDefault();$("#staff-error").textContent="";try{const d=await api("/api/admin/staff",{method:"POST",body:JSON.stringify({name:$("#new-name").value,email:$("#new-email").value,cpf:$("#new-cpf").value,phone:$("#new-phone").value,password:$("#new-password").value,role:$("#new-role").value})});toast(d.message);e.target.reset();await loadStaff()}catch(x){$("#staff-error").textContent=x.message}};
$("#setup-2fa").onclick=async()=>{try{const id=$("#staff-select").value;if(!id)throw Error("Selecione um profissional.");const d=await api("/api/admin/staff/"+id+"/2fa/setup",{method:"POST"});pending2faId=id;$("#twofa-key").hidden=false;$("#twofa-key").textContent="Chave de configuração: "+d.manualKey+" · Entregue ao profissional por canal seguro.";$("#confirm-2fa").hidden=false;$("#twofa-message").textContent=d.instructions}catch(x){$("#twofa-message").textContent=x.message}};
$("#confirm-2fa").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/staff/"+pending2faId+"/2fa/confirm",{method:"POST",body:JSON.stringify({otp:$("#twofa-code").value})});$("#twofa-message").textContent="2FA ativado com sucesso. Atualizando sua sessão...";$("#confirm-2fa").hidden=true;$("#twofa-key").hidden=true;setTimeout(()=>location.reload(),900)}catch(x){$("#twofa-message").textContent=x.message}};
$("#slot-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/slots",{method:"POST",body:JSON.stringify({doctorId:$("#slot-doctor").value,startsAt:new Date($("#slot-date").value).toISOString(),specialty:$("#slot-specialty").value,unit:$("#slot-unit").value})});$("#slot-message").textContent="Horário publicado e disponível para agendamento.";e.target.reset()}catch(x){$("#slot-message").textContent=x.message}};
$("#vaccine-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/vaccines",{method:"POST",body:JSON.stringify({name:$("#vaccine-name").value,description:$("#vaccine-description").value,targetGroup:$("#vaccine-target").value,doses:$("#vaccine-doses").value})});$("#vaccine-message").textContent="Vacina cadastrada.";e.target.reset()}catch(x){$("#vaccine-message").textContent=x.message}};
$("#event-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/immunization-events",{method:"POST",body:JSON.stringify({title:$("#event-title").value,description:$("#event-description").value,startsAt:new Date($("#event-start").value).toISOString(),endsAt:$("#event-end").value?new Date($("#event-end").value).toISOString():undefined,unit:$("#event-unit").value})});$("#event-message").textContent="Campanha publicada no calendário.";e.target.reset()}catch(x){$("#event-message").textContent=x.message}};
init();