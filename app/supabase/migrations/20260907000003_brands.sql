-- 20260907000003_brands.sql
-- RF-2.1: struttura società → marchi. Ogni marchio ha slug tecnico stabile
-- (per join, log, chiavi di configurazione) e display_name modificabile.
-- RS-3: unicità dello slug per organization garantita in DB, non solo in app.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  slug text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  constraint brands_slug_per_org_unique unique (organization_id, slug),
  constraint brands_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,49}$')
);

create index brands_organization_idx on public.brands(organization_id);

comment on column public.brands.slug is
  'Identificatore tecnico stabile (a-z, 0-9, trattino). Il display_name è modificabile senza toccare i riferimenti.';
