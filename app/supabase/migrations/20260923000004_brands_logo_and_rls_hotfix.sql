-- 20260923000004_brands_logo_and_rls_hotfix.sql
--
-- PARTE 1: RLS hotfix per le 3 tabelle create senza abilitare RLS.
-- Il baseline del progetto e denial-by-default (mig 20260907000007).
-- Il codice usa getAdminClient (service_role) che bypassa RLS, quindi nessun
-- impatto funzionale — ma allineamento a policy standard del progetto.
--
-- PARTE 2: aggiungere logo_url a brands (RF-2.2 completamento).

-- ── PARTE 1: RLS baseline sulle 3 tabelle mancanti ──────────────────────────
alter table public.brand_recurring_events enable row level security;
alter table public.brand_social_accounts enable row level security;
alter table public.content_material_requests enable row level security;

-- Nessuna policy select: denial-by-default (coerente col baseline).
-- Le policy scoped-per-organization arriveranno con F1 completo o F0-b.

-- ── PARTE 2: logo_url in brands ─────────────────────────────────────────────
alter table public.brands
  add column if not exists logo_url text;

comment on column public.brands.logo_url is
  'URL public del logo marchio nel bucket content-media (path: brand-logos/{brandId}.{ext}). NULL = nessun logo → UI mostra placeholder.';
