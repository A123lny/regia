-- 20260907000006_seed_default_org_and_brands.sql
-- RN-87: unica organization al lancio. ID fissato per riferimento nei test e nel codice.
-- §1.1 tabella marchi: quattro marchi con voci distinte (RN-33).

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Gruppo Lenny + Stazione')
on conflict (id) do nothing;

insert into public.brands (organization_id, slug, display_name)
values
  ('00000000-0000-0000-0000-000000000001', 'lenny', 'Lenny'),
  ('00000000-0000-0000-0000-000000000001', 'stazione', 'Stazione'),
  ('00000000-0000-0000-0000-000000000001', 'eni-cafe', 'Eni Cafè'),
  ('00000000-0000-0000-0000-000000000001', 'officina', 'Officina')
on conflict (organization_id, slug) do nothing;
