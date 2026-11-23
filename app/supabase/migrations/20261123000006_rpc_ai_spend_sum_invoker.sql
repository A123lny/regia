-- Hardening della RPC rpc_sum_ai_spend_this_month:
--  (a) Passa a SECURITY INVOKER: la chiamata avviene gia' da service_role
--      (che bypassa RLS), quindi non serve DEFINER. Se qualcuno accidentalmente
--      concede EXECUTE a authenticated/anon, RLS su ai_spend_ledger blocca.
--  (b) REVOKE esplicito su public, anon, authenticated: nessun ruolo diverso
--      da service_role puo' eseguire la funzione.

create or replace function public.rpc_sum_ai_spend_this_month(
  p_organization_id uuid,
  p_categories text[]
)
returns numeric
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce(sum(cost_usd), 0)::numeric
  from public.ai_spend_ledger
  where organization_id = p_organization_id
    and (array_length(p_categories, 1) is null or category = any(p_categories))
    and occurred_at >= date_trunc('month', now());
$$;

revoke all on function public.rpc_sum_ai_spend_this_month(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.rpc_sum_ai_spend_this_month(uuid, text[]) to service_role;
