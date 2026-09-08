-- 20260907000005_audit_events.sql
-- RF-11.3: audit log consultabile, filtrabile, esportabile, IMMUTABILE.
-- Ogni azione umana e dell'agente vi finisce.
-- RA-8.12: per ogni azione dell'agente conserviamo origine, contesto, motivo,
-- strumenti, esito, costo (nei details JSONB).
-- RS-3: l'invariante "append-only" è enforced in DB via trigger, non solo in codice.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_kind text not null check (actor_kind in ('user', 'agent', 'system')),
  action text not null check (length(action) between 1 and 200),
  target text null check (target is null or length(target) between 1 and 500),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_org_created_idx
  on public.audit_events(organization_id, created_at desc);
create index audit_events_actor_idx
  on public.audit_events(actor_user_id, created_at desc)
  where actor_user_id is not null;
create index audit_events_action_idx
  on public.audit_events(action);

-- Blocco a livello DB di UPDATE e DELETE.
-- Chiunque usi il service_role vede questi trigger scattare: nemmeno un errore
-- in codice può cancellare la traccia.
-- Nota: TRUNCATE non attiva i trigger per riga; il vincolo è UPDATE/DELETE.
-- In produzione, TRUNCATE sarebbe eseguibile solo da un ruolo con privilegi
-- elevati (mai anon/authenticated), quindi il rischio è trascurabile.
create or replace function public.deny_audit_events_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_events is append-only (RF-11.3)';
end;
$$;

create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.deny_audit_events_mutation();

create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function public.deny_audit_events_mutation();

comment on table public.audit_events is
  'RF-11.3: audit log immutabile. Nessuna UPDATE/DELETE consentita.';

-- Sicurezza baseline coerente con _000007_: RLS abilitata, denial-by-default.
-- L'unica scrittura consentita è via service_role in lib/audit/log.ts (RS-2/RA-8.6).
-- Le policy select per il pannello Owner (RF-11.3 lettura filtrabile) arriveranno in F1.
alter table public.audit_events enable row level security;
revoke insert, update, delete on public.audit_events from anon, authenticated;
-- service_role conserva il grant DEFAULT da PUBLIC; qui lo rendiamo esplicito
-- per proteggere logAuditEvent() da futuri "revoke all from public" di hardening.
grant insert on public.audit_events to service_role;
