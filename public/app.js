const $ = (selector) => document.querySelector(selector);
let currentUser = null;
const SELECTED_UNIT_STORAGE_KEY = "saude-perto:selected-unit";
let selectedUnit = (() => {
  try { return localStorage.getItem(SELECTED_UNIT_STORAGE_KEY) || ""; }
  catch { return ""; }
})();

function saveSelectedUnit(unitId) {
  selectedUnit = unitId || "";
  try {
    if (selectedUnit) localStorage.setItem(SELECTED_UNIT_STORAGE_KEY, selectedUnit);
    else localStorage.removeItem(SELECTED_UNIT_STORAGE_KEY);
  } catch {
    // A seleção continua válida nesta página mesmo se o navegador bloquear o armazenamento.
  }
}
let scheduleSlots = [];

function setAuthenticatedUser(user) {
  currentUser = user || null;
  const loginButton = $("#login-open");
  const logoutButton = $("#logout-button");
  const mobileLogin = $("#mobile-login");

  const isPatient = Boolean(currentUser && currentUser.role === "PATIENT");
  loginButton.hidden = Boolean(currentUser);
  logoutButton.hidden = !currentUser;
  $("#mobile-dashboard-link").hidden = !isPatient;
  $("#mobile-profile-link").hidden = !isPatient;
  $("#mobile-history-link").hidden = !isPatient;
  $("#mobile-appointments-link").hidden = !isPatient;
  $("#mobile-login").hidden = Boolean(currentUser);
  $("#register-open-top").hidden = Boolean(currentUser);
  $("#mobile-register").hidden = Boolean(currentUser);
  $("#mobile-logout").hidden = !currentUser;
  if (mobileLogin) {
    mobileLogin.innerHTML = currentUser
      ? '<i data-lucide="user-round"></i>Minha conta'
      : '<i data-lucide="user-round"></i>Entrar na minha conta';
    if (window.lucide) window.lucide.createIcons();
  }
}

async function restoreSession() {
  try {
    const session = await api("/api/auth/me");
    if (session.user.role !== "PATIENT") {
      window.location.href = "/staff.html";
      return;
    }
    setAuthenticatedUser(session.user);
  } catch {
    setAuthenticatedUser(null);
  }
}

let operationCount=0,operationHideTimer=null;
function showOperationStatus(message,state="loading"){
 let node=document.querySelector("#operation-status");
 if(!node){node=document.createElement("div");node.id="operation-status";node.className="operation-status";node.setAttribute("role","status");node.setAttribute("aria-live","polite");document.body.appendChild(node)}
 node.className="operation-status is-visible "+(state==="loading"?"is-loading":state==="error"?"is-error":"is-success");
 node.innerHTML=state==="loading"?'<span class="operation-spinner" aria-hidden="true"></span><span>'+message+'</span>':'<span aria-hidden="true">'+(state==="error"?"!":"✓")+'</span><span>'+message+'</span>';
}
function startOperation(method){
 operationCount++;if(operationHideTimer)clearTimeout(operationHideTimer);
 const label=method==="POST"?"Criando / salvando...":method==="PATCH"?"Alterando...":method==="DELETE"?"Removendo...":"Processando...";
 showOperationStatus(label,"loading");
}
function finishOperation(error){
 operationCount=Math.max(0,operationCount-1);
 if(operationCount>0)return;
 showOperationStatus(error?"Não foi possível concluir. Confira a mensagem na tela.":"Concluído com sucesso.",error?"error":"success");
 operationHideTimer=setTimeout(()=>{if(operationCount===0){const node=document.querySelector("#operation-status");node?.classList.remove("is-visible")}},1800);
}

async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const mutating = ["POST", "PATCH", "PUT", "DELETE"].includes(method);
  const trackOperation = mutating && !String(url).startsWith("/api/auth/");
  if (trackOperation) startOperation(method);
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
    if (trackOperation) finishOperation(false);
    return data;
  } catch (error) {
    if (trackOperation) finishOperation(true);
    throw error;
  }
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 3200);
}

function openDialog(selector) { $(selector).showModal(); }
function closeDialog(selector) { $(selector).close(); }

function beginButtonLoading(button, label) {
  if (!button) return () => {};
  const originalHTML = button.innerHTML;
  const wasDisabled = button.disabled;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>' + label + '</span>';
  return () => {
    button.innerHTML = originalHTML;
    button.disabled = wasDisabled;
    button.removeAttribute("aria-busy");
  };
}

