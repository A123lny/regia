-- Seed opzionale dei provider media esterni per tutte le organizzazioni
-- esistenti. L'Owner deve ATTIVARLI esplicitamente (is_active=false di default):
-- qui crea solo le righe con slug + diritti impostati, così la UI mostra
-- subito la card da attivare invece di chiedere all'Owner di scriverla.
--
-- Idempotente: ON CONFLICT DO NOTHING.

insert into public.media_providers (
  organization_id,
  name,
  slug,
  provider_kind,
  tos_url,
  rights_holder,
  allowed_uses,
  restricted_sectors,
  verification_notes,
  verified_by,
  verified_at,
  is_active
)
select
  o.id,
  'fal.ai',
  'fal-ai',
  'image',
  'https://fal.ai/terms',
  'user',
  array['commercial']::text[],
  array[]::text[],
  'Provider immagini AI (FLUX schnell + pro). Attivabile da Impostazioni → Provider media quando FAL_KEY è configurata.',
  null,
  now(),
  false
from public.organizations o
on conflict do nothing;

insert into public.media_providers (
  organization_id,
  name,
  slug,
  provider_kind,
  tos_url,
  rights_holder,
  allowed_uses,
  restricted_sectors,
  verification_notes,
  verified_by,
  verified_at,
  is_active
)
select
  o.id,
  'Creatomate',
  'creatomate',
  'both',
  'https://creatomate.com/legal',
  'user',
  array['commercial']::text[],
  array[]::text[],
  'Provider video/immagini da template Creatomate. Attivabile quando CREATOMATE_API_KEY è configurata.',
  null,
  now(),
  false
from public.organizations o
on conflict do nothing;
