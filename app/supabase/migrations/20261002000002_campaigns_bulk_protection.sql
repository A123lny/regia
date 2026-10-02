-- M07 campaigns RN-62 bulk send protection (preview + test + partenza scaglionata).
-- Aggiunge le colonne di stato scaglionato + tracking test send alle campagne esistenti.

alter table campaigns
  add column if not exists staged_batch_size int not null default 100,
  add column if not exists staged_pause_seconds int not null default 600,
  add column if not exists test_sent_at timestamptz null,
  add column if not exists test_sent_to text null,
  add column if not exists enqueued_count int not null default 0,
  add column if not exists launched_at timestamptz null,
  add column if not exists cancelled_at timestamptz null;

-- Estensione status enum: aggiungere 'sending' tra scheduled e sent se non c'e' gia'.
-- La tabella usa text con check constraint, non enum nativo. Rilassiamo il check.
do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_name like 'campaigns_status_%'
  ) then
    -- drop existing status check se esiste con nome convenzionale
    alter table campaigns drop constraint if exists campaigns_status_check;
  end if;
end $$;

alter table campaigns
  drop constraint if exists campaigns_status_check,
  add constraint campaigns_status_check
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled'));

-- Rilassiamo campaigns_status_timestamps per supportare lo stato 'sending'
-- (launched_at valorizzato, sent_at null finché il worker non completa).
alter table campaigns drop constraint if exists campaigns_status_timestamps;
alter table campaigns
  add constraint campaigns_status_timestamps check (
    (status = 'draft' and sent_at is null) or
    (status = 'scheduled' and planned_at is not null and sent_at is null) or
    (status = 'sending' and launched_at is not null and sent_at is null) or
    (status = 'sent' and sent_at is not null) or
    (status = 'cancelled')
  );

create index if not exists campaigns_sending_idx on campaigns (organization_id, launched_at)
  where status = 'sending';
