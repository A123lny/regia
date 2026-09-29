-- 20260923000003_content_material_requests.sql
-- RF-3.9: richieste di materiali (foto/video) per contenuti pianificati.
-- Quando un draft ha bisogno di materiale non ancora in libreria, si genera
-- una task assegnabile con scadenza (typically = data pubblicazione - 3 giorni).
-- La detection oggi e manuale (Owner marca); quando M4 libreria media
-- arrivera, il generatore AI potra creare le request automaticamente.
-- Idempotente: IF NOT EXISTS.

create table if not exists public.content_material_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  draft_id uuid not null references public.content_drafts(id) on delete cascade,
  description text not null,
  needed_by_date date,
  status text not null default 'open',
  assigned_to text,
  fulfilled_at timestamptz,
  fulfilled_note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint material_status_check check (status in ('open', 'fulfilled', 'cancelled')),
  constraint material_description_length check (length(description) between 3 and 500)
);

create index if not exists material_requests_org_status_idx
  on public.content_material_requests (organization_id, status);

create index if not exists material_requests_draft_idx
  on public.content_material_requests (draft_id);

create index if not exists material_requests_needed_by_idx
  on public.content_material_requests (needed_by_date)
  where status = 'open';

comment on table public.content_material_requests is
  'Task per raccolta foto/video mancanti per un draft (RF-3.9). Popolate manualmente in F1; M4+M03 populeranno anche in automatico quando la libreria media arrivera.';
