-- Bucket content-media: ammetti video/mp4 e video/webm (output fal video +
-- Creatomate reel). La CHECK constraint di brand_media_assets gia' li ammette
-- (migration 20261124000003), ma Supabase Storage rifiutava gli upload a
-- livello bucket perche' allowed_mime_types era ancora solo image/*.
--
-- Dimensione: 20MB per immagini bastava, ma un reel 1080x1920 @ 25fps x 8s
-- pesa facilmente 15-25MB a bitrate decente, e un mp4 Kling (5s) 5-10MB.
-- Alzato a 100MB per sicurezza.
--
-- Idempotente: UPDATE si può eseguire piu volte senza effetti collaterali.

update storage.buckets
set
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm'
  ]::text[],
  file_size_limit = 100 * 1024 * 1024
where name = 'content-media';
