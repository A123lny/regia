-- 20260922000001_brands_color_and_archive.sql
-- Aggiunge colonne color + is_archived a brands per abilitare CRUD marchi da UI.
-- - color: colore identita esadecimale (#RRGGBB), obbligatorio, default fallback grigio.
-- - is_archived: soft delete. I marchi archiviati spariscono da menu/liste ma restano
--   accessibili per audit e per contenuti storici (rispetta integrita cascade).
-- Backfill dei 4 seed con i colori identita gia usati in codice.
-- Idempotente: IF NOT EXISTS su colonne, guardia sui backfill via on conflict do nothing gia in seed.

alter table public.brands
  add column if not exists color text not null default '#7a6857',
  add column if not exists is_archived boolean not null default false;

-- Vincolo formato colore: #RRGGBB esadecimale minuscolo o maiuscolo, 6 cifre esa.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'brands_color_format'
      and conrelid = 'public.brands'::regclass
  ) then
    alter table public.brands
      add constraint brands_color_format check (color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- Index parziale per query "solo marchi attivi" (default UI).
create index if not exists brands_active_idx
  on public.brands (organization_id, display_name)
  where is_archived = false;

-- Backfill dei 4 seed con colori identita fissi.
update public.brands set color = '#FF6B35' where slug = 'lenny'    and color = '#7a6857';
update public.brands set color = '#1E5F8C' where slug = 'stazione' and color = '#7a6857';
update public.brands set color = '#8C5E1E' where slug = 'eni-cafe' and color = '#7a6857';
update public.brands set color = '#556B2F' where slug = 'officina' and color = '#7a6857';

comment on column public.brands.color is
  'Colore identita marchio in formato #RRGGBB. Usato per pillole, chip, hero della dashboard.';
comment on column public.brands.is_archived is
  'Soft delete: marchi archiviati spariscono da menu e liste ma restano nel DB per audit.';
