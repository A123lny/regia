-- 20260923000005_brand_media_assets.sql
-- RF-4.1: Libreria media per marchio (foto/video). F1: solo immagini.
-- Storage: bucket 'content-media' (esistente), path 'media/{org_id}/{brand_id}/{yyyy}/{mm}/{uuid}.{ext}'.
-- Il record content ha un signed URL long-lived (10 anni) memorizzato in signed_url per uso publish.
-- Tag[] per etichettatura + ricerca. Caption text con full-text search.
-- media_asset_id in content_drafts consente di allegare un'immagine a una bozza.
-- Idempotente: IF NOT EXISTS.

create table if not exists public.brand_media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  storage_path text not null,
  signed_url text not null,
  content_type text not null,
  size_bytes int not null,
  width int,
  height int,
  tags text[] not null default '{}'::text[],
  caption text not null default '',
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null,
  constraint media_size_check check (size_bytes between 1 and 20971520),
  constraint media_content_type_check
    check (content_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  constraint media_caption_length check (length(caption) <= 500),
  constraint media_storage_path_unique unique (storage_path)
);

create index if not exists brand_media_assets_brand_idx
  on public.brand_media_assets (brand_id, uploaded_at desc);

create index if not exists brand_media_assets_tags_gin
  on public.brand_media_assets using gin (tags);

-- Full-text ricerca su caption
create index if not exists brand_media_assets_caption_fts
  on public.brand_media_assets using gin (to_tsvector('simple', caption));

alter table public.brand_media_assets enable row level security;
-- Nessuna policy: denial-by-default (baseline). Le query passano da service_role.

-- Aggancio bidirezionale: draft puo allegare un asset (nullable).
alter table public.content_drafts
  add column if not exists media_asset_id uuid references public.brand_media_assets(id) on delete set null;

create index if not exists content_drafts_media_asset_idx
  on public.content_drafts (media_asset_id)
  where media_asset_id is not null;

comment on table public.brand_media_assets is
  'Libreria media per marchio (RF-4.1). Immagini con caption, tag e signed URL long-lived.';
comment on column public.content_drafts.media_asset_id is
  'FK opzionale a brand_media_assets: immagine allegata al draft (RF-4.1 + RF-4.6).';
