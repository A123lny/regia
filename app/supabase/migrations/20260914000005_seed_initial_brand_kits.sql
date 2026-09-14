-- 20260914000005_seed_initial_brand_kits.sql
-- Seed dati iniziali dai contenuti del capitolato per i 4 marchi seed.
-- RF-2.3 tono, RF-2.3a contesto strategico, RF-2.4 rubriche, RF-2.5 parole bandite + sensibili.

-- Brand kit tono + contesto per i 4 marchi
insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Giovane, veloce, digitale. Registro colloquiale, mai aziendalese. Parla il marchio Lenny, non il titolare in prima persona.',
  'Food delivery e spesa a domicilio su San Marino. Pubblico: residenti + pendolari (~30.000 nel bacino) come base di frequenza; turismo estivo come volano di acquisizione. Lenny è software house nata dal delivery, orientata a lanciare altri servizi.',
  'Aumentare la frequenza degli ordini per cliente esistente. Riattivare i dormienti. Alimentare Lenny nei mesi estivi con la stazione come raccolta contatti.',
  'Nei prossimi anni: aggiunta di nuovi servizi verticali sotto brand Lenny (partendo dalla spesa a domicilio) mantenendo il posizionamento di prodotto software leggero e riusabile.'
from public.brands b where b.slug = 'lenny'
on conflict (brand_id) do nothing;

insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Quotidiano, affidabile, di territorio. Voce dell''insegna storica di San Marino. Registro colloquiale, mai aziendalese. Il carburante non è oggetto di comunicazione ma dato.',
  'Stazione carburanti a marchio Eni sull''arteria principale di San Marino. Servizi attivi: carburante, lavaggi, shop. In apertura: bar (Eni Cafè) e officina. Forte quota di turismo italiano attratto dal differenziale prezzo del carburante.',
  'Notorietà presso i residenti e lancio dei nuovi servizi (bar, officina). Costruzione della base contatti da zero (nessun recapito in archivio).',
  'Trasformare il traffico esistente (già gratuito) in conversione verso gli altri servizi. Portare bar e officina a regime nei 12 mesi.'
from public.brands b where b.slug = 'stazione'
on conflict (brand_id) do nothing;

insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Conversazione da bar. La decisione del cliente è quotidiana (caffè, aperitivo, colazione), il tono lo riflette. Chi cerca un aperitivo non cerca una stazione di servizio: voce autonoma, non "il bar della stazione".',
  'Il bar in apertura all''interno della stazione. Cadenza di comunicazione quotidiana (RN-34): il servizio genera più contenuti di tutti col minor sforzo (foto al banco, piatto del giorno, aperitivo).',
  'Farsi conoscere come luogo autonomo con carattere proprio. Costruire abitudini quotidiane su residenti e pendolari.',
  'Diventare punto di riferimento del centro. Espansione delle occasioni (colazione, pausa, aperitivo, pranzo veloce).'
from public.brands b where b.slug = 'eni-cafe'
on conflict (brand_id) do nothing;

insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Fiducia, competenza, presenza fisica costante. Mai sconti sulla tariffa oraria (RF-6.17): si vende con servizio incluso o controllo gratuito. L''officina, pur avendo nome proprio, mostra sempre di stare dentro la stazione (RN-60).',
  'Officina in apertura all''interno della stazione. Tagliandi, gomme, piccoli lavori. Prenotazione online, richiami automatici, preventivi come oggetto centrale del processo (RN-73).',
  'Priorità assoluta: le prime 5-6 recensioni Google (RN-61). Fiducia si costruisce con le prime esperienze positive. Orario continuato come argomento di vendita (RN-78).',
  'Diventare officina di riferimento del centro. Cross-selling verso lavaggi, shop, bar della stessa stazione.'
from public.brands b where b.slug = 'officina'
on conflict (brand_id) do nothing;

-- Pillars per marchio (§7.2)
insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, x.name, x.weight, x.sort_order
from public.brands b
cross join lateral (
  values
    ('Ristorante della settimana', 3, 0),
    ('Servizio (rete, zone, orari, spesa)', 3, 1),
    ('Commerciale', 2, 2),
    ('Dietro le quinte (rider e team)', 2, 3)
) as x(name, weight, sort_order)
where b.slug = 'lenny'
on conflict (brand_id, name) do nothing;

insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, x.name, x.weight, x.sort_order
from public.brands b
cross join lateral (
  values
    ('Servizio (orari, festività, chiusure)', 4, 0),
    ('I servizi con i volti di chi ci lavora', 2, 1),
    ('Consigli pratici stagionali', 2, 2),
    ('Commerciale', 1, 3)
) as x(name, weight, sort_order)
where b.slug = 'stazione'
on conflict (brand_id, name) do nothing;

insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, x.name, x.weight, x.sort_order
from public.brands b
cross join lateral (
  values
    ('Piatto del giorno / offerta', 4, 0),
    ('Aperitivo', 3, 1),
    ('Volti del banco', 2, 2),
    ('Storie del bar', 1, 3)
) as x(name, weight, sort_order)
where b.slug = 'eni-cafe'
on conflict (brand_id, name) do nothing;

insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, x.name, x.weight, x.sort_order
from public.brands b
cross join lateral (
  values
    ('Consigli stagionali (gomme, controlli)', 3, 0),
    ('Il meccanico spiega', 3, 1),
    ('Prenotazioni e disponibilità', 2, 2),
    ('Recensioni positive dei clienti', 2, 3)
) as x(name, weight, sort_order)
where b.slug = 'officina'
on conflict (brand_id, name) do nothing;

-- Parole bandite universali (aziendalese) per tutti e 4 i marchi
insert into public.brand_forbidden_words (brand_id, word)
select b.id, w.word
from public.brands b
cross join lateral (values ('eccellenza'), ('sinergia'), ('valore aggiunto'), ('best-in-class'), ('game changer')) as w(word)
on conflict do nothing;

-- Sensitive topics per Stazione: carburante (§13, §15.B)
insert into public.brand_sensitive_topics (brand_id, topic, kind, note)
select b.id,
       'Nominare il prezzo del carburante nelle comunicazioni',
       'revisione_umana',
       'Vincoli promozionali Eni ancora da chiarire (§15.B in carico al titolare). Sempre revisione umana prima di pubblicare.'
from public.brands b where b.slug = 'stazione'
on conflict (brand_id, topic, kind) do nothing;

-- Claim vietati per Lenny
insert into public.brand_sensitive_topics (brand_id, topic, kind, note)
select b.id, x.topic, 'claim_vietato', x.note
from public.brands b
cross join lateral (
  values
    ('Sconti sul cibo a carico di Lenny', 'RF-6.16: erode la commissione, unica marginalità.'),
    ('Promesse sui tempi di consegna specifici', 'RF-7.6: dipendono dai ristoranti, non prometterli.')
) as x(topic, note)
where b.slug = 'lenny'
on conflict (brand_id, topic, kind) do nothing;
