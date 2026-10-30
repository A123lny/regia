# Diario di bordo — Regìa

> Aggiornato: 30 ottobre 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- **Allineamento capitolato — 5 gap MEDIA chiusi** (RF-6.9, RN-76, RN-70,
  RF-4.2, RN-74). Da audit profondo 29 ott con 4 agent paralleli emersi 9 gap
  MEDIA/BASSA + 1 ALTA ricalibrata (§8.2 enforcement = aspirazionale per
  contenuti semantici, non actionable). Fatti i 5 autonomi ad alto valore,
  resta RN-45 (stagionale Lenny estate ~4-6h), RN-53/54 (eventi locali
  ~3-5h), RN-4.4 (raccolta foto strutturata 50 locali ~5-7h), RF-3.1/3.2
  (cross-marchio aggregato ~4-6h) + deferred noti (M14/M8b/connettori).
- **RF-8.8 M09→M08 bridge chiuso.** Deferred da F0 M08 ora implementato:
  checkbox "Chiedi recensione" nel resolve dialog anti-abbandono schedula
  reminder `review_request` idempotente. 2 nuovi invariant test. Zero migration
  (kind + template già esistenti).
- **M08 Recensioni e reputazione — F0 core completato** (14 task, 16 commit da
  `b99bbe1` a `4f82381`). Nuovo modulo `m08-reviews` con fetcher Google Places
  giornaliero (`/api/reviews/fetch` cron 06:00), classifier euristico (rating +
  keyword grave), bozza AI Anthropic tono-coerente con guard RF-8.7 anti-blame
  (Lenny no colpa ristorante), workflow approvazione Owner, publish manuale con
  copy clipboard. Pagina `/recensioni` con KPI/filtri/tabella + drawer 7 stati.
  2 nuove migrazioni, 5 invarianti (15+ test case), 3 unit test, 2 E2E spec
  (scritti ma non eseguibili per env issue pre-esistente SERVICE_ROLE_KEY).
  Esecuzione subagent-driven con reviewer per task: 4 fix round totali
  (regex sbagli stem-anchor, AiConfigError fail-fast, audit regenerate,
  clipboard+remount drawer).
- **Tour funzionale completato.** Esaminati 20+ pagine con l'utente in sessioni
  di spiegazione guidata (operativo + marketing + commerciale + clienti + insight
  + config), ciascuna con mini-fix UX emersi durante il walkthrough. Lo stato
  del software operativo e' solido: nessun bug bloccante trovato, molti aggiustamenti
  di coerenza (es. chip cooling, assenso->consenso, veicoli nascosti per brand
  non-automotive, chip "In raffreddamento" visibile su tabella ristoranti).
- **CI GitHub Actions attiva e verde** (HEAD `e6d13a6`). Il workflow esisteva da
  2 ott ma falliva da settimane al passo `format:check` per 13 file aggiunti
  senza passare da prettier globale. Fix: `prettier --write .` + aggiunto
  node_modules root a .gitignore. Ogni push triggera: lint + prettier + typecheck
  + boundaries + supabase db reset + vitest in ~6 min.
- **Suite E2E Playwright: 49 test** (39 smoke + 10 deep). I 7 flow deep implementati
  nelle ultime 2 sessioni coprono: M03 draft->approve->schedule, M06 voucher
  idempotenza (RF-6.26), M10 signup pubblico, M09 abbandono resolve + audit,
  M01 revoca consenso, M07 campagna launcher preview. Pattern: insert via admin
  DB + UI action + assertion DB + cleanup afterEach. Full suite ~2.3 min local.
- **Dati di test completati:** `npm run seed:demo` ora carica 33 contatti (3 duplicati
  per test dedup) + 90 consensi + 10 veicoli + 13 prodotti (modello consegne Lenny
  only, costi reali per gli altri brand) + 30 ordini con 63 righe + 5 ristoranti
  Lenny + 5 fornitori realistici (zero Barilla, aggiunti Illy/Melegatti/Bosch)
  + 20 bozze (6 con attribuzione RF-9.3) + 20 voucher + 3 segmenti + 2 campagne
  + 2 landing + 12 promemoria + 9 segnali abbandono. Idempotente.
