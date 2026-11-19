class Paciente {
 constructor({id,nome,cartaoSUS,telefoneCelular}) {
  this.id=id; this.nome=nome; this.cartaoSUS=cartaoSUS; this.telefoneCelular=telefoneCelular;
 }
 solicitarAgendamento(agenda,horario) {
  return agenda.bloquearHorario(horario);
 }
 consultarFilaDeEspera(fila) {
  return fila.filter(item=>item.pacienteId===this.id);
 }
}
class AgendaPosto {
 constructor({medico,especialidade,horariosDisponiveis=[]}) {
  this.medico=medico; this.especialidade=especialidade; this.horariosDisponiveis=[...horariosDisponiveis];
 }
 bloquearHorario(horario) {
  const index=this.horariosDisponiveis.indexOf(horario);
  if(index<0)return false;
  this.horariosDisponiveis.splice(index,1);
  return true;
 }
 liberarVaga(horario) {
  if(this.horariosDisponiveis.includes(horario))return false;
  this.horariosDisponiveis.push(horario);
  this.horariosDisponiveis.sort();
  return true;
 }
}
module.exports={Paciente,AgendaPosto};
