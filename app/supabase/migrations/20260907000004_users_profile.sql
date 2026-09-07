-- 20260907000004_users_profile.sql
-- Estensione di auth.users di Supabase: ruoli e organization di appartenenza.
-- RU-1: ruoli separati per organization/brand. In F0 supportiamo solo ruoli a
-- livello organization; il permesso per-brand (RU-1) arriva in F1 quando serve.
-- RU-3: solo Owner con 2FA può cambiare autonomia. In F0 predisponiamo la
-- colonna 'requires_mfa' ma l'enforcement 2FA vero è F0-b (cloud).

create table public.users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  role text not null,
  requires_mfa boolean not null default false,
  created_at timestamptz not null default now(),
  constraint users_profile_role_check
    check (role in ('owner', 'editor', 'delegate', 'agent'))
);

create index users_profile_organization_idx on public.users_profile(organization_id);

-- Owner richiede sempre 2FA (RU-3). Enforcement DB dell'invariante.
-- RU-3: Owner richiede 2FA.
-- ATTENZIONE — In F0 (locale) questo trigger controlla SOLO la colonna auto-
-- dichiarata `requires_mfa`, non l'esistenza di un fattore MFA verificato. È
-- una predisposizione: garantisce che nessun record `role='owner'` venga
-- inserito senza il flag alzato, ma non prova che l'MFA sia davvero attivo.
--
-- In F0-b (col cloud e provider MFA reale) va sostituito con lookup su
-- auth.mfa_factors — vedi ledger `.superpowers/sdd/2026-09-07-cantiere-f0/progress.md`
-- voce "Task 5: deferred F0-b — enforce_owner_mfa reale". Esempio target:
--
--   if new.role = 'owner' and not exists (
--     select 1 from auth.mfa_factors f
--     where f.user_id = new.user_id and f.status = 'verified'
--   ) then
--     raise exception 'RU-3: owner richiede fattore MFA verificato';
--   end if;
create or replace function public.enforce_owner_mfa()
returns trigger language plpgsql as $$
begin
  if new.role = 'owner' and new.requires_mfa = false then
    raise exception 'RU-3 (F0-predisposition): role owner requires_mfa=true (F0-b upgrade: aggancio a auth.mfa_factors)';
  end if;
  return new;
end;
$$;

create trigger users_profile_owner_mfa
  before insert or update on public.users_profile
  for each row execute function public.enforce_owner_mfa();

comment on column public.users_profile.role is
  'RU-1: owner|editor|delegate|agent. delegate = RF-12.6 sostituto con permessi ridotti.';
