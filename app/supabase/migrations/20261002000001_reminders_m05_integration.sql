-- M09 → M05 integration: tracking job + status sync automatico.
-- Quando M05 pubblica un messaggio con source_kind='reminder', un trigger
-- su m05_publish_log aggiorna la reminder originale (sent_at o last_error).

-- Riferimento al job di invio M05 (nullable finche' non si invia).
alter table reminders
  add column if not exists publish_job_id uuid null references m05_publish_jobs(id) on delete set null,
  add column if not exists last_send_error text null;

create index if not exists reminders_publish_job_idx on reminders (publish_job_id) where publish_job_id is not null;

-- Trigger: quando entra un log entry con source_kind='reminder', aggiorna la reminder.
-- - status='sent'   -> reminders.sent_at = NEW.sent_at, last_send_error = null, status='sent'
-- - status='failed' -> reminders.last_send_error = provider_response, reminder torna in 'pending' per retry manuale
create or replace function m09_sync_reminder_from_publish_log() returns trigger
language plpgsql
as $$
declare
  v_job record;
begin
  -- Carica il job per leggere source_kind + source_id
  select source_kind, source_id, organization_id into v_job
  from m05_publish_jobs where id = NEW.job_id;

  if v_job.source_kind is distinct from 'reminder' then
    return NEW;  -- non e' una reminder, skip
  end if;
  if v_job.source_id is null then
    return NEW;
  end if;

  if NEW.status = 'sent' then
    update reminders set
      status = 'sent',
      sent_at = NEW.sent_at,
      last_send_error = null
    where id = v_job.source_id
      and organization_id = v_job.organization_id
      and status in ('pending', 'sent');  -- idempotente
  elsif NEW.status = 'failed' then
    update reminders set
      last_send_error = coalesce(NEW.provider_response->>'error', 'unknown error'),
      publish_job_id = null  -- libera per retry
    where id = v_job.source_id
      and organization_id = v_job.organization_id
      and status = 'pending';
  end if;

  return NEW;
end;
$$;

drop trigger if exists m09_sync_reminder_trg on m05_publish_log;
create trigger m09_sync_reminder_trg
  after insert on m05_publish_log
  for each row execute function m09_sync_reminder_from_publish_log();
