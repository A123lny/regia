-- M08 reviews: storage + classificazione + bozza + workflow approvazione.
-- RS-3: UNIQUE dedup fetcher, CHECK rating/status, RLS tenant, CASCADE.

-- Generic set_updated_at() trigger function (riused across multiple tables)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  source text not null check (source in ('google')),
  external_id text not null,
  author_name text,
  rating smallint not null check (rating between 1 and 5),
  text_original text,
  posted_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  classification text not null check (classification in ('positive','negative','serious')),
  classification_reason text,
  suggested_reply text,
  approved_reply text,
  status text not null default 'pending' check (
    status in ('pending','draft_ready','approved','published_externally','serious_signaled','serious_resolved','ignored')
  ),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  published_externally_at timestamptz,
  resolved_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source, external_id)
);

create index idx_reviews_pending on reviews (organization_id, brand_id, status)
  where status in ('pending','draft_ready');
create index idx_reviews_posted on reviews (organization_id, brand_id, posted_at desc);

create trigger reviews_updated_at before update on reviews
  for each row execute function set_updated_at();

alter table reviews enable row level security;
create policy reviews_tenant on reviews
  using (organization_id = (select auth.jwt() ->> 'org_id')::uuid);

comment on table reviews is 'M08 Recensioni e reputazione (RF-8.1..8.9). Fetcher Google Places read-only + classifier euristico + bozza AI + approvazione Owner.';
