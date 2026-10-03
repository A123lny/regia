-- RF-6.18 + RN-41/42/43 Gestione capacita rider (Lenny food).
-- Il motore non genera domanda oltre la capacita: le promo food vengono bloccate
-- dalla commercial guard se la fascia oraria target e' satura.

-- 1. rider_capacity_windows: configurazione finestre settimanali ricorrenti.
--    weekday 0=domenica .. 6=sabato (convenzione date-fns).
create table rider_capacity_windows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  time_start time not null,
  time_end time not null check (time_end > time_start),
  slots_total int not null check (slots_total >= 0),
  slots_filled int not null default 0 check (slots_filled >= 0),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una finestra per (brand, weekday, time_start) e' sufficiente in v1:
  -- l'Owner configura le ricorrenze settimanali, le eccezioni (festivi/eventi) in v2.
  unique (organization_id, brand_id, weekday, time_start)
);
create index rider_capacity_windows_brand_idx on rider_capacity_windows (organization_id, brand_id);
alter table rider_capacity_windows enable row level security;

-- 2. rider_shift_requests: richieste quantificate di disponibilita (RN-43).
--    "servono 3 rider venerdi 19-21" con stato pending/filled/cancelled.
create table rider_shift_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  shift_date date not null,
  time_start time not null,
  time_end time not null check (time_end > time_start),
  slots_needed int not null check (slots_needed > 0),
  slots_filled int not null default 0 check (slots_filled >= 0),
  note text null,
  status text not null default 'pending' check (status in ('pending', 'partially_filled', 'filled', 'cancelled')),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rider_shift_requests_brand_date_idx on rider_shift_requests (organization_id, brand_id, shift_date);
create index rider_shift_requests_pending_idx on rider_shift_requests (organization_id, shift_date)
  where status in ('pending', 'partially_filled');
alter table rider_shift_requests enable row level security;

-- Trigger che aggiorna status automaticamente da slots_filled vs slots_needed.
create or replace function rider_shift_requests_touch_status() returns trigger
language plpgsql
as $$
begin
  if NEW.status = 'cancelled' then
    return NEW;  -- cancelled e' terminale, non toccare
  end if;
  if NEW.slots_filled >= NEW.slots_needed then
    NEW.status := 'filled';
  elsif NEW.slots_filled > 0 then
    NEW.status := 'partially_filled';
  else
    NEW.status := 'pending';
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
create trigger rider_shift_requests_status_trg
  before insert or update on rider_shift_requests
  for each row execute function rider_shift_requests_touch_status();
