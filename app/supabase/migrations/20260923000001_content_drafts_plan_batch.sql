-- 20260923000001_content_drafts_plan_batch.sql
-- RF-3.1: piano editoriale multi-post genera N bozze in una sessione.
-- plan_batch_id raggruppa le bozze generate dallo stesso piano per:
--   - filtrare lista dopo la generazione (?planBatchId=...)
--   - wizard RF-3.6 sessione a doppia copertura
--   - statistiche "quante bozze di un piano approvate/rifiutate"
-- NULL per drafts generati singolarmente (RF-3.3).
-- Idempotente: IF NOT EXISTS.

alter table public.content_drafts
  add column if not exists plan_batch_id uuid;

create index if not exists content_drafts_plan_batch_idx
  on public.content_drafts (plan_batch_id, created_at)
  where plan_batch_id is not null;

comment on column public.content_drafts.plan_batch_id is
  'Raggruppa bozze generate dallo stesso piano editoriale (RF-3.1). NULL per drafts singoli.';
