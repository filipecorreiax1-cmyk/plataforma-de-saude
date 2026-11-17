const test=require("node:test");
const assert=require("node:assert/strict");
const {Paciente,AgendaPosto}=require("./domain");
test("Paciente solicita agendamento bloqueando horário disponível",()=>{const agenda=new AgendaPosto({medico:"Dra. Ana",especialidade:"Clínica geral",horariosDisponiveis:["2026-12-01T09:00:00Z"]});const p=new Paciente({id:"p1",nome:"Pessoa Teste",cartaoSUS:"",telefoneCelular:""});assert.equal(p.solicitarAgendamento(agenda,"2026-12-01T09:00:00Z"),true);assert.deepEqual(agenda.horariosDisponiveis,[])});
test("AgendaPosto não permite bloquear duas vezes o mesmo horário",()=>{const a=new AgendaPosto({medico:"Dr. B",especialidade:"Clínica",horariosDisponiveis:["09:00"]});assert.equal(a.bloquearHorario("09:00"),true);assert.equal(a.bloquearHorario("09:00"),false)});
test("cancelamento libera novamente a vaga",()=>{const a=new AgendaPosto({medico:"Dr. B",especialidade:"Clínica"});assert.equal(a.liberarVaga("10:00"),true);assert.equal(a.liberarVaga("10:00"),false);assert.deepEqual(a.horariosDisponiveis,["10:00"])});
test("Paciente consulta somente seus itens na fila",()=>{const p=new Paciente({id:"p1",nome:"Teste",cartaoSUS:"",telefoneCelular:""});assert.deepEqual(p.consultarFilaDeEspera([{pacienteId:"p1",posicao:1},{pacienteId:"p2",posicao:2}]),[{pacienteId:"p1",posicao:1}])});
