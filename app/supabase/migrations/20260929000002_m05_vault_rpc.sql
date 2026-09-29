-- M05 Task 4: vault_create_secret RPC per integrazione credenziali.
-- Wrapper su vault.create_secret (built-in Supabase Vault).

create or replace function public.vault_create_secret(
  p_value text,
  p_name text,
  p_description text default null
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  return vault.create_secret(p_value, p_name, p_description);
end;
$$;

grant execute on function public.vault_create_secret(text, text, text) to service_role;
