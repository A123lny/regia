-- Brand kit: personalizzazione immagini AI (richiesta utente 2026-11-27).
-- Tre aggiunte a brand_kits:
--   image_style         - descrizione stile foto in INGLESE da iniettare nel
--                          prompt text-to-image (es. "warm photorealistic,
--                          natural light, shallow depth of field, editorial")
--   forbidden_subjects  - array di soggetti da evitare ("avoid imagery: X")
--   lora_model_url      - safetensors URL del LoRA addestrato su fal
--                          (vedi lora_training_jobs). Quando valorizzato le
--                          generazioni fal passano da flux/dev a flux-lora
--                          con questo path come style reference.

alter table public.brand_kits
  add column if not exists image_style text not null default '',
  add column if not exists forbidden_subjects text[] not null default '{}',
  add column if not exists lora_model_url text;

-- Job training LoRA su fal (`fal-ai/flux-lora-fast-training`). State machine
-- queued → in_progress → succeeded/failed. Al completamento, la URL del
-- safetensors viene scritta in brand_kits.lora_model_url.

create table if not exists public.lora_training_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  request_id text not null,
  trigger_word text,
  is_style boolean not null default true,
  steps integer not null default 1000,
  images_zip_url text not null,
  num_images integer not null,
  status text not null default 'queued'
    check (status in ('queued','in_progress','succeeded','failed')),
  lora_url text,
  config_url text,
  error_message text,
  requested_by uuid not null references auth.users(id) on delete restrict,
  cost_usd numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  succeeded_at timestamptz,
  failed_at timestamptz,
  constraint lora_training_request_unique unique (request_id)
);

create index if not exists idx_lora_training_org_brand
  on public.lora_training_jobs (organization_id, brand_id, created_at desc);
create index if not exists idx_lora_training_pending
  on public.lora_training_jobs (status) where status in ('queued','in_progress');

alter table public.lora_training_jobs enable row level security;
drop policy if exists "service_role full access on lora_training_jobs" on public.lora_training_jobs;
create policy "service_role full access on lora_training_jobs"
  on public.lora_training_jobs for all to service_role using (true) with check (true);

create or replace function public.touch_lora_training_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lora_training_jobs_touch on public.lora_training_jobs;
create trigger trg_lora_training_jobs_touch
  before update on public.lora_training_jobs
  for each row execute function public.touch_lora_training_jobs_updated_at();
