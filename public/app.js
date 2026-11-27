const $ = (selector) => document.querySelector(selector);
let currentUser = null;

function setAuthenticatedUser(user) {
  currentUser = user || null;
  const loginButton = $("#login-open");
  const logoutButton = $("#logout-button");
  const mobileLogin = $("#mobile-login");

  const isPatient = Boolean(currentUser && currentUser.role === "PATIENT");
  loginButton.textContent = isPatient ? "Meu painel" : "Entrar";
  logoutButton.hidden = !currentUser;
  const dashboard = $("#patient-dashboard");
  if (dashboard) dashboard.hidden = !isPatient;
  $("#desktop-dashboard-link").hidden = !isPatient;
  $("#mobile-dashboard-link").hidden = !isPatient;
  $("#register-open-top").hidden = Boolean(currentUser);
  $("#mobile-register").hidden = Boolean(currentUser);
  if (isPatient) {
    $("#patient-name").textContent = currentUser.name || "cidadão";
    $("#patient-email").textContent = currentUser.email || "—";
    $("#patient-cpf").textContent = currentUser.cpf || "—";
    $("#patient-sus").textContent = currentUser.susCard || "Não informado";
    $("#patient-phone").textContent = currentUser.phone || "—";
    loadPatientDashboard();
  }
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

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data;
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

$("#font-toggle").addEventListener("click", () => {
  document.body.classList.toggle("large-text");
});

$("#login-open").addEventListener("click", () => {
  if (currentUser && currentUser.role === "PATIENT") $("#patient-dashboard").scrollIntoView({behavior:"smooth",block:"start"});
  else openDialog("#auth-dialog");
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
$("#my-appointments").addEventListener("click", loadAppointments);
$("#dashboard-refresh").addEventListener("click", loadPatientDashboard);
$("#dashboard-schedule").addEventListener("click", startSchedule);

$("#register-open").addEventListener("click", () => {
  closeDialog("#auth-dialog");
  openDialog("#register-dialog");
});

async function startSchedule() {
  try {
    await api("/api/auth/me");
    await loadDoctors();
    openDialog("#schedule-dialog");
  } catch {
    openDialog("#auth-dialog");
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
    setAuthenticatedUser(session.user);
    toast("Login realizado.");
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

async function loadDoctors() {
  const result = await api("/api/staff/doctors");
  $("#doctor").innerHTML = '<option value="">Selecione</option>' +
    result.doctors.map((doctor) =>
      '<option value="' + doctor.id + '">' + escapeHtml(doctor.name) + "</option>"
    ).join("");
  $("#slot").innerHTML = '<option value="">Selecione o profissional</option>';
}

$("#doctor").addEventListener("change", loadSlots);

async function loadSlots() {
  const doctorId = $("#doctor").value;
  $("#slot").innerHTML = '<option value="">Carregando horários...</option>';
  if (!doctorId) {
    $("#slot").innerHTML = '<option value="">Selecione o profissional</option>';
    return;
  }
  try {
    const result = await api("/api/staff/slots?doctorId=" + encodeURIComponent(doctorId));
    $("#slot").innerHTML = result.slots.length
      ? '<option value="">Selecione o horário</option>' + result.slots.map((slot) =>
        '<option value="' + slot.id + '">' +
        new Date(slot.startsAt).toLocaleString("pt-BR") + " · " +
        escapeHtml(slot.specialty) + " · " + escapeHtml(slot.unit) + "</option>"
      ).join("")
      : '<option value="">Nenhum horário disponível</option>';
  } catch (error) {
    $("#slot").innerHTML = '<option value="">Não foi possível carregar</option>';
    $("#schedule-error").textContent = error.message;
  }
}

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
      body: JSON.stringify({ slotId: $("#slot").value })
    });
    closeDialog("#schedule-dialog");
    toast("Agendamento registrado.");
  } catch (error) {
    $("#schedule-error").textContent = error.message;
  } finally {
    restoreButton();
  }
});

function appointmentStatusLabel(status) {
  return ({SCHEDULED:"Agendada",CANCELLED:"Cancelada",COMPLETED:"Concluída",NO_SHOW:"Não compareceu"})[status] || status;
}

