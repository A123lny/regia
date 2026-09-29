-- M10 Raccolta contatti (RF-10.1..10.4).
-- Landing pubbliche accessibili via QR/link. Nessun login richiesto per l'iscrizione.
-- Backend: dedup contatti (RF-1.7), consensi separati per canale (RF-1.4), voucher benvenuto opzionale (M6).

-- ============================================================================
-- 1. signup_landings — configurazioni pagina iscrizione pubblica
-- ============================================================================

create table if not exists signup_landings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  slug text not null,
  headline text not null,
  subheadline text,
  benefit_headline text not null, -- "Ricevi un caffè omaggio", "5% sconto sulla prima spesa"
  audience_prompt text, -- "Sei residente o di passaggio?" — se null, no domanda RF-10.2
  audience_residente_label text default 'Residente / pendolare',
  audience_turista_label text default 'Di passaggio',
  welcome_offer_id uuid references voucher_offers(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  constraint landings_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  constraint landings_headline_length check (length(trim(headline)) > 0),
  constraint landings_benefit_length check (length(trim(benefit_headline)) > 0)
);

create index if not exists idx_landings_org on signup_landings(organization_id);
create index if not exists idx_landings_slug on signup_landings(slug);
create index if not exists idx_landings_active on signup_landings(organization_id) where is_active = true;

drop trigger if exists trg_landings_touch_updated_at on signup_landings;
create trigger trg_landings_touch_updated_at
before update on signup_landings
for each row execute function contacts_touch_updated_at();

alter table signup_landings enable row level security;
drop policy if exists "landings_service_role_all" on signup_landings;
create policy "landings_service_role_all"
on signup_landings for all to service_role using (true) with check (true);

-- ============================================================================
-- 2. signup_events — log iscrizioni via landing
-- ============================================================================

create table if not exists signup_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  landing_id uuid references signup_landings(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null, -- null se dedup ha fallito
  audience_kind text check (audience_kind is null or audience_kind in ('residente','pendolare','turista','altro')),
  channels_granted text[] not null default '{}',
  welcome_voucher_id uuid references vouchers(id) on delete set null,
  source_hint text not null default 'qr' check (source_hint in ('qr','link','manuale','web')),
  ip_hash text, -- hash SHA-256 hex 64 char per rate-limit anti-abuse, no PII
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_signup_events_org_time on signup_events(organization_id, occurred_at desc);
create index if not exists idx_signup_events_landing on signup_events(landing_id) where landing_id is not null;
create index if not exists idx_signup_events_contact on signup_events(contact_id) where contact_id is not null;
create index if not exists idx_signup_events_ip on signup_events(ip_hash, occurred_at desc) where ip_hash is not null;

alter table signup_events enable row level security;
drop policy if exists "signup_events_service_role_all" on signup_events;
create policy "signup_events_service_role_all"
on signup_events for all to service_role using (true) with check (true);