- **UX fixes applicati durante tour:**
  - Calendario day-view: task "sliding" su tutti i giorni fino a scadenza con
    colori graduati (verde/giallo/arancione/rosso) + fix timezone parsing
  - Anti-abbandono: ordinamento esplicito severity high->medium->low + card
    risolti cliccabile con modal storico + textarea 1000 char con outcome
  - Iscrizioni: generatore QR integrato (libreria qrcode client-side) con
    bottone "Scarica PNG" + auto-open su create landing
  - Analytics: separate capability analytics.marketing.read vs .commercial.read
    (RU-1a) per nascondere fatturato all'Editor futuro
  - Fornitori: assenso -> consenso (coerente lessico), descrizione header
    corretta (Lenny food non ha fornitori)
  - Ristoranti: chip "In raffreddamento" esplicito nella colonna Status
- **Prossimo:** 3 blocchi rimanenti dall'audit:
  (1) hosting Vercel (sblocca scheduler cron M05/M08 reali + QR da smartphone +
  demo pubblica); (2) connettori M1 reali Lenny/Stazione (sblocca RN-47/48
  metriche); (3) M14 auto-publishing social (bloccato Meta dev account) +
  M08b email assistenza (scope da brainstormare).

## Fatto

- **30 ott 2026 — Allineamento capitolato: 5 gap MEDIA chiusi** (`a3b8a10`..`c7bd4e5` + RN-74).
  Audit sistematico 29 ott (4 agent paralleli su M1-M14 + RS/RA/RNF/RQ) ha
  mappato scostamenti reali post-M08. Implementati:
  - **RF-6.9 M06+M08 cross-brand flow** (`a3b8a10`): aggregator "paga chi
    riceve" per coppia (issuer,spendable) con costo stimato. Nuova sezione
    `/analytics` gated su analytics.commercial.read. 3 invarianti verdi.
  - **RN-76 M02 orari apertura centralizzati** (`e4b9f5e`): brands.opening_hours
    jsonb + helper isValidOpeningHours/isBrandOpenAt + UI OpeningHoursEditor
    inline con toggle per giorno + time pickers. 14 unit test. Wiring M05
    (RN-77 quiet hours) + M03 prompt (RN-78 orario continuato officina)
    deferred come follow-up.
  - **RN-70 M02 tono da esempi reali** (`0504f56`): max 10 post passati con
    nota, iniettati nel prompt M3 come few-shot. UI ToneExamplesEditor sulla
    pagina brand kit. 10 invariant test + CHECK DB max 10.
  - **RF-4.2 M04 auto-suggest template + autofill** (`c7bd4e5`): mapping
    topic→template deterministico (promozione→promo-announce, avviso→
    service-notice, consegna→restaurant-of-week, etc), autofill prima riga
    →title/headline, resto→description/details. UI banner "Suggerito" nel
    media-picker + bottone "Compila dal draft". 13 unit test.
  - **RN-74 M09 quote_followup reminder officina**: nuovo kind enum +
    template email + action manuale scheduleQuoteFollowupAction + UI
    QuoteFollowupButton nel drawer contatto. Owner schedula follow-up
    gentile dopo preventivo (default 5gg). 2 invariant test.
- **28 ott 2026 — RF-8.8 M09→M08 bridge: richiesta recensione post-risoluzione abbandono.**
  Hook deferred dal F0 di M08 ora chiuso. ResolveDialog anti-abbandono: nuovo
  checkbox "Chiedi recensione a questo cliente" nel modal. `resolveAbandonmentSignalAction`
  esteso con param `askForReview?: boolean` → se true, chiama `scheduleReminder({
  kind:'review_request', referenceType:'abandonment_signal', referenceId:signalId })`
  (idempotente via UNIQUE constraint esistente). Audit event `abandonment.review_requested`
  + soft-fail su `abandonment.review_request_failed` se lo schedule non riesce
  (resolve principale resta committed). Zero migration — `review_request` kind
  già esistente nell'enum da 24 set + template email già implementato in
  send-reminder.ts. Esteso `ReminderReferenceType` con `abandonment_signal`.
  2 nuovi test invariante (crea + idempotenza). Il reminder resta pending in
  /promemoria finché Owner lo invia manualmente o canale M05 configurato.
