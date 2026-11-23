# BarberPro — Spec (análise do repositório, sem alterações de código)

SaaS multi-tenant de gestão de barbearias (pt-BR), importado do Lovable.
URL pública: https://barber-manager-99--9kcciklc.preview.emergentagent.com

## Stack
- Frontend único (sem backend próprio): React 19 + TypeScript strict + TanStack Start (SSR, file-based routing, routeTree.gen.ts), TanStack Query, Tailwind v4 + shadcn/ui (new-york), zod, react-hook-form, sonner, recharts.
- Build: Vite 8 via @lovable.dev/vite-tanstack-config; deploy Cloudflare Workers (nitro); dev server fixa porta 8080 (ignora PORT).
- Banco: PostgreSQL via Lovable Cloud (Supabase) — projeto fjpikeisyldjsxfxdtgj, config em supabase/config.toml, env em .env (publishable key apenas). Migrations SQL em drizzle/migrations (0000 core, 0001 funções/triggers, 0002 RLS, 0003 índices). drizzle/schema.ts está VAZIO de propósito; AGENTS.md proíbe editar drizzle/ e supabase/migrations manualmente — só via Lovable.
- Auth: Supabase Auth — e-mail/senha (confirmação por e-mail), Google OAuth e "Lovable OAuth" via @lovable.dev/cloud-auth-js; reset em /reset-password; sessão persistida (localStorage ou broker postMessage no preview Lovable).
- NÃO existe: server functions (createServerFn), Edge Functions, Supabase Storage em uso, nem backend FastAPI (o supervisor do pod espera /app/backend + /app/frontend, que não existem — preview fica 502; contornar subindo vite dev :8080 + proxy HTTP em :3000 reescrevendo Host para localhost:8080).

## Modelo de dados (10 tabelas, Postgres/RLS)
profiles (1:1 auth.users, trigger handle_new_user) · barbershops (slug único, timezone America/Fortaleza, created_by→owner automático via triggers) · shop_memberships (user N:N shop; role: owner|admin|barber|receptionist) · customers (profile opcional) · barbers (profile opcional) · services (price>=0, 5–480min) · barber_services (N:N) · working_hours (dia 0–6, EXCLUDE anti-sobreposição) · barber_time_off · appointments (status: scheduled|confirmed|completed|cancelled|no_show; snapshot de preço/duração; EXCLUDE anti-conflito por barbeiro; trigger valida expediente/folga/serviço do barbeiro/passage do tempo).
Isolamento multi-tenant: barbershop_id em toda tabela + FKs compostas (id, barbershop_id) + trigger anti-troca de barbearia + policies RLS por membership via funções SECURITY DEFINER (has_shop_role, is_shop_member/manager/frontdesk, is_barber_self, is_customer_self, barber_serves_customer, can_view_profile). docs/database.md documenta tudo.

## Fluxos implementados (UI)
- / : landing com CTA → /auth
- /auth : login, cadastro (senha>=8, confirmação por e-mail), esqueci senha; Google/Lovable OAuth
- /reset-password : nova senha
- /painel : lista barbearias do usuário (membership+role), criar barbearia (slug com retry 23505), links Serviços/Barbeiros
- /servicos : CRUD de serviços (validação pt-BR em lib/service-rules), seletor de barbearia, permissão owner/admin na UI
- /barbeiros : CRUD barbeiro + vínculo com serviços + expediente semanal + folgas (lib/barber-rules; EXPEDIENTE usa hora local da barbearia, mas FOLGAS converte com fuso do navegador — bug latente)
- Guard: rota _authenticated com beforeLoad (getUser) → redirect /auth; onAuthStateChange invalida router/query.

## Estado (roadmap.md, confirmado no código)
Pronto: infra, banco+RLS, auth, cadastro de barbearia, módulo Serviços, módulo Barbeiros/horários.
Banco pronto mas SEM UI: appointments, customers, convites/equipe (memberships), get_barber_busy_slots. Perfil do usuário sem tela. Página pública de agendamento inexistente (precisa policies anon).
Barbeiros criados pela UI ficam sem profile_id — não há fluxo para vinculá-los a contas.

## Verificação (nesta sessão, somente leitura)
tsc --noEmit: 0 erros. vitest: 19/19 pass (4 arquivos). Preview público: 200; fluxo home→/auth e redirect /painel→/auth OK; 0 erros de console. Supabase REST anônimo retorna [] (RLS ativa). Testes de regra: lib/*.test.ts; routing: src/test/app-routing.test.tsx.

## Não fazer sem o usuário pedir
Preservar React/TS, Supabase, banco e migrations (Lovable gerencia schema). pt-BR na UI.
