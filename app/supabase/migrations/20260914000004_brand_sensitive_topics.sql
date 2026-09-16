-- 20260914000004_brand_sensitive_topics.sql
-- RF-2.5: argomenti sensibili (claim vietati + argomenti che richiedono revisione umana).

create table public.brand_sensitive_topics (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  topic text not null,
  kind text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint brand_sensitive_topics_kind_check
    check (kind in ('claim_vietato', 'revisione_umana')),
  constraint brand_sensitive_topics_per_brand_unique unique (brand_id, topic, kind),
  constraint brand_sensitive_topics_topic_len check (length(topic) between 1 and 200),
  constraint brand_sensitive_topics_note_len check (length(note) <= 500)
);

create index brand_sensitive_topics_brand_idx on public.brand_sensitive_topics(brand_id);

alter table public.brand_sensitive_topics enable row level security;
revoke insert, update, delete on public.brand_sensitive_topics from anon, authenticated;
grant insert, update, delete, select on public.brand_sensitive_topics to service_role;

comment on table public.brand_sensitive_topics is
  'RF-2.5: claim vietati + argomenti che richiedono revisione umana per marchio.';
