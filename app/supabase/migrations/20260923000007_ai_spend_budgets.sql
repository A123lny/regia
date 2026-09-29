-- 20260923000007_ai_spend_budgets.sql
-- RF-11.5: tetti spesa AI per organization + categoria.
-- ai_spend_budgets: config (cap mensile + soglia allarme)
-- ai_spend_ledger: log immutabile delle spese (append-only, coerente con audit)
--
-- Categorie: 'anthropic' (Claude), 'gemini' (Google), 'voyage' (embeddings),
-- 'all' (budget totale, opzionale). NULL brand_id = spesa non attribuibile.
-- Idempotente: IF NOT EXISTS.

create table if not exists public.ai_spend_budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category text not null,
  monthly_cap_usd numeric(10, 4) not null,
  alert_threshold_percent int not null default 80,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint budget_category_check
    check (category in ('anthropic', 'gemini', 'voyage', 'all')),
  constraint budget_cap_positive check (monthly_cap_usd >= 0),
  constraint budget_threshold_range check (alert_threshold_percent between 1 and 100),
  constraint budget_unique_per_org unique (organization_id, category)
);

alter table public.ai_spend_budgets enable row level security;

create table if not exists public.ai_spend_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  category text not null,
  action text not null,
  cost_usd numeric(10, 6) not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  target_type text,
  target_id text,
  occurred_at timestamptz not null default now(),
  constraint ledger_category_check
    check (category in ('anthropic', 'gemini', 'voyage')),
  constraint ledger_cost_positive check (cost_usd >= 0)
);

create index if not exists ai_spend_ledger_org_month_idx
  on public.ai_spend_ledger (organization_id, category, occurred_at);

alter table public.ai_spend_ledger enable row level security;

comment on table public.ai_spend_budgets is
  'RF-11.5: cap mensile di spesa AI per categoria + soglia allarme.';
comment on table public.ai_spend_ledger is
  'RF-11.5: log append-only delle spese AI. Somma mensile confrontata col cap.';
