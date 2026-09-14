-- 20260914000003_brand_forbidden_words.sql
-- RF-2.5: parole bandite per marchio. Unique case-insensitive via lower(word).

create table public.brand_forbidden_words (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  word text not null,
  created_at timestamptz not null default now(),
  constraint brand_forbidden_words_word_len check (length(word) between 1 and 100)
);

create unique index brand_forbidden_words_brand_lower_word_unique
  on public.brand_forbidden_words(brand_id, lower(word));

create index brand_forbidden_words_brand_idx on public.brand_forbidden_words(brand_id);

alter table public.brand_forbidden_words enable row level security;
revoke insert, update, delete on public.brand_forbidden_words from anon, authenticated;
grant insert, update, delete, select on public.brand_forbidden_words to service_role;

comment on table public.brand_forbidden_words is
  'RF-2.5: parole bandite per marchio. Unique case-insensitive.';