function initScrollReveal() {
  const selectors = [
    ".hero-copy", ".hero-art", ".trust-strip > div",
    ".section-heading", ".service-card", ".vaccine-card",
    ".calendar-panel", ".info-section > div", ".event-item"
  ];
  const elements = document.querySelectorAll(selectors.join(","));
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      currentObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

  elements.forEach((element, index) => {
    if (element.dataset.revealReady === "true") return;
    element.dataset.revealReady = "true";
    element.classList.add("scroll-reveal");
    element.style.setProperty("--reveal-delay", Math.min(index % 4, 3) * 85 + "ms");
    observer.observe(element);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    button.setAttribute("aria-label", showing ? "Ocultar senha" : "Mostrar senha");
    button.setAttribute("aria-pressed", String(showing));
    button.innerHTML = showing
      ? '<i data-lucide="eye-off"></i>'
      : '<i data-lucide="eye"></i>';
    if (window.lucide) window.lucide.createIcons();
  });
});

$("#font-toggle").addEventListener("click", () => {
  document.body.classList.toggle("large-text");
});

$("#login-open").addEventListener("click", () => openDialog("#auth-dialog"));
$("#mobile-logout").addEventListener("click", async () => {
  document.getElementById("menu-mobile-close")?.click();
  try { await api("/api/auth/logout", {method:"POST"}); setAuthenticatedUser(null); toast("Você saiu da sua conta."); }
  catch (error) { toast(error.message); }
});

function openRegisterDialog() {
  if (currentUser) return;
  openDialog("#register-dialog");
}
$("#register-open-top").addEventListener("click", openRegisterDialog);
$("#hero-register-open").addEventListener("click", openRegisterDialog);
$("#mobile-register").addEventListener("click", () => {
  document.getElementById("menu-mobile-close")?.click();
  openRegisterDialog();
});
$("#login-from-register").addEventListener("click", () => {
  closeDialog("#register-dialog");
  openDialog("#auth-dialog");
});

$("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    setAuthenticatedUser(null);
    toast("Você saiu da sua conta.");
  } catch (error) {
    toast(error.message);
  }
});
$("#schedule-open").addEventListener("click", startSchedule);
$("#service-schedule").addEventListener("click", startSchedule);

$("#register-open").addEventListener("click", () => {
  closeDialog("#auth-dialog");
  openDialog("#register-dialog");
});

let scheduleOpening = false;

async function startSchedule(event) {
  if (scheduleOpening) return;
  scheduleOpening = true;
  const restoreButton = beginButtonLoading(event.currentTarget, "Preparando...");
  try {
    try {
      await api("/api/auth/me");
    } catch {
      openDialog("#auth-dialog");
      return;
    }
    restoreButton();
    const restoreSearchButton = beginButtonLoading(event.currentTarget, "Buscando horários...");
    try {
      await loadScheduleData();
      openDialog("#schedule-dialog");
    } finally {
      restoreSearchButton();
    }
  } catch (error) {
    toast("Não foi possível carregar os horários. " + error.message);
  } finally {
    restoreButton();
    scheduleOpening = false;
  }
}

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#auth-error").textContent = "";
  const restoreButton = beginButtonLoading(
    event.submitter || $("#auth-form").querySelector('[type="submit"]'),
    "Entrando..."
  );
  try {
    const session = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#auth-email").value,
        password: $("#auth-password").value,
        otp: $("#auth-otp").value || undefined
      })
    });
    if (session.requiresTwoFactor) {
      $("#otp-wrap").hidden = false;
      $("#auth-otp").required = true;
      $("#auth-error").textContent = session.message;
      $("#auth-otp").focus();
      return;
    }
    closeDialog("#auth-dialog");
    if (session.user.role !== "PATIENT") {
      window.location.href = "/staff.html";
      return;
    }
    window.location.href = "/";
  } catch (error) {
    $("#auth-error").textContent = error.message;
    if (error.message.includes("Código de autenticação em duas etapas")) {
      $("#otp-wrap").hidden = false;
      $("#auth-otp").required = true;
      $("#auth-otp").focus();
    }
  } finally {
    restoreButton();
  }
});

