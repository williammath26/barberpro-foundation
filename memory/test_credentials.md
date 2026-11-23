# Contas de teste (QA) — Lovable Cloud real

Criadas para os testes E2E do contexto multi-tenant (e-mails temporários guerrillamail, confirmados).
Login em /auth com e-mail + senha.

| Conta | E-mail | Senha |
|---|---|---|
| Usuário A | tfewlmzz@guerrillamailblock.com | QaBarber!qgdlp7nv#7Kz |
| Usuário B | usckloxz@guerrillamailblock.com | QaBarber!fbzzsenv#7Kz |

Estado atual (semeado para testes de Agenda/Convite/Folgas):
- Usuário B é owner de "QA — Loja Centro" (id 7c67b2ef-15a9-4b9f-966f-17bb23431df9, fuso America/Fortaleza UTC-3).
  Serviços "Corte QA" (30min, R$50) e "Barba QA" (30min, R$30); "Barbeiro QA" faz os dois, expediente 09:00–18:00 todos os dias;
  cliente "Cliente Existente QA"; 1 agendamento em 2026-11-25 10:00–10:30 (hora local) — horário 10:00 deve aparecer bloqueado nesse dia.
- Usuário A não tem barbearia: é o barbeiro a ser convidado (código de convite = user id de A: 4024bb0e-7596-44ef-a4ed-02fad4cb1daf).
