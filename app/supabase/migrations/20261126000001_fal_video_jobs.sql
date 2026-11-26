-- Job fal.ai video (image-to-video). State machine queued → in_progress →
-- succeeded/failed. Il polling client ne legge lo stato finché finisce.

create table if not exists public.fal_video_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  draft_id uuid references content_drafts(id) on delete set null,
  request_id text not null,
  model_id text not null,
  prompt text not null,
  image_url text not null,
  status text not null default 'queued'
    check (status in ('queued','in_progress','succeeded','failed')),
  output_url text,
  duration_seconds numeric,
  error_message text,
  asset_id uuid references brand_media_assets(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  constraint fal_video_request_unique unique (request_id)
);

create index if not exists idx_fal_video_jobs_org_brand
  on public.fal_video_jobs (organization_id, brand_id, created_at desc);
create index if not exists idx_fal_video_jobs_pending
  on public.fal_video_jobs (status) where status in ('queued','in_progress');

alter table public.fal_video_jobs enable row level security;
drop policy if exists "service_role full access on fal_video_jobs" on public.fal_video_jobs;
create policy "service_role full access on fal_video_jobs"
  on public.fal_video_jobs for all to service_role using (true) with check (true);

create or replace function public.touch_fal_video_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fal_video_jobs_touch on public.fal_video_jobs;
create trigger trg_fal_video_jobs_touch
  before update on public.fal_video_jobs
  for each row execute function public.touch_fal_video_jobs_updated_at();
