-- Aggiunge la categoria 'fal' (immagini generate con fal.ai) alle spese AI.
-- Idempotente: se la constraint ha già 'fal' non fa nulla.

do $$
begin
  -- Drop vecchia constraint (se esiste con qualsiasi nome standard)
  if exists (
    select 1 from pg_constraint
    where conname = 'ai_spend_ledger_category_check'
  ) then
    alter table ai_spend_ledger drop constraint ai_spend_ledger_category_check;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'ai_spend_budgets_category_check'
  ) then
    alter table ai_spend_budgets drop constraint ai_spend_budgets_category_check;
  end if;
end $$;

-- 'anthropic-robot' è una sotto-categoria sintetica usata per il widget robot
-- (vedi ai-spend.ts sumSpendThisMonth): va inclusa come valore ammissibile nel ledger.
alter table ai_spend_ledger
  add constraint ai_spend_ledger_category_check
  check (category in ('anthropic', 'anthropic-robot', 'gemini', 'voyage', 'fal'));

-- I budget hanno 'all' come categoria aggregata; non ammettono 'anthropic-robot'
-- (non ha senso un tetto separato per il robot: rientra nel cap gemini).
alter table ai_spend_budgets
  add constraint ai_spend_budgets_category_check
  check (category in ('anthropic', 'gemini', 'voyage', 'fal', 'all'));
