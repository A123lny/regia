-- RN-64..67 Unsubscribe flow completo.
-- Token one-time per link in email/WA, landing pubblica, motivo + "scrivetemi meno",
-- allarme "troppi messaggi" via query aggregata.
--
-- Vincolo tecnico (RN-64): la disiscrizione funziona SEMPRE. Il click sul token
-- revoca immediatamente il consenso del canale di provenienza; il form di motivo
-- e' una domanda in piu', mai una condizione.

-- 1. Token di disiscrizione: generato quando un invio M05 parte, consumato al click sul link.
create table m05_unsubscribe_tokens (
  token uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','sms')),
  source_kind text null,  -- 'campaign','reminder','voucher',... (tracking)
  source_id uuid null,
  publish_job_id uuid null references m05_publish_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz null,
  used_from_ip_hash text null  -- hash SHA256 dell'IP per anti-abuse (mai in chiaro)
);
create index m05_unsub_tokens_contact_idx on m05_unsubscribe_tokens (organization_id, contact_id);
create index m05_unsub_tokens_unused_idx on m05_unsubscribe_tokens (created_at) where used_at is null;

alter table m05_unsubscribe_tokens enable row level security;

-- 2. Motivo disiscrizione + "scrivetemi meno" su contact_consents.
alter table contact_consents
  add column if not exists unsubscribe_reason text null
    check (unsubscribe_reason is null or unsubscribe_reason in (
      'too_many_messages', 'not_interested', 'not_customer_anymore', 'other'
    )),
  add column if not exists unsubscribe_reason_free text null,
  add column if not exists reduce_frequency boolean not null default false;

-- 3. Vista aggregata per allarme RN-67 "troppi messaggi".
-- Per ogni (organization, channel), negli ultimi 30gg, calcola % reason=too_many.
-- Il dashboard legge questa vista e flagga quando >= 50%.
create or replace view m05_unsubscribe_pressure_alerts as
select
  cc.organization_id,
  cc.channel,
  count(*) filter (where cc.status = 'revoked' and cc.revoked_at >= now() - interval '30 days') as revocations_30d,
  count(*) filter (where cc.status = 'revoked' and cc.unsubscribe_reason = 'too_many_messages' and cc.revoked_at >= now() - interval '30 days') as too_many_30d,
  count(*) filter (where cc.reduce_frequency = true and cc.updated_at >= now() - interval '30 days') as reduce_frequency_30d
from contact_consents cc
group by cc.organization_id, cc.channel
having count(*) filter (where cc.status = 'revoked' and cc.revoked_at >= now() - interval '30 days') > 0;

comment on view m05_unsubscribe_pressure_alerts is
  'RN-67: aggregato disiscrizioni per canale negli ultimi 30gg. Allarme in dashboard quando too_many_30d / revocations_30d >= 50%.';