- **27 ott 2026 — M08 Recensioni e reputazione (RF-8.1..8.9) — F0 core 14 task.**
  Nuovo modulo `m08-reviews` end-to-end. Spec+plan in `docs/superpowers/{specs,plans}/`.
  Esecuzione subagent-driven: 14 task bite-sized, ciascuno dispatcato come fresh
  implementer subagent (haiku per transcription, sonnet per integration), review
  task-reviewer dopo ciascuno (sonnet), 4 fix round completati (regex stem-anchor
  RF-8.7, AiConfigError fail-fast, audit regenerate action, clipboard try/catch
  + drawer re-mount). Componenti: migration `reviews` + `brands.google_place_id`;
  classifier euristico (rating + 11 keyword grave); `GooglePlacesAdapter`
  (RS-2) + fetcher idempotente; prompt builder con RF-8.7 Lenny guard + draft
  guard regex post-generation; draft generator Anthropic con retry max 2 + fatale
  AiConfigError; 5 server actions + capability `reviews.{read,respond}` (owner /
  owner+editor); endpoint cron `/api/reviews/fetch 0 6 * * *` + script fallback
  locale; UI pagina `/recensioni` con 4 KPI + filtri + tabella + sidebar; drawer
  7 stati con approve/publish/resolve/regenerate wiring; 5 invarianti (dedup
  fetcher, classifier, prompt+guard, publish-flow, tenant-scope, serious-no-draft)
  + 2 E2E spec. Totale 16 commit (`b99bbe1`..`4f82381`). FUORI SCOPE F0 (deferred):
  RF-8.8 richiesta review post-risoluzione (hook da M09), RF-8.9 commenti social
  (bloccato Meta), GBP write API (nessun brand verificato oggi).
- **26 ott 2026 — Audit stato + 5 flow E2E deep + CI verde.**
  Audit completo del codebase: resi espliciti i gap (M14, M08 recensioni,
  M08b email assistenza, connettori M1, scheduler cron M09). Fix CI GitHub
  Actions che falliva da 1 mese per prettier format:check su 13 file:
  `prettier --write .` + node_modules root in gitignore. Scritti 5 flow E2E
  deep aggiuntivi (voucher idempotenza, signup pubblico, campagna launcher,
  abbandono resolve, revoca consenso) seguendo pattern consolidato di
  contenuti-flow. Suite totale 49 test, 2.3 min full run.
