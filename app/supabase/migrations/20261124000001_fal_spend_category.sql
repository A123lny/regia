-- Aggiunge la categoria 'fal' (immagini generate con fal.ai) alle spese AI.
-- Idempotente. I nomi reali dei CHECK sono `ledger_category_check` e
-- `budget_category_check` (vedi 20260923000007 e 20261116000001). La versione
-- precedente di questa migration usava i nomi sbagliati `ai_spend_*_category_check`:
-- se è già stata applicata su qualche DB, la DROP sui vecchi nomi auto-generati
-- qui sotto fa cleanup; i drop su nomi inesistenti non errano grazie a `if exists`.

alter table public.ai_spend_ledger drop constraint if exists ledger_category_check;
alter table public.ai_spend_ledger drop constraint if exists ai_spend_ledger_category_check;

alter table public.ai_spend_budgets drop constraint if exists budget_category_check;
alter table public.ai_spend_budgets drop constraint if exists ai_spend_budgets_category_check;

-- Ledger: 'anthropic-robot' è sotto-categoria sintetica introdotta da
-- 20261116000001 per separare la spesa del widget robot (vedi ai-spend.ts).
alter table public.ai_spend_ledger
  add constraint ledger_category_check
  check (category in ('anthropic', 'anthropic-robot', 'gemini', 'voyage', 'fal'));

-- Budget: 'all' è il tetto aggregato cross-categoria. 'anthropic-robot' NON è
-- un budget separato (la spesa del robot rientra nel cap gemini via
-- sumSpendThisMonth), quindi non va ammesso qui.
alter table public.ai_spend_budgets
  add constraint budget_category_check
  check (category in ('anthropic', 'gemini', 'voyage', 'fal', 'all'));

comment on constraint budget_category_check on public.ai_spend_budgets is
  'Budget categories: anthropic, gemini, voyage, fal, all.';
comment on constraint ledger_category_check on public.ai_spend_ledger is
  'Ledger categories: anthropic, anthropic-robot (robot widget), gemini, voyage, fal.';
