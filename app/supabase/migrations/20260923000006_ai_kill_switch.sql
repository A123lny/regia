-- 20260923000006_ai_kill_switch.sql
-- RF-11.4: interruttore arresto AI per-org (kill switch).
-- Flag boolean su organizations. Quando true, tutte le server actions AI
-- (generateText, embedText, renderTemplate) throwano BEFORE la chiamata esterna.
-- L'Owner puo alzare/abbassare da /impostazioni con 1 click.
-- Idempotente: IF NOT EXISTS.

alter table public.organizations
  add column if not exists ai_kill_switch boolean not null default false,
  add column if not exists ai_kill_switch_updated_at timestamptz,
  add column if not exists ai_kill_switch_reason text;

comment on column public.organizations.ai_kill_switch is
  'RF-11.4: se true, blocca tutte le generazioni AI (testo, embeddings, template PNG). Un click, effetto immediato.';
