-- 20260907000002_organizations.sql
-- RN-87: campo organization presente fin da subito, con un solo valore possibile oggi.
-- Non attiviamo funzionalità multi-tenant; è predisposizione a costo zero
-- in vista di una possibile rivendita white label futura.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.organizations is
  'RN-87: predisposizione multi-tenant. Al lancio esiste una sola riga.';
