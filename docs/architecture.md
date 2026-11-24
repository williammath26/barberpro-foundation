# BarberPro — Arquitetura do produto

**Status:** decisões arquiteturais iniciais aprovadas  
**Data:** 2026-11-24  
**Branch de trabalho:** `fix/seguranca-e-integridade`

## 1. Decisões aprovadas

- **Modelo comercial:** cada barbearia contrata e administra seu próprio ambiente lógico.
- **Aplicativo do cliente:** um único aplicativo BarberPro para Android e iOS, atendendo todas as barbearias.
- **Infraestrutura:** compartilhada, com isolamento lógico dos dados por barbearia (multi-tenant).
- **Agendamento:** disponível tanto no aplicativo quanto em uma página pública responsiva, acessível por link exclusivo da barbearia.
- **Painel administrativo:** aplicação web para proprietários e equipe.

“Ambiente individual” significa identidade, usuários, configurações, dados e regras separados. Não significa criar um banco ou uma instalação de código por cliente.

## 2. Visão de alto nível

```text
                 ECOSSISTEMA BARBERPRO
                          |
        +-----------------+------------------+
        |                 |                  |
  Painel Web        App Mobile        Página Pública
  Gestão             Cliente           Agendamento
        |                 |                  |
        +-----------------+------------------+
                          |
                 Camada de serviços
       autenticação • autorização • agenda
       clientes • promoções • fidelidade
                          |
                 Lovable Cloud / Supabase
       Auth • PostgreSQL • RLS • Storage
       funções server-side / Edge Functions
```

## 3. Aplicações

### 3.1 Painel administrativo — aplicação existente

Manter a aplicação web atual em React + TypeScript, TanStack Start e integração com Supabase/Lovable Cloud.

Perfis previstos:
- `owner`: proprietário e controle total da barbearia.
- `admin`: administração operacional conforme permissões.
- `barber`: agenda própria e operações permitidas.
- `receptionist`: clientes e agenda, conforme permissões.

O usuário pode participar de mais de uma barbearia. A barbearia ativa deve ser resolvida por vínculo válido no servidor; não confiar em um `barbershop_id` enviado pelo navegador como prova de autorização.

### 3.2 Aplicativo único — cliente

Criar um aplicativo React Native com Expo, publicado uma vez como BarberPro para Android e iOS.

O app deve:
- permitir descobrir/selecionar uma barbearia ou entrar por link direto;
- carregar nome, logo, cores, serviços, equipe e promoções da barbearia selecionada;
- permitir cadastro/login do cliente;
- listar e gerenciar agendamentos;
- mostrar pontos, extrato e recompensas;
- receber notificações relacionadas à barbearia e aos agendamentos.

A identidade visual do app permanece BarberPro. A identidade da barbearia é aplicada dentro da experiência e nas páginas vinculadas. Não gerar um binário diferente por barbearia.

### 3.3 Página pública de agendamento

A aplicação web existente deve oferecer rota pública baseada em slug, por exemplo:

`barberpro.app/b/{slug}`

Fluxo:
1. Carregar somente dados públicos e ativos da barbearia.
2. Selecionar serviço.
3. Selecionar barbeiro ou opção “qualquer disponível”, se habilitada.
4. Selecionar data e horário realmente disponíveis.
5. Informar nome e telefone; oferecer login/cadastro sem tornar a instalação do app obrigatória.
6. Confirmar o agendamento e apresentar protocolo/resumo.

A página pública não pode expor dados pessoais, agenda completa, motivos de folga ou dados de outros clientes.

## 4. Multi-tenancy e isolamento

- Todas as tabelas de negócio devem possuir `barbershop_id` (ou uma relação composta que prove o tenant).
- Chaves estrangeiras compostas devem impedir relacionar cliente, barbeiro, serviço e agendamento de barbearias diferentes.
- RLS deve ser habilitada em todas as tabelas expostas ao cliente.
- Políticas devem verificar associação ativa e papel apropriado.
- Funções privilegiadas devem usar `SECURITY DEFINER` com `search_path` fixo, validar usuário/tenant/papel internamente e revogar execução de `PUBLIC` e `anon` quando não forem públicas.
- Nunca colocar chave `service_role` no navegador ou no aplicativo.
- Não usar apenas filtros de frontend como mecanismo de segurança.
- Dados públicos devem ser disponibilizados por políticas/funções específicas e com projeção mínima.

## 5. Domínios funcionais

1. **Identidade e acesso:** perfis, autenticação, memberships, convites e papéis.
2. **Barbearia:** cadastro, slug, contatos, endereço, fuso horário, logo e tema.
3. **Catálogo:** serviços, preços, duração, status e associação barbeiro-serviço.
4. **Equipe:** barbeiros, expediente, folgas, bloqueios e permissões.
5. **Agenda:** disponibilidade, agendamento, confirmação, conclusão, cancelamento e ausência.
6. **Clientes:** cadastro por barbearia, histórico e preferências.
7. **Promoções:** campanhas, cupons, validade, limites e regras de elegibilidade.
8. **Fidelidade:** configuração de pontos, ledger imutável de créditos/débitos, recompensas e resgates.
9. **Notificações:** confirmações, lembretes, cancelamentos e campanhas com consentimento.
10. **Assinatura comercial:** plano, status da contratação, período de teste, cobrança e suspensão controlada.

