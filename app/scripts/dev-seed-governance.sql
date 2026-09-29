-- Seed dev M13: flag discount_forbidden sui prodotti chiave (RF-6.15, RF-6.17).
-- Idempotente: solo update, non insert.
-- Le regole autonomy sono già inserite dalla migration (seed inline).

do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then return; end if;

  -- RF-6.15: carburanti mai in sconto
  update brand_products
  set
    discount_forbidden = true,
    discount_forbidden_reason = 'RF-6.15: margine troppo sottile, prezzo esposto in strada — mai sconti sul carburante'
  where organization_id = v_org_id
    and sku in ('STZ-BENZ-95', 'STZ-DIESEL', 'STZ-GPL')
    and notes = 'seed-dev';

  -- RF-6.17: tariffe officina mai in sconto (servizi di manutenzione)
  update brand_products
  set
    discount_forbidden = true,
    discount_forbidden_reason = 'RF-6.17: sconto sulla tariffa oraria officina insinua dubbio sulla qualità — mai sconti'
  where organization_id = v_org_id
    and sku in ('OFF-TAGLIANDO', 'OFF-CAMBIO-OLIO', 'OFF-REVISIONE')
    and notes = 'seed-dev';

  raise notice '[seed-governance] Flag discount_forbidden applicato a 6 prodotti (3 carburanti + 3 tariffe officina).';
end $$;
