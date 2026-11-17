-- 20261117000002_manuale_chunks_pgvector.sql
-- RN-robot RAG: chunks del manuale piattaforma indicizzati con embeddings
-- Gemini text-embedding-004 (768 dimensioni, free tier).
--
-- Tabella: manuale_chunks — una riga per ogni sezione/sottosezione del
-- manuale-piattaforma.md. Protetta da RLS (solo service_role legge/scrive,
-- per prevenire RAG poisoning).
-- Indice ivfflat su embedding per similarity search veloce con cosine distance.

create extension if not exists vector;

create table if not exists public.manuale_chunks (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  heading text not null,
  content text not null,
  embedding vector(768) not null,
  source_file text not null default 'manuale-piattaforma.md',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manuale_chunks_embedding_idx
  on public.manuale_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

create index if not exists manuale_chunks_section_idx
  on public.manuale_chunks (section);

comment on table public.manuale_chunks is
  'RN-robot RAG: chunks del docs/manuale-piattaforma.md con embeddings Gemini 768d.';

-- Hardening: RLS + denial-by-default.
-- Anche se i dati non sono PII, un anon/authenticated con scrittura potrebbe
-- fare RAG poisoning (inserire chunk falsi che il modello poi cita). L'accesso
-- avviene SOLO via service_role nel backend (lib/db/admin.ts) che bypassa RLS.
alter table public.manuale_chunks enable row level security;
revoke all on table public.manuale_chunks from anon, authenticated;

-- RPC per similarity search: ritorna i top N chunk piu' simili alla query.
-- Distanza coseno (0 = identico, 2 = opposto). Similarity = 1 - distance.
create or replace function public.match_manuale_chunks(
  query_embedding vector(768),
  match_count int default 3
)
returns table (
  section text,
  heading text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    mc.section,
    mc.heading,
    mc.content,
    1 - (mc.embedding <=> query_embedding) as similarity
  from public.manuale_chunks mc
  order by mc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 10));
$$;

comment on function public.match_manuale_chunks(vector, int) is
  'RN-robot RAG: ritorna i top N chunk del manuale per similarity cosine.';

-- Hardening: solo service_role puo' eseguire la ricerca. L'app chiama via
-- getAdminClient() nel tool explainFeature, nessun client puo' bypassare.
revoke execute on function public.match_manuale_chunks(vector, int)
  from anon, authenticated, public;
grant execute on function public.match_manuale_chunks(vector, int) to service_role;