## 6. Regras críticas de agendamento

- O horário é calculado no fuso da barbearia (`barbershops.timezone`); instantes são persistidos em `timestamptz`.
- O servidor calcula o fim do atendimento usando a duração vigente do serviço e grava preço/duração como snapshot.
- A disponibilidade considera expediente, folgas, bloqueios, serviços habilitados e agendamentos ativos.
- A validação final ocorre no banco/servidor dentro de operação atômica.
- A constraint de não sobreposição continua sendo a última barreira contra concorrência.
- A consulta de disponibilidade nunca substitui a validação no momento da confirmação.
- Cancelamento, reagendamento, conclusão e ausência devem seguir transições explícitas e auditáveis.

## 7. Regras críticas de fidelidade

- Pontos são concedidos somente após atendimento concluído e conforme regra vigente da barbearia.
- Toda movimentação deve gerar registro no extrato; não sobrescrever saldo manualmente.
- A operação de crédito deve ser idempotente para impedir pontuação duplicada.
- Resgate deve debitar pontos e criar a recompensa/resgate na mesma transação.
- Estornos e ajustes devem gerar lançamentos compensatórios, com motivo e autor.
- O cliente pode consultar, mas não alterar saldo ou lançamentos.

## 8. Stack e organização

### Stack confirmada pelo projeto atual
- Web: React + TypeScript + TanStack Start.
- Backend gerenciado: Lovable Cloud / Supabase.
- Banco: PostgreSQL.
- Segurança: Supabase Auth + RLS + funções PostgreSQL.
- Testes web: Vitest e Testing Library.
- Pacotes e scripts: Bun conforme arquivos atuais do repositório.

### Aplicativo mobile planejado
- React Native + Expo.
- Consumir os mesmos contratos e serviços de backend.
- Reutilizar tipos/validações compartilháveis quando isso não acoplar o app mobile ao runtime web.
- Não duplicar regras críticas no cliente; o backend continua sendo a fonte de verdade.

### Organização-alvo (evolutiva)
- aplicação web existente na raiz;
- aplicativo mobile em `apps/mobile`;
- contratos/tipos compartilhados em pacote próprio somente quando houver necessidade real;
- documentação de domínio e segurança em `docs/`.

A inclusão do app mobile deve ser feita incrementalmente, sem reestruturar a aplicação web já funcional.

## 9. Estado conhecido e pendências técnicas

O repositório já contém cadastro de barbearia, serviços, barbeiros, clientes e início do módulo de agenda. A branch `fix/seguranca-e-integridade` contém a migration `0004_atomic_barber_accounts_and_busy_slots.sql`, ausente da branch `main` no estado verificado em 2026-11-24.

Antes de ampliar funcionalidades:
1. resolver a sincronização/integração da branch de segurança com o fluxo do Lovable; não presumir que a migration 0004 já foi aplicada no banco;
2. corrigir e testar a regra `can_view_profile` para exigir vínculo ativo quando aplicável;
3. definir a fonte canônica do schema: as migrations SQL existentes são a trilha atual; `drizzle/schema.ts` está vazio e não deve ser tratado como schema completo;
4. completar snapshot/journal do Drizzle somente conforme a estratégia de migração aprovada, sem editar arquivos gerenciados pelo Lovable manualmente;
5. executar testes de integração contra ambiente Supabase de teste, incluindo RLS, RPCs, concorrência e isolamento entre duas barbearias;
6. criar leitura pública mínima e fluxo seguro de reserva sem autenticação para a página pública;
7. desenhar e implementar módulos de promoções e fidelidade depois de estabilizar agenda e permissões.

## 10. Ordem de implementação

**Fase 0 — Fundação segura**
- consolidar migrations e branch;
- revisar RLS, funções e papéis;
- criar testes de isolamento multi-tenant;
- validar ambiente de teste.

**Fase 1 — Agenda operacional**
- consulta de disponibilidade;
- criação/edição/cancelamento;
- estados e visão diária/semanal;
- fluxo de recepção e barbeiro.

**Fase 2 — Agendamento público**
- página por slug;
- dados públicos mínimos;
- reserva segura e prevenção de spam;
- confirmação e notificações.

**Fase 3 — Cliente e fidelidade**
- conta do cliente e histórico;
- ledger de pontos;
- recompensas e resgates;
- promoções e cupons.

**Fase 4 — App mobile**
- autenticação e seleção de barbearia;
- agendamento;
- histórico;
- pontos e promoções;
- push notifications.

**Fase 5 — Operação comercial**
- onboarding de barbearias;
- planos e assinaturas;
- cobrança;
- suporte, auditoria e observabilidade.

## 11. Critérios de aceite arquitetural

- Um usuário de uma barbearia não consegue ler nem alterar dados de outra, inclusive manipulando IDs.
- Um barbeiro não acessa dados de clientes/agendas fora de suas permissões.
- A reserva concorrente do mesmo barbeiro/horário resulta em no máximo um agendamento ativo.
- A página pública não revela dados privados.
- O app único aplica corretamente o contexto e a identidade visual de cada barbearia.
- Pontos não podem ser duplicados nem resgatados duas vezes.
- Nenhum segredo privilegiado é distribuído aos clientes.
