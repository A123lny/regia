-- RF-12.1 Operational tasks — todo manuali creati dagli utenti, assegnabili
-- ad altri utenti dell'organizzazione. Si affiancano ai segnali operativi
-- auto-generati che la dashboard aggrega dai moduli m01/m03/m06/m07/m09/m13.
--
-- RLS: tutti gli utenti dell'org vedono i task (lettura), creator e assignee
-- possono modificarli/completarli. Service role bypassa come al solito.

create table operational_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  priority text not null default 'important'
    check (priority in ('urgent', 'important', 'opportunity')),
  status text not null default 'open'
    check (status in ('open', 'done', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Coerenza status/completed_at
  constraint tasks_completed_coherent check (
    (status = 'open' and completed_at is null and completed_by is null) or
    (status = 'done' and completed_at is not null and completed_by is not null) or
    (status = 'cancelled' and completed_at is null and completed_by is null)
  )
);

create index idx_tasks_org_status on operational_tasks(organization_id, status);
create index idx_tasks_assignee on operational_tasks(assigned_to, status)
  where assigned_to is not null;
create index idx_tasks_created_by on operational_tasks(created_by, status);
create index idx_tasks_due on operational_tasks(organization_id, due_at)
  where due_at is not null and status = 'open';

-- Trigger updated_at (riusa funzione comune)
drop trigger if exists trg_tasks_touch_updated_at on operational_tasks;
create trigger trg_tasks_touch_updated_at
before update on operational_tasks
for each row execute function contacts_touch_updated_at();

alter table operational_tasks enable row level security;
create policy "operational_tasks_service_role_all"
  on operational_tasks for all to service_role using (true) with check (true);

comment on table operational_tasks is
  'RF-12.1: todo manuali assegnabili tra utenti dell''org. Convive con i segnali auto-generati.';
