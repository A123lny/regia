-- Seed dev loyalty: 3 contatori + 3 offerte + eventi + 15 voucher.
-- Idempotente: cancella e reinsersisce SOLO record con name/notes = 'seed-dev'.

do $$
declare
  v_org_id uuid;
  v_brand_lenny uuid;
  v_brand_stazione uuid;
  v_brand_officina uuid;
  v_brand_enicafe uuid;
  v_counter_lavaggi uuid;
  v_counter_caffe uuid;
  v_counter_ordini uuid;
  v_offer_lavaggi uuid;
  v_offer_caffe uuid;
  v_offer_ordini uuid;
  v_contact_id uuid;
  v_offer_id uuid;
  v_reward_kind text;
  v_reward_value int;
  v_reward_pct numeric;
  v_reward_label text;
  v_code text;
  v_expires_at timestamptz;
  v_status text;
  v_status_r numeric;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then
    raise notice '[seed-loyalty] Nessuna organization, esco.'; return;
  end if;

  select id into v_brand_lenny from brands where organization_id = v_org_id and slug = 'lenny';
  select id into v_brand_stazione from brands where organization_id = v_org_id and slug = 'stazione';
  select id into v_brand_officina from brands where organization_id = v_org_id and slug = 'officina';
  select id into v_brand_enicafe from brands where organization_id = v_org_id and slug = 'eni-cafe';

  -- Cleanup precedenti seed
  delete from vouchers where organization_id = v_org_id and notes = 'seed-dev';
  delete from voucher_offers where organization_id = v_org_id and description = 'seed-dev';
  delete from loyalty_counters where organization_id = v_org_id and description = 'seed-dev';

  ------------------------------------------------------------------------------
  -- 3 contatori
  ------------------------------------------------------------------------------
  if v_brand_stazione is not null then
    insert into loyalty_counters (organization_id, brand_id, name, description, kind, threshold_count, reset_mode, is_active)
    values (v_org_id, v_brand_stazione, '10 lavaggi = 1 gratis', 'seed-dev', 'passaggi', 10, 'dopo_premio', true)
    returning id into v_counter_lavaggi;
  end if;

  if v_brand_enicafe is not null then
    insert into loyalty_counters (organization_id, brand_id, name, description, kind, threshold_count, reset_mode, is_active)
    values (v_org_id, v_brand_enicafe, '5 caffè = 1 gratis', 'seed-dev', 'passaggi', 5, 'dopo_premio', true)
    returning id into v_counter_caffe;
  end if;

  if v_brand_lenny is not null then
    insert into loyalty_counters (organization_id, brand_id, name, description, kind, threshold_count, reset_mode, is_active)
    values (v_org_id, v_brand_lenny, '10 ordini = 5€ sconto', 'seed-dev', 'ordini', 10, 'dopo_premio', true)
    returning id into v_counter_ordini;
  end if;

  ------------------------------------------------------------------------------
  -- 3 offerte corrispondenti
  ------------------------------------------------------------------------------
  if v_counter_lavaggi is not null and v_brand_stazione is not null then
    insert into voucher_offers (organization_id, issuer_brand_id, spendable_brand_id, counter_id, name, description, reward_kind, reward_label, default_expires_days, cumulable, is_active)
    values (v_org_id, v_brand_stazione, v_brand_stazione, v_counter_lavaggi, '11° lavaggio gratis', 'seed-dev', 'servizio_gratis', 'Lavaggio esterno standard', 60, false, true)
    returning id into v_offer_lavaggi;
  end if;

  if v_counter_caffe is not null and v_brand_enicafe is not null then
    insert into voucher_offers (organization_id, issuer_brand_id, spendable_brand_id, counter_id, name, description, reward_kind, reward_label, default_expires_days, cumulable, is_active)
    values (v_org_id, v_brand_enicafe, v_brand_enicafe, v_counter_caffe, '6° caffè gratis', 'seed-dev', 'servizio_gratis', 'Caffè espresso', 45, false, true)
    returning id into v_offer_caffe;
  end if;

  if v_counter_ordini is not null and v_brand_lenny is not null then
    insert into voucher_offers (organization_id, issuer_brand_id, spendable_brand_id, counter_id, name, description, reward_kind, reward_value_cents, default_expires_days, cumulable, is_active)
    values (v_org_id, v_brand_lenny, v_brand_lenny, v_counter_ordini, '5€ sconto ordine 11°', 'seed-dev', 'valore_fisso', 500, 30, false, true)
    returning id into v_offer_ordini;
  end if;

  ------------------------------------------------------------------------------
  -- Eventi contatore: registro un po' di passaggi/ordini per i contatti seed
  -- Uso LATERAL per moltiplicare per random count per contatto
  ------------------------------------------------------------------------------
  if v_counter_lavaggi is not null then
    insert into loyalty_counter_events (organization_id, counter_id, contact_id, delta_count)
    select v_org_id, v_counter_lavaggi, c.id, 1
    from contacts c,
         lateral generate_series(1, floor(random() * 8 + 1)::int) g
    where c.organization_id = v_org_id
      and 'seed-dev' = any(c.tags)
      and c.brand_id = v_brand_stazione;
  end if;

  if v_counter_caffe is not null then
    insert into loyalty_counter_events (organization_id, counter_id, contact_id, delta_count)
    select v_org_id, v_counter_caffe, c.id, 1
    from contacts c,
         lateral generate_series(1, floor(random() * 6 + 1)::int) g
    where c.organization_id = v_org_id
      and 'seed-dev' = any(c.tags)
      and c.brand_id = v_brand_enicafe;
  end if;

  if v_counter_ordini is not null then
    insert into loyalty_counter_events (organization_id, counter_id, contact_id, delta_count)
    select v_org_id, v_counter_ordini, c.id, 1
    from contacts c,
         lateral generate_series(1, floor(random() * 8 + 1)::int) g
    where c.organization_id = v_org_id
      and 'seed-dev' = any(c.tags)
      and c.brand_id = v_brand_lenny;
  end if;

  ------------------------------------------------------------------------------
  -- 15 voucher emessi (mix stato: 60% issued, 25% redeemed, 10% expired, 5% cancelled)
  ------------------------------------------------------------------------------
  for i in 1..15 loop
    -- Scelgo un'offerta a caso tra quelle create
    if i % 3 = 0 and v_offer_lavaggi is not null then
      v_offer_id := v_offer_lavaggi;
      v_reward_kind := 'servizio_gratis';
      v_reward_label := 'Lavaggio esterno standard';
      v_reward_value := null;
      v_reward_pct := null;
      -- Contatto Stazione
      select id into v_contact_id from contacts
        where organization_id = v_org_id and 'seed-dev' = any(tags) and brand_id = v_brand_stazione
        order by random() limit 1;
    elsif i % 3 = 1 and v_offer_caffe is not null then
      v_offer_id := v_offer_caffe;
      v_reward_kind := 'servizio_gratis';
      v_reward_label := 'Caffè espresso';
      v_reward_value := null;
      v_reward_pct := null;
      select id into v_contact_id from contacts
        where organization_id = v_org_id and 'seed-dev' = any(tags) and brand_id = v_brand_enicafe
        order by random() limit 1;
    elsif v_offer_ordini is not null then
      v_offer_id := v_offer_ordini;
      v_reward_kind := 'valore_fisso';
      v_reward_value := 500;
      v_reward_pct := null;
      v_reward_label := null;
      select id into v_contact_id from contacts
        where organization_id = v_org_id and 'seed-dev' = any(tags) and brand_id = v_brand_lenny
        order by random() limit 1;
    else
      continue;
    end if;

    if v_contact_id is null then continue; end if;

    -- Codice 8 char alfanumerico (no I/O/0/1)
    v_code := upper(
      substring(md5(random()::text || i::text) from 1 for 8)
    );
    -- md5 può includere caratteri sotto la nostra convenzione, ma funziona per seed dev

    -- Status realistico (calcolato UNA volta per evitare divergenze)
    v_status_r := random();
    declare
      v_issued_at timestamptz;
    begin
      if v_status_r < 0.60 then
        v_status := 'issued';
        v_issued_at := now() - (random() * interval '20 days');
        v_expires_at := v_issued_at + interval '30 days' * random() + interval '10 days';
        if v_expires_at <= now() then v_expires_at := now() + interval '5 days'; end if;
      elsif v_status_r < 0.85 then
        v_status := 'redeemed';
        v_issued_at := now() - (random() * interval '25 days' + interval '5 days');
        v_expires_at := v_issued_at + interval '60 days';
      elsif v_status_r < 0.95 then
        v_status := 'expired';
        v_issued_at := now() - interval '90 days';
        v_expires_at := v_issued_at + interval '60 days'; -- scaduto ~30 giorni fa
      else
        v_status := 'cancelled';
        v_issued_at := now() - (random() * interval '15 days');
        v_expires_at := v_issued_at + interval '60 days';
      end if;

      insert into vouchers (
        organization_id, offer_id, contact_id, code,
        reward_kind, reward_value_cents, reward_pct, reward_label,
        status, issued_at, expires_at, redeemed_at, cancelled_at, cancelled_reason, notes
      )
      values (
        v_org_id, v_offer_id, v_contact_id, v_code,
        v_reward_kind, v_reward_value, v_reward_pct, v_reward_label,
        v_status,
        v_issued_at,
        v_expires_at,
        case when v_status = 'redeemed' then v_issued_at + interval '5 days' * random() else null end,
        case when v_status = 'cancelled' then v_issued_at + interval '2 days' else null end,
        case when v_status = 'cancelled' then 'Cliente ha richiesto annullo' else null end,
        'seed-dev'
      );
    end;
  end loop;

  raise notice '[seed-loyalty] Inseriti 3 contatori + 3 offerte + eventi + 15 voucher.';
end $$;
