-- RF-13.1..13.4 + 13.6 Advertising budgets, toggles, classifications, overrun requests.
-- Fuori scope v1: RF-13.5 adapter concreto Google/Meta Ads, RF-13.7 SEO.

-- 1. advertising_budgets: tetto mensile per (brand, categoria) + interruttore ON/OFF.
--    RF-13.2 vincolo: enabled parte sempre false — l'accensione e' sempre decisione esplicita.
create table advertising_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  category text not null check (category in ('social_sponsored', 'google_ads_search', 'google_ads_display')),
  monthly_cap_cents int not null default 0 check (monthly_cap_cents >= 0),
  enabled boolean not null default false,  -- RF-13.2: default OFF per TUTTI, sempre
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, category)
);
create index advertising_budgets_org_brand_idx on advertising_budgets (organization_id, brand_id);
alter table advertising_budgets enable row level security;

-- 2. advertising_spend_ledger: ogni spesa stimata o reale per audit + somma mensile.
--    kind='estimated' = spesa prevista pre-approvazione (RF-13.3)
--    kind='actual'    = spesa reale confermata (dopo invio Ads API — v2)
create table advertising_spend_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  category text not null check (category in ('social_sponsored', 'google_ads_search', 'google_ads_display')),
  draft_id uuid null references content_drafts(id) on delete set null,
  campaign_id uuid null references campaigns(id) on delete set null,
  amount_cents int not null check (amount_cents >= 0),
  kind text not null check (kind in ('estimated', 'actual')),
  notes text null,
  spent_at timestamptz not null default now()
);
create index advertising_ledger_month_idx on advertising_spend_ledger (organization_id, brand_id, category, spent_at);
alter table advertising_spend_ledger enable row level security;

-- 3. content_drafts: classificazione advertising (RF-13.4) + stima spesa (RF-13.3).
alter table content_drafts
  add column if not exists ad_classification text null
    check (ad_classification is null or ad_classification in (
      'only_organic', 'boosted_within_budget', 'boost_candidate_over_budget'
    )),
  add column if not exists ad_estimated_spend_cents int null check (ad_estimated_spend_cents is null or ad_estimated_spend_cents >= 0),
  add column if not exists ad_category text null
    check (ad_category is null or ad_category in ('social_sponsored', 'google_ads_search', 'google_ads_display'));

-- 4. advertising_overrun_requests: RF-13.6 superamento tetto MAI automatico.
--    Owner approva/rifiuta esplicitamente; nessuna auto-approvazione.
create table advertising_overrun_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  category text not null check (category in ('social_sponsored', 'google_ads_search', 'google_ads_display')),
  draft_id uuid null references content_drafts(id) on delete set null,
  campaign_id uuid null references campaigns(id) on delete set null,
  current_cap_cents int not null,
  requested_amount_cents int not null check (requested_amount_cents > 0),
  motivation text not null check (length(trim(motivation)) >= 20),  -- RF-13.6: "motivazione onesta e concreta"
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by uuid null references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  decided_by uuid null references auth.users(id) on delete set null,
  decided_at timestamptz null,
  decision_notes text null
);
create index advertising_overrun_pending_idx on advertising_overrun_requests (organization_id)
  where status = 'pending';
alter table advertising_overrun_requests enable row level security;

-- Seed: NON pre-popoliamo budget. RF-13.2 vincolo: ogni accensione deve essere esplicita.
-- La UI mostrera' righe "non configurato" per i brand × categorie attesi.
