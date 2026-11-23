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
- /painel : lista barbearias do usuário (membership+role), criar barbearia (slug com retry 23505), links Serviços/Barbeiros levam ?shop=<id>
- /servicos : CRUD de serviços (validação pt-BR em lib/service-rules), permissão owner/admin na UI; exclusão de serviço com agendamentos (FK RESTRICT, 23503) mostra toast amigável e não exclui (isLinkedAppointmentsError)
- /barbeiros : CRUD barbeiro + vínculo com serviços + expediente semanal + folgas (lib/barber-rules; EXPEDIENTE usa hora local da barbearia, mas FOLGAS converte com fuso do navegador — bug latente)
- Guard: rota _authenticated com beforeLoad (getUser) → redirect /auth; onAuthStateChange invalida router/query.

## Agenda, convite de barbeiro, fuso e login
- /agenda (src/routes/_authenticated/agenda.tsx): dia no fuso da loja (lib/timezone), lista appointments do dia (RLS: frontdesk vê todos, barbeiro só os seus), mudar status (Confirmar/Concluir/Faltou/Cancelar). Frontdesk cria agendamento: barbeiro → serviços que ele faz → horários livres (lib/agenda-rules.computeFreeSlots: expediente do dia − get_barber_busy_slots − passado, passo 15min) → cliente existente ou novo. Conflito 23P01 / mensagens P0001 do trigger viram toast (describeAppointmentError).
- Convite por código (sem mudar banco): painel mostra "código de convite" = user.id; em Barbeiros → "Conta do barbeiro" o owner/admin cola o código → cria shop_memberships role barber + barbers.profile_id. Desvincular reverte. Barbeiro ligado vê a loja no painel e só a própria agenda.
- Folgas: datetime-local interpretado e exibido no fuso da barbearia (zonedLocalToUtcIso / formatInZone), não no do navegador.
- Login/reset: botão desabilitado ("Carregando...") até hidratar; valores digitados antes da hidratação são recuperados do DOM; form method=post evita GET nativo.

## Contexto multi-tenant (barbearia ativa)
- Fonte única: src/hooks/use-my-barbershops.ts
  - useMyBarbershops(userId): única query de memberships, chave ["my-barbershops", userId], shape completo (id, name, phone, address), .order("created_at"), staleTime 60s (invalidada ao criar barbearia e no login/logout).
  - useActiveBarbershop(path, userId, requestedShopId): resolve a loja ativa a partir de ?shop=<id>; só aceita se houver membership ativa; senão fallback determinístico (1ª por created_at) e normaliza a URL (replace). Retorna activeShopId, activeShop, activeRole, canManage, setActiveShopId.
  - parseShopSearch: validateSearch do grupo _authenticated (?shop string, 1–80 chars).
- ?shop é só seleção de contexto — autorização continua 100% na RLS + .eq("barbershop_id") em cada operação.
- AppHeader (src/components/AppHeader.tsx): indicador da loja ativa (badge se 1 loja; seletor se >1, data-testid active-shop-switcher/active-shop-indicator) + Sair.
- Troca de loja: useEffect([activeShopId]) fecha formulários/diálogos/painéis abertos; forms montados com key `${activeShopId}-${id}` — rascunho nunca é enviado para outra loja. Query keys de dados incluem o shopId (["services", shopId], ["barbers", shopId]) — sem mistura de cache.
- Links internos (logo, "Voltar ao painel", cards do painel) propagam ?shop.

## Estado (roadmap.md, confirmado no código)
Pronto: infra, banco+RLS, auth, cadastro de barbearia, módulo Serviços, módulo Barbeiros/horários.
Banco pronto mas SEM UI: appointments, customers, convites/equipe (memberships), get_barber_busy_slots. Perfil do usuário sem tela. Página pública de agendamento inexistente (precisa policies anon).
Barbeiros criados pela UI ficam sem profile_id — não há fluxo para vinculá-los a contas.

## Verificação (contexto multi-tenant)
tsc: 0 erros. vitest: 30/30 (inclui src/hooks/use-my-barbershops.test.tsx com Supabase mockado e router em memória).
E2E real (2 contas QA, depois limpo): API RLS 12/12; navegador 20/20 + 6/6 (A, servidor direto).
ATENÇÃO testes E2E pelo URL público: o ingress do preview devolve HTTP 429 quando há muitos carregamentos completos seguidos em modo dev (Vite serve centenas de módulos) → tela branca intermitente. Não é bug do app; prefira navegação client-side ou http://localhost:3000. Na tela /auth, espere a hidratação antes de preencher (antes dela o form faz GET nativo /auth?).
tsc --noEmit: 0 erros. vitest: 19/19 pass (4 arquivos). Preview público: 200; fluxo home→/auth e redirect /painel→/auth OK; 0 erros de console. Supabase REST anônimo retorna [] (RLS ativa). Testes de regra: lib/*.test.ts; routing: src/test/app-routing.test.tsx.

## Não fazer sem o usuário pedir
Preservar React/TS, Supabase, banco e migrations (Lovable gerencia schema). pt-BR na UI.
