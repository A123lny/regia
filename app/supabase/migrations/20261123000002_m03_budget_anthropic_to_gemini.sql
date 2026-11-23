-- M03 ha migrato il provider testo da Anthropic a Gemini. I tetti spesa e il
-- ledger esistenti riferiscono la categoria 'anthropic', quindi:
-- 1) assertBudgetOk("gemini") fail-open (nessun cap gemini -> spesa illimitata)
-- 2) la spesa gia' effettuata questo mese resta imputata alla categoria
--    sbagliata, il grafico impostazioni non riconcilia.
--
-- Questa migration:
--  (a) clona i budget 'anthropic' attivi in 'gemini' SOLO dove manca un
--      budget 'gemini' per la stessa org (nessun override di configurazioni
--      esistenti). Idempotente via ON CONFLICT (unique su org+category).
--  (b) riclassifica il ledger del mese corrente: le righe action LIKE
--      'editorial.%' con categoria 'anthropic' passano a 'gemini'. Preserva
--      i totali gia' spesi per la nuova categoria. Non tocca mesi passati
--      per non riscrivere lo storico.
-- (c) default morbido: se non esiste nessun budget 'gemini' ne' 'anthropic'
--      attivo per l'org e nemmeno 'all', NON forziamo un default qui — la
--      policy di fail-open vs fail-closed in assenza di cap resta decisione
--      applicativa (RF-11.5).

-- (a) Clone anthropic -> gemini budgets dove manca
insert into public.ai_spend_budgets
  (organization_id, category, monthly_cap_usd, alert_threshold_percent, is_active)
select
  b.organization_id,
  'gemini',
  b.monthly_cap_usd,
  b.alert_threshold_percent,
  b.is_active
from public.ai_spend_budgets b
where b.category = 'anthropic'
  and not exists (
    select 1 from public.ai_spend_budgets g
    where g.organization_id = b.organization_id
      and g.category = 'gemini'
  )
on conflict (organization_id, category) do nothing;

-- (b) Riclassifica editorial.* del mese corrente
update public.ai_spend_ledger
set category = 'gemini'
where category = 'anthropic'
  and action like 'editorial.%'
  and occurred_at >= date_trunc('month', now());