function appointmentCard(appointment, allowCancel = false) {
  const date = new Date(appointment.startsAt);
  return '<article class="dashboard-appointment"><div class="dashboard-appointment-top"><b>' +
    escapeHtml(appointment.specialty) + '</b><span class="status-pill status-' +
    escapeHtml(appointment.status.toLowerCase()) + '">' + escapeHtml(appointmentStatusLabel(appointment.status)) +
    '</span></div><p><i data-lucide="calendar"></i>' +
    escapeHtml(date.toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"})) +
    '</p><p><i data-lucide="map-pin"></i>' + escapeHtml(appointment.unit) +
    '</p><p><i data-lucide="user-round"></i>' + escapeHtml(appointment.doctor) + '</p>' +
    (allowCancel && appointment.status === "SCHEDULED"
      ? '<button class="button button-outline" type="button" data-cancel="' + escapeHtml(appointment.id) + '">Cancelar agendamento</button>' : '') +
    '</article>';
}

function bindCancelButtons(container, onSuccess) {
  container.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Deseja cancelar este agendamento?")) return;
      button.disabled = true;
      try {
        await api("/api/appointments/" + encodeURIComponent(button.dataset.cancel) + "/cancel", {method:"PATCH"});
        toast("Agendamento cancelado.");
        await onSuccess();
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    });
  });
}

async function loadPatientDashboard() {
  if (!currentUser) return;
  const upcomingBox = $("#dashboard-upcoming");
  const historyBox = $("#dashboard-history");
  $("#upcoming-count").textContent = "Atualizando...";
  try {
    const result = await api("/api/appointments");
    const now = Date.now();
    const upcoming = result.appointments.filter((item) =>
      item.status === "SCHEDULED" && new Date(item.startsAt).getTime() >= now
    ).sort((a,b) => new Date(a.startsAt)-new Date(b.startsAt));
    const history = result.appointments.filter((item) =>
      item.status !== "SCHEDULED" || new Date(item.startsAt).getTime() < now
    ).sort((a,b) => new Date(b.startsAt)-new Date(a.startsAt));
    $("#upcoming-count").textContent = upcoming.length + (upcoming.length === 1 ? " consulta agendada" : " consultas agendadas");
    upcomingBox.innerHTML = upcoming.length ? upcoming.map((item) => appointmentCard(item,true)).join("") :
      '<div class="dashboard-empty"><i data-lucide="calendar-heart"></i><p>Você não tem consultas futuras.</p><small>Quando agendar, seus próximos atendimentos aparecerão aqui.</small></div>';
    historyBox.innerHTML = history.length ? history.map((item) => appointmentCard(item,false)).join("") :
      '<div class="dashboard-empty compact"><i data-lucide="notebook-text"></i><p>Seu histórico aparecerá aqui.</p></div>';
    bindCancelButtons(upcomingBox, loadPatientDashboard);
    if (window.lucide) window.lucide.createIcons();
  } catch (error) {
    $("#upcoming-count").textContent = "Não foi possível atualizar";
    upcomingBox.innerHTML = '<p class="form-error">Não foi possível carregar seus agendamentos. Tente atualizar.</p>';
    historyBox.innerHTML = "";
  }
}

async function loadAppointments(openAfterLoad = true) {
  if (!currentUser) { openDialog("#auth-dialog"); return; }
  try {
    const result = await api("/api/appointments");
    $("#appointments-list").innerHTML = result.appointments.length
      ? result.appointments.map((item) => appointmentCard(item,item.status === "SCHEDULED")).join("")
      : "<p>Você ainda não possui agendamentos.</p>";
    bindCancelButtons($("#appointments-list"), async () => {
      await loadPatientDashboard();
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
      ? result.vaccines.map((vaccine) =>
        '<article class="vaccine-card"><h3>' + escapeHtml(vaccine.name) +
        "</h3><p>" + escapeHtml(vaccine.description) + "</p><p><b>Indicação:</b> " +
        escapeHtml(vaccine.targetGroup) + "</p><p><b>Doses:</b> " +
        escapeHtml(vaccine.doses) + "</p></article>"
      ).join("")
      : '<p class="muted">Vacinas ainda não cadastradas pela unidade.</p>';

    $("#calendar-list").innerHTML = result.calendar.length
      ? result.calendar.map((event) =>
        '<div class="event-item"><b>' + escapeHtml(event.title) + "</b><small>" +
        new Date(event.startsAt).toLocaleDateString("pt-BR") + " · " +
        escapeHtml(event.unit) + "</small><p>" + escapeHtml(event.description) +
        "</p></div>"
      ).join("")
      : '<p class="muted">Nenhuma campanha cadastrada. Consulte sua unidade.</p>';
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
loadVaccines();
