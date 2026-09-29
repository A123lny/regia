-- Seed dev M7 Partners: 8 ristoranti fittizi Lenny + attività storiche.
-- Idempotente: cancella e reinsersisce SOLO record con notes='seed-dev'.

do $$
declare
  v_org_id uuid;
  v_brand_lenny uuid;
  v_partner_id uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then
    raise notice '[seed-partners] Nessuna organization, esco.'; return;
  end if;

  select id into v_brand_lenny from brands where organization_id = v_org_id and slug = 'lenny';
  if v_brand_lenny is null then
    raise notice '[seed-partners] Brand lenny non trovato, esco.'; return;
  end if;

  -- Cleanup (cascade cancella activities)
  delete from partner_restaurants where organization_id = v_org_id and notes = 'seed-dev';

  ------------------------------------------------------------------------------
  -- 8 ristoranti
  ------------------------------------------------------------------------------
  insert into partner_restaurants (
    organization_id, brand_id, name, referent_name, phone, email,
    address_city, cuisine_category, avg_prep_minutes,
    onboarding_status, cooling_flag, cooling_reason, notes
  ) values
    (v_org_id, v_brand_lenny, 'Pizzeria Da Mario', 'Mario Bianchi', '+39 0549 111111', 'mario@damario.sm',
     'Borgo Maggiore', 'Pizza', 22, 'attivo', false, null, 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Sushi Wave', 'Yuki Tanaka', '+39 0549 222222', 'info@sushiwave.sm',
     'Serravalle', 'Sushi', 30, 'attivo', false, null, 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Trattoria del Titano', 'Giovanna Rossi', '+39 0549 333333', null,
     'Domagnano', 'Italiana', 35, 'attivo', true, 'Ordini in calo del 30% ultime 3 settimane, referente lamenta prezzi troppo bassi in cambio', 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Burger Zone', 'Luca Verdi', '+39 0549 444444', 'lucav@burgerzone.sm',
     'Chiesanuova', 'Burger', 18, 'attivo', false, null, 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Kebab Express', 'Ahmed Hassan', '+39 0549 555555', null,
     'Serravalle', 'Kebab', 12, 'attivo', false, null, 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Ristorante La Piazza', 'Sofia Marino', '+39 0549 666666', 's.marino@lapiazza.sm',
     'Città', 'Italiana', 45, 'sospeso', false, null, 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Pokè House', 'Elena Ferrari', '+39 0549 777777', 'elena@pokehouse.sm',
     'Borgo Maggiore', 'Pokè', 20, 'mai_partito', false, null, 'seed-dev'),
    (v_org_id, v_brand_lenny, 'Osteria del Vecchio', 'Antonio Costa', '+39 0549 888888', null,
     'Fiorentino', 'Italiana', 50, 'mai_partito', false, null, 'seed-dev');

  ------------------------------------------------------------------------------
  -- Attività storiche per alcuni partner
  ------------------------------------------------------------------------------
  -- Pizzeria Da Mario: 3 chiamate positive
  select id into v_partner_id from partner_restaurants
    where organization_id = v_org_id and name = 'Pizzeria Da Mario';
  if v_partner_id is not null then
    insert into partner_activities (organization_id, partner_id, kind, outcome, summary, occurred_at) values
      (v_org_id, v_partner_id, 'chiamata', 'positivo', 'Ordini in aumento del 15% mese scorso. Referente contento, chiede se possiamo pubblicizzare pizza speciale del venerdì.', now() - interval '5 days'),
      (v_org_id, v_partner_id, 'follow_up', 'positivo', 'Concordato invio foto pizza speciale per contenuto Instagram Lenny.', now() - interval '20 days'),
      (v_org_id, v_partner_id, 'onboarding', 'positivo', 'Onboarding completato, prime settimane senza problemi.', now() - interval '90 days');
  end if;

  -- Sushi Wave: 2 attività
  select id into v_partner_id from partner_restaurants
    where organization_id = v_org_id and name = 'Sushi Wave';
  if v_partner_id is not null then
    insert into partner_activities (organization_id, partner_id, kind, outcome, summary, occurred_at) values
      (v_org_id, v_partner_id, 'incontro', 'positivo', 'Visita in loco. Cucina pulita, referente professionale. Chiede supporto foto piatti.', now() - interval '10 days'),
      (v_org_id, v_partner_id, 'onboarding', 'positivo', 'Onboarding con demo tablet ordini, tutto ok.', now() - interval '60 days');
  end if;

  -- Trattoria del Titano (COOLING): attività negative recenti
  select id into v_partner_id from partner_restaurants
    where organization_id = v_org_id and name = 'Trattoria del Titano';
  if v_partner_id is not null then
    insert into partner_activities (organization_id, partner_id, kind, outcome, summary, occurred_at) values
      (v_org_id, v_partner_id, 'chiamata', 'negativo', 'Referente lamenta commissioni troppo alte, minaccia di lasciare Lenny. Da rivedere accordo entro fine mese.', now() - interval '3 days'),
      (v_org_id, v_partner_id, 'segnalazione', 'da_richiamare', 'Cliente ha segnalato ritardo 40 min. Referente non ha risposto in chat.', now() - interval '12 days'),
      (v_org_id, v_partner_id, 'chiamata', 'neutro', 'Verifica volumi ordini. Referente ha ammesso difficoltà con nuovo menu.', now() - interval '25 days');
  end if;

  -- Burger Zone: 1 attività recente
  select id into v_partner_id from partner_restaurants
    where organization_id = v_org_id and name = 'Burger Zone';
  if v_partner_id is not null then
    insert into partner_activities (organization_id, partner_id, kind, outcome, summary, occurred_at) values
      (v_org_id, v_partner_id, 'whatsapp', 'positivo', 'Confermato aumento capacità venerdì sera per weekend San Marino.', now() - interval '2 days');
  end if;

  -- Ristorante La Piazza (SOSPESO): ultima attività di sospensione
  select id into v_partner_id from partner_restaurants
    where organization_id = v_org_id and name = 'Ristorante La Piazza';
  if v_partner_id is not null then
    insert into partner_activities (organization_id, partner_id, kind, outcome, summary, occurred_at) values
      (v_org_id, v_partner_id, 'chiamata', 'neutro', 'Referente chiede sospensione temporanea per ristrutturazione (3 mesi).', now() - interval '15 days');
  end if;

  -- Pokè House (MAI_PARTITO): follow-up pending
  select id into v_partner_id from partner_restaurants
    where organization_id = v_org_id and name = 'Pokè House';
  if v_partner_id is not null then
    insert into partner_activities (organization_id, partner_id, kind, outcome, summary, occurred_at) values
      (v_org_id, v_partner_id, 'chiamata', 'da_richiamare', 'Prima chiamata: interessata ma vuole vedere condizioni economiche. Da inviare proposta.', now() - interval '35 days');
  end if;

  raise notice '[seed-partners] Inseriti 8 ristoranti + attività storiche.';
end $$;
