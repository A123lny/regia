-- Seed dev M7: 3 segmenti + 2 campagne.
-- Idempotente: cancella e reinsersisce SOLO record con description='seed-dev' o notes='seed-dev'.

do $$
declare
  v_org_id uuid;
  v_brand_lenny uuid;
  v_brand_stazione uuid;
  v_brand_enicafe uuid;
  v_seg_abituali uuid;
  v_seg_dormienti uuid;
  v_seg_turisti uuid;
begin
  select id into v_org_id from organizations order by created_at asc limit 1;
  if v_org_id is null then
    raise notice '[seed-outreach] Nessuna organization, esco.'; return;
  end if;

  select id into v_brand_lenny from brands where organization_id = v_org_id and slug = 'lenny';
  select id into v_brand_stazione from brands where organization_id = v_org_id and slug = 'stazione';
  select id into v_brand_enicafe from brands where organization_id = v_org_id and slug = 'eni-cafe';

  -- Cleanup
  delete from campaigns where organization_id = v_org_id and notes = 'seed-dev';
  delete from contact_segments where organization_id = v_org_id and description = 'seed-dev';

  ------------------------------------------------------------------------------
  -- 3 segmenti
  ------------------------------------------------------------------------------
  if v_brand_lenny is not null then
    insert into contact_segments (organization_id, brand_id, name, description, criteria, is_active)
    values (
      v_org_id, v_brand_lenny, 'Abituali Lenny',
      'seed-dev',
      '{"lastOrderMaxDays": 30, "minOrderCount": 3, "requiredConsentChannel": "email"}'::jsonb,
      true
    )
    returning id into v_seg_abituali;
  end if;

  if v_brand_stazione is not null then
    insert into contact_segments (organization_id, brand_id, name, description, criteria, is_active)
    values (
      v_org_id, v_brand_stazione, 'Da riattivare Stazione',
      'seed-dev',
      '{"lastOrderMinDays": 60, "requiredTags": ["residente"]}'::jsonb,
      true
    )
    returning id into v_seg_dormienti;
  end if;

  if v_brand_enicafe is not null then
    insert into contact_segments (organization_id, brand_id, name, description, criteria, is_active)
    values (
      v_org_id, v_brand_enicafe, 'Turisti Eni Cafè con WhatsApp',
      'seed-dev',
      '{"requiredTags": ["turista"], "requiredConsentChannel": "whatsapp"}'::jsonb,
      true
    )
    returning id into v_seg_turisti;
  end if;

  ------------------------------------------------------------------------------
  -- 2 campagne draft
  ------------------------------------------------------------------------------
  if v_brand_lenny is not null and v_seg_abituali is not null then
    insert into campaigns (
      organization_id, brand_id, segment_id, name, channel, status, planned_at, notes
    )
    values (
      v_org_id, v_brand_lenny, v_seg_abituali,
      'Promo abituali Novembre',
      'email',
      'scheduled',
      now() + interval '5 days',
      'seed-dev'
    );
  end if;

  if v_brand_stazione is not null and v_seg_dormienti is not null then
    insert into campaigns (
      organization_id, brand_id, segment_id, name, channel, status, notes
    )
    values (
      v_org_id, v_brand_stazione, v_seg_dormienti,
      'Riattivazione dormienti',
      'misto',
      'draft',
      'seed-dev'
    );
  end if;

  raise notice '[seed-outreach] Inseriti 3 segmenti + 2 campagne.';
end $$;
