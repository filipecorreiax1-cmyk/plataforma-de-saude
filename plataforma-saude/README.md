# Plataforma de Saúde

Portal mobile-first para aproximar a população dos serviços da atenção básica: cadastro, agendamento e cancelamento de consultas, consulta de vacinas e calendário municipal.

## Estrutura
- `frontend/`: portal do cidadão, área da equipe, interface responsiva e acessível.
- `backend/src/server.js`: API Express, autenticação e autorização.
- `backend/prisma/schema.prisma`: PostgreSQL, usuários, profissionais, consultas, horários, vacinas, campanhas e auditoria.

## Instalação local
1. Instale Node.js 20+ e PostgreSQL.
2. Na pasta `plataforma-saude`, execute `npm install`.
3. Copie `backend/.env.example` para `.env` e ajuste `DATABASE_URL`, `JWT_SECRET` (segredo aleatório de pelo menos 32 caracteres) e os dados de bootstrap do administrador.
4. Execute `npx prisma generate`.
5. Execute `npx prisma migrate dev --name inicial`.
6. Crie o primeiro administrador uma única vez: `npm run admin:create`. Use CPF real válido e senha forte no arquivo de ambiente; depois remova as variáveis ADMIN_* do ambiente.
7. Execute `npm start` e abra http://localhost:3000.

## Fluxo de operação
- O administrador acessa `/staff.html`, cadastra profissionais pela tela e provisiona o 2FA.
- O administrador cria horários pela área da equipe (profissional, data/hora, especialidade e unidade).
- O cidadão consulta os profissionais e horários em aberto, solicita uma vaga e pode cancelar seu próprio agendamento.
- A equipe de enfermagem/administrador cadastra vacinas e campanhas pela área da equipe.

## Papéis e proteção de dados
- PATIENT: acessa apenas os próprios agendamentos.
- DOCTOR: acessa sua agenda e pacientes com atendimento associado ao próprio profissional.
- NURSE: gerencia vacinas e campanhas; não acessa a listagem geral de pacientes.
- ADMIN: gerencia profissionais, horários e provisionamento do segundo fator.

A autorização é validada no servidor. CPF e Cartão SUS são mascarados em listagens. Não há prontuário clínico completo nesta etapa. O agendamento utiliza horários previamente cadastrados e bloqueio transacional; a restrição única no banco impede duplicidade por profissional/horário. Cancelamentos liberam o horário novamente.

## Autenticação de profissionais
O administrador provisiona o TOTP por `POST /api/admin/staff/:id/2fa/setup`; o profissional registra a chave em aplicativo autenticador; o administrador confirma o código por `POST /api/admin/staff/:id/2fa/confirm`. Contas profissionais sem 2FA ativo não conseguem entrar.

## Testes
- `npm test`: testes automatizados de validação de CPF e mascaramento.
- Consulte `tests/acceptance.md` para os testes de cadastro, concorrência de horários, autenticação, responsividade e bloqueio de rotas.

## Segurança e implantação
Em produção, use HTTPS obrigatório, segredo em cofre de segredos, backup criptografado, política de retenção, monitoramento, gestão de incidentes e revisão independente de segurança. Faça avaliação de impacto e validação jurídica da LGPD. Não exponha o banco à internet.

## Limitações importantes
Ainda não há integração com sistemas nacionais do SUS, prontuário eletrônico completo, notificações SMS/e-mail, recuperação de senha, painel visual administrativo/profissional, nem sincronização automática do calendário municipal. Os dados de vacinas e campanhas devem ser inseridos por profissionais autorizados e validados pela Secretaria de Saúde.

**Esta entrega é uma base de desenvolvimento/MVP e não está pronta para uso clínico com dados reais.** Antes de produção, conclua auditoria de segurança, testes de carga e acessibilidade, revisão jurídica/LGPD, política de consentimento/base legal, backups e validação com a equipe de saúde.

## Acessibilidade
Meta: WCAG 2.2 nível AA. Foram incluídos landmarks semânticos, link para pular conteúdo, rótulos de campos, foco visível, teclado, ajuste de fonte e respeito à redução de movimento. A conformidade exige auditoria manual e automatizada com leitores de tela e dispositivos reais.
