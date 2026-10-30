-- RN-76 Orari apertura centralizzati per marchio.
-- Un solo posto nel sistema: da qui alimentano scheda Google, risposte automatiche,
-- avvisi, contenuti (RN-77 niente commerciale a saracinesca chiusa, RN-78 orario
-- continuato come argomento di vendita per officina). Al cambio (estate, festività)
-- si aggiorna qui una volta e si propaga.
--
-- Schema JSONB flessibile: per ogni giorno 0..6 (0=lunedì, 6=domenica) una lista
-- di fasce { open, close } in formato HH:mm 24h. Giorno chiuso = lista vuota.
-- Esempio: Lenny ristorante aperto 11-14 e 18-23 → monday=[{open:"11:00",close:"14:00"},{open:"18:00",close:"23:00"}]
-- Officina Lenny 7:30-19:30 continuato → monday=[{open:"07:30",close:"19:30"}]
-- NULL = non configurato (brand digitale o senza orari, es. Lenny food platform).

alter table brands add column opening_hours jsonb;

comment on column brands.opening_hours is
  'RN-76: orari di apertura settimanali del brand. Schema: { monday: [{open:"HH:mm",close:"HH:mm"}], ..., sunday: [] }. NULL = non applicabile.';

-- Validazione soft: lo schema effettivo è enforced applicativamente (TypeScript
-- types + runtime guard nel repo). Qui garantiamo solo che sia un object (non array).
alter table brands
  drop constraint if exists brands_opening_hours_is_object;
alter table brands
  add constraint brands_opening_hours_is_object
  check (opening_hours is null or jsonb_typeof(opening_hours) = 'object');
