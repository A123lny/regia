-- Mappatura template Creatomate per brand. L'Owner salva uno o più
-- template_id per marchio con un alias leggibile (es. "Post Instagram 1:1").
-- Indipendente dall'elenco pescato live da Creatomate: qui viviamo gli
-- "scelti e approvati" per il brand, con etichette umane.

create table if not exists public.brand_creatomate_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete cascade,
  template_id text not null,
  label text not null,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_creatomate_tpl_unique unique (brand_id, template_id),
  constraint brand_creatomate_tpl_label_length check (length(label) between 1 and 80)
);

create index if not exists idx_brand_creatomate_tpl_brand
  on public.brand_creatomate_templates (brand_id, sort_order, is_active);

alter table public.brand_creatomate_templates enable row level security;

drop policy if exists "service_role full access on brand_creatomate_templates"
  on public.brand_creatomate_templates;
create policy "service_role full access on brand_creatomate_templates"
  on public.brand_creatomate_templates for all to service_role
  using (true) with check (true);

create or replace function public.touch_brand_creatomate_tpl_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_brand_creatomate_tpl_touch
  on public.brand_creatomate_templates;
create trigger trg_brand_creatomate_tpl_touch
  before update on public.brand_creatomate_templates
  for each row execute function public.touch_brand_creatomate_tpl_updated_at();
