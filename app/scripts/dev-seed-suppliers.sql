-- Seed dev M6a: 3 fornitori (partner spesa Lenny) con mix di assenso.
-- Idempotente: cancella e reinsersisce SOLO record con notes='seed-dev'.

do $$
declare
  v_org_id uuid;
  v_supp_bevande uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then return; end if;

  delete from supply_partners where organization_id = v_org_id and notes = 'seed-dev';

  insert into supply_partners (
    organization_id, name, referent_name, phone, email, category,
    general_consent, general_consent_note, notes
  ) values
    (v_org_id, 'Pastificio Titano', 'Carlo Rossi', '+39 0549 100001', 'carlo@pastificiotitano.sm', 'Pasta',
     true, 'Accordo commerciale 2026, promozioni permesse su tutta la linea fresca', 'seed-dev'),
    (v_org_id, 'Bevande San Marino srl', 'Anna Ferri', '+39 0549 100002', 'anna@bevandesm.sm', 'Bevande',
     false, null, 'seed-dev'),
    (v_org_id, 'Caseificio del Titano', 'Marco Neri', '+39 0549 100003', null, 'Latticini',
     false, null, 'seed-dev');

  -- Associo un prodotto (acqua Eni Cafè) al fornitore SENZA assenso per far vedere il blocco
  select id into v_supp_bevande from supply_partners
    where organization_id = v_org_id and name = 'Bevande San Marino srl';

  update brand_products
  set supply_partner_id = v_supp_bevande
  where organization_id = v_org_id
    and notes = 'seed-dev'
    and sku = 'CAFE-ACQUA';

  raise notice '[seed-suppliers] 3 fornitori inseriti + 1 prodotto legato.';
end $$;
