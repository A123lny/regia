-- 20260923000010_platform_branding.sql
-- RF-2.7 White label: nome, logo, colore primario configurabili per organization.
-- Default "Regìa" + palette editoriale. Consente rivendita whitelabel (RN-87).
-- Idempotente: IF NOT EXISTS.

alter table public.organizations
  add column if not exists platform_name text not null default 'Regìa',
  add column if not exists platform_logo_url text,
  add column if not exists platform_primary_color text,
  add constraint org_platform_color_format
    check (platform_primary_color is null or platform_primary_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.organizations.platform_name is
  'RF-2.7: nome della piattaforma mostrato in header, login, metadata title.';
comment on column public.organizations.platform_logo_url is
  'RF-2.7: URL signed del logo piattaforma. NULL = usa nome testuale.';
comment on column public.organizations.platform_primary_color is
  'RF-2.7: override del colore primary CSS. NULL = default palette editoriale.';
