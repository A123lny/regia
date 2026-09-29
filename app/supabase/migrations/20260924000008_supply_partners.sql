-- M6a Partner spesa — RF-6.19 assenso partner per promozioni.

-- ============================================================================
-- 1. supply_partners — anagrafica fornitori (principalmente spesa Lenny)
-- ============================================================================

create table if not exists supply_partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  name text not null,
  referent_name text,
  phone text,
  email text,
  category text, -- bevande, pasta, carne, latticini, ecc.
  general_consent boolean not null default false, -- assenso "blanket" per promozioni sui suoi prodotti
  general_consent_note text,
  archived_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supply_name_length check (length(trim(name)) > 0),
  -- Se general_consent=true → note dovrebbe esserci (motivo/scadenza dell'assenso)
  constraint supply_consent_note_when_granted
    check (general_consent = false or (general_consent = true and general_consent_note is not null and length(trim(general_consent_note)) > 0))
);

create index if not exists idx_supply_org on supply_partners(organization_id);
create index if not exists idx_supply_consent on supply_partners(organization_id) where general_consent = true;
create index if not exists idx_supply_active on supply_partners(organization_id, created_at desc) where archived_at is null;

drop trigger if exists trg_supply_touch_updated_at on supply_partners;
create trigger trg_supply_touch_updated_at
before update on supply_partners
for each row execute function contacts_touch_updated_at();

alter table supply_partners enable row level security;
drop policy if exists "supply_partners_service_role_all" on supply_partners;
create policy "supply_partners_service_role_all"
on supply_partners for all to service_role using (true) with check (true);

-- ============================================================================
-- 2. brand_products.supply_partner_id — link prodotto → fornitore
-- ============================================================================

alter table brand_products
  add column if not exists supply_partner_id uuid
  references supply_partners(id) on delete set null;

create index if not exists idx_products_supply_partner
  on brand_products(supply_partner_id) where supply_partner_id is not null;
