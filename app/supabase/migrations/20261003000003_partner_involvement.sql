-- RF-6a.1 Partner come entita' configurabile: livello di coinvolgimento,
-- tempo di preavviso, referente (gia' presente), traccia delle risposte.
-- Casi noti RF-6a.3: partner spesa (da informare), Eni (uso logo libero,
-- promozionale da verificare).

-- 1. Estende supply_partners con i nuovi attributi.
alter table supply_partners
  add column if not exists involvement_level text not null default 'informed'
    check (involvement_level in ('informed', 'approves', 'co_finances', 'name_veto')),
  add column if not exists advance_notice_days int not null default 3
    check (advance_notice_days >= 0),
  add column if not exists veto_notes text null;

comment on column supply_partners.involvement_level is
  'RF-6a.1: informed (da informare), approves (deve approvare esplicitamente), co_finances (cofinanzia promo), name_veto (diritto di veto sul nome).';
comment on column supply_partners.advance_notice_days is
  'RF-6a.1: giorni di preavviso minimi prima di pubblicare qualcosa che lo coinvolge.';

-- 2. partner_approval_requests: traccia richieste e risposte (RF-6a.1 "traccia delle risposte").
--    Collegata a content_drafts/campaigns tramite source_* (polimorfico semplice).
--    status: pending / approved / rejected / expired (preavviso passato senza risposta).
create table partner_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  partner_id uuid not null references supply_partners(id) on delete restrict,
  source_kind text not null check (source_kind in ('content_draft', 'campaign', 'voucher_offer', 'other')),
  source_id uuid null,
  subject text not null check (length(trim(subject)) > 0),
  message text null,
  requested_at timestamptz not null default now(),
  requested_by uuid null references auth.users(id) on delete set null,
  due_at timestamptz null,  -- scadenza preavviso (requested_at + advance_notice_days)
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  response_at timestamptz null,
  response_notes text null,
  recorded_by uuid null references auth.users(id) on delete set null,  -- chi ha registrato la risposta
  check (
    (status = 'pending' and response_at is null)
    or (status in ('approved', 'rejected', 'expired') and response_at is not null)
  )
);
create index partner_approval_requests_partner_idx on partner_approval_requests (organization_id, partner_id);
create index partner_approval_requests_pending_idx on partner_approval_requests (organization_id, due_at)
  where status = 'pending';
alter table partner_approval_requests enable row level security;
