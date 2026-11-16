-- 20261116000001_robot_assistant_schema.sql
-- RN-robot T1: schema per assistente AI in-app (robottino 🤖).
--
-- Tabelle nuove:
--   robot_conversations  - header conversazione (NO messaggi persistiti su DB).
--   robot_role_access    - configurazione abilitazione robottino per ruolo.
--
-- Modifiche additive:
--   ai_spend_budgets.category + ai_spend_ledger.category: aggiunta 'anthropic-robot'
--   per segmentare la spesa AI del robottino dal motore editoriale esistente.
--
-- Sicurezza: pattern coerente con 20260907000005_audit_events.sql
--   - RLS enabled su entrambe le nuove tabelle
--   - Nessuna policy SELECT per anon/authenticated: il backend legge via service_role
--   - revoke insert/update/delete da anon/authenticated (denial-by-default)
--   - grant esplicito a service_role
-- Idempotenza: IF NOT EXISTS su CREATE TABLE/INDEX; constraint ricreate via drop+add.

-- ============================================================
-- robot_conversations
-- ============================================================
create table if not exists public.robot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  ended_at timestamptz,
  tool_calls_count int not null default 0,
  constraint robot_conv_tool_count_positive check (tool_calls_count >= 0)
);

create index if not exists robot_conv_org_user_idx
  on public.robot_conversations (organization_id, user_id, last_message_at desc);

alter table public.robot_conversations enable row level security;

revoke insert, update, delete on public.robot_conversations from anon, authenticated;
grant insert, update, select on public.robot_conversations to service_role;

comment on table public.robot_conversations is
  'RN-robot: header conversazione robottino. Messaggi NON persistiti (solo sessionStorage browser).';

-- ============================================================
-- robot_role_access
-- ============================================================
create table if not exists public.robot_role_access (
  role text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint robot_role_access_role_check
    check (role in ('owner', 'editor', 'delegate', 'agent'))
);

alter table public.robot_role_access enable row level security;

revoke insert, update, delete on public.robot_role_access from anon, authenticated;
grant insert, update, select on public.robot_role_access to service_role;

-- Seed iniziale: solo owner abilitato (rollout controllato, cfr. design §6 e §13)
insert into public.robot_role_access (role, enabled)
values
  ('owner', true),
  ('editor', false),
  ('delegate', false),
  ('agent', false)
on conflict (role) do nothing;

comment on table public.robot_role_access is
  'RN-robot: abilitazione robottino per ruolo utente. Default: solo owner.';

-- ============================================================
-- ai_spend_budgets / ai_spend_ledger: aggiunta category 'anthropic-robot'
-- ============================================================
alter table public.ai_spend_budgets
  drop constraint if exists budget_category_check;
alter table public.ai_spend_budgets
  add constraint budget_category_check
    check (category in ('anthropic', 'gemini', 'voyage', 'all', 'anthropic-robot'));

alter table public.ai_spend_ledger
  drop constraint if exists ledger_category_check;
alter table public.ai_spend_ledger
  add constraint ledger_category_check
    check (category in ('anthropic', 'gemini', 'voyage', 'anthropic-robot'));

comment on constraint budget_category_check on public.ai_spend_budgets is
  'RN-robot: aggiunta category anthropic-robot per budget separato del robottino.';
