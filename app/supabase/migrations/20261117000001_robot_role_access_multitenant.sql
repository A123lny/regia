-- 20261117000001_robot_role_access_multitenant.sql
-- RN-robot fix multi-tenant isolation (security HIGH): la tabella
-- robot_role_access, creata ieri (20261116000001), aveva PK solo su `role`,
-- rendendo la configurazione globale per TUTTE le org.
-- Correggiamo: PK composita (organization_id, role) + seed per ogni org.
--
-- Idempotente: se la tabella ha gia' organization_id (fix gia' applicato),
-- la seconda esecuzione e' no-op.

-- Cancella la tabella vecchia (solo 4 righe seed di 'owner default', zero dati utente)
drop table if exists public.robot_role_access cascade;

create table public.robot_role_access (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, role),
  constraint robot_role_access_role_check
    check (role in ('owner', 'editor', 'delegate', 'agent'))
);

alter table public.robot_role_access enable row level security;

revoke insert, update, delete on public.robot_role_access from anon, authenticated;
grant insert, update, select on public.robot_role_access to service_role;

-- Seed per ogni organizzazione esistente: solo owner enabled per default.
insert into public.robot_role_access (organization_id, role, enabled)
select o.id, r.role, case when r.role = 'owner' then true else false end
from public.organizations o
cross join (values ('owner'), ('editor'), ('delegate'), ('agent')) as r(role)
on conflict (organization_id, role) do nothing;

comment on table public.robot_role_access is
  'RN-robot: abilitazione robottino per (organization, ruolo). Default: solo owner.';
