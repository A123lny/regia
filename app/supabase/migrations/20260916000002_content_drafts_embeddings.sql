-- F1.5a — Motore editoriale: embeddings per retrieval semantico rifiuti (RF-3.8).
-- pgvector è già attivato in F0 (migrazione _000001_extensions.sql).
-- Dimensione 512 = voyage-3-lite (adapter in src/lib/ai/voyage.ts).

alter table content_drafts
  add column rejection_reason_embedding vector(512);

-- Guardia coerenza: solo i draft rifiutati hanno embedding (evita spazio sprecato).
alter table content_drafts
  add constraint rejection_embedding_only_if_rejected
    check (rejection_reason_embedding is null or status = 'rejected');

-- Index HNSW per k-NN cosine (retrieval veloce anche con migliaia di rifiuti per brand).
-- Filtered index: solo rows con embedding presente.
create index content_drafts_rejection_embedding_idx
  on content_drafts using hnsw (rejection_reason_embedding vector_cosine_ops)
  where status = 'rejected';

-- RPC per retrieval anti-pattern chiamato da src/modules/m03-editorial/internal/content-drafts-repo.ts.
-- Definita qui (vicino allo schema che consulta) invece che nel dominio: usa operatore
-- cosine <=> di pgvector, non esposto direttamente dal builder Supabase JS.
create or replace function fetch_similar_rejections(
  p_brand_id uuid,
  p_embedding vector(512),
  p_limit int
) returns table(theme_input text, generated_text text, rejection_reason text)
language sql stable as $$
  select theme_input, generated_text, rejection_reason
  from content_drafts
  where brand_id = p_brand_id
    and status = 'rejected'
    and rejection_reason_embedding is not null
  order by rejection_reason_embedding <=> p_embedding
  limit p_limit;
$$;

-- Grant execute a service_role: F1.5a l'accesso è mediato dalle server actions.
-- Nessun grant a authenticated (RLS resta chiuso in F1.5a).
grant execute on function fetch_similar_rejections(uuid, vector(512), int) to service_role;
