-- M09 Reminders — RF-6.22 promemoria automatici (retention).
-- Benvenuto, thank-you, richiami officina data certa, voucher in scadenza,
-- contatori vicino alla soglia, dormienti da riattivare, richiesta recensione.
-- Il DB tiene lo stato; il compute engine popola/aggiorna in modo idempotente.

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  contact_id uuid not null references contacts(id) on delete cascade,
  kind text not null check (kind in (
    'welcome',
    'thanks_order',
    'service_call',
    'voucher_expiring',
    'counter_close',
    'dormant_reactivation',
    'review_request'
  )),
  channel_hint text check (channel_hint is null or channel_hint in ('email','sms','whatsapp','misto')),
  status text not null default 'pending'
    check (status in ('pending','sent','dismissed','expired')),
  -- Riferimento generico all'oggetto scatenante (voucher, ordine, veicolo, ecc.)
  reference_type text,
  reference_id uuid,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  dismissed_at timestamptz,
  message_hint text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Coerenza status/timestamp
  constraint reminders_status_timestamps check (
    (status = 'pending' and sent_at is null and dismissed_at is null) or
    (status = 'sent' and sent_at is not null and dismissed_at is null) or
    (status = 'dismissed' and dismissed_at is not null and sent_at is null) or
    (status = 'expired')
  )
);

-- UNIQUE parziale: massimo un promemoria pending per (contact, kind, reference).
-- Reference NULL è normalizzato a stringa per essere considerato nel matching.
create unique index if not exists uq_reminders_pending_unique
  on reminders(organization_id, contact_id, kind, coalesce(reference_id::text, ''))
  where status = 'pending';

create index if not exists idx_reminders_org_scheduled
  on reminders(organization_id, scheduled_at asc)
  where status = 'pending';
create index if not exists idx_reminders_contact on reminders(contact_id);
create index if not exists idx_reminders_brand_status
  on reminders(organization_id, brand_id, status);
create index if not exists idx_reminders_kind on reminders(organization_id, kind, status);

drop trigger if exists trg_reminders_touch_updated_at on reminders;
create trigger trg_reminders_touch_updated_at
before update on reminders
for each row execute function contacts_touch_updated_at();

alter table reminders enable row level security;
drop policy if exists "reminders_service_role_all" on reminders;
create policy "reminders_service_role_all"
on reminders for all to service_role using (true) with check (true);
