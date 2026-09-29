-- 20260922000003_brand_social_accounts.sql
-- Credenziali social per-brand-per-platform (RS-2 anticipa m14 publisher).
-- Schema flessibile via jsonb: ogni platform ha campi diversi (page_id vs bearer_token vs ...).
-- Validazione dei campi per platform lato applicativo (server actions), non lato DB.
-- Sicurezza F0-b: cifratura at-rest gia garantita da infra Supabase. Cifratura
-- applicativa aggiuntiva (envelope encryption) e' TODO F1.6 quando gestiamo tokens produzione.
-- Idempotente: IF NOT EXISTS.

create table if not exists public.brand_social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  platform text not null,
  credentials jsonb not null default '{}'::jsonb,
  is_connected boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint brand_social_accounts_platform_check
    check (platform in ('facebook', 'instagram', 'google_business', 'linkedin', 'tiktok', 'x')),
  constraint brand_social_accounts_unique
    unique (brand_id, platform)
);

create index if not exists brand_social_accounts_brand_idx
  on public.brand_social_accounts (brand_id);

create index if not exists brand_social_accounts_org_idx
  on public.brand_social_accounts (organization_id);

comment on table public.brand_social_accounts is
  'Credenziali social per marchio e piattaforma. Predisposizione per M14 auto-publishing.';
comment on column public.brand_social_accounts.credentials is
  'jsonb con campi specifici per platform. Non mostrare mai in chiaro nella UI (solo status).';
comment on column public.brand_social_accounts.is_connected is
  'True se le credenziali sono state salvate almeno una volta (proxy di "configurato").';
