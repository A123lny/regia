-- RPC per sommare ai_spend_ledger lato DB, aggirando il limit di default di
-- PostgREST (1000 rows) che truncava la somma applicativa quando il mese
-- aveva molte righe (spend-cap bypass silenzioso).

create or replace function public.rpc_sum_ai_spend_this_month(
  p_organization_id uuid,
  p_categories text[]
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(cost_usd), 0)::numeric
  from public.ai_spend_ledger
  where organization_id = p_organization_id
    and (array_length(p_categories, 1) is null or category = any(p_categories))
    and occurred_at >= date_trunc('month', now());
$$;

revoke all on function public.rpc_sum_ai_spend_this_month(uuid, text[]) from public;
grant execute on function public.rpc_sum_ai_spend_this_month(uuid, text[]) to service_role;

comment on function public.rpc_sum_ai_spend_this_month is
  'Somma cost_usd del mese corrente per org e categorie. Aggrega lato DB (evita truncation PostgREST 1000 rows). Chiamata solo da service_role via adapter server-side.';
