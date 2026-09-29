-- M7 Rete ristoranti Lenny (RF-7.1..7.6).
-- I ~50 ristoranti sono micro-partner, non destinatari di lista.
-- Solo Lenny in F1: brand_id vincolato applicativo, non check DB (in futuro altri brand potrebbero avere partner).

-- ============================================================================
-- 1. partner_restaurants — anagrafica RF-7.1
-- ============================================================================

create table if not exists partner_restaurants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  referent_name text,
  phone text,
  email text,
  address_street text,
  address_city text,
  address_cap text,
  cuisine_category text, -- pizza, sushi, italiana, ecc.
  avg_prep_minutes int check (avg_prep_minutes is null or avg_prep_minutes >= 0), -- RF-7.5 tempo ordine → ritiro
  onboarding_status text not null default 'mai_partito'
    check (onboarding_status in ('mai_partito','attivo','sospeso','uscito')),
  cooling_flag boolean not null default false, -- RF-7.4 raffreddamento
  cooling_reason text,
  last_contact_at timestamptz,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_name_length check (length(trim(name)) > 0),
  -- Se cooling_flag=true, cooling_reason deve esserci
  constraint partners_cooling_needs_reason check (
    (cooling_flag = false) or (cooling_flag = true and cooling_reason is not null and length(trim(cooling_reason)) > 0)
  )
);

create index if not exists idx_partners_org_brand on partner_restaurants(organization_id, brand_id);
create index if not exists idx_partners_status on partner_restaurants(organization_id, brand_id, onboarding_status);
create index if not exists idx_partners_cooling on partner_restaurants(organization_id, brand_id) where cooling_flag = true;
create index if not exists idx_partners_last_contact on partner_restaurants(organization_id, brand_id, last_contact_at nulls first);
create index if not exists idx_partners_active on partner_restaurants(organization_id, brand_id, created_at desc)
  where archived_at is null;

drop trigger if exists trg_partners_touch_updated_at on partner_restaurants;
create trigger trg_partners_touch_updated_at
before update on partner_restaurants
for each row execute function contacts_touch_updated_at();

alter table partner_restaurants enable row level security;
drop policy if exists "partners_service_role_all" on partner_restaurants;
create policy "partners_service_role_all"
on partner_restaurants for all to service_role using (true) with check (true);

-- ============================================================================
-- 2. partner_activities — log attività RF-7.2
-- ============================================================================
-- Append-only in logica applicativa (l'operatore può cancellare voci solo se
-- Owner e recenti; in F1 nessuna delete via UI — audit trail).

create table if not exists partner_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  partner_id uuid not null references partner_restaurants(id) on delete cascade,
  kind text not null check (kind in ('chiamata','incontro','email','whatsapp','follow_up','segnalazione','onboarding','uscita')),
  outcome text check (outcome is null or outcome in ('positivo','neutro','negativo','da_richiamare')),
  summary text not null,
  occurred_at timestamptz not null default now(),
  created_by uuid, -- FK molle su auth.users
  created_at timestamptz not null default now(),
  constraint activities_summary_length check (length(trim(summary)) > 0)
);

create index if not exists idx_activities_partner_time on partner_activities(partner_id, occurred_at desc);
create index if not exists idx_activities_org on partner_activities(organization_id, occurred_at desc);

alter table partner_activities enable row level security;
drop policy if exists "partner_activities_service_role_all" on partner_activities;
create policy "partner_activities_service_role_all"
on partner_activities for all to service_role using (true) with check (true);

-- Trigger: quando registro un'attività, aggiorno last_contact_at sul partner
create or replace function partner_activities_touch_last_contact()
returns trigger language plpgsql as $$
begin
  update partner_restaurants
  set last_contact_at = new.occurred_at, updated_at = now()
  where id = new.partner_id
    and (last_contact_at is null or last_contact_at < new.occurred_at);
  return new;
end;
$$;

drop trigger if exists trg_activities_touch_last_contact on partner_activities;
create trigger trg_activities_touch_last_contact
after insert on partner_activities
for each row execute function partner_activities_touch_last_contact();
