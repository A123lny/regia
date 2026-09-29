-- M6 Fedeltà + Voucher (Modello A) — RF-6.1..6.10, RF-6.26.
-- RF-6.24: scheda base unica (codice, valore, ambito, scadenza, destinatario).
-- RF-6.26: voucher a uso singolo — riscatto atomico registrato con timestamp.
-- RN-87 organization_id ovunque. RS-3 invarianti in DB.

-- ============================================================================
-- 1. loyalty_counters — RF-6.1 contatori configurabili per brand
-- ============================================================================
-- Cosa si conta: 'passaggi' (default), 'valore_speso_cents', 'ordini'.
-- Soglia: soglia_conteggio (es. 10 lavaggi) o soglia_valore_cents (es. 100€ speso).
-- Azzeramento: 'dopo_premio' (default), 'annuale', 'mai'.

create table if not exists loyalty_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  description text,
  kind text not null check (kind in ('passaggi','valore_speso','ordini')),
  threshold_count int check (threshold_count is null or threshold_count > 0),
  threshold_value_cents int check (threshold_value_cents is null or threshold_value_cents > 0),
  reset_mode text not null default 'dopo_premio'
    check (reset_mode in ('dopo_premio','annuale','mai')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Serve almeno UNA soglia coerente col tipo
  constraint counters_threshold_coherent check (
    (kind = 'valore_speso' and threshold_value_cents is not null and threshold_count is null) or
    (kind in ('passaggi','ordini') and threshold_count is not null and threshold_value_cents is null)
  ),
  constraint counters_name_length check (length(trim(name)) > 0)
);

create index if not exists idx_counters_org_brand on loyalty_counters(organization_id, brand_id);
create index if not exists idx_counters_active on loyalty_counters(organization_id, brand_id)
  where is_active = true;

drop trigger if exists trg_counters_touch_updated_at on loyalty_counters;
create trigger trg_counters_touch_updated_at
before update on loyalty_counters
for each row execute function contacts_touch_updated_at();

alter table loyalty_counters enable row level security;
drop policy if exists "counters_service_role_all" on loyalty_counters;
create policy "counters_service_role_all"
on loyalty_counters for all to service_role using (true) with check (true);

-- ============================================================================
-- 2. loyalty_counter_events — eventi che incrementano il contatore
-- ============================================================================
-- Ogni evento è agganciato a un contatto (ospiti non contano — RF-6.10 digitale).
-- delta_count / delta_value_cents: quanto incrementa (di solito 1 per passaggio,
-- valore ordine per valore_speso). order_id opzionale: se l'evento origina da un ordine.

create table if not exists loyalty_counter_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  counter_id uuid not null references loyalty_counters(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  delta_count int not null default 1 check (delta_count >= 0),
  delta_value_cents int not null default 0 check (delta_value_cents >= 0),
  order_id uuid references brand_orders(id) on delete set null,
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_counter_events_counter_contact
  on loyalty_counter_events(counter_id, contact_id, occurred_at desc);
create index if not exists idx_counter_events_contact
  on loyalty_counter_events(contact_id, occurred_at desc);
create index if not exists idx_counter_events_order
  on loyalty_counter_events(order_id) where order_id is not null;

alter table loyalty_counter_events enable row level security;
drop policy if exists "counter_events_service_role_all" on loyalty_counter_events;
create policy "counter_events_service_role_all"
on loyalty_counter_events for all to service_role using (true) with check (true);

-- ============================================================================
-- 3. voucher_offers — RF-6.2/6.3 offerte configurate
-- ============================================================================
-- issuer_brand_id: chi emette il voucher (chi ha il contatore che si "riempie").
-- spendable_brand_id: dove si può spendere (RF-6.4 può essere diverso, voucher incrociato).
-- reward_kind: 'valore_fisso' (valueCents), 'percentuale' (valuePct), 'servizio_gratis' (rewardLabel).
-- default_expires_days: la scadenza è calcolata al momento dell'emissione (RF-6.6).

create table if not exists voucher_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  issuer_brand_id uuid not null references brands(id) on delete restrict,
  spendable_brand_id uuid not null references brands(id) on delete restrict,
  counter_id uuid references loyalty_counters(id) on delete set null,
  name text not null,
  description text,
  reward_kind text not null check (reward_kind in ('valore_fisso','percentuale','servizio_gratis')),
  reward_value_cents int check (reward_value_cents is null or reward_value_cents >= 0),
  reward_pct numeric(5,2) check (reward_pct is null or (reward_pct >= 0 and reward_pct <= 100)),
  reward_label text,
  default_expires_days int not null default 60 check (default_expires_days > 0),
  cumulable boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Coerenza reward_kind ↔ valori
  constraint offers_reward_coherent check (
    (reward_kind = 'valore_fisso' and reward_value_cents is not null and reward_pct is null) or
    (reward_kind = 'percentuale' and reward_pct is not null and reward_value_cents is null) or
    (reward_kind = 'servizio_gratis' and reward_label is not null and length(trim(reward_label)) > 0)
  ),
  constraint offers_name_length check (length(trim(name)) > 0)
);

