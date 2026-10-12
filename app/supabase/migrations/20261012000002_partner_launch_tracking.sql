-- RN-48 Workflow lancio nuovo ristorante.
-- Il capitolato: "Al nuovo ristorante il sistema prepara pacchetto, lancia in
-- sequenza, sorveglia primi 30gg segnalando se sotto media categoria."
--
-- Scope F1: aggiungiamo tracking date lancio + target soglie. La "sorveglianza"
-- e' calcolata on-demand confrontando ordini vs mediana categoria nei 30gg.
-- La "sequenza di contenuti" (post di lancio, banner) resta manuale in F1:
-- la UI segnala che e' il momento di crearli, non li genera in automatico.

alter table partner_restaurants
  add column if not exists launched_at timestamptz,
  add column if not exists launch_target_orders int
    check (launch_target_orders is null or launch_target_orders > 0),
  add column if not exists launch_review_notes text;

create index if not exists idx_partners_launch_active
  on partner_restaurants(organization_id, launched_at)
  where launched_at is not null;

comment on column partner_restaurants.launched_at is
  'RN-48: data primo passaggio a onboarding_status=attivo. Null se mai partito. Fase di lancio = primi 30gg da questa data.';
comment on column partner_restaurants.launch_target_orders is
  'RN-48: target ordini attesi nei primi 30gg (opzionale, aiuta sorveglianza). Se null si usa la mediana categoria.';
comment on column partner_restaurants.launch_review_notes is
  'RN-48: note raccolte dall''Owner durante la fase di lancio (sorveglianza 30gg).';
