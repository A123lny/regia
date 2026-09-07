-- 20260907000007_enable_rls_baseline.sql
-- Sicurezza baseline: RLS abilitata su ogni tabella F0, con revoke completo su
-- anon/authenticated. Nessuna policy: F0 non serve accesso client-side ai dati.
-- Il codice applicativo usa service_role via lib/db/admin.ts (RS-2) che bypassa
-- RLS by design. Le policy di lettura scoped alla propria organization arrivano
-- in F1 quando i moduli funzionali avranno bisogno di lettura autenticata
-- (RU-1: "un utente può avere ruoli diversi su marchi diversi").
--
-- Motivazione: coerenza con RS-3 (invarianti in DB, non solo in app). Con RLS
-- attiva + revoke, l'unico percorso di scrittura resta service_role: il codice
-- dispone (RA-8.6), il modello (o un bug applicativo) non può bypassarlo.

alter table public.organizations enable row level security;
alter table public.brands enable row level security;
alter table public.users_profile enable row level security;

revoke insert, update, delete on public.organizations from anon, authenticated;
revoke insert, update, delete on public.brands from anon, authenticated;
revoke insert, update, delete on public.users_profile from anon, authenticated;

-- Nessuna policy di SELECT: l'accesso in lettura da client (anon/authenticated)
-- è chiuso finché F1 non le apre esplicitamente per modulo.

comment on table public.organizations is
  'RN-87: predisposizione multi-tenant. RLS abilitata, denial-by-default. Policy in F1.';
comment on table public.brands is
  'RF-2.1: marchi. RLS abilitata, denial-by-default. Policy scoped per organization in F1.';
comment on table public.users_profile is
  'RU-1: ruoli utente per organization. RLS abilitata, denial-by-default. Policy self-read in F1.';
