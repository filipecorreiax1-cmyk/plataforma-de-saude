const $ = (selector) => document.querySelector(selector);

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

$("#login-open").addEventListener("click", () => openDialog("#auth-dialog"));
$("#schedule-open").addEventListener("click", startSchedule);
$("#service-schedule").addEventListener("click", startSchedule);
$("#my-appointments").addEventListener("click", loadAppointments);

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
  try {
    const session = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#auth-email").value,
        password: $("#auth-password").value,
        otp: $("#auth-otp").value || undefined
      })
    });
    closeDialog("#auth-dialog");
    if (session.user.role !== "PATIENT") {
      window.location.href = "/staff.html";
      return;
    }
    toast("Login realizado.");
  } catch (error) {
    $("#auth-error").textContent = error.message;
    $("#otp-wrap").hidden = false;
  }
});

$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#register-error").textContent = "";
  try {
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("#reg-name").value,
        email: $("#reg-email").value,
        cpf: $("#reg-cpf").value,
        phone: $("#reg-phone").value,
        susCard: $("#reg-sus").value,
        password: $("#reg-password").value
      })
    });
    closeDialog("#register-dialog");
    toast(result.message);
    openDialog("#auth-dialog");
  } catch (error) {
    $("#register-error").textContent = error.message;
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
  try {
    await api("/api/appointments", {
      method: "POST",
      body: JSON.stringify({ slotId: $("#slot").value })
    });
    closeDialog("#schedule-dialog");
    toast("Agendamento registrado.");
  } catch (error) {
    $("#schedule-error").textContent = error.message;
  }
});

async function loadAppointments() {
  try {
    const result = await api("/api/appointments");
    $("#appointments-list").innerHTML = result.appointments.length
      ? result.appointments.map((appointment) =>
          '<article class="appointment-row"><b>' + escapeHtml(appointment.specialty) +
          "</b><p>" + new Date(appointment.startsAt).toLocaleString("pt-BR") +
          " · " + escapeHtml(appointment.unit) + "</p><p>Profissional: " +
          escapeHtml(appointment.doctor) + "</p><p>Status: " +
          escapeHtml(appointment.status) + "</p>" +
          (appointment.status === "SCHEDULED"
            ? '<button class="button button-outline" data-cancel="' + appointment.id +
              '">Cancelar agendamento</button>' : "") + "</article>"
        ).join("")
      : "<p>Você ainda não possui agendamentos.</p>";

    $("#appointments-list").querySelectorAll("[data-cancel]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm("Deseja cancelar este agendamento?")) return;
        try {
          await api("/api/appointments/" + button.dataset.cancel + "/cancel", { method: "PATCH" });
          toast("Agendamento cancelado.");
          await loadAppointments();
        } catch (error) {
          toast(error.message);
        }
      });
    });
    openDialog("#appointments-dialog");
  } catch {
    openDialog("#auth-dialog");
  }
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
  } catch {
    $("#vaccine-list").textContent = "Não foi possível carregar as informações.";
  }
}

if (window.lucide) window.lucide.createIcons();
loadVaccines();
