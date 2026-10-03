-- RN-52 Zone di consegna variabili (clima, eventi, chiusure stradali).
-- Vincolo assoluto: mai inviare promozioni a chi abita in una zona
-- temporaneamente non servita. Il motore promo food Lenny chiama la guard
-- isContactInBlackoutZone PRIMA di accodare l'invio.
--
-- Scoping: solo brand con delivery (Lenny food in F1). Non applica a stazione
-- bar/officina/carburante — quei servizi non dipendono da zone.

-- 1. delivery_zones: aree geografiche servite da un brand (es. "Centro",
--    "Castelli alti"). Match su contacts.address_cap tramite prefisso.
--    cap_prefixes e' array: una zona puo' coprire piu' CAP.
create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text null,
  cap_prefixes text[] not null default '{}'::text[],  -- es. ['47890', '47891']
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, name)
);
create index delivery_zones_brand_idx on delivery_zones (organization_id, brand_id);
alter table delivery_zones enable row level security;

-- 2. delivery_zone_blackouts: finestra temporale in cui la zona NON e' servita.
--    kind: motivo (snow/rain/event/road_closure/other). end_at nullable:
--    finche' null, il blackout e' attivo. L'Owner lo chiude manualmente oppure
--    si auto-chiude a end_at.
create table delivery_zone_blackouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  zone_id uuid not null references delivery_zones(id) on delete cascade,
  kind text not null check (kind in ('snow', 'rain', 'event', 'road_closure', 'other')),
  reason text null,  -- note testuali
  start_at timestamptz not null default now(),
  end_at timestamptz null,
  triggered_by uuid null references auth.users(id) on delete set null,
  closed_at timestamptz null,
  closed_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index delivery_zone_blackouts_active_idx on delivery_zone_blackouts (organization_id, zone_id)
  where closed_at is null;
alter table delivery_zone_blackouts enable row level security;

comment on column delivery_zone_blackouts.end_at is
  'Fine finestra programmata. Se null, il blackout dura finche closed_at non e valorizzato (chiusura esplicita).';
comment on column delivery_zone_blackouts.closed_at is
  'Chiusura esplicita dal titolare. Il blackout e attivo se closed_at is null e (end_at is null or end_at > now()).';
