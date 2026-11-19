# BarberPro — Banco de dados

Fuso padrão: `America/Fortaleza` (coluna `barbershops.timezone`). Datas em TIMESTAMPTZ; `working_hours` usa hora local da barbearia.

## Tabelas e relacionamentos
- profiles (1:1 auth.users) — criado automaticamente no cadastro.
- barbershops — o criador vira `owner` automaticamente.
- shop_memberships (profile N:N barbershop) — papel: owner | admin | barber | receptionist.
- customers (barbershop, profile opcional) — um perfil pode ser cliente de várias barbearias.
- barbers (barbershop, profile opcional).
- services (barbershop) — preço ≥ 0, duração 5–480 min.
- barber_services (barber N:N service).
- working_hours (barber, dia 0=domingo…6, início/fim, sem sobreposição).
- barber_time_off (barber, intervalo).
- appointments (customer, barber, service; preço e duração copiados no momento do agendamento).
Chaves estrangeiras compostas `(id, barbershop_id)` garantem que tudo pertence à mesma barbearia.

## Regras de acesso (RLS)
| Tabela | Ver | Criar/editar | Excluir |
|---|---|---|---|
| profiles | próprio; colegas da barbearia; recepção vê clientes | próprio | — |
| barbershops | ativas (logados); membros | criar: qualquer logado; editar: owner/admin | owner |
| shop_memberships | próprio vínculo; membros da barbearia | owner: todos os papéis; admin: só barber/receptionist; ninguém altera o próprio papel | owner/admin (mesma regra); usuário pode sair (exceto owner) |
| customers | owner/admin/recepção; o próprio cliente; barbeiro só clientes que atende | owner/admin/recepção; cliente cria/edita o próprio | owner/admin |
| barbers, services, barber_services, working_hours | membros; logados veem itens ativos de barbearias ativas | owner/admin | owner/admin |
| barber_time_off | owner/admin/recepção; o próprio barbeiro | owner/admin; barbeiro (próprias folgas) | idem |
| appointments | owner/admin/recepção; barbeiro (próprios); cliente (próprios) | recepção+: tudo; cliente: agenda para si, só cancela; barbeiro: só status/observações | owner/admin |

## Funções
- Permissão (SECURITY DEFINER, sem recursão): has_shop_role, is_shop_member, is_shop_manager, is_shop_frontdesk, is_barber_self, is_customer_self, barber_serves_customer, can_view_profile.
- get_barber_busy_slots(barbeiro, de, até): só intervalos ocupados, sem dados de clientes (máx. 31 dias).

## Triggers
handle_new_user, criação de owner, updated_at, bloqueio de troca de barbearia, proteção de papéis/último owner, validação de cliente, validação de agendamento (expediente, folgas, serviço do barbeiro, passado, snapshot de preço/duração). Conflitos de horário são barrados por EXCLUDE constraint (seguro com acessos simultâneos).
