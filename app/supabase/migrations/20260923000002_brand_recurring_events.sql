-- 20260923000002_brand_recurring_events.sql
-- RF-3.4: calendario ricorrenze annuali per marchio.
-- Eventi che tornano ogni anno pressoché identici (Natale, Ferragosto, orari estivi,
-- cambio gomme officina, chiusure ferie). Il sistema li sorveglia e alla data giusta
-- (today + lead_time_days) propone in dashboard di generare la bozza dedicata.
-- Idempotente: IF NOT EXISTS.

create table if not exists public.brand_recurring_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  kind text not null,
  month_of_year int not null,
  day_of_month int not null,
  lead_time_days int not null default 14,
  suggested_theme text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_kind_check check (kind in ('holiday', 'seasonal', 'business')),
  constraint recurring_month_check check (month_of_year between 1 and 12),
  constraint recurring_day_check check (day_of_month between 1 and 31),
  constraint recurring_lead_check check (lead_time_days between 0 and 90),
  constraint recurring_unique_per_brand unique (brand_id, name, month_of_year, day_of_month)
);

create index if not exists recurring_brand_active_idx
  on public.brand_recurring_events (brand_id, month_of_year, day_of_month)
  where is_active = true;

comment on table public.brand_recurring_events is
  'Ricorrenze annuali per marchio (RF-3.4). Il sistema propone di generare la bozza a today+lead_time.';

-- Per tracciare quali ricorrenze sono gia state "attivate" (draft generato) nell'anno corrente,
-- riusiamo content_drafts.theme_input con prefisso [RICORRENZA:<slug>:<anno>] per matcharle.
-- Nessuna nuova colonna richiesta.

-- Seed iniziale ricorrenze base per i 4 marchi seed dell'org demo.
-- Nota: il seed usa un DO block per lookup brand_id via slug + on conflict do nothing (idempotente).
do $$
declare
  v_org_id uuid := '00000000-0000-0000-0000-000000000001';
  v_lenny_id uuid;
  v_stazione_id uuid;
  v_eni_id uuid;
  v_officina_id uuid;
begin
  select id into v_lenny_id from public.brands where slug = 'lenny' and organization_id = v_org_id;
  select id into v_stazione_id from public.brands where slug = 'stazione' and organization_id = v_org_id;
  select id into v_eni_id from public.brands where slug = 'eni-cafe' and organization_id = v_org_id;
  select id into v_officina_id from public.brands where slug = 'officina' and organization_id = v_org_id;

  -- Ricorrenze trasversali (tutti i marchi): Natale, Capodanno, Ferragosto, Pasqua (data mobile → gestione manuale)
  if v_lenny_id is not null then
    insert into public.brand_recurring_events (organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme)
    values
      (v_org_id, v_lenny_id, 'Auguri di Natale', 'holiday', 12, 25, 21, 'Auguri Natale a clienti Lenny — tono caldo, richiamo alla convivialita della tavola'),
      (v_org_id, v_lenny_id, 'Chiusura Ferragosto', 'holiday', 8, 15, 21, 'Comunicazione chiusura Ferragosto: date esatte di chiusura e ripresa consegne'),
      (v_org_id, v_lenny_id, 'Buon Anno Nuovo', 'holiday', 12, 31, 14, 'Auguri fine anno + anteprima novita menu gennaio')
    on conflict do nothing;
  end if;

  if v_stazione_id is not null then
    insert into public.brand_recurring_events (organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme)
    values
      (v_org_id, v_stazione_id, 'Auguri di Natale', 'holiday', 12, 25, 21, 'Auguri Natale ai clienti abituali stazione — tono affidabile e locale'),
      (v_org_id, v_stazione_id, 'Rientro settembre — orari pieni', 'seasonal', 9, 1, 14, 'Fine estate: ripresa orari pieni, promemoria controlli auto post-vacanze'),
      (v_org_id, v_stazione_id, 'Cambio gomme invernali', 'business', 11, 15, 30, 'Promemoria obbligo gomme invernali 15 novembre — prenotazione officina attiva')
    on conflict do nothing;
  end if;

  if v_eni_id is not null then
    insert into public.brand_recurring_events (organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme)
    values
      (v_org_id, v_eni_id, 'Auguri di Natale', 'holiday', 12, 25, 21, 'Auguri Natale bar — tono conviviale, invito colazione festiva'),
      (v_org_id, v_eni_id, 'Colazione estiva', 'seasonal', 6, 1, 14, 'Menu bar estivo: granite, spremute, caffe shakerato — inizio giugno')
    on conflict do nothing;
  end if;

  if v_officina_id is not null then
    insert into public.brand_recurring_events (organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme)
    values
      (v_org_id, v_officina_id, 'Cambio gomme invernali', 'business', 10, 15, 30, 'Promemoria cambio gomme invernali — apertura prenotazioni ottobre'),
      (v_org_id, v_officina_id, 'Cambio gomme estive', 'business', 4, 1, 21, 'Cambio gomme estive dopo il 15 aprile — prenotazioni aperte'),
      (v_org_id, v_officina_id, 'Check-up pre-vacanze', 'seasonal', 7, 1, 14, 'Check-up auto pre-vacanze estive — luglio, promo tagliando')
    on conflict do nothing;
  end if;
end $$;
