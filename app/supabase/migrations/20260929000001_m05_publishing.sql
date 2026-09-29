-- M05 Publishing v1 (RF-5.1..5.7, RA-8.4, RS-3, RS-4, RS-8, RN-87)
-- Adapter per canale (Twilio WA + Resend Email in v1), coda idempotente,
-- log immutabile, credenziali via Supabase Vault.

-- Vault e' gia enabled su Supabase (extension supabase_vault). Verifica:
-- select extname from pg_extension where extname='supabase_vault';

create table m05_channel_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','sms','facebook','instagram','google')),
  provider text not null,
  vault_secret_id uuid not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  verified_at timestamptz null,
  last_test_at timestamptz null,
  last_test_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)
);

create table m05_channel_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null,
  quiet_hours_start time not null default '09:00',
  quiet_hours_end time not null default '21:00',
  allow_promotional boolean not null default true,
  max_per_month_per_contact int not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)
);

create table m05_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null,
  provider text not null,
  recipient_contact_id uuid null references contacts(id) on delete set null,
  recipient_address text not null,
  source_kind text not null check (source_kind in ('test','reminder','voucher','campaign','signup_welcome','manual')),
  source_id uuid null,
  payload jsonb not null,
  dedupe_key text generated always as (
    md5(source_kind || ':' || coalesce(source_id::text,'') || ':' || recipient_address)
  ) stored,
  status text not null default 'queued' check (status in ('queued','claimed','sent','failed','dead')),
  claim_token uuid null,
  claimed_at timestamptz null,
  retry_count int not null default 0,
  next_retry_at timestamptz not null default now(),
  send_after timestamptz not null default now(),
  last_error text null,
  sent_at timestamptz null,
  external_id text null,
  cost_estimate_cents int null,
  is_promotional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create index m05_publish_jobs_queued_idx on m05_publish_jobs (next_retry_at, created_at) where status = 'queued';
create index m05_publish_jobs_claimed_idx on m05_publish_jobs (claimed_at) where status = 'claimed';
create index m05_publish_jobs_contact_month_idx on m05_publish_jobs (organization_id, recipient_contact_id, channel, sent_at) where status = 'sent';

create table m05_publish_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references m05_publish_jobs(id) on delete restrict,
  channel text not null,
  provider text not null,
  recipient_contact_id uuid null,
  recipient_address text not null,
  content_snapshot jsonb not null,
  external_id text null,
  cost_actual_cents int null,
  status text not null check (status in ('sent','failed')),
  provider_response jsonb null,
  is_promotional boolean not null default false,
  sent_at timestamptz not null default now()
);
create index m05_publish_log_contact_month_idx on m05_publish_log (organization_id, recipient_contact_id, channel, sent_at) where is_promotional = true;

-- RF-5.7: log append-only, no UPDATE/DELETE.
create or replace function m05_publish_log_no_update() returns trigger as $$
begin raise exception 'm05_publish_log is append-only (RF-5.7)'; end;
$$ language plpgsql;
create trigger m05_publish_log_no_update_trg
  before update or delete on m05_publish_log
  for each row execute function m05_publish_log_no_update();

create table m05_provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references organizations(id) on delete set null,
  provider text not null,
  webhook_type text not null,
  external_id text null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_error text null
);
create index m05_provider_webhooks_pending_idx on m05_provider_webhooks (received_at) where processed_at is null;

-- RLS denial-by-default su tutte (service_role bypassa comunque).
alter table m05_channel_credentials enable row level security;
alter table m05_channel_config enable row level security;
alter table m05_publish_jobs enable row level security;
alter table m05_publish_log enable row level security;
alter table m05_provider_webhooks enable row level security;

-- Seed config default per org 00000000...01 (Gruppo Lenny):
-- WA: quiet 9-21, no promotional (RF-5.5a), max 2/mese
-- Email: no quiet (00-24), promotional ok, max 4/mese
insert into m05_channel_config (organization_id, channel, quiet_hours_start, quiet_hours_end, allow_promotional, max_per_month_per_contact)
values
  ('00000000-0000-0000-0000-000000000001','whatsapp','09:00','21:00',false,2),
  ('00000000-0000-0000-0000-000000000001','email','00:00','23:59',true,4)
on conflict do nothing;