$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#register-error").textContent = "";
  const restoreButton = beginButtonLoading(
    event.submitter || $("#register-form").querySelector('[type="submit"]'),
    "Criando conta..."
  );
  try {
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("#reg-name").value,
        email: $("#reg-email").value,
        cpf: $("#reg-cpf").value,
        phone: $("#reg-phone").value,
        susCard: $("#reg-sus").value,
        password: $("#reg-password").value,
        privacyNoticeAccepted: $("#privacy-accepted").checked
      })
    });
    closeDialog("#register-dialog");
    toast(result.message);
    openDialog("#auth-dialog");
  } catch (error) {
    $("#register-error").textContent = error.message;
  } finally {
    restoreButton();
  }
});

$("#reg-cpf").addEventListener("input", (event) => {
  let value = event.target.value.replace(/\D/g, "").slice(0, 11);
  value = value.replace(/(\d{3})(\d)/, "$1.$2");
  value = value.replace(/(\d{3})(\d)/, "$1.$2");
  value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  event.target.value = value;
});

async function loadScheduleData() {
  $("#schedule-error").textContent="";
  $("#schedule-unit").innerHTML='<option value="">Carregando unidades...</option>';
  $("#unit-select").innerHTML='<option value="">Carregando unidades...</option>';
  const {units}=await api("/api/units");
  window.healthUnits=units;
  const options=units.length?'<option value="">Selecione uma unidade</option>'+units.map(u=>'<option value="'+u.id+'">'+escapeHtml(u.name+" — "+u.municipality)+'</option>').join(""):'<option value="">Nenhuma unidade com agenda disponível</option>';
  $("#schedule-unit").innerHTML=options;
  $("#unit-select").innerHTML=options;
  if(selectedUnit&&units.some(u=>u.id===selectedUnit)){
    $("#schedule-unit").value=selectedUnit;$("#unit-select").value=selectedUnit;
    $("#unit-label").textContent=$("#unit-select").selectedOptions[0]?.textContent||"Unidade selecionada";
    await updateSpecialties();
  }else{
    saveSelectedUnit("");
    $("#schedule-specialty").innerHTML='<option value="">Selecione primeiro a unidade</option>';
    $("#doctor").innerHTML='<option value="">Selecione primeiro a especialidade</option>';
    $("#schedule-specialty").disabled=true;$("#doctor").disabled=true;
    $("#period-schedule").innerHTML='<option value="">Selecione os dados acima</option>';
  }
  const dateInput=$("#schedule-date");
  const localToday=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const nextDate=new Date(localToday+"T00:00:00.000Z");nextDate.setUTCDate(nextDate.getUTCDate()+1);
  dateInput.min=localToday;dateInput.max=nextDate.toISOString().slice(0,10);
  if(!dateInput.value||dateInput.value<dateInput.min||dateInput.value>dateInput.max)dateInput.value=localToday;
}
let availablePeriods=[];
async function fetchPeriods(){
 const unitId=$("#schedule-unit").value,date=$("#schedule-date").value;
 if(!unitId)return [];
 const query=new URLSearchParams({unitId});
 if(date)query.set("date",date);
 const result=await api("/api/period-schedules?"+query.toString());
 return result.schedules;
}
async function updateSpecialties(){
 const unitId=$("#schedule-unit").value;
 if(!unitId){$("#schedule-specialty").disabled=true;return;}
 try{
  availablePeriods=await fetchPeriods();
  const values=[...new Set(availablePeriods.map(x=>x.specialty))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  $("#schedule-specialty").innerHTML=values.length?'<option value="">Selecione uma especialidade</option>'+values.map(v=>'<option value="'+escapeHtml(v)+'">'+escapeHtml(v)+'</option>').join(""):'<option value="">Nenhuma especialidade nesta data</option>';
  $("#schedule-specialty").disabled=!values.length;
  $("#doctor").disabled=true;$("#doctor").innerHTML='<option value="">Selecione primeiro a especialidade</option>';
  $("#period-schedule").innerHTML='<option value="">Selecione primeiro o profissional</option>';
 }catch(e){$("#schedule-error").textContent=e.message;}
}
async function updateDoctors(){
 const specialty=$("#schedule-specialty").value;
 const doctors=new Map(availablePeriods.filter(x=>x.specialty===specialty).map(x=>[x.doctor.id,x.doctor.name]));
 $("#doctor").innerHTML=doctors.size?'<option value="">Selecione um profissional</option>'+[...doctors].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR")).map(([id,n])=>'<option value="'+id+'">'+escapeHtml(n)+'</option>').join(""):'<option value="">Nenhum médico disponível</option>';
 $("#doctor").disabled=!doctors.size;
 await loadPeriodOptions();
}
async function loadPeriodOptions(){
 const doctorId=$("#doctor").value,specialty=$("#schedule-specialty").value,period=$("#schedule-period").value;
 const rows=availablePeriods.filter(x=>x.doctor.id===doctorId&&x.specialty===specialty&&x.period===period);
 $("#period-schedule").innerHTML=rows.length?'<option value="">Selecione o período</option>'+rows.map(x=>'<option value="'+x.id+'">'+new Date(x.startsAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+' às '+new Date(x.endsAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})+' · '+x.remaining+' vaga(s)</option>').join(""):'<option value="">Sem disponibilidade neste período</option>';
}
$("#schedule-unit").addEventListener("change",() => {
  if ($("#schedule-unit").value) saveSelectedUnit($("#schedule-unit").value);
  updateSpecialties();
});
$("#schedule-specialty").addEventListener("change",updateDoctors);
$("#doctor").addEventListener("change",loadPeriodOptions);
$("#schedule-period").addEventListener("change",loadPeriodOptions);
$("#schedule-date").addEventListener("change",async()=>{await updateSpecialties();});
$("#unit-open").addEventListener("click",async()=>{
  try { await loadScheduleData(); openDialog("#unit-dialog"); }
  catch(error) { toast(error.message); }
});
$("#unit-form").addEventListener("submit",event=>{
  event.preventDefault();
  if(!$("#unit-select").value)return;
  saveSelectedUnit($("#unit-select").value);
  $("#unit-label").textContent=$("#unit-select").selectedOptions[0]?.textContent||"Unidade selecionada";
  $("#unit-dialog").close();
});
$("#unit-geolocation").addEventListener("click",()=>{
  const button=$("#unit-geolocation"),status=$("#unit-location-status");
  if(!navigator.geolocation){status.textContent="Este navegador não oferece localização. Escolha a unidade manualmente.";return;}
  button.disabled=true;status.textContent="Aguardando sua autorização no navegador...";
  navigator.geolocation.getCurrentPosition(
    pos=>{const latitude=pos.coords.latitude,longitude=pos.coords.longitude;const rad=v=>v*Math.PI/180;const distance=u=>{if(u.latitude==null||u.longitude==null)return Infinity;const dLat=rad(u.latitude-latitude),dLon=rad(u.longitude-longitude),a=Math.sin(dLat/2)**2+Math.cos(rad(latitude))*Math.cos(rad(u.latitude))*Math.sin(dLon/2)**2;return 6371*2*Math.asin(Math.sqrt(a));};const units=[...(window.healthUnits||[])].sort((a,b)=>distance(a)-distance(b));const options=units.map(u=>{const km=distance(u),label=u.name+" — "+u.municipality+(Number.isFinite(km)?" · "+(km<1?Math.round(km*1000)+" m":km.toFixed(1)+" km"):" · distância indisponível");return '<option value="'+u.id+'">'+escapeHtml(label)+'</option>'}).join("");$("#unit-select").innerHTML='<option value="">Selecione uma unidade</option>'+options;$("#schedule-unit").innerHTML='<option value="">Selecione uma unidade</option>'+options;const nearest=units.find(u=>Number.isFinite(distance(u)));if(nearest){saveSelectedUnit(nearest.id);$("#unit-select").value=nearest.id;$("#schedule-unit").value=nearest.id;$("#unit-label").textContent=nearest.name+" — "+nearest.municipality;status.textContent="Unidades ordenadas pela distância. A mais próxima foi selecionada; você pode escolher outra.";updateSpecialties();}else{status.textContent="Localização obtida, mas as unidades ainda não têm coordenadas cadastradas. Escolha manualmente ou peça ao ADM para atualizar os locais.";}button.disabled=false;},
    error=>{status.textContent=error.code===1?"Permissão não concedida. Você pode escolher a unidade manualmente.":"Não foi possível obter a localização. Escolha a unidade manualmente.";button.disabled=false;},
    {enableHighAccuracy:false,timeout:10000,maximumAge:60000}
  );
});

$("#schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#schedule-error").textContent = "";
  const restoreButton = beginButtonLoading(
    event.submitter || $("#schedule-form").querySelector('[type="submit"]'),
    "Agendando..."
  );
  try {
    await api("/api/appointments", {
      method: "POST",
      body: JSON.stringify({ periodScheduleId: $("#period-schedule").value })
    });
    closeDialog("#schedule-dialog");
    toast("Agendamento registrado.");
  } catch (error) {
    $("#schedule-error").textContent = error.message;
  } finally {
    restoreButton();
  }
});

