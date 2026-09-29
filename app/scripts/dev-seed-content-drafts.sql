-- Seed content_drafts di test per il tour visivo del calendario.
-- Chiamato da scripts/dev-seed-content-drafts.sh.
-- Idempotente grazie al DELETE per marker "[SEED]" nel .sh.

WITH
  u AS (SELECT id AS user_id FROM auth.users WHERE email = 'admin@admin.com' LIMIT 1),
  b AS (
    SELECT id, slug FROM public.brands
    WHERE organization_id = '00000000-0000-0000-0000-000000000001'::uuid
  ),
  v(brand_slug, theme, txt, status, created_offset, approved_offset, scheduled_offset, published_offset) AS (
    VALUES
      -- 4 BOZZE (status='draft')
      ('lenny',    'Bozza pizza gourmet Serrano',      'Post per lanciare la nuova pizza con crudo di Serrano e mozzarella di bufala. Tono giocoso, cta per prenotare.',                                    'draft',      '-3 hours',      NULL,            NULL,             NULL),
      ('stazione', 'Bozza tasting menu autunno',       'Menu degustazione 5 portate a 45 euro. Comunicare eleganza senza sembrare snob. Foto in stile film.',                                              'draft',      '-2 hours',      NULL,            NULL,             NULL),
      ('eni-cafe', 'Bozza nuovo blend arabica',        'Blend etiope 100 percento arabica. Tono descrittivo, senza tecnicismi. CTA: assaggia gratis martedi.',                                             'draft',      '-90 minutes',   NULL,            NULL,             NULL),
      ('officina', 'Bozza detailing premium',          'Servizio detailing completo: lucidatura, sanificazione, protezione ceramica. Prezzo civetta 149 euro, target giovani professionisti.',              'draft',      '-1 hour',       NULL,            NULL,             NULL),

      -- 4 APPROVATE non programmate
      ('lenny',    'Panino veg del mese',              'Panino vegetariano con hummus, verdure grigliate e formaggio caprino. In carta tutto ottobre. #streetfood #vegfriendly',                            'approved',   '-2 days',       '-1 day',        NULL,             NULL),
      ('stazione', 'Serata jazz sabato',               'Sabato sera concerto jazz dal vivo con il trio Marco Bianchi. Prenotazione consigliata. Aperitivo dalle 19:30.',                                    'approved',   '-3 days',       '-2 days',       NULL,             NULL),
      ('eni-cafe', 'Cioccolata calda artigianale',     'La cioccolata calda e tornata. Ricetta della casa con cacao mono-origine Venezuela. Da provare con panna montata al momento.',                      'approved',   '-2 days',       '-1 day',        NULL,             NULL),
      ('officina', 'Pulizia interni auto 39 euro',     'Promozione pulizia interni auto a 39 euro fino al 15 ottobre. Include aspirazione, sanificazione, trattamento sedili.',                             'approved',   '-4 days',       '-2 days',       NULL,             NULL),

      -- 12 PROGRAMMATE sui prossimi 14 giorni
      ('lenny',    'Diamond Cheese in menu',           'Nuovo panino Diamond Cheese: doppio hamburger di manzo, cheddar 24 mesi, cipolla caramellata. Disponibile da domani.',                              'scheduled',  '-2 days',       '-1 day',        '+1 day 9 hours 30 minutes',  NULL),
      ('stazione', 'Aperitivo Aperol Spritz 5 euro',   'Da lunedi a giovedi Aperol Spritz a 5 euro con tagliere di crostini. Aperitivo dalle 18 alle 20.',                                                  'scheduled',  '-2 days',       '-1 day',        '+1 day 18 hours',            NULL),
      ('eni-cafe', 'Blend arabica etiope in shop',     'Nuovo blend etiope in vendita al banco. 250g a 12 euro. Ideale per moka e V60.',                                                                    'scheduled',  '-3 days',       '-2 days',       '+2 days 11 hours',           NULL),
      ('officina', 'Check-up gomme gratuito',          'Fino al 30 ottobre check-up gomme gratuito: pressione, battistrada, allineamento. Prenota il tuo slot.',                                            'scheduled',  '-2 days',       '-1 day',        '+2 days 16 hours 30 minutes',NULL),
      ('lenny',    'Sconto studenti mercoledi',        'Ogni mercoledi 20 percento di sconto per gli studenti sotto i 25 anni. Basta mostrare il tesserino universitario.',                                'scheduled',  '-4 days',       '-3 days',       '+3 days 12 hours',           NULL),
      ('stazione', 'Chef Mario Rossi ospite venerdi',  'Venerdi sera lo chef stellato Mario Rossi ospite della nostra cucina. Menu speciale a 65 euro. Solo 20 coperti.',                                  'scheduled',  '-5 days',       '-4 days',       '+4 days 20 hours',           NULL),
      ('eni-cafe', 'Latte macchiato dautore',          'Latte macchiato preparato con nuova ricetta: cacao Valrhona e sciroppo di nocciola artigianale. Da provare.',                                       'scheduled',  '-3 days',       '-2 days',       '+5 days 8 hours',            NULL),
      ('officina', 'Sabato aperti 8-14',               'Ricordiamo che ogni sabato siamo aperti dalle 8 alle 14 per tagliandi e piccole riparazioni. Su appuntamento.',                                     'scheduled',  '-4 days',       '-3 days',       '+6 days 14 hours',           NULL),
      ('lenny',    'Behind the scenes cucina',         'Un giorno nella nostra cucina. Video di come prepariamo il pane in casa ogni mattina alle 5. #dietroleQuinte',                                      'scheduled',  '-6 days',       '-5 days',       '+8 days 10 hours',           NULL),
      ('stazione', 'Vino della casa selezione',        'Il vino della casa: Chianti Classico del podere di famiglia. Solo al calice, solo per chi cena da noi.',                                            'scheduled',  '-7 days',       '-6 days',       '+10 days 19 hours',          NULL),
      ('eni-cafe', 'Torrefazione locale in caraffa',   'Da oggi in caraffa il caffe della torrefazione Bianchi di Rimini. Filiera corta, tostatura leggera.',                                              'scheduled',  '-8 days',       '-7 days',       '+12 days 9 hours',           NULL),
      ('officina', 'Pneumatici invernali sconto 15',   'Cambio gomme invernali con sconto 15 percento fino al 15 novembre. Marchi Michelin, Pirelli, Continental.',                                         'scheduled',  '-9 days',       '-8 days',       '+13 days 15 hours 30 minutes',NULL),

      -- 4 PUBBLICATE nella settimana passata
      ('lenny',    'Il pane fatto in casa',            'Il pane e fatto in casa ogni mattina con lievito madre. Zero conservanti. Prova la focaccia della domenica.',                                       'published',  '-10 days',      '-9 days',       '-6 days 10 hours 30 minutes','-6 days 10 hours 30 minutes'),
      ('stazione', 'Menu primavera 2026',              'Il nuovo menu primavera 2026 e online. Piatti di stagione, ingredienti a km 0, tanti sapori nuovi. Prenota il tuo tavolo.',                        'published',  '-8 days',       '-7 days',       '-4 days 15 hours',           '-4 days 15 hours'),
      ('eni-cafe', 'Colazione con cornetto e cappuccino', 'Colazione tradizionale con cornetto artigianale e cappuccino a 3 euro. Tutti i giorni dalle 7 alle 10.',                                        'published',  '-7 days',       '-6 days',       '-3 days 9 hours',            '-3 days 9 hours'),
      ('officina', 'Cambio olio 40 euro completo',     'Cambio olio motore completo di filtro a 40 euro tutto compreso. Olio Castrol o equivalente. Fino al 30 settembre.',                                'published',  '-5 days',       '-4 days',       '-1 day 17 hours',            '-1 day 17 hours')
  )
INSERT INTO public.content_drafts (
  organization_id, brand_id, channel, theme_input, generated_text,
  prompt_version, model_used, tokens_in, tokens_out, cost_usd, latency_ms,
  status, created_by, created_at, approved_at, scheduled_at, published_at,
  rejection_reason, rejected_at
)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  b.id,
  'social'::content_channel,
  '[SEED] ' || v.theme,
  v.txt,
  'seed-v1',
  'gemini-2.5-flash',
  350, 180, 0.0012, 1250,
  v.status::content_draft_status,
  u.user_id,
  now() + (v.created_offset)::interval,
  CASE WHEN v.approved_offset IS NULL THEN NULL ELSE now() + (v.approved_offset)::interval END,
  CASE WHEN v.scheduled_offset IS NULL THEN NULL ELSE now() + (v.scheduled_offset)::interval END,
  CASE WHEN v.published_offset IS NULL THEN NULL ELSE now() + (v.published_offset)::interval END,
  NULL, NULL
FROM u, b, v
WHERE b.slug = v.brand_slug;
