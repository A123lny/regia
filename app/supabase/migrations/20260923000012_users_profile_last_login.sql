-- 20260923000012_users_profile_last_login.sql
-- RF-12.6: last_login_at su users_profile per rilevare assenze dell'Owner.
-- Aggiornato da getSessionOrRedirect ad ogni successo di auth.
-- Idempotente: IF NOT EXISTS.

alter table public.users_profile
  add column if not exists last_login_at timestamptz;

comment on column public.users_profile.last_login_at is
  'RF-12.6: ultimo accesso confermato. Aggiornato da getSessionOrRedirect. NULL = mai loggato.';