async function loadAppointments(openAfterLoad = true) {
  if (!currentUser) { openDialog("#auth-dialog"); return; }
  try {
    const result = await api("/api/appointments");
    $("#appointments-list").innerHTML = result.appointments.length
      ? result.appointments.map((item) => appointmentCard(item,item.status === "SCHEDULED")).join("")
      : "<p>Você ainda não possui agendamentos.</p>";
    bindCancelButtons($("#appointments-list"), async () => {
      await loadAppointments(false);
    });
    if (window.lucide) window.lucide.createIcons();
    if (openAfterLoad) openDialog("#appointments-dialog");
  } catch (error) { toast(error.message); }
}

async function loadVaccines() {
  try {
    const result = await api("/api/vaccines");
    $("#vaccine-list").innerHTML = result.vaccines.length
      ? result.vaccines.map(vaccine =>
        '<article class="vaccine-card">' + (vaccine.imageData ? '<img class="campaign-image" src="' + vaccine.imageData + '" alt="Imagem informativa de ' + escapeHtml(vaccine.name) + '">' : '') +
        '<h3>' + escapeHtml(vaccine.name) + '</h3><p>' + escapeHtml(vaccine.description) + '</p><p><b>Indicação:</b> ' +
        escapeHtml(vaccine.targetGroup) + '</p><p><b>Doses:</b> ' + escapeHtml(vaccine.doses) + '</p></article>'
      ).join("")
      : '<p class="muted">Vacinas ainda não cadastradas pela unidade.</p>';
    $("#calendar-list").innerHTML = result.calendar.length
      ? result.calendar.map(event =>
        '<div class="event-item">' + (event.imageData ? '<img class="campaign-image" src="' + event.imageData + '" alt="Imagem da campanha ' + escapeHtml(event.title) + '">' : '') +
        '<b>' + escapeHtml(event.title) + '</b><small>' + new Date(event.startsAt).toLocaleDateString("pt-BR") + ' a ' +
        (event.endsAt ? new Date(event.endsAt).toLocaleDateString("pt-BR") : 'data não informada') + ' · ' +
        escapeHtml(event.unit) + '</small><p>' + escapeHtml(event.description) + '</p></div>'
      ).join("")
      : '<p class="muted">Nenhuma campanha ativa neste momento. Consulte sua unidade.</p>';
    initScrollReveal();
  } catch {
    $("#vaccine-list").textContent = "Não foi possível carregar as informações.";
  }
}


