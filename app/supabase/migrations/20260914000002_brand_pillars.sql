-- 20260914000002_brand_pillars.sql
-- RF-2.4: rubriche/pilastri con pesi frequenza per piano editoriale (§7.2).
-- 1:N con brands. weight 1..10 vincolato in DB (RS-3).

create table public.brand_pillars (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  weight integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint brand_pillars_name_per_brand_unique unique (brand_id, name),
  constraint brand_pillars_weight_range check (weight between 1 and 10),
  constraint brand_pillars_name_len check (length(name) between 1 and 100)
);

create index brand_pillars_brand_sort_idx on public.brand_pillars(brand_id, sort_order);

alter table public.brand_pillars enable row level security;
revoke insert, update, delete on public.brand_pillars from anon, authenticated;
grant insert, update, delete, select on public.brand_pillars to service_role;

comment on table public.brand_pillars is
  'RF-2.4: rubriche/pilastri per marchio. Peso frequenza 1-10 vincolato in DB.';