- **22-24 ott 2026 — Tour funzionale guidato 20+ pagine + mini-fix UX.**
  Walkthrough paga per pagina con ipotesi di uso reale. Fix emersi:
  (a) chip "In raffreddamento" visibile in colonna Status ristoranti;
  (b) fornitori "assenso"->"consenso" (coerente con lessico contatti) +
  descrizione header corretta (Lenny food = ristoratori, non fornitori);
  (c) ridisegno fornitori seed: zero Barilla, aggiunti Illy/Melegatti/Bosch
  mappati sui brand che davvero ne hanno (Stazione/Officina/Eni Cafe);
  (d) catalogo Lenny: rimossi piatti (gestiti dai ristoratori), aggiunte
  2 consegne con cost+margin reali (unico stock di proprieta' del gruppo);
  (e) brand_order_lines popolate (63 righe) per 30 ordini seed;
  (f) sezione veicoli dossier contatto nascosta per brand non-automotive
  (Lenny food/Eni Cafe) quando vuota — RF-1.3 ha senso solo stazione/officina.
- **20-21 ott 2026 — Analytics + calendario + anti-abbandono deep polish.**
  (a) RU-1a: separate capability `analytics.marketing.read` (owner+editor) e
  `analytics.commercial.read` (solo owner, nasconde fatturato in euro);
  (b) Calendario day-view: task "sliding" su tutti i giorni da oggi fino a
  scadenza con colori graduati overdue/today/tomorrow/soon/later + fix
  timezone parsing esplicito YYYY-MM-DDTHH:mm per evitare slittamento giorno;
  (c) Anti-abbandono: ordinamento esplicito severity high->medium->low (prima
  Supabase ordinava alfabeticamente), card "Risolti 30gg" cliccabile con
  modal storico (motivo + note), form risoluzione in modal con textarea
  1000 char + outcome dropdown; (d) 1° flow E2E deep contenuti-flow (M03
  draft->approve->schedule, 2 test).
- **19-20 ott 2026 — Iscrizioni QR integrato + segmenti + dedup seed.**
  (a) Pagina iscrizioni: modal QR generato client-side via libreria qrcode
  (zero backend), bottone "Scarica PNG" + auto-open dopo creazione nuova
  landing; (b) Dedup detector seed: aggiunti 3 duplicati sintetici (email/
  phone/whatsapp match) per vedere il flow unifica; (c) 3 flow E2E deep
  aggiuntivi: anti-abbandono resolve + audit, revoca consenso, campagna
  launcher 3 strati; (d) seed demo copre 33 contatti + 90 consensi + 20
  reminder + 9 abandonment signals + 20 voucher con attribuzione RF-9.3
  al 30%.
- **17-18 ott 2026 — Suite Playwright E2E iniziale + testing guide.**
  Setup Playwright 1.56: auth setup via admin API genera magic link e
  salva storageState riusato. 38 smoke test su 13 moduli (page loads +
  heading + bottone primario). Config: workers=1 (seriale, DB staging
  condiviso), trace retain-on-failure, HTML report. docs/testing-guide.md
  pagina per pagina + flow critici 30min + template per estendere. 2°
  flow E2E deep: dashboard + anti-abbandono smoke completo.
- **13 ott 2026 — RN-37/38/39 M07: analisi mercato rete per categoria.**
  Nuova pagina `/ristoranti/mercato` (Owner-only). Aggregator confronta ordini
  medi per partner per ciascuna cuisine_category vs mediana rete: verdetti
  "sotto_offerta" (opportunita'), "equilibrata", "satura". Il principio del
  capitolato: il problema non e' chi va male, e' quanti fanno la stessa cosa.
  4 KPI card + tabella con 7 colonne + hint testuale per verdetto.
- **13 ott 2026 — RN-28 M07: errori consegna ristorante (soglia 3/mese allarme).**
  Nuova migration `partner_delivery_errors` (FK partner + order opzionale +
  voucher scuse opzionale, severity enum, reporter). Card nel drawer ristorante
  con count 30gg vs 30gg precedente + badge "Allarme" >=3 / "Attenzione" =2.
  Form espandibile per registrare errore con tutti i dettagli. Fix security:
  validazione UUID + ownership check su order/voucher cross-tenant.
- **12 ott 2026 — RN-48 M07: workflow lancio nuovo ristorante.**
  `partner_restaurants.launched_at` + hook automatico quando onboarding→'attivo'.
  Sorveglianza 30gg con progress bar, confronto ordini vs mediana categoria
  (dai peer con finestra gia' completata), underSurveillance se sotto 70%
  pro-rata target. Card con 2 KPI + textarea note di review persistite.
- **12 ott 2026 — RN-47 M07: report mensile automatico ristoratori.**
  `brand_orders.partner_restaurant_id` nullable (per connettori M1 futuri).
  Aggregator `buildMonthlyPartnerReport` + `formatMonthlyReportMessage` con
  3 varianti template (dati vendita / solo attivita' / rilancio relazione).
  Card nel drawer "Report mensile" con 4 metriche + textarea editabile +
  copy clipboard. Invio M05 lasciato manuale per F1 (Twilio non ancora up).
- **13 ott 2026 — RS-1 split barrel m05-publishing + m10-signup.** Twilio
  (-> fs/https Node-only) non va bundlato nel client. Separati `public.ts`
  (client-safe) e `server.ts` (adapter concreti). Pattern coerente con il
  precedente split m06+m09. Aggiornati 7 callers.
- **12 ott 2026 — Seed demo dati Cloud.** Script `app/scripts/seed-demo.ts`
  idempotente (UUID deterministici via md5 + upsert on conflict). Carica
  ~235 righe demo coprendo 13 entita' (contatti, consensi, veicoli, catalogo,
  ordini, ristoranti, fornitori, bozze, voucher, segmenti, campagne, landing).
  Safety switch `ALLOW_SEED=1` obbligatorio. Lanciabile con `npm run seed:demo`.
- **12 ott 2026 — RF-12.1 sidebar in 6 gruppi.** Da lista piatta di 18 voci a
  blocchi semantici: Operativo quotidiano · Marketing · Commerciale · Clienti ·
  Insight · Configurazione. Allineato al capitolato §7.2 che distingue
  marketing (contenuti/distribuzione) da commerciale (motore RF-6.x).
  Gruppi senza voci visibili per il ruolo vengono nascosti; "Contenuti"
  resta collassabile dentro Marketing.
- **12 ott 2026 — POC desktop OS parallelo.** Nuovo worktree
  `C:\Users\Andrea\Desktop\regia-desktop\` sul branch `feature/desktop-shell`,
  porta :3001 (Cloud condiviso). Shell completo: wallpaper + 19 icone cartella
  (DesktopIcon) + windows draggabili/resizable (react-rnd + zustand store) +
  dock + taskbar con windows list + search palette Cmd+K + widget notifiche
  live (/api/desktop-notifications non bloccante) + post-it draggabili
  persistiti in localStorage + orologio widget. Tema embed override: finestre
  aperte via iframe con `sec-fetch-dest=iframe` nascondono AppShell e
  applicano `embed-root` CSS (palette grigio-blu + font system invece che
  Fraunces/terracotta Regia). RF-13.5 ads adapter spostato come
  nice-to-have (non implementato: prematuro senza clienti su ads reali).
- **7 ott 2026 — RF-13.7 M03: suggerimenti SEO organica (analyzer euristico).**
  Analyzer deterministico (no AI, no costi) con 6 check: lunghezza / titolo
  apertura / CTA / numeri concreti / densita' parole chiave / frasi lunghe.
  Stop-words italiane + 26 verbi CTA + regex per prezzo/data/orario. Card
  nel draft detail. 21 unit test aggiunti (44 totali sugli analyzer: 12
  topic + 11 UTM + 21 SEO, 1.66s senza Docker).
- **7 ott 2026 — RF-4.6/4.7 M04: formati stampa A4 (locandina) + anteprima.**
  Formati `a4-portrait` (2480x3508 @300dpi) e `a4-landscape`. 2 nuovi template
  demo con font scalati. Tab "Stampa A4" in channel-previews con mockup
  foglio 1:√2.
- **7 ott 2026 — RF-6.21 M06: azzeramento contatore mensile.**
  Esteso enum reset_mode da {dopo_premio, annuale, mai} a includere "mensile".
  Migration + types + labels. UI auto-propaga (itera Object.keys).
- **7 ott 2026 — RF-9.3 M06+M08: attribuzione contenuto -> vendita (voucher).**
  FK `vouchers.source_draft_id` nullable + ON DELETE SET NULL. Aggregator
  `getAttributionByDraft` con 4 metriche (issued/redeemed attribuiti vs non +
  copertura %). UI /analytics sezione dedicata. UI /fedelta issue form:
  dropdown "Attribuisci a un post" con drafts pubblicati/programmati. Fix
  security IDOR: validazione UUID + ownership check draft.
- **7 ott 2026 — RF-12.7 HelpButton su 4 pagine nuove.** provider-media,
  zone-consegna, dati-personali, memoria-agente. Help text contestuali
  completi (compliance ToS, blackout clima, GDPR dossier, memoria agente).
- **7 ott 2026 — chore: Node >=22 engines + middleware->proxy (Next.js 16).**
  Fix deprecation Next.js 16: `middleware.ts` rinominato `proxy.ts`, export
  rinominato. `engines` aggiunto a package.json.
- **3 ott 2026 — RF-4.3 Provider media esterna (ToS/diritti verificati).**
  Pre-condizione per generazione AI esterna (fal.ai, Replicate, DALL-E): tabella
  `media_providers` con slug unico per org, enum rights_holder (user/provider/
  shared/public_domain), allowed_uses check (commercial/editorial/personal),
  restricted_sectors text[] con lista comune (tabacco/alcool/armi/politica/...).
  Repo + action upsert/archive, 2 capability Owner-only, UI /impostazioni/provider-media
  con tabella + sheet form. Guard `hasActiveProviderForUse` per quando si collega
  provider reale. In F1 M04 usa solo template interni: questa infrastruttura dorme.
- **3 ott 2026 — RF-6a.1 Partner come entita configurabile.** Esteso supply_partners
  con involvement_level enum (informed/approves/co_finances/name_veto), advance_notice_days,
  veto_notes. Nuova tabella `partner_approval_requests` con workflow approve/reject,
  due_at calcolato da advance_notice_days. UI /fornitori con 4 radio card livello +
  preavviso + textarea veto condizionale.
- **3 ott 2026 — RN-52 Zone consegna variabili (clima/eventi).** 2 tabelle:
  delivery_zones (brand × name × cap_prefixes[]) + delivery_zone_blackouts (kind:
  snow/rain/event/road_closure/other, start_at + end_at nullable, closed_at). Guard
  `isContactInBlackoutZone` + `assertDeliveryZonesOk` per promo food. UI /governance/
  zone-consegna con banner rosso attivo + inline Blackout button. Fix di sicurezza
  sistematico: `assertEntityOwnedByOrg` applicato a 11 action m13-governance (brandId
  /zoneId/draftId/campaignId/windowId) per prevenire IDOR cross-tenant.
- **3 ott 2026 — RA-8.11 UI memoria agente.** Pagina Owner-only /impostazioni/memoria-agente
  con 4 sezioni: approval rate per topic (Candidata L2 quando >= 10 draft e >= 90%),
  keyword cloud motivi rifiuto, esiti promo (voucher issued/redeemed con color coding),
  preferenze stile per brand (pilastri con peso + forbidden count + sensitive count).
  Read-only, aggrega da content_drafts/vouchers/brand_pillars. Nessun dato scritto.
- **3 ott 2026 — RF-1.9 Richieste dati personali GDPR (quick win legale).**
  Dossier contatto completo (anagrafica + consensi + veicoli + voucher + ordini +
  signup events + reminders + publishLog + previous requests), download JSON client-side.
  Tabella `contact_data_requests` con request_type (export/erasure) + status
  (received/in_progress/fulfilled) + dossier_snapshot jsonb per audit. UI /contatti/
  [id]/dati-personali Owner-only. Fix sicurezza: IDOR su createContactDataRequestAction
  (requireOwnedContact invece di requireCapability) + fulfillContactDataRequestAction
  (req.contactId server-side invece che client-supplied). Erasure nullifica + archivia.
- **3 ott 2026 — RF-6.18 + RN-41/42/43 Capacita rider Lenny.** Finestre
  settimanali per weekday+timeOfDay+totalSlots, guard pre-promo food che blocca
  se slots_filled >= total. Richieste rider quantificate (slots_needed) con workflow
  open/filled/cancelled, Lenny decide se accettare prima di proseguire promo.
  Bloccante architetturale per attivare motori food.
- **2 ott 2026 — Push su GitHub + fast-forward di main.**
  160 commit da 2162e6d a 915fdd3 applicati a main. Niente PR formale (single dev,
  branch divergenza zero). Catchup prettier + rimozione public-actions.ts barrel orfano.
- **2 ott 2026 — M13 Advertising RF-13.1..13.4+13.6 (motore promo con tetti spesa).**
  advertising_budgets (brand × categoria, enabled default OFF sempre),
  advertising_spend_ledger (actual + estimated), advertising_overrun_requests (RF-13.6
  motivazione min 20 char + decisione mai automatica Owner-only). 6 capability nuove.
- **2 ott 2026 — RN-64..67 unsubscribe flow completo.** Token one-time + landing
  /u/[token] con revoca pre-render, motivo opzionale + reduce_frequency, propagazione
  cross-canale, banner dashboard "pressione commerciale alta" (>= 50% motivi
  "too_many_messages" e >= 3 revoche negli ultimi 30gg). Footer unsubscribe auto in email.
- **2 ott 2026 — RN-62 bulk send protection M07 campagne.** campaign-launcher con
  preview destinatari + sample 3 + invio di prova + launch scaglionato (batch 100,
  pausa 10min). Transizione draft→sending→cancelled.
- **2 ott 2026 — M10→M05 welcome + M06→M09 voucher-expiring + M09→M05 adapter.**
  Primo flusso event-driven reale: signup → reminder scheduledAt=now → sendReminderNow
  → M05 enqueue → worker invia. Mapping reminder.kind → canale deterministico.
- **29 set - 2 ott 2026 — M05 Publishing v1 (14 task, 17 commit).** 5 tabelle DB
  + RLS, 4 capability publishing.*, PublishAdapter interface (RS-2) + Resend/Twilio
  concreti, repo con Vault, publish-jobs claimBatch SKIP LOCKED, 6 gate (consent/
  recipient-matches/channel/quiet-hours/pressure/budget), worker tickBatch con retry
  backoff → DLQ, UI /impostazioni canali, 7 test invariante, pg_cron per Cloud.
- **29 set 2026 — Supabase Cloud staging attivato.** `regia` Frankfurt Free, 43 migrazioni
  pushate, Owner creato, .env.staging gitignored, dev:staging/build:staging aggiunti.
- **23-25 set 2026 — Rush F1 commerciale skeleton (11 commit ordinati).**
  M01 data-hub + dedup RF-1.7, M06 loyalty, M07 outreach + partners, M09 reminders +
  anti-abbandono, M10 signup, M13 governance, M08 analytics. 24 migrazioni, 212 test.
- **22-23 set 2026 — Blocchi A-F (M3/M4/M11/M2/M12/topic+UTM).** 13 migrazioni,
  31 nuovi test, UI design refresh (hero blob, metric cards animate, brand card parallax).
- **18 set 2026 — F1.5b-α Workflow scheduled+published + calendario bisettimanale drag&drop.**
- **16-17 set 2026 — F1.5a M3 motore editoriale (generazione singola) + hotfix RNF-9.**
- **14 set 2026 — F1.2 M2 brand kit editabile + F1.1 layout UI/shell.**
- **7-8 set 2026 — Cantiere F0 locale completato:** repo, Next.js+TS strict, Supabase
  locale, invarianti DB (RS-3), audit log append-only, auth Owner+MFA-ready, CI 8/8.
- **18 ago 2026 — Capitolato v1.5:** generazione media aperta a servizi esterni (RF-4.5),
  materiali offline (RF-4.7), RS-2 aggiornato.
- Voci precedenti: cronologia in git.

## Prossimo (in ordine)

1. **RN-69 WhatsApp foto dal campo** — ultimo P3 scoperto. Webhook Twilio
   incoming numero dedicato -> genera draft M03 nel tono del marchio. Richiede
   setup Twilio sandbox prima.
2. **Smoke test M05 end-to-end su Cloud**: account Resend + Twilio reali
   (anche sandbox), API keys nella UI /impostazioni, invio manuale a se stesso.
   Richiede abilitare `vault` schema in Dashboard Supabase Cloud (5 min).
3. **F0-b hosting**: DigitalOcean App Platform vs Droplet, Supabase Pro,
   GitHub Actions CI (riusa `ci.sh`), 2FA reale, backup cifrato remoto.
4. **POC desktop OS: decisione** merge/scarta/accantona. Il worktree
   `../regia-desktop/` ha shell completo funzionante.
5. **Connettori M1 reali verso gestionali** Lenny/Stazione (SQL diretto vs API).
   Prerequisito per test end-to-end con dati veri + per far "accendersi"
   RN-47/RN-48 (metriche ordini oggi a 0 senza dati reali).
6. **M14 auto-publishing social** (IG/FB/LinkedIn) — adapter stub e poi
   implementazione reale. Richiede dev account Meta approvato.
7. **M08b Email assistenza** (info@/help@) routing semi-autonomo. Scope da
   brainstormare prima di partire.

## Decisioni prese in corso d'opera

- **3 ott 2026 — IDOR cross-tenant: pattern di prevenzione centrale.**
  `assertEntityOwnedByOrg(table, id, organizationId, humanName)` in m13-governance
  come helper riutilizzabile. Qualsiasi action che accetta un entityId esterno DEVE
  verificare ownership prima di qualunque update. Introdotto dopo audit security
  che ha trovato 11 action vulnerabili. Stesso pattern applicato a RF-1.9
  (requireOwnedContact + lookup server-side della request contactId).
- **3 ott 2026 — Docker Desktop locale escluso dallo workflow.** Dopo WSL2 toggle,
  Hyper-V switch, task manager kills e PC restart tutti falliti, workflow diventa
  Cloud-only: `npx supabase db push --linked` funziona, typecheck/lint/prettier/
  boundaries tutti verdi. I test vitest girano senza Docker. Da riconsiderare solo
  se serve supabase local reset per debugging migrazioni intricate.
- **23 set 2026 — Rendering template PNG server-side accettato in dev**
  (satori + @resvg/resvg-js, ~2MB, bloccante 500-2000ms). Produzione: coda BullMQ (RS-4).
- **23 set 2026 — Full-text search archivio con `ilike` invece di tsvector.**
  L'indice GIN italian predisposto ma non usato: overkill per volumi F1 (<10k drafts).
- **23 set 2026 — Topic classifier heuristico deterministico invece che AI-based.**
  Motivo: zero costo, zero latenza, comportamento predicibile. Manual override sempre.
- **7 set 2026 — Prototipo Streamlit conservato come riferimento**, isolato su branch.
- **7 set 2026 — Nuova piattaforma in `app/`** dentro lo stesso repo (§9.1 monolite).
- **18 ago 2026 — Generazione media AI aperta ai servizi esterni** (v1.5):
  restano RN-72 (no dati inventati), autorizzazione terzi bloccante (Eni), RS-2 adapter.
- **14 ago 2026 — Stack: Supabase + BullMQ/Upstash Redis + Next.js monolite.**
  n8n escluso (fuori RS-1 + RA-8.5).

## Da non dimenticare

- Il QR alla colonnina è **l'unica voce con scadenza di calendario** (picco agosto).
- La deroga RF-6.25 è **dormiente**: al lancio si implementa solo il Modello A.
- **Hosting applicazione ancora aperto** (App Platform vs Droplet su DigitalOcean).
- **Rotare la chiave Anthropic in `app/.env.local`** (finita nel transcript Claude
  Code del 17 set): console.anthropic.com → API Keys → rigenera → sostituisci.
- **Credito Anthropic esaurito** durante tour manuale M4-γ: ricaricare prima di
  riprendere test end-to-end sui percorsi AI (≥$5 basta per il tour).
- **UTM tagging oggi è solo preview.** Applicazione effettiva nei publisher adapter
  di M14 (auto-publishing), quando arriverà. Utility già pronta.
- **Node 22+** vincolato in `app/package.json` engines (dep-cruiser CLI richiede 22+,
  nessun blocker: Node locale e CI sono gia' 22).
- **Docker Desktop locale non funzionante** → workflow Cloud-only, test vitest OK
  senza, migrazioni via `npx supabase db push --linked`.
