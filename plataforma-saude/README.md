# Plataforma de Saúde

Portal mobile-first para aproximar a população dos serviços da atenção básica: cadastro do cidadão, agendamento e cancelamento, vacinas e calendário municipal.

## Estrutura
- `frontend/`: interface responsiva, semântica e acessível.
- `backend/src/server.js`: API Express, autenticação e autorização.
- `backend/prisma/schema.prisma`: modelos PostgreSQL, relações e restrições de integridade.

## Executar localmente
1. Instale Node.js 20+ e PostgreSQL.
2. Na pasta `plataforma-saude`, execute `npm install`.
3. Copie `backend/.env.example` para `.env` e configure `DATABASE_URL` e `JWT_SECRET` (segredo aleatório com pelo menos 32 caracteres).
4. Execute `npx prisma generate`.
5. Execute `npx prisma migrate dev --name inicial`.
6. Execute `npm start` e acesse http://localhost:3000.

## Papéis e acesso
- PATIENT: acessa somente seus próprios agendamentos.
- DOCTOR: acessa sua agenda e os pacientes com os quais possui atendimento registrado.
- NURSE: consulta dados mínimos e administra informações de vacinação.
- ADMIN: administração e provisionamento do segundo fator de profissionais.

A autorização é validada no servidor, não apenas na interface. CPF e Cartão SUS são mascarados nas listagens. Prontuário clínico completo não está implementado nesta etapa.

## Segurança e implantação
Senhas com bcrypt, sessão JWT em cookie HttpOnly/SameSite, limitação de requisições, Helmet, auditoria e TOTP obrigatório para contas profissionais. Um administrador deve provisionar o TOTP por `POST /api/admin/staff/:id/2fa/setup`; o profissional registra a chave em autenticador e o administrador confirma por `POST /api/admin/staff/:id/2fa/confirm`. Não libere contas profissionais antes dessa configuração.

Em produção: HTTPS obrigatório, segredo forte em cofre de segredos, backup criptografado, política de retenção, gestão de incidentes, monitoramento, revisão independente de segurança e avaliação LGPD. Não exponha o banco de dados à internet.

## Limitações conhecidas
A agenda ainda precisa de cadastro de profissionais e horários pela administração; nesta versão o cidadão seleciona um profissional e solicita um horário futuro, e a restrição única no banco impede duplicidade por profissional/horário. Vacinas e campanhas dependem de dados oficiais cadastrados pela unidade. Não há integração com sistemas nacionais do SUS, prontuário eletrônico completo, notificações por SMS/e-mail ou fluxo de recuperação de senha.

**Não utilize dados reais nem coloque em produção para atendimento clínico antes de concluir essas funções, realizar testes, configurar o 2FA, validar a LGPD e obter revisão técnica e jurídica.**

## Acessibilidade
Meta: WCAG 2.2 nível AA. A interface já contempla landmarks HTML, link para pular conteúdo, rótulos, foco visível, navegação por teclado, ajuste de fonte e respeito a redução de movimento. Conformidade requer auditoria manual e automatizada em leitores de tela e dispositivos reais.
