-- Aggiunge la categoria 'creatomate' (video/immagini da template) alle spese AI.
-- Pattern identico a 20261124000001 per 'fal'.

alter table public.ai_spend_ledger drop constraint if exists ledger_category_check;
alter table public.ai_spend_budgets drop constraint if exists budget_category_check;

alter table public.ai_spend_ledger
  add constraint ledger_category_check
  check (category in ('anthropic', 'anthropic-robot', 'gemini', 'voyage', 'fal', 'creatomate'));

alter table public.ai_spend_budgets
  add constraint budget_category_check
  check (category in ('anthropic', 'gemini', 'voyage', 'fal', 'creatomate', 'all'));
