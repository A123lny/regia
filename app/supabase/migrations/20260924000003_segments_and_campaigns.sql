-- M7 Segmentazione + Campagne (predisposizione).
-- RF-1.8 segmentazione automatica per recency/frequency/value.
-- Campagne = predisposizione: l'invio effettivo arriverà con M5 (adapter email/SMS/WhatsApp).
-- §8.2: "primo contatto a pubblici nuovi" e "comunicazioni che toccano partner spesa/Eni" MAI autonome.
--       Non è vincolo DB — è vincolo processo: l'invio è sempre gated da approvazione umana.

-- ============================================================================
-- 1. contact_segments — RF-1.8 segmenti per brand
-- ============================================================================
-- criteria: JSON semplice con predicati opzionali:
--   {
--     "lastOrderMaxDays": 30,        // ordini negli ultimi N giorni
--     "lastOrderMinDays": 60,        // NESSUN ordine negli ultimi N giorni (dormienti)
--     "minOrderCount": 5,            // almeno N ordini
--     "minSpentCents": 5000,         // spesa totale >= N centesimi
--     "requiredConsentChannel": "email", // solo chi ha granted su questo canale
--     "requiredTags": ["residente"], // AND sui tag
--     "excludeTags": ["dormiente"]   // NOT su questi tag
--   }
-- Materializziamo count + refreshed_at per non ricalcolare a ogni pagina.

create table if not exists contact_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  description text,
  criteria jsonb not null default '{}'::jsonb,
  contact_count_materialized int not null default 0 check (contact_count_materialized >= 0),
  refreshed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint segments_name_length check (length(trim(name)) > 0),
  constraint segments_criteria_is_object check (jsonb_typeof(criteria) = 'object')
);

create index if not exists idx_segments_org_brand on contact_segments(organization_id, brand_id);
create index if not exists idx_segments_active on contact_segments(organization_id, brand_id)
  where is_active = true;

drop trigger if exists trg_segments_touch_updated_at on contact_segments;
create trigger trg_segments_touch_updated_at
before update on contact_segments
for each row execute function contacts_touch_updated_at();

alter table contact_segments enable row level security;
drop policy if exists "segments_service_role_all" on contact_segments;
create policy "segments_service_role_all"
on contact_segments for all to service_role using (true) with check (true);

-- ============================================================================
-- 2. campaigns — predisposizione campagne
-- ============================================================================
-- content_draft_id: aggancio opzionale al contenuto M3 (bozza approvata).
-- channel: quale canale useremo (email/sms/whatsapp/misto).
-- status: draft → scheduled → sent | cancelled. In F1 la transizione a 'sent' è manuale
--         (marker operatore) finché non arriva M5 con l'invio effettivo.
-- attempted/delivered/failed: snapshot counters (popolati manualmente in F1 dall'operatore
--    che riporta l'esito, in M5 lo faranno gli adapter).

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  segment_id uuid references contact_segments(id) on delete restrict,
  content_draft_id uuid references content_drafts(id) on delete set null,
  name text not null,
  channel text not null check (channel in ('email','sms','whatsapp','misto')),
  status text not null default 'draft'
    check (status in ('draft','scheduled','sent','cancelled')),
  planned_at timestamptz,
  sent_at timestamptz,
  attempted_count int not null default 0 check (attempted_count >= 0),
  delivered_count int not null default 0 check (delivered_count >= 0),
  failed_count int not null default 0 check (failed_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_name_length check (length(trim(name)) > 0),
  -- Coerenza status/timestamp
  constraint campaigns_status_timestamps check (
    (status = 'draft' and sent_at is null) or
    (status = 'scheduled' and planned_at is not null and sent_at is null) or
    (status = 'sent' and sent_at is not null) or
    (status = 'cancelled')
  )
);

create index if not exists idx_campaigns_org_brand on campaigns(organization_id, brand_id);
create index if not exists idx_campaigns_status on campaigns(organization_id, status);
create index if not exists idx_campaigns_segment on campaigns(segment_id) where segment_id is not null;

drop trigger if exists trg_campaigns_touch_updated_at on campaigns;
create trigger trg_campaigns_touch_updated_at
before update on campaigns
for each row execute function contacts_touch_updated_at();

alter table campaigns enable row level security;
drop policy if exists "campaigns_service_role_all" on campaigns;
create policy "campaigns_service_role_all"
on campaigns for all to service_role using (true) with check (true);
