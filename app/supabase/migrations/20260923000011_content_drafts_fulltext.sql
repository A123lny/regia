-- 20260923000011_content_drafts_fulltext.sql
-- RF-12.2 Archivio + ricerca full-text.
-- Index GIN su tsvector italiano di theme_input + generated_text.
-- Idempotente: IF NOT EXISTS.

create index if not exists content_drafts_fulltext_idx
  on public.content_drafts
  using gin (
    to_tsvector('italian', coalesce(theme_input, '') || ' ' || coalesce(generated_text, ''))
  );

comment on index public.content_drafts_fulltext_idx is
  'RF-12.2: index full-text italiano per ricerca contenuti in archivio.';
