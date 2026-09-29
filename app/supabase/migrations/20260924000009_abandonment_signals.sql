-- M9 Anti-abbandono — RN-40 spesa settimanale + inattività cronica.
-- Detector genera "signal" quando un pattern viene rilevato; UI mostra priorità.

create table if not exists abandonment_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete cascade,
  kind text not null check (kind in (
    'skipped_week',        -- RN-40: cliente settimanale che ha saltato una settimana
    'dropped_frequency',   -- frequenza dimezzata rispetto al passato
    'silence_gap',         -- 30+ gg senza ordini
    'inactivity'           -- 60+ gg senza ordini
  )),
  severity text not null check (severity in ('low','medium','high')),
  signal_at timestamptz not null default now(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  previous_orders_count int not null default 0,
  current_orders_count int not null default 0,
  resolved_at timestamptz,
  resolved_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint signals_window_valid check (window_end > window_start),
  constraint signals_resolved_coherent check (
    (resolved_at is null and resolved_reason is null) or
    (resolved_at is not null)
  )
);

-- UNIQUE parziale: un solo segnale ATTIVO (non resolved) per (contact, kind).
-- Se il pattern si ripete dopo la risoluzione, ne creiamo uno nuovo.
create unique index if not exists uq_signals_active_unique
  on abandonment_signals(organization_id, contact_id, kind)
  where resolved_at is null;

create index if not exists idx_signals_org_active
  on abandonment_signals(organization_id, severity desc, signal_at desc)
  where resolved_at is null;
create index if not exists idx_signals_brand
  on abandonment_signals(organization_id, brand_id) where resolved_at is null;
create index if not exists idx_signals_contact
  on abandonment_signals(contact_id, signal_at desc);

drop trigger if exists trg_signals_touch_updated_at on abandonment_signals;
create trigger trg_signals_touch_updated_at
before update on abandonment_signals
for each row execute function contacts_touch_updated_at();

alter table abandonment_signals enable row level security;
drop policy if exists "signals_service_role_all" on abandonment_signals;
create policy "signals_service_role_all"
on abandonment_signals for all to service_role using (true) with check (true);
