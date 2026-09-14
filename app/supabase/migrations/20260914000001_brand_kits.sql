-- 20260914000001_brand_kits.sql
-- RF-2.3 (tono di voce) + RF-2.3a (contesto strategico).
-- 1:1 con brands. brand_id come primary key = FK cascade.

create table public.brand_kits (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  tone_of_voice text not null default '',
  strategic_purpose text not null default '',
  strategic_year_goal text not null default '',
  strategic_direction text not null default '',
  updated_at timestamptz not null default now(),
  constraint brand_kits_tone_len check (length(tone_of_voice) <= 5000),
  constraint brand_kits_purpose_len check (length(strategic_purpose) <= 3000),
  constraint brand_kits_year_goal_len check (length(strategic_year_goal) <= 3000),
  constraint brand_kits_direction_len check (length(strategic_direction) <= 3000)
);

-- Sicurezza baseline coerente con _000007_ F0: RLS enabled + revoke totale
-- su anon/authenticated. Solo service_role scrive (via lib/db/admin.ts).
alter table public.brand_kits enable row level security;
revoke insert, update, delete on public.brand_kits from anon, authenticated;
grant insert, update, delete, select on public.brand_kits to service_role;

comment on table public.brand_kits is
  'RF-2.3 + RF-2.3a: tono di voce + contesto strategico per marchio. 1:1 con brands.';