create index if not exists idx_offers_org on voucher_offers(organization_id);
create index if not exists idx_offers_issuer on voucher_offers(issuer_brand_id);
create index if not exists idx_offers_spendable on voucher_offers(spendable_brand_id);
create index if not exists idx_offers_active on voucher_offers(organization_id) where is_active = true;

drop trigger if exists trg_offers_touch_updated_at on voucher_offers;
create trigger trg_offers_touch_updated_at
before update on voucher_offers
for each row execute function contacts_touch_updated_at();

alter table voucher_offers enable row level security;
drop policy if exists "offers_service_role_all" on voucher_offers;
create policy "offers_service_role_all"
on voucher_offers for all to service_role using (true) with check (true);

-- ============================================================================
-- 4. vouchers — istanze emesse (RF-6.24, RF-6.26 uso singolo)
-- ============================================================================

create table if not exists vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  offer_id uuid not null references voucher_offers(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete restrict,
  code text not null,
  -- Snapshot dell'offerta al momento dell'emissione (RF-6.11 storicità)
  reward_kind text not null,
  reward_value_cents int,
  reward_pct numeric(5,2),
  reward_label text,
  status text not null default 'issued'
    check (status in ('issued','redeemed','expired','cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by_order_id uuid references brand_orders(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  -- Coerenza status/timestamp (RF-6.26 uso singolo)
  constraint voucher_status_timestamps_coherent check (
    (status = 'issued' and redeemed_at is null and cancelled_at is null) or
    (status = 'redeemed' and redeemed_at is not null and cancelled_at is null) or
    (status = 'expired' and redeemed_at is null and cancelled_at is null) or
    (status = 'cancelled' and cancelled_at is not null and redeemed_at is null)
  ),
  constraint voucher_expires_after_issued check (expires_at > issued_at),
  constraint voucher_code_length check (length(trim(code)) >= 4)
);

create index if not exists idx_vouchers_org on vouchers(organization_id);
create index if not exists idx_vouchers_contact on vouchers(contact_id);
create index if not exists idx_vouchers_status on vouchers(organization_id, status);
create index if not exists idx_vouchers_offer on vouchers(offer_id);
create index if not exists idx_vouchers_expires on vouchers(expires_at) where status = 'issued';

drop trigger if exists trg_vouchers_touch_updated_at on vouchers;
create trigger trg_vouchers_touch_updated_at
before update on vouchers
for each row execute function contacts_touch_updated_at();

alter table vouchers enable row level security;
drop policy if exists "vouchers_service_role_all" on vouchers;
create policy "vouchers_service_role_all"
on vouchers for all to service_role using (true) with check (true);
