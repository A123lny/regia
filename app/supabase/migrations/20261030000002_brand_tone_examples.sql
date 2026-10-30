-- RN-70 Tono da esempi reali.
-- Il tono di voce di ogni marchio parte da 5-6 post passati per marchio con
-- l'indicazione di cosa piaceva di ciascuno. Le poche visualizzazioni non li
-- rendono inutili: servono per il TONO, non per il risultato. Da questi si
-- ricavano le linee del brand kit — e il prompt M3 li inietta come few-shot
-- examples per calibrare la generazione.
--
-- Shape jsonb: array di { text: string, note: string }. Max 10 esempi.
--   text: il post originale (1-500 char)
--   note: perché piaceva (0-200 char, es. "tono diretto, finale emotivo")

alter table brand_kits
  add column tone_examples jsonb not null default '[]'::jsonb;

alter table brand_kits
  drop constraint if exists brand_kits_tone_examples_is_array;
alter table brand_kits
  add constraint brand_kits_tone_examples_is_array
  check (jsonb_typeof(tone_examples) = 'array' and jsonb_array_length(tone_examples) <= 10);

comment on column brand_kits.tone_examples is
  'RN-70: fino a 10 post passati come esempi di tono. Shape: [{text, note}]. Alimentano il prompt M3 come few-shot.';
