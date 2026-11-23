-- Archiviazione contatto atomica (contatto + voucher issued + reminders pending)
-- in una singola funzione Postgres, invocata da server-side (service_role).
-- Risolve fail-open state drift: senza transazione, se il cascade su
-- reminders falliva dopo quello su voucher, restava in stato incoerente
-- (contatto archiviato + voucher cancellati ma reminders ancora pending).
-- Qui tutto si committa insieme o niente.

create or replace function public.rpc_archive_contact(
  p_organization_id uuid,
  p_contact_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_archived boolean;
begin
  -- 1) Soft-delete contatto. Idempotente: ritorna false se gia' archiviato.
  update public.contacts
     set archived_at = now()
   where id = p_contact_id
     and organization_id = p_organization_id
     and archived_at is null;

  if not found then
    return false;
  end if;

  v_archived := true;

  -- 2) Cancella voucher issued del contatto.
  update public.vouchers
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_reason = 'contatto archiviato'
   where contact_id = p_contact_id
     and organization_id = p_organization_id
     and status = 'issued';

  -- 3) Dismiss promemoria pending del contatto.
  update public.reminders
     set status = 'dismissed',
         dismissed_at = now()
   where contact_id = p_contact_id
     and organization_id = p_organization_id
     and status = 'pending';

  -- 4) Marca come 'dead' i job M05 in coda (queued/claimed) per questo
  --    contatto. Pulizia di claim_token/claimed_at: senza questo, il
  --    reclaimOrphaned (che cerca job claimed con lease scaduta) potrebbe
  --    riportare in queue un job gia' marcato dead.
  update public.m05_publish_jobs
     set status = 'dead',
         last_error = 'contatto archiviato',
         claim_token = null,
         claimed_at = null
   where recipient_contact_id = p_contact_id
     and organization_id = p_organization_id
     and status in ('queued', 'claimed');

  return v_archived;
end;
$$;

revoke all on function public.rpc_archive_contact(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.rpc_archive_contact(uuid, uuid) to service_role;

comment on function public.rpc_archive_contact is
  'Archivia contatto + cancella voucher issued + dismiss reminders pending in transazione atomica. Chiamata da getAdminClient (service_role).';
