-- 20260922000002_users_profile_archive.sql
-- Soft delete per membri del team: is_archived=true impedisce il login.
-- Coerente col pattern brands.is_archived (dati storici conservati per audit).
-- Il check in getSessionOrRedirect blocca l'accesso a membri archiviati.
-- Idempotente: IF NOT EXISTS.

alter table public.users_profile
  add column if not exists is_archived boolean not null default false;

-- Index parziale per "solo membri attivi" (default UI /team)
create index if not exists users_profile_active_idx
  on public.users_profile (organization_id, role)
  where is_archived = false;

comment on column public.users_profile.is_archived is
  'Soft delete: membri archiviati non possono fare login (verificato in getSessionOrRedirect).';
