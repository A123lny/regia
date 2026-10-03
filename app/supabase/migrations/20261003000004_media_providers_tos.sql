-- RF-4.3 Provider di generazione media esterna: ToS/diritti verificati UNA VOLTA
-- al collegamento del fornitore. Non e' un controllo da rifare a ogni generazione:
-- e' una condizione di ammissione del fornitore (RF-4.3 + RS-2 adapter config).
--
-- Non colleghiamo ancora provider reali (M04 F1 usa template interni); questa
-- tabella precede l'implementazione e serve come compliance ledger quando
-- l'owner registra per la prima volta un provider (es. fal.ai FLUX, Replicate,
-- DALL-E, Stable Diffusion API, ecc.).

create table media_providers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null,  -- machine-readable id (es. 'fal_ai_flux', 'replicate', 'dalle3')
  provider_kind text not null check (provider_kind in ('image', 'video', 'both')),
  tos_url text null,
  rights_holder text not null check (rights_holder in ('user', 'provider', 'shared', 'public_domain')),
  allowed_uses text[] not null default '{}'::text[]
    check (allowed_uses <@ ARRAY['commercial', 'editorial', 'personal']),
  restricted_sectors text[] not null default '{}'::text[],  -- es. ['tabacco','alcool','armi','politica','religione']
  verified_at timestamptz not null default now(),
  verified_by uuid null references auth.users(id) on delete set null,
  verification_notes text null,  -- note aggiuntive su T&C
  is_active boolean not null default true,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index media_providers_org_idx on media_providers (organization_id)
  where archived_at is null;
alter table media_providers enable row level security;

comment on column media_providers.rights_holder is
  'RF-4.3: chi detiene i diritti sull''output generato. user=noi (customer paga), provider=il servizio, shared=co-ownership, public_domain=libero.';
comment on column media_providers.allowed_uses is
  'RF-4.3: usi ammessi secondo T&C del provider. commercial=marketing/vendita, editorial=giornalismo/informazione, personal=non commerciale.';
comment on column media_providers.restricted_sectors is
  'RF-4.3: settori che il provider vieta esplicitamente nei suoi T&C. Esempi: tabacco, alcool, armi, gioco d''azzardo, pornografia, politica, religione.';
