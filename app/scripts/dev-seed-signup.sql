-- Seed dev M10: 2 landing + 5 eventi signup.
-- Idempotente su slug per landing e su source_hint='qr' con landing seed per eventi.

do $$
declare
  v_org_id uuid;
  v_brand_stazione uuid;
  v_brand_lenny uuid;
  v_brand_enicafe uuid;
  v_offer_caffe uuid;
  v_offer_lenny uuid;
  v_landing_stazione uuid;
  v_landing_lenny uuid;
  v_contact_id uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then return; end if;

  select id into v_brand_stazione from brands where organization_id = v_org_id and slug = 'stazione';
  select id into v_brand_lenny from brands where organization_id = v_org_id and slug = 'lenny';
  select id into v_brand_enicafe from brands where organization_id = v_org_id and slug = 'eni-cafe';

  select id into v_offer_caffe from voucher_offers
    where organization_id = v_org_id and description = 'seed-dev' and issuer_brand_id = v_brand_enicafe
    limit 1;
  select id into v_offer_lenny from voucher_offers
    where organization_id = v_org_id and description = 'seed-dev' and issuer_brand_id = v_brand_lenny
    limit 1;

  -- Cleanup
  delete from signup_landings
    where organization_id = v_org_id
    and slug in ('bar-eni-cafe','prima-spesa-lenny');

  ------------------------------------------------------------------------------
  -- 2 landing pubbliche
  ------------------------------------------------------------------------------
  insert into signup_landings (
    organization_id, brand_id, slug, headline, subheadline, benefit_headline,
    audience_prompt, audience_residente_label, audience_turista_label,
    welcome_offer_id, is_active
  )
  values (
    v_org_id, coalesce(v_brand_enicafe, v_brand_stazione),
    'bar-eni-cafe',
    'Iscriviti al bar Eni Cafè',
    'Ricevi il tuo codice sconto al prossimo caffè. QR presso il bancone e la colonnina.',
    'Un caffè omaggio al prossimo pieno',
    'Sei residente o di passaggio?',
    'Residente / pendolare',
    'Di passaggio (turista)',
    v_offer_caffe,
    true
  )
  returning id into v_landing_stazione;

  insert into signup_landings (
    organization_id, brand_id, slug, headline, subheadline, benefit_headline,
    audience_prompt, welcome_offer_id, is_active
  )
  values (
    v_org_id, coalesce(v_brand_lenny, v_brand_stazione),
    'prima-spesa-lenny',
    'La spesa a domicilio, senza pensieri',
    'Iscriviti e ricevi 5€ di sconto sulla prima consegna sopra i 20€.',
    '5€ sulla prima spesa sopra 20€',
    null,
    v_offer_lenny,
    true
  )
  returning id into v_landing_lenny;

  ------------------------------------------------------------------------------
  -- 5 eventi signup fittizi collegati a contatti seed esistenti
  ------------------------------------------------------------------------------
  -- Prendo 5 contatti seed a caso di stazione + eni-cafe + lenny
  for v_contact_id in
    select id from contacts
    where organization_id = v_org_id and 'seed-dev' = any(tags)
    order by random()
    limit 5
  loop
    insert into signup_events (
      organization_id, landing_id, contact_id, audience_kind, channels_granted, source_hint, occurred_at
    ) values (
      v_org_id,
      case when random() < 0.5 then v_landing_stazione else v_landing_lenny end,
      v_contact_id,
      (array['residente','pendolare','turista','altro'])[1 + floor(random() * 4)::int],
      case when random() < 0.5 then array['email','sms']::text[] else array['email']::text[] end,
      'qr',
      now() - (random() * interval '10 days')
    );
  end loop;

  raise notice '[seed-signup] Inseriti 2 landing + 5 eventi.';
end $$;
