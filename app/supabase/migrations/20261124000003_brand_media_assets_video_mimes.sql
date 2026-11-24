-- Estende i MIME types ammessi su brand_media_assets per supportare video
-- (output Creatomate = mp4; webm come fallback).
-- Idempotente. Il nome reale della constraint è `media_content_type_check`.

alter table public.brand_media_assets
  drop constraint if exists media_content_type_check;

alter table public.brand_media_assets
  add constraint media_content_type_check
  check (content_type in (
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm'
  ));
