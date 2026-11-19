# Roteiro de testes de aceitação

Executar em ambiente de teste com banco PostgreSQL separado e dados fictícios. Não usar CPF, Cartão SUS ou prontuários reais.

## 1. Cadastro
- Tentar cadastrar paciente com CPF inválido: a API deve responder 400.
- Cadastrar CPF válido.
- Tentar cadastrar o mesmo CPF novamente: deve responder 409.
- Confirmar que a senha armazenada é hash bcrypt e nunca aparece na resposta.

## 2. Agendamento concorrente
- Como ADMIN, cadastrar um médico e criar um horário futuro em `POST /api/admin/slots`.
- Fazer duas solicitações simultâneas de `POST /api/appointments` com o mesmo `slotId), usando dois pacientes.
- Apenas uma deve receber 201; a outra deve receber 409.
- Cancelar a consulta confirmada; o horário deve voltar a aparecer como disponível.

## 3. Autenticação
- Fazer logout e chamar `GET /api/appointments`: deve retornar 401.
- Entrar com paciente e confirmar que /api/appointments retorna somente os agendamentos daquele paciente.
- Profissional sem 2FA ativo não deve conseguir entrar.
- Profissional com TOTP válido deve conseguir entrar.

## 4. Responsividade e acessibilidade
- Testar em viewport de 320px, 375px, 768px e desktop.
- Verificar ausência de rolagem horizontal, campos legíveis, botões utilizáveis e diálogos que cabem na tela.
- Navegar apenas pelo teclado e verificar foco visível e link “Pular para o conteúdo”.
- Testar com leitor de tela e zoom de 200%.

## 5. Segurança de rotas
- Tentar acessar /api/staff/patients sem login: 401.
- Logado como PATIENT, tentar acessar /api/staff/patients: 403.
- Logado como DOCTOR, verificar que a listagem contém somente pacientes com consulta vinculada àquele médico.
- Logado como PATIENT A, tentar cancelar agendamento do PATIENT B: 403.
- Confirmar CPF e Cartão SUS mascarados em respostas de listagem.

## Resultado
Registrar ambiente, navegador, data, resultado esperado/obtido e evidência de cada teste. Os testes automatizados atuais cobrem apenas CPF e mascaramento; este roteiro de integração ainda precisa ser executado após configurar o banco e os usuários de teste.