/* Navegação mobile e compactação do cabeçalho */
(() => {
  const toggle = document.getElementById("menu-mobile-toggle");
  const close = document.getElementById("menu-mobile-close");
  const menu = document.getElementById("menu-mobile");
  const overlay = document.getElementById("mobile-overlay");
  const header = document.querySelector(".topbar");

  if (header) {
    let scheduled = false;
    const updateHeader = () => {
      header.classList.toggle("menu-rolado", window.scrollY > 70);
      scheduled = false;
    };
    window.addEventListener("scroll", () => {
      if (!scheduled) {
        window.requestAnimationFrame(updateHeader);
        scheduled = true;
      }
    }, { passive: true });
    updateHeader();
  }

  if (!toggle || !menu || !overlay) return;

  function openMenu() {
    document.body.classList.add("mobile-menu-open");
    menu.inert = false;
    overlay.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fechar menu");
    close?.focus();
  }

  function closeMenu() {
    document.body.classList.remove("mobile-menu-open");
    menu.inert = true;
    overlay.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
    toggle.focus();
  }

  toggle.addEventListener("click", () => {
    document.body.classList.contains("mobile-menu-open") ? closeMenu() : openMenu();
  });
  close?.addEventListener("click", closeMenu);
  overlay.addEventListener("click", closeMenu);

  menu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("mobile-menu-open")) {
      closeMenu();
    }
  });

  document.getElementById("mobile-login")?.addEventListener("click", () => {
    closeMenu();
    document.getElementById("login-open")?.click();
  });

  document.getElementById("mobile-font")?.addEventListener("click", () => {
    document.getElementById("font-toggle")?.click();
  });
})();

if (window.lucide) window.lucide.createIcons();
initScrollReveal();
restoreSession();
if (new URLSearchParams(window.location.search).get("login") === "required") openDialog("#auth-dialog");
loadVaccines();
