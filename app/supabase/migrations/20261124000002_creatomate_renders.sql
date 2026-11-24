-- M15 Creatomate: stato dei render video/immagine da template.
-- State machine: queued → planned|rendering → succeeded|failed.
-- webhook_token: segreto per-render che Creatomate rimanda via query param
-- del webhook_url; il nostro handler verifica che corrisponda al record.

create table if not exists public.creatomate_renders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  draft_id uuid references content_drafts(id) on delete set null,
  external_id text not null,
  template_id text not null,
  modifications jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','planned','rendering','succeeded','failed','cancelled')),
  output_url text,
  snapshot_url text,
  output_format text,
  width int, height int,
  duration_seconds numeric,
  error_message text,
  asset_id uuid references brand_media_assets(id) on delete set null,
  webhook_token text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  constraint creatomate_external_unique unique (external_id)
);

create index if not exists idx_creatomate_renders_org_brand
  on public.creatomate_renders (organization_id, brand_id, created_at desc);
create index if not exists idx_creatomate_renders_pending
  on public.creatomate_renders (status)
  where status in ('queued','planned','rendering');
create index if not exists idx_creatomate_renders_draft
  on public.creatomate_renders (draft_id)
  where draft_id is not null;

alter table public.creatomate_renders enable row level security;

drop policy if exists "service_role full access on creatomate_renders"
  on public.creatomate_renders;
create policy "service_role full access on creatomate_renders"
  on public.creatomate_renders for all to service_role
  using (true) with check (true);

-- Trigger updated_at
create or replace function public.touch_creatomate_renders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_creatomate_renders_touch_updated_at on public.creatomate_renders;
create trigger trg_creatomate_renders_touch_updated_at
  before update on public.creatomate_renders
  for each row execute function public.touch_creatomate_renders_updated_at();

comment on table public.creatomate_renders is
  'Render video/immagine via Creatomate. State machine queued→succeeded/failed.';
