-- 20260923000008_brands_font.sql
-- RF-2.2: font per marchio. Uno tra Google Fonts predefiniti.
-- Usato nei template PNG (satori) e nelle anteprime canali (RF-4.6).
-- Default 'Bricolage' coerente col resto della piattaforma.
-- Idempotente: IF NOT EXISTS.

alter table public.brands
  add column if not exists font_family text not null default 'Bricolage';

comment on column public.brands.font_family is
  'RF-2.2: font per marchio (uno di GOOGLE_FONTS_ALLOWED nel codice). Usato in template e anteprima.';
