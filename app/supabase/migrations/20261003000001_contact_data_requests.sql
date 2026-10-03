-- RF-1.9 Richieste dati personali (export/cancellazione).
-- Gestione INTERAMENTE MANUALE: il sistema registra la richiesta, mostra
-- cosa Regia possiede, aiuta l'addetto a rispondere. Non genera risposte,
-- non decide, non invia nulla automaticamente.

create table contact_data_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete restrict,
  request_type text not null check (request_type in ('export', 'erasure')),
  requested_at timestamptz not null default now(),
  requested_by uuid null references auth.users(id) on delete set null,
  requested_via text null, -- 'email', 'phone', 'in_person', 'letter', 'altro'
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'rejected')),
  fulfilled_at timestamptz null,
  fulfilled_by uuid null references auth.users(id) on delete set null,
  decision_notes text null,
  -- Snapshot JSON del dossier al momento del fulfilled (per audit immutabile).
  -- Export: contiene i dati esportati. Erasure: snapshot pre-cancellazione.
  dossier_snapshot jsonb null,
  check (
    (status = 'pending' and fulfilled_at is null and fulfilled_by is null)
    or (status in ('fulfilled', 'rejected') and fulfilled_at is not null)
  )
);
create index contact_data_requests_contact_idx on contact_data_requests (organization_id, contact_id);
create index contact_data_requests_pending_idx on contact_data_requests (organization_id, requested_at)
  where status = 'pending';
alter table contact_data_requests enable row level security;

-- Rilassa contacts_at_least_one_contact_method per permettere erasure (RF-1.9):
-- un contatto puo' avere tutti i recapiti NULL se e' archiviato (archived_at not null).
-- Preserva FK storiche (ordini, voucher, publish_log) senza violare GDPR.
alter table contacts drop constraint if exists contacts_at_least_one_contact_method;
alter table contacts
  add constraint contacts_at_least_one_contact_method
  check (
    archived_at is not null
    or (email is not null and length(trim(email)) > 0)
    or (phone is not null and length(trim(phone)) > 0)
    or (whatsapp is not null and length(trim(whatsapp)) > 0)
  );

