-- Seed dev RF-1.7: 3 duplicati intenzionali per testare la dedup.
-- - 1 coppia con email uguale (case diverso)
-- - 1 coppia con telefono uguale (spaziatura diversa)
-- - 1 coppia con whatsapp uguale

do $$
declare
  v_org_id uuid;
  v_brand_lenny uuid;
  v_brand_stazione uuid;
  v_brand_enicafe uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then return; end if;
  select id into v_brand_lenny from brands where organization_id = v_org_id and slug = 'lenny';
  select id into v_brand_stazione from brands where organization_id = v_org_id and slug = 'stazione';
  select id into v_brand_enicafe from brands where organization_id = v_org_id and slug = 'eni-cafe';

  -- Cleanup precedenti
  delete from contacts where organization_id = v_org_id and 'seed-dup' = any(tags);

  -- Duplicato 1: email uguale case diverso (Lenny)
  if v_brand_lenny is not null then
    insert into contacts (organization_id, brand_id, first_name, last_name, email, source, tags) values
      (v_org_id, v_brand_lenny, 'Roberto', 'Bianchi', 'r.bianchi@example.it', 'qr', array['seed-dup','pendolare']),
      (v_org_id, v_brand_lenny, 'Roberto', 'Bianchi', 'R.BIANCHI@example.it', 'manuale', array['seed-dup']);
  end if;

  -- Duplicato 2: telefono uguale con spaziatura diversa (Stazione)
  if v_brand_stazione is not null then
    insert into contacts (organization_id, brand_id, first_name, last_name, phone, source, tags) values
      (v_org_id, v_brand_stazione, 'Maria', 'Verdi', '+39 333 1234567', 'qr', array['seed-dup','residente']),
      (v_org_id, v_brand_stazione, 'M.', 'Verdi', '+393331234567', 'gestionale', array['seed-dup']);
  end if;

  -- Duplicato 3: whatsapp uguale (Eni Cafè)
  if v_brand_enicafe is not null then
    insert into contacts (organization_id, brand_id, first_name, email, whatsapp, source, tags) values
      (v_org_id, v_brand_enicafe, 'Giulio', 'g.dupla@example.com', '+39 348 9998887', 'web', array['seed-dup']),
      (v_org_id, v_brand_enicafe, 'Giulio Dupla', null, '+39-348-999-8887', 'manuale', array['seed-dup']);
  end if;

  raise notice '[seed-duplicates] Inseriti 3 coppie di contatti duplicati.';
end $$;
