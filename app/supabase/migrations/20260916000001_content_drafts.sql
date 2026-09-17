-- F1.5a — Motore editoriale: tabella base per bozze di contenuto (RF-3.3, RF-3.7).
-- Un draft rappresenta una singola generazione AI per marchio + canale + tema.
-- Il ciclo di stato è: draft → approved | rejected (F1.5a).
-- F1.5b aggiungerà stati: scheduled, published, measured (RF-3.5).

create type content_channel as enum ('social');
create type content_draft_status as enum ('draft', 'approved', 'rejected');

create table content_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  channel content_channel not null,
  theme_input text not null check (length(theme_input) between 1 and 2000),
  generated_text text not null check (length(generated_text) between 1 and 10000),
  prompt_version text not null check (length(prompt_version) between 1 and 100),
  model_used text not null check (length(model_used) between 1 and 100),
  tokens_in integer not null check (tokens_in >= 0),
  tokens_out integer not null check (tokens_out >= 0),
  cost_usd numeric(10,6) not null check (cost_usd >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  status content_draft_status not null default 'draft',
  rejection_reason text check (
    rejection_reason is null or length(rejection_reason) between 1 and 500
  ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  -- coerenza stato ↔ timestamp/reason: rende impossibile "approvato senza timestamp".
  constraint approved_has_timestamp
    check ((status = 'approved') = (approved_at is not null)),
  constraint rejected_has_timestamp_and_reason
    check ((status = 'rejected') = (rejected_at is not null and rejection_reason is not null))
);

-- Index per listContentDraftsByBrand (feed cronologico decrescente).
create index content_drafts_brand_created_idx
  on content_drafts(brand_id, created_at desc);

-- Index per fetchRecentApprovedByBrand e retrieval status-scoped.
create index content_drafts_brand_status_idx
  on content_drafts(brand_id, status);
