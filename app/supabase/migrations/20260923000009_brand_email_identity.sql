-- 20260923000009_brand_email_identity.sql
-- RF-2.2a: identita email per marchio (mittente, display, reply-to).
-- Verra usato da M5 publisher quando invieremo email newsletter/transazionali.
-- La validazione DNS (SPF/DKIM) e config, non codice.
-- Idempotente: IF NOT EXISTS.

alter table public.brands
  add column if not exists email_from_address text,
  add column if not exists email_from_display_name text,
  add column if not exists email_reply_to text,
  add constraint brand_email_from_format
    check (email_from_address is null or email_from_address ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  add constraint brand_email_reply_to_format
    check (email_reply_to is null or email_reply_to ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$');

comment on column public.brands.email_from_address is
  'RF-2.2a: mittente email marchio (es. hello@lenny.it). Dominio deve avere SPF/DKIM configurati.';
comment on column public.brands.email_from_display_name is
  'RF-2.2a: nome visualizzato nel client email (es. "Lenny — la nostra cucina").';
comment on column public.brands.email_reply_to is
  'RF-2.2a: dove arrivano le risposte del cliente (puo essere diverso dal from).';
