-- M13 Governance — §8.2 categorie mai autonome + RF-6.15..6.20 vincoli commerciali.
-- Ogni regola documentata in DB con `level` modificabile e flag `enforced_in_code`
-- che indica se il codice applica la guardia (true) o è solo documentazione (false).

-- ============================================================================
-- 1. brand_products: flag "sconto vietato" — RF-6.15/6.17 (carburante, tariffa)
-- ============================================================================

alter table brand_products
  add column if not exists discount_forbidden boolean not null default false;
alter table brand_products
  add column if not exists discount_forbidden_reason text;

-- Se discount_forbidden=true → reason deve esserci
alter table brand_products
  drop constraint if exists products_discount_needs_reason;
alter table brand_products
  add constraint products_discount_needs_reason
  check (
    (discount_forbidden = false) or
    (discount_forbidden = true and discount_forbidden_reason is not null and length(trim(discount_forbidden_reason)) > 0)
  );

create index if not exists idx_products_discount_forbidden
  on brand_products(organization_id, brand_id)
  where discount_forbidden = true;

-- ============================================================================
-- 2. autonomy_rules — registro §8.2 + RF-6.15..6.20
-- ============================================================================
-- level:
--   'never'         → l'agente AI non può MAI agire autonomamente (§8.2 categorie mai autonome)
--   'human_review'  → può proporre ma serve approvazione umana esplicita
--   'auto'          → può agire in autonomia (con audit log)
-- enforced_in_code: true = una guardia applicativa impedisce la violazione;
--                   false = documentata ma dipende dalla disciplina operativa.

create table if not exists autonomy_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  kind text not null,
  title text not null,
  description text not null,
  level text not null check (level in ('never', 'human_review', 'auto')),
  enforced_in_code boolean not null default false,
  reference_ids text[] not null default '{}', -- riferimenti RF/RN/§ del capitolato
  updated_by uuid, -- FK molle su auth.users
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kind),
  constraint autonomy_title_length check (length(trim(title)) > 0),
  constraint autonomy_description_length check (length(trim(description)) > 0)
);

create index if not exists idx_autonomy_org on autonomy_rules(organization_id);
create index if not exists idx_autonomy_level on autonomy_rules(organization_id, level);

drop trigger if exists trg_autonomy_touch_updated_at on autonomy_rules;
create trigger trg_autonomy_touch_updated_at
before update on autonomy_rules
for each row execute function contacts_touch_updated_at();

alter table autonomy_rules enable row level security;
drop policy if exists "autonomy_rules_service_role_all" on autonomy_rules;
create policy "autonomy_rules_service_role_all"
on autonomy_rules for all to service_role using (true) with check (true);

-- ============================================================================
-- 3. Seed regole standard §8.2 + RF-6.15..6.20 per ogni organization esistente
-- ============================================================================
do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from organizations loop
    -- §8.2 categorie mai autonome (8 righe, level='never')
    insert into autonomy_rules (organization_id, kind, title, description, level, enforced_in_code, reference_ids)
    values
      (v_org_id, 'promozioni',
       'Promozioni',
       'Ogni offerta commerciale (voucher, sconti, coupon) richiede approvazione umana esplicita.',
       'never', false, array['§8.2']),
      (v_org_id, 'partner_spesa',
       'Comunicazioni che toccano partner della spesa',
       'Contenuti che nominano fornitori Lenny o che offrono prodotti del partner senza il suo assenso preventivo.',
       'never', false, array['§8.2', 'RF-6.19']),
      (v_org_id, 'marchio_eni',
       'Comunicazioni che toccano il marchio Eni',
       'L''uso del marchio Eni richiede sempre autorizzazione: mai in autonomia.',
       'never', false, array['§8.2']),
      (v_org_id, 'primo_contatto_nuovi',
       'Primo contatto a pubblici nuovi',
       'La prima comunicazione verso un segmento non ancora contattato passa sempre da revisione umana.',
       'never', false, array['§8.2']),
      (v_org_id, 'recensioni_negative',
       'Risposte pubbliche a critiche/recensioni negative',
       'Ogni risposta pubblica a critica o recensione negativa richiede approvazione umana.',
       'never', false, array['§8.2']),
      (v_org_id, 'incidenti',
       'Incidenti e disservizi',
       'Comunicazioni su chiusure impreviste, guasti, incidenti: mai autonome.',
       'never', false, array['§8.2']),
      (v_org_id, 'prezzi',
       'Modifica prezzi',
       'Nessuna modifica prezzo di listino in autonomia (RF-6.11 storico + approvazione).',
       'never', true, array['§8.2', 'RF-6.11']),
      (v_org_id, 'advertising',
       'Attivazione/modifica advertising',
       'Nessuna attivazione o modifica campagne advertising in autonomia.',
       'never', false, array['§8.2']),
      -- RF-6.15..6.20 (6 righe, mix enforced)
      (v_org_id, 'sconti_carburante',
       'Sconti sul carburante',
       'Margine troppo sottile, prezzo esposto in strada: mai sconti (RF-6.15). Enforced via discount_forbidden sui prodotti.',
       'never', true, array['RF-6.15']),
      (v_org_id, 'sconti_food_lenny',
       'Sconti sul cibo a carico Lenny',
       'La commissione è l''unica marginalità: gli sconti sul cibo devono essere cofinanziati dal ristorante (RF-6.16).',
       'never', false, array['RF-6.16']),
      (v_org_id, 'sconti_tariffa_officina',
       'Sconti sulla tariffa oraria officina',
       'Lo sconto sul meccanico insinua il dubbio sulla qualità. Si vende con servizio incluso o controllo gratuito (RF-6.17). Enforced via discount_forbidden.',
       'never', true, array['RF-6.17']),
      (v_org_id, 'capacita_rider',
       'Promozioni oltre capacità rider',
       'Nessuna promozione se la capacità rider della fascia non regge (RF-6.18). Human review obbligatorio.',
       'human_review', false, array['RF-6.18']),
      (v_org_id, 'sconti_partner_senza_assenso',
       'Sconti su prodotti del partner spesa',
       'Nessuno sconto sui prodotti del partner senza il suo assenso esplicito (RF-6.19).',
       'never', false, array['RF-6.19']),
      (v_org_id, 'promo_ristoranti_nuovi',
       'Promo ristoranti nuovi',
       'Costo delle promozioni per ristoranti nuovi o con pochi ordini a carico del ristorante, non di Lenny (RF-6.20).',
       'human_review', false, array['RF-6.20'])
    on conflict (organization_id, kind) do nothing;
  end loop;
end $$;
