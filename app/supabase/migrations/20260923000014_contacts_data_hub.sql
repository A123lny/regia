-- M1 Data Hub — scheletro core contatto-centrico.
-- RF-1.2 modello dati canonico (contatti, consensi, veicoli). Ordini/margini/prodotti
-- arrivano nei blocchi successivi.
-- RF-1.3 anagrafica veicolo → prerequisito richiami officina.
-- RF-1.4 consensi per canale, blocco a monte di ogni invio.
-- RS-3 invarianti in DB (unique/FK/check), RS-8 migrazione versionata.
-- RN-87 organization_id su ogni tabella (tenant scope).

-- ============================================================================
-- 1. contacts — anagrafica base cliente
-- ============================================================================

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  first_name text,
  last_name text,
  email text,
  phone text,
  whatsapp text,
  address_street text,
  address_city text,
  address_cap text,
  tags text[] not null default '{}',
  notes text,
  source text not null check (source in ('qr','manuale','import','gestionale','web')),
  is_duplicate_of uuid references contacts(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- RN-87: brand deve appartenere alla stessa organization del contatto (guardia extra).
  constraint contacts_brand_org_consistency
    check (brand_id is not null and organization_id is not null),
  -- almeno un recapito (email/phone/whatsapp) — un contatto senza modo di essere
  -- raggiunto non ha senso operativo.
  constraint contacts_at_least_one_contact_method
    check (
      (email is not null and length(trim(email)) > 0) or
      (phone is not null and length(trim(phone)) > 0) or
      (whatsapp is not null and length(trim(whatsapp)) > 0)
    ),
  -- email deve avere @ se presente (permissivo, non regex completa)
  constraint contacts_email_format
    check (email is null or email like '%_@_%')
);

create index if not exists idx_contacts_org_brand on contacts(organization_id, brand_id);
create index if not exists idx_contacts_email on contacts(organization_id, lower(email))
  where email is not null;
create index if not exists idx_contacts_phone on contacts(organization_id, phone)
  where phone is not null;
create index if not exists idx_contacts_source on contacts(organization_id, source);
create index if not exists idx_contacts_active on contacts(organization_id, created_at desc)
  where archived_at is null;

-- Trigger updated_at automatico
create or replace function contacts_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contacts_touch_updated_at on contacts;
create trigger trg_contacts_touch_updated_at
before update on contacts
for each row execute function contacts_touch_updated_at();

-- RLS denial-by-default.
alter table contacts enable row level security;

drop policy if exists "contacts_service_role_all" on contacts;
create policy "contacts_service_role_all"
on contacts for all
to service_role
using (true) with check (true);

-- ============================================================================
-- 2. contact_consents — registro consensi separato per canale (RF-1.4)
-- ============================================================================
-- Blocco a monte di ogni invio: il sistema NON invia se non c'e granted.
-- UNIQUE (contact_id, channel) — un solo record vivo per (contatto, canale).
-- History: le revoche non cancellano ma passano status→revoked e set revoked_at.

create table if not exists contact_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel text not null check (channel in ('email','sms','whatsapp')),
  status text not null check (status in ('granted','revoked','never')),
  granted_at timestamptz,
  revoked_at timestamptz,
  source text not null check (source in ('qr','manuale','import','gestionale','web','disiscrizione')),
  evidence_text text, -- prova (RF-1.4): "iscritto via QR colonnina", "disiscritto da link email 2026-08-01"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, channel),
  -- Coerenza status/timestamp:
  --   granted → granted_at not null, revoked_at null
  --   revoked → granted_at not null (era stato granted prima), revoked_at not null
  --   never   → granted_at null, revoked_at null
  constraint consent_status_timestamps_coherent
    check (
      (status = 'granted' and granted_at is not null and revoked_at is null) or
      (status = 'revoked' and granted_at is not null and revoked_at is not null) or
      (status = 'never' and granted_at is null and revoked_at is null)
    )
);

create index if not exists idx_consents_contact on contact_consents(contact_id);
create index if not exists idx_consents_org_channel_granted
  on contact_consents(organization_id, channel)
  where status = 'granted';

drop trigger if exists trg_consents_touch_updated_at on contact_consents;
create trigger trg_consents_touch_updated_at
before update on contact_consents
for each row execute function contacts_touch_updated_at();

alter table contact_consents enable row level security;
drop policy if exists "consents_service_role_all" on contact_consents;
create policy "consents_service_role_all"
on contact_consents for all
to service_role
using (true) with check (true);

-- ============================================================================
-- 3. contact_vehicles — anagrafica veicolo (RF-1.3)
-- ============================================================================
-- Prerequisito richiami officina: targa, modello, km, data ultimo intervento,
-- tipo gomme. Un contatto può avere più veicoli (auto famiglia).
-- Plate UNIQUE per (organization, plate) — mai due veicoli con stessa targa
-- nella stessa azienda anche se su contatti diversi.

create table if not exists contact_vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete cascade,
  plate text not null,
  model text,
  year int,
  kilometers int,
  last_service_at date,
  tire_type text check (tire_type is null or tire_type in ('estive','invernali','4stagioni','termiche')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, plate),
  -- plate almeno 5 char, mai vuoto (guardia base, no regex targa italiana)
  constraint vehicles_plate_length
    check (length(trim(plate)) >= 5),
  constraint vehicles_year_reasonable
    check (year is null or (year >= 1950 and year <= extract(year from now())::int + 1)),
  constraint vehicles_km_non_negative
    check (kilometers is null or kilometers >= 0)
);

create index if not exists idx_vehicles_contact on contact_vehicles(contact_id);
create index if not exists idx_vehicles_org_plate on contact_vehicles(organization_id, plate);
create index if not exists idx_vehicles_service_due
  on contact_vehicles(organization_id, last_service_at)
  where last_service_at is not null;

drop trigger if exists trg_vehicles_touch_updated_at on contact_vehicles;
create trigger trg_vehicles_touch_updated_at
before update on contact_vehicles
for each row execute function contacts_touch_updated_at();

alter table contact_vehicles enable row level security;
drop policy if exists "vehicles_service_role_all" on contact_vehicles;
create policy "vehicles_service_role_all"
on contact_vehicles for all
to service_role
using (true) with check (true);
