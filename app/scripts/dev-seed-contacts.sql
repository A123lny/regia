-- Seed dev: 30 contatti fittizi + consensi + veicoli.
-- Idempotente: cancella e reinsersisce SOLO contatti con tag 'seed-dev'.
-- Non tocca contatti creati manualmente da UI.
-- Prerequisito: organizations + brands esistono (seed brand kit F1.2 già applicato).
-- Brand slugs (verificati): lenny, stazione, officina, eni-cafe.

do $$
declare
  v_org_id uuid;
  v_brand_lenny uuid;
  v_brand_stazione uuid;
  v_brand_officina uuid;
  v_brand_enicafe uuid;
  v_fallback_brand uuid;
  v_contact_id uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then
    raise notice '[seed-contacts] Nessuna organization presente, esco.';
    return;
  end if;

  select id into v_brand_lenny from brands
    where organization_id = v_org_id and slug = 'lenny' and is_archived = false;
  select id into v_brand_stazione from brands
    where organization_id = v_org_id and slug = 'stazione' and is_archived = false;
  select id into v_brand_officina from brands
    where organization_id = v_org_id and slug = 'officina' and is_archived = false;
  select id into v_brand_enicafe from brands
    where organization_id = v_org_id and slug = 'eni-cafe' and is_archived = false;

  -- Fallback: se un brand manca, usa il primo disponibile per non violare NOT NULL.
  v_fallback_brand := coalesce(v_brand_lenny, v_brand_stazione, v_brand_officina, v_brand_enicafe);
  if v_fallback_brand is null then
    raise notice '[seed-contacts] Nessun brand presente, esco.';
    return;
  end if;
  v_brand_lenny := coalesce(v_brand_lenny, v_fallback_brand);
  v_brand_stazione := coalesce(v_brand_stazione, v_fallback_brand);
  v_brand_officina := coalesce(v_brand_officina, v_fallback_brand);
  v_brand_enicafe := coalesce(v_brand_enicafe, v_fallback_brand);

  -- Cleanup precedenti seed
  delete from contacts where organization_id = v_org_id and 'seed-dev' = any(tags);

  -- Lenny (8) — food delivery
  insert into contacts (organization_id, brand_id, first_name, last_name, email, phone, whatsapp, address_city, source, tags)
  values
    (v_org_id, v_brand_lenny, 'Marco', 'Rossi', 'marco.rossi@example.com', '+39 3491234567', '+39 3491234567', 'Serravalle', 'qr', array['seed-dev','residente']),
    (v_org_id, v_brand_lenny, 'Anna', 'Bianchi', 'anna.b@example.it', '+39 3392345678', null, 'Borgo Maggiore', 'web', array['seed-dev','residente']),
    (v_org_id, v_brand_lenny, 'Giulia', 'Verdi', 'giulia.verdi@example.com', null, '+39 3474567890', 'Domagnano', 'qr', array['seed-dev','pendolare']),
    (v_org_id, v_brand_lenny, 'Luca', 'Neri', 'luca.n@example.it', '+39 3405678901', null, 'Rimini', 'web', array['seed-dev','pendolare']),
    (v_org_id, v_brand_lenny, 'Sara', 'Ricci', null, '+39 3336789012', '+39 3336789012', 'Serravalle', 'gestionale', array['seed-dev','abituale']),
    (v_org_id, v_brand_lenny, 'Paolo', 'Marini', 'paolo.marini@example.com', '+39 3287890123', null, 'Chiesanuova', 'manuale', array['seed-dev']),
    (v_org_id, v_brand_lenny, 'Elena', 'Costa', 'elena.costa@example.it', null, '+39 3208901234', 'Falciano', 'qr', array['seed-dev','residente']),
    (v_org_id, v_brand_lenny, 'Davide', 'Ferrari', 'd.ferrari@example.com', '+39 3159012345', null, 'Fiorentino', 'web', array['seed-dev']);

  -- Stazione (8) — turisti e residenti misti
  insert into contacts (organization_id, brand_id, first_name, last_name, email, phone, whatsapp, address_city, source, tags)
  values
    (v_org_id, v_brand_stazione, 'Giovanni', 'Moretti', 'g.moretti@example.it', '+39 3487890167', null, 'Serravalle', 'qr', array['seed-dev','residente']),
    (v_org_id, v_brand_stazione, 'Laura', 'Rizzo', 'laura.rizzo@example.com', '+39 3398901278', '+39 3398901278', 'Fiorentino', 'qr', array['seed-dev','pendolare']),
    (v_org_id, v_brand_stazione, 'Alessandro', 'Marino', null, '+39 3479012389', null, 'Rimini', 'qr', array['seed-dev','pendolare']),
    (v_org_id, v_brand_stazione, 'Valentina', 'Grassi', 'v.grassi@example.it', null, '+39 3400123490', 'Domagnano', 'web', array['seed-dev','residente']),
    (v_org_id, v_brand_stazione, 'Simone', 'Barbieri', 'simone.b@example.com', '+39 3331234501', null, 'Serravalle', 'gestionale', array['seed-dev','abituale']),
    (v_org_id, v_brand_stazione, 'Martina', 'Fontana', null, '+39 3282345612', '+39 3282345612', 'Milano', 'qr', array['seed-dev','turista']),
    (v_org_id, v_brand_stazione, 'Federico', 'Colombo', 'f.colombo@example.it', '+39 3153456723', null, 'Bologna', 'qr', array['seed-dev','turista']),
    (v_org_id, v_brand_stazione, 'Beatrice', 'Rinaldi', 'b.rinaldi@example.com', null, null, 'Chiesanuova', 'import', array['seed-dev','dormiente']);

  -- Officina (7) — tutti con veicolo
  insert into contacts (organization_id, brand_id, first_name, last_name, email, phone, whatsapp, address_city, source, tags)
  values
    (v_org_id, v_brand_officina, 'Antonio', 'Lombardi', 'a.lombardi@example.it', '+39 3484567834', null, 'Serravalle', 'gestionale', array['seed-dev','officina']),
    (v_org_id, v_brand_officina, 'Michela', 'Vitale', 'michela.v@example.com', '+39 3395678945', '+39 3395678945', 'Borgo Maggiore', 'gestionale', array['seed-dev','officina']),
    (v_org_id, v_brand_officina, 'Emanuele', 'Serra', null, '+39 3476789056', null, 'Falciano', 'manuale', array['seed-dev','officina']),
    (v_org_id, v_brand_officina, 'Cristina', 'Mancini', 'c.mancini@example.it', '+39 3407890167', null, 'Rimini', 'gestionale', array['seed-dev','officina']),
    (v_org_id, v_brand_officina, 'Nicola', 'Ferri', 'nicola.ferri@example.com', null, '+39 3338901278', 'Fiorentino', 'gestionale', array['seed-dev','officina']),
    (v_org_id, v_brand_officina, 'Ilaria', 'Palma', 'i.palma@example.it', '+39 3289012389', null, 'Domagnano', 'manuale', array['seed-dev','officina']),
    (v_org_id, v_brand_officina, 'Stefano', 'Testa', null, '+39 3150123490', '+39 3150123490', 'Serravalle', 'gestionale', array['seed-dev','officina']);

  -- Eni Cafè (7)
  insert into contacts (organization_id, brand_id, first_name, last_name, email, phone, whatsapp, address_city, source, tags)
  values
    (v_org_id, v_brand_enicafe, 'Francesca', 'Galli', 'f.galli@example.it', '+39 3480123456', '+39 3480123456', 'Serravalle', 'qr', array['seed-dev','abituale']),
    (v_org_id, v_brand_enicafe, 'Roberto', 'Conti', 'roberto.c@example.com', null, '+39 3391234501', 'Borgo Maggiore', 'gestionale', array['seed-dev','abituale']),
    (v_org_id, v_brand_enicafe, 'Chiara', 'Bruno', 'chiara.bruno@example.com', '+39 3472345612', null, 'Domagnano', 'qr', array['seed-dev']),
    (v_org_id, v_brand_enicafe, 'Andrea', 'De Luca', null, '+39 3403456723', '+39 3403456723', 'Serravalle', 'web', array['seed-dev','settimanale']),
    (v_org_id, v_brand_enicafe, 'Silvia', 'Longo', 's.longo@example.it', '+39 3334567834', null, 'Falciano', 'manuale', array['seed-dev']),
    (v_org_id, v_brand_enicafe, 'Matteo', 'Greco', 'matteo.greco@example.com', null, null, 'Serravalle', 'import', array['seed-dev','dormiente']),
    (v_org_id, v_brand_enicafe, 'Alessia', 'Santoro', 'a.santoro@example.it', '+39 3286789056', '+39 3286789056', 'Chiesanuova', 'qr', array['seed-dev']);

  -- Consensi: pattern realistico. IMPORTANTE: valuto random() UNA VOLTA per (contact, canale)
  -- via CTE, altrimenti status e granted_at usano random() indipendenti e violano il check
  -- constraint consent_status_timestamps_coherent (granted → granted_at not null).
  for v_contact_id in
    select id from contacts where organization_id = v_org_id and 'seed-dev' = any(tags)
  loop
    -- Email (90% granted se email presente)
    with pick as (
      select
        c.source,
        c.email is not null as has_channel,
        random() as r
      from contacts c where c.id = v_contact_id
    )
    insert into contact_consents (organization_id, contact_id, channel, status, granted_at, source, evidence_text)
    select
      v_org_id,
      v_contact_id,
      'email',
      case when pick.has_channel and pick.r < 0.9 then 'granted' else 'never' end,
      case when pick.has_channel and pick.r < 0.9 then now() - (random() * interval '90 days') else null end,
      pick.source,
      'Seed dev: iscritto via ' || pick.source
    from pick;

    -- SMS (40% granted se phone presente)
    with pick as (
      select
        c.source,
        c.phone is not null as has_channel,
        random() as r
      from contacts c where c.id = v_contact_id
    )
    insert into contact_consents (organization_id, contact_id, channel, status, granted_at, source, evidence_text)
    select
      v_org_id,
      v_contact_id,
      'sms',
      case when pick.has_channel and pick.r < 0.4 then 'granted' else 'never' end,
      case when pick.has_channel and pick.r < 0.4 then now() - (random() * interval '90 days') else null end,
      pick.source,
      'Seed dev: consenso SMS via ' || pick.source
    from pick;

    -- WhatsApp (25% granted se whatsapp presente)
    with pick as (
      select
        c.source,
        c.whatsapp is not null as has_channel,
        random() as r
      from contacts c where c.id = v_contact_id
    )
    insert into contact_consents (organization_id, contact_id, channel, status, granted_at, source, evidence_text)
    select
      v_org_id,
      v_contact_id,
      'whatsapp',
      case when pick.has_channel and pick.r < 0.25 then 'granted' else 'never' end,
      case when pick.has_channel and pick.r < 0.25 then now() - (random() * interval '90 days') else null end,
      pick.source,
      'Seed dev: consenso WhatsApp via ' || pick.source
    from pick;
  end loop;

  -- Veicoli: contatti officina + 40% dei residenti stazione
  insert into contact_vehicles (organization_id, contact_id, plate, model, year, kilometers, last_service_at, tire_type, notes)
  select
    v_org_id,
    c.id,
    upper(chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int)) ||
      lpad(floor(random()*1000)::text, 3, '0') ||
      upper(chr(65 + floor(random()*26)::int) || chr(65 + floor(random()*26)::int)),
    (array['Fiat Panda', 'VW Golf', 'Renault Clio', 'Ford Fiesta', 'Toyota Yaris', 'Peugeot 208', 'Fiat 500', 'Opel Corsa'])[1 + floor(random()*8)::int],
    2015 + floor(random()*10)::int,
    30000 + floor(random()*120000)::int,
    (current_date - (random() * 365)::int)::date,
    (array['estive', 'invernali', '4stagioni'])[1 + floor(random()*3)::int],
    'Seed dev'
  from contacts c
  where c.organization_id = v_org_id
    and 'seed-dev' = any(c.tags)
    and ('officina' = any(c.tags) or (c.brand_id = v_brand_stazione and random() < 0.4));

  raise notice '[seed-contacts] Inseriti 30 contatti + consensi + veicoli.';
end $$;
