-- RN-74 Recupero preventivi officina: nuovo kind reminder 'quote_followup'.
-- Promemoria gentile a chi ha chiesto un preventivo officina e non ha risposto.
-- L'automazione più redditizia dell'officina: lavora su persone che hanno già
-- dichiarato interesse.
--
-- Owner lo schedula manualmente dalla scheda contatto quando invia il preventivo
-- (default: 5 giorni dopo). Al momento officina non è ancora aperta — questo
-- predispone il tipo per quando sarà operativa.

alter table reminders
  drop constraint if exists reminders_kind_check;

alter table reminders
  add constraint reminders_kind_check
  check (kind in (
    'welcome',
    'thanks_order',
    'service_call',
    'voucher_expiring',
    'counter_close',
    'dormant_reactivation',
    'review_request',
    'quote_followup'
  ));

comment on constraint reminders_kind_check on reminders is
  'RN-74 aggiunto quote_followup per recupero preventivi officina non riscontrati.';
