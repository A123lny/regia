-- Seed dev: catalogo prodotti + storico prezzi + ordini + righe.
-- Idempotente: cancella e reinsersisce SOLO record con notes = 'seed-dev'.
-- Prerequisito: brands esistono + contatti seed-dev caricati (per FK contact_id).

do $$
declare
  v_org_id uuid;
  v_brand_lenny uuid;
  v_brand_stazione uuid;
  v_brand_officina uuid;
  v_brand_enicafe uuid;
  v_product_id uuid;
  v_order_id uuid;
  v_contact_id uuid;
  v_brand_id uuid;
  v_channel text;
  v_first_price int;
  v_new_price int;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then
    raise notice '[seed-catalog] Nessuna organization presente, esco.';
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

  -- Cleanup: cancella prodotti seed (cascade → prezzi; ordini seed cancellati sotto)
  delete from brand_products where organization_id = v_org_id and notes = 'seed-dev';
  delete from brand_orders where organization_id = v_org_id and notes = 'seed-dev';

  ------------------------------------------------------------------------------
  -- LENNY (5 prodotti: cibo delivery)
  ------------------------------------------------------------------------------
  if v_brand_lenny is not null then
    insert into brand_products (organization_id, brand_id, sku, name, category, unit, price_current_cents, cost_current_cents, min_margin_pct, source, notes)
    values
      (v_org_id, v_brand_lenny, 'LNY-PIZZA-MARG', 'Pizza margherita', 'Pizza', 'pezzo', 850, 300, 30, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_lenny, 'LNY-PIZZA-DIAV', 'Pizza diavola', 'Pizza', 'pezzo', 1050, 400, 30, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_lenny, 'LNY-BURGER-CL', 'Burger classico', 'Burger', 'pezzo', 1200, 500, 35, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_lenny, 'LNY-INSAL-CES', 'Insalata Caesar', 'Insalate', 'pezzo', 950, 400, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_lenny, 'LNY-CONS-STD', 'Consegna standard', 'Servizio', 'servizio', 300, 250, null, 'manuale', 'seed-dev');
  end if;

  ------------------------------------------------------------------------------
  -- STAZIONE (5 prodotti: carburante + accessori)
  ------------------------------------------------------------------------------
  if v_brand_stazione is not null then
    insert into brand_products (organization_id, brand_id, sku, name, category, unit, price_current_cents, cost_current_cents, min_margin_pct, source, notes)
    values
      (v_org_id, v_brand_stazione, 'STZ-BENZ-95', 'Benzina 95', 'Carburante', 'litro', 189, 175, 3, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_stazione, 'STZ-DIESEL', 'Diesel', 'Carburante', 'litro', 179, 165, 3, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_stazione, 'STZ-GPL', 'GPL', 'Carburante', 'litro', 89, 78, 5, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_stazione, 'STZ-LAVAGGIO', 'Lavaggio esterno standard', 'Lavaggio', 'servizio', 800, 200, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_stazione, 'STZ-ARIA', 'Aria compressa', 'Servizio', 'servizio', 100, 20, null, 'manuale', 'seed-dev');
  end if;

  ------------------------------------------------------------------------------
  -- OFFICINA (5 servizi)
  ------------------------------------------------------------------------------
  if v_brand_officina is not null then
    insert into brand_products (organization_id, brand_id, sku, name, category, unit, price_current_cents, cost_current_cents, min_margin_pct, source, notes)
    values
      (v_org_id, v_brand_officina, 'OFF-TAGLIANDO', 'Tagliando standard', 'Manutenzione', 'servizio', 12000, 5000, 25, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_officina, 'OFF-CAMBIO-OLIO', 'Cambio olio motore', 'Manutenzione', 'servizio', 4500, 1800, 30, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_officina, 'OFF-CAMBIO-GOMME', 'Cambio gomme stagionale', 'Gomme', 'servizio', 3000, 800, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_officina, 'OFF-REVISIONE', 'Revisione ministeriale', 'Revisione', 'servizio', 6800, 4500, 15, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_officina, 'OFF-CONTROLLO', 'Controllo pre-viaggio gratuito', 'Manutenzione', 'servizio', 0, 0, null, 'manuale', 'seed-dev');
  end if;

  ------------------------------------------------------------------------------
  -- ENI CAFÈ (5 prodotti: bar)
  ------------------------------------------------------------------------------
  if v_brand_enicafe is not null then
    insert into brand_products (organization_id, brand_id, sku, name, category, unit, price_current_cents, cost_current_cents, min_margin_pct, source, notes)
    values
      (v_org_id, v_brand_enicafe, 'CAFE-ESPR', 'Caffè espresso', 'Caffetteria', 'pezzo', 110, 30, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_enicafe, 'CAFE-CAPP', 'Cappuccino', 'Caffetteria', 'pezzo', 150, 45, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_enicafe, 'CAFE-BRIOCHE', 'Brioche vuota', 'Colazione', 'pezzo', 120, 40, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_enicafe, 'CAFE-COMBO', 'Colazione (caffè + brioche)', 'Colazione', 'pezzo', 250, 75, 40, 'manuale', 'seed-dev'),
      (v_org_id, v_brand_enicafe, 'CAFE-ACQUA', 'Acqua naturale 50cl', 'Bevande', 'pezzo', 100, 30, 30, 'manuale', 'seed-dev');
  end if;

  ------------------------------------------------------------------------------
  -- STORICO PREZZI: uno snapshot precedente per ogni prodotto (~20% differenza)
  -- Simula un cambio prezzo avvenuto 30-90 giorni fa
  ------------------------------------------------------------------------------
  for v_product_id, v_new_price in
    select id, price_current_cents from brand_products
    where organization_id = v_org_id and notes = 'seed-dev' and price_current_cents is not null and price_current_cents > 0
  loop
    -- Prima registro il vecchio prezzo (chiuso)
    v_first_price := round(v_new_price * (0.85 + random() * 0.15))::int; -- 85-100% del nuovo
    insert into brand_product_prices (organization_id, product_id, price_cents, cost_cents, valid_from, valid_to, note)
    values (
      v_org_id,
      v_product_id,
      v_first_price,
      round(v_first_price * 0.7)::int,
      now() - (interval '90 days'),
      now() - (interval '30 days' * random() + interval '15 days'),
      'Seed dev: prezzo storico'
    );

    -- Poi il prezzo attuale (aperto). max(valid_to) dello storico chiuso = valid_from del corrente.
    insert into brand_product_prices (organization_id, product_id, price_cents, cost_cents, valid_from, valid_to, note)
    select
      v_org_id,
      v_product_id,
      v_new_price,
      p.cost_current_cents,
      (select max(valid_to) from brand_product_prices where product_id = v_product_id),
      null,
      'Seed dev: prezzo attuale'
    from brand_products p
    where p.id = v_product_id;
  end loop;

  ------------------------------------------------------------------------------
  -- ORDINI: ~40 ordini fittizi ripartiti sui 4 brand, alcuni con contatto, altri ospite
  ------------------------------------------------------------------------------
  declare
    v_status text;
    v_placed_at timestamptz;
    v_status_r numeric;
  begin
  for i in 1..40 loop
    -- Brand + canale (pesati)
    if i % 4 = 0 then
      v_brand_id := coalesce(v_brand_officina, v_brand_lenny);
      v_channel := 'officina';
    elsif i % 4 = 1 then
      v_brand_id := coalesce(v_brand_lenny, v_brand_stazione);
      v_channel := case when random() < 0.7 then 'delivery' else 'pickup' end;
    elsif i % 4 = 2 then
      v_brand_id := coalesce(v_brand_stazione, v_brand_lenny);
      v_channel := case when random() < 0.6 then 'carburante' else 'store' end;
    else
      v_brand_id := coalesce(v_brand_enicafe, v_brand_stazione);
      v_channel := 'store';
    end if;

    -- Contatto o ospite
    if random() < 0.6 then
      select id into v_contact_id from contacts
        where organization_id = v_org_id and 'seed-dev' = any(tags) and brand_id = v_brand_id
        order by random() limit 1;
    else
      v_contact_id := null;
    end if;

    -- Status: calcolato UNA VOLTA per garantire coerenza con completed_at
    v_status_r := random();
    if v_status_r < 0.80 then
      v_status := 'completed';
    elsif v_status_r < 0.92 then
      v_status := 'pending';
    elsif v_status_r < 0.97 then
      v_status := 'cancelled';
    else
      v_status := 'refunded';
    end if;

    v_placed_at := now() - (random() * interval '60 days');

    insert into brand_orders (organization_id, brand_id, contact_id, channel, status, placed_at, completed_at, notes)
    values (
      v_org_id,
      v_brand_id,
      v_contact_id,
      v_channel,
      v_status,
      v_placed_at,
      case
        when v_status in ('completed','refunded') then v_placed_at + interval '2 hours'
        else null
      end,
      'seed-dev'
    )
    returning id into v_order_id;

    -- 1-3 righe per ordine, prodotti dello stesso brand
    insert into brand_order_lines (order_id, product_id, name_snapshot, unit_price_cents, quantity, line_total_cents)
    select
      v_order_id,
      p.id,
      p.name,
      coalesce(p.price_current_cents, 500),
      (1 + floor(random() * 3))::numeric,
      coalesce(p.price_current_cents, 500) * (1 + floor(random() * 3))::int
    from brand_products p
    where p.organization_id = v_org_id
      and p.brand_id = v_brand_id
      and p.notes = 'seed-dev'
    order by random()
    limit 1 + floor(random() * 3)::int;
  end loop;
  end;

  raise notice '[seed-catalog] Inseriti 20 prodotti + storico + 40 ordini.';
end $$;
