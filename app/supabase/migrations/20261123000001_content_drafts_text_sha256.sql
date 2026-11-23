-- content_drafts: colonna generated STORED con l'hash SHA-256 del testo.
-- Serve come content-binding compatto per l'approvazione atomica:
-- approveContentDraft puo' matchare su .eq('generated_text_sha256', <hash>)
-- nel WHERE della UPDATE senza spedire il testo pieno (5000 char max) nella
-- URL della richiesta PostgREST, evitando leak nei log e URL length limits.
--
-- Il valore e' autogenerato dal DB: ogni UPDATE del testo aggiorna anche
-- l'hash in transazione, senza codice applicativo.

alter table public.content_drafts
  add column if not exists generated_text_sha256 text
  generated always as (encode(digest(coalesce(generated_text, ''), 'sha256'), 'hex')) stored;

-- Indice: non necessario per performance (tabella piccola, filtro su id gia'
-- unico) ma utile se in futuro vorremo cercare per hash duplicato.
create index if not exists idx_content_drafts_text_sha256
  on public.content_drafts(generated_text_sha256);

comment on column public.content_drafts.generated_text_sha256 is
  'Hash SHA-256 (hex) di generated_text. Colonna generata (STORED). Usata per content-binding atomico nell''approvazione (M03).';
