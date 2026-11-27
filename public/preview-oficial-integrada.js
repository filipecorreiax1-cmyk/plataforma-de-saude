const $=s=>document.querySelector(s);let selectedNeighborhood="";let locationWasGranted=false;const units={"Centro":["UBS Centro","UBS Vila das Flores"],"Vila Nova":["UBS Vila Nova"],"São Geraldo":["UBS São Geraldo"],"Planalto":["UBS Planalto"]};
function fillUnits(bairro,select){select.innerHTML='<option value="">Selecione uma unidade</option>'+(units[bairro]||[]).map(u=>'<option>'+u+'</option>').join('')}
$("#unit-open").onclick=()=>{$("#unit-dialog").showModal()};$("#service-unit").onclick=()=>$("#unit-dialog").showModal();$("#unit-form").addEventListener("submit",e=>{e.preventDefault();if(!$("#unit-select").value)return;selectedNeighborhood=$("#neighborhood").value;$("#unit-label").textContent=$("#unit-select").value;$("#unit-dialog").close()});$("#neighborhood").onchange=()=>fillUnits($("#neighborhood").value,$("#unit-select"));
$("#schedule-open").onclick=()=>{if(selectedNeighborhood){$("#book-neighborhood").value=selectedNeighborhood;fillUnits(selectedNeighborhood,$("#book-unit"));$("#book-unit").value=$("#unit-label").textContent;}showStep(1);$("#booking-dialog").showModal()};$("#service-schedule").onclick=$("#schedule-open").onclick;
$("#book-neighborhood").onchange=()=>fillUnits($("#book-neighborhood").value,$("#book-unit"));
function requestLocation(statusSelector,buttonSelector){
 const status=$(statusSelector),button=$(buttonSelector);
 if(!navigator.geolocation){status.textContent="Este navegador não disponibiliza localização. Escolha seu bairro manualmente.";return}
 button.disabled=true;button.textContent="Consultando localização…";
 navigator.geolocation.getCurrentPosition(
  ()=>{locationWasGranted=true;status.textContent="Localização autorizada. Para indicar a unidade correta, confirme seu bairro abaixo. Esta prévia ainda não possui o mapa oficial de unidades e áreas de abrangência.";button.textContent="Localização autorizada";},
  error=>{status.textContent=error.code===1?"Permissão não concedida. Você pode escolher seu bairro manualmente.":"Não foi possível obter a localização agora. Escolha seu bairro manualmente.";button.textContent="Tentar novamente";button.disabled=false;},
  {enableHighAccuracy:false,timeout:10000,maximumAge:60000}
 );
}
$("#unit-geolocation").onclick=()=>requestLocation("#unit-location-status","#unit-geolocation");
$("#booking-geolocation").onclick=()=>requestLocation("#booking-location-status","#booking-geolocation");
let step=1,period="Manhã";function showStep(n){step=n;document.querySelectorAll(".booking-step").forEach(x=>x.classList.toggle("active",Number(x.dataset.step)===n));$("#booking-back").hidden=n===1;$("#booking-next").textContent=n===3?"Concluir demonstração":n===2?"Revisar solicitação":"Continuar"}
$("#booking-back").onclick=()=>showStep(step-1);$("#booking-next").onclick=()=>{if(step===1){if(!$("#book-neighborhood").value||!$("#book-unit").value){$("#booking-error").textContent="Selecione seu bairro e sua unidade.";return}$("#booking-error").textContent="";selectedNeighborhood=$("#book-neighborhood").value;$("#unit-label").textContent=$("#book-unit").value;showStep(2)}else if(step===2){$("#booking-summary").innerHTML='<p><b>Unidade:</b> '+$("#book-unit").value+'</p><p><b>Especialidade:</b> '+$("#specialty").value+'</p><p><b>Profissional:</b> '+$("#professional").value+'</p><p><b>Preferência:</b> '+period+'</p>';showStep(3)}else{$("#booking-dialog").close();$("#toast").textContent="Demonstração concluída. Nenhuma consulta foi marcada.";$("#toast").classList.add("show");setTimeout(()=>$("#toast").classList.remove("show"),3200);showStep(1)}};
document.querySelectorAll("[data-period]").forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll("[data-period]").forEach(x=>x.classList.toggle("selected",x===b))});
$("#login-open").onclick=()=>$("#login-dialog").showModal();document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>b.closest("dialog").close());$("#font-toggle").onclick=()=>document.body.classList.toggle("large-text");$("#mobile-book").onclick=()=>{document.body.classList.remove("mobile-menu-open");$("#schedule-open").click()};
$("#menu-mobile-toggle").onclick=()=>{document.body.classList.add("mobile-menu-open");$("#menu-mobile").inert=false};$("#menu-mobile-close").onclick=()=>{document.body.classList.remove("mobile-menu-open");$("#menu-mobile").inert=true};$("#mobile-overlay").onclick=()=>{document.body.classList.remove("mobile-menu-open");$("#menu-mobile").inert=true};
if(window.lucide)window.lucide.createIcons();
