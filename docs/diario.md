# Diario di bordo — Regìa

> Aggiornato: 29 settembre 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- **F1 commerciale chiuso e committato.** Sul branch `feature/design-refresh`, dopo il
  rush marketing del 23 set sono arrivate altre due sessioni (24 e 25 set) che hanno
  completato tutti i moduli commerciali con schema DB, repo, azioni, UI e test invariante.
  Oggi (29 set) tutto committato in **11 commit ordinati per modulo** (RA-8.6 permessi,
  M02 brand, M04 media, M11 admin, M03 editorial, M12 daily-use, M01 data-hub+dedup,
  M06 loyalty+M6a supply, M07 outreach+M07b partners, M09 reminders+anti-abbandono,
  M10 signup+M13 governance+M08 analytics). Totale: **53 file di test · 212 test verdi**
  · CI locale green (typecheck + lint + prettier + build + boundaries).
- **Audit capitolato v1.5 fatto (25 set):** F1 è avanti su marketing e commerciale;
  restano fuori M05 Publishing (nessun adapter social/email/WhatsApp), M08b Email
  assistenza, connettori reali M1 verso gestionali, M13 advertising RF-13.x,
  RN-41/42/43 capacità rider, RF-1.9 richieste dati personali.
- **Da fare oggi/prossimo:** decidere se pushare i 11 commit su GitHub
  (`feature/design-refresh` → `origin`) e poi aprire brainstorming per M05 Publishing
  (prossimo bloccante per andare in produzione).

## Fatto

- **29 set 2026 — Commit ordinato dei rush di sessione 23/24/25 set (11 commit).**
  In ordine di dipendenza: fondamenta permessi (RA-8.6 RU-1a, 50 capabilities + matrice
  centralizzata), M02 brand esteso, M04 media, M11 admin, M03 editorial esteso, M12
  daily-use esteso, M01 data-hub + dedup RF-1.7, M06 loyalty + M6a supply partners,
  M07 outreach + M07b partners, M09 reminders + anti-abbandono, M10 signup + M13
  governance + M08 analytics. CI locale verde tutti i controlli, 212 test invariante.
  Non ancora pushato su origin.
- **25 set 2026 — Blocchi 10-12 chiusura commerciale.** RF-1.7 dedup automatica
  (normalizzazione email/telefono/whatsapp + merge distruttivo con priorita consensi),
  M6a Partner spesa (guardia RF-6.19 nel commercial-guards di M13 che blocca offerte
  su prodotti con partner senza assenso), M9 anti-abbandono (RN-40 con 3 pattern:
  skipped_week / dropped_frequency / silence_inactivity, UNIQUE partial per idempotenza).
  Aggiunte capabilities abandonment.\* e supply.\* alla matrice. Audit capitolato v1.5
  fatto: buchi principali M05 publishing, M08b email, connettori M1 reali, M13
  advertising, RN-41/42/43 capacita rider.
- **24 set 2026 — Blocchi 1-9 F1 commerciale skeleton.** M01 data-hub (contatti +
  veicoli + consensi separati per canale RF-1.4 + catalogo con storia prezzi RF-6.11
  + ordini read-only), M06 loyalty (voucher single-use atomico RF-6.7, contatori,
  offerte), M07 outreach (segmenti + campagne mark_sent Owner-only), M07b partners
  (rete ristoranti Lenny con cooling check + activity log RF-7.5), M10 signup
  (landings pubbliche RF-10.x + form /iscriviti/[slug]), M13 governance (autonomy
  rules L1-L4 + commercial guards RF-6.15..6.20 fisse §8.2), M09 reminders
  (compute-engine 4 tipi + event-driven da m10/m06), M08 analytics (KPI cross-modulo).
  24 migrazioni tra 20260923000014 e 20260924000009. Test invariante saliti a 212.
- **23 set 2026 — Blocchi A-F marketing completati (rush di sessione).**
  - **Blocco A (M3 completamento):** RF-3.1 piano AI multi-post con context accumulation
    e weighted pillar picker, RF-3.4 corsia veloce servizio (prompt asciutto, zero
    linguaggio promozionale, max 3 righe), RF-3.4 calendario ricorrenze annuali
    (seed iniziale 10 eventi per 4 marchi), RF-3.6 sessione a doppia copertura wizard
    cross-brand, RF-3.9 richiesta materiali (foto/video dai ristoranti).
  - **Blocco B (M4 libreria media):** RF-4.1 upload + tag + search + reuse, RF-4.2
    template registry con 8 template (4 Lenny + 4 stazione) via satori + @resvg/resvg-js
    per rendering JSX→SVG→PNG server-side, RF-4.6 anteprima 4 canali (IG post, IG story,
    FB post, Email), RF-4.7 export HR. Media picker inline nel draft.
  - **Blocco C (M11 admin):** RF-11.4 kill switch AI con `assertAiEnabled` guard cablato
    in 4 AI actions, RF-11.5 tetti spesa (assertBudgetOk + logSpend pattern), RF-11.2
    salute connessioni social. Global banner quando kill switch attivo.
  - **Blocco D (M2 completamento):** RF-2.2 font brand (8 fonts Google), RF-2.2a
    identità email (from/reply-to), RF-2.7 white label piattaforma (nome + logo + colore
    primario override).
  - **Blocco E (M12 uso quotidiano):** RF-12.2 archivio full-text con filtri (query
    testo · marchio · stato · date · argomento), RF-12.3 equilibrio editoriale su
    topic_label (segnalazione sbilanciamento ≥20pp), RF-12.4 CRUD ricorrenze, RF-12.6
    banner "bentornato dopo assenza" (soglia 7gg, `previousLoginAt` in session),
    RF-12.7 HelpButton su 12 pagine.
  - **Blocco F (RN-85 + topic_label):** classifier heuristico deterministico
    (7 label: officina, bar, consegna, promozione, avviso, ricorrenza, altro) con
    keyword italiane + prefissi strutturati, auto-classifica su insert, override
    manuale via editor. UTM tagger (`applyUtmToLinks`, preserva query e override
    esistenti, gestisce fragment e trailing punct), preview "originale vs con UTM"
    in ogni draft con link.
  - **13 nuove migrazioni DB** (20260922000001..20260923000013) tutte con RLS +
    check constraint DB-level (RS-3). Migrazioni chiave: brand_media_assets,
    ai_kill_switch, ai_spend_budgets+ledger, platform_branding, brands_font,
    brand_email_identity, content_drafts_topic_label, content_drafts_plan_batch,
    brand_recurring_events, content_material_requests, users_profile_last_login,
    brands_logo_and_rls_hotfix (RLS enforcement retroattivo su 3 tabelle scoperte
    scoperte).
  - **31 nuovi test** (era 62, oggi 93) in 26 file: topic-classifier (12), utm-tagger
    (11), permissions (6), + altri incrementi mirati. Test suite verde in 40s.
  - **UI/UX:** dashboard ridisegnata con hero blob-color per brand, 4 metric card
    animate con stagger, brand card colorate con ornamenti animati parallax,
    BrandLogo component (5 size + placeholder), TopicLabelChip, UtmPreviewCard,
    HelpButton popover, WelcomeBackBanner, RecurrencesBanner, MaterialRequestsBanner,
    EditorialBalanceCard, sidebar sticky + header z-30.
- **18 set 2026 — F1.5b-α Workflow scheduled+published + calendario bisettimanale
  con drag&drop completato.** Extension state machine `content_drafts` con
  scheduled+published, drawer approvati laterale, StatusBadge 5-stati, Card "Chiavi
  AI" read-only. 62 test verdi. Merge in `feature/f1-1-layout-shell` avvenuto in
  questa sessione.
- **17 set 2026 — Hotfix RNF-9 F1.5a:** catch di `VoyageConfigError` nella generation
  path per non bloccare quando Voyage manca.
- **16–17 set 2026 — F1.5a M3 motore editoriale (generazione singola) completato.**
  Adapter Anthropic + Voyage (RS-2), modulo m03-editorial (RS-1) con retrieval
  semantico rifiuti via pgvector HNSW cosine, injection guard XML marker,
  55 test verdi.
- **14 set 2026 — F1.2 M2 brand kit editabile:** 4 tabelle brand_kits/pillars/
  forbidden_words/sensitive_topics con seed dal capitolato, 6 card edit in
  `/marchi/[slug]`, `formatBrandContextForAI` pronto per M3.
- **14 set 2026 — F1.1 layout UI + shell:** Tailwind v4 + shadcn/ui + Fraunces/Geist,
  6 pagine navigabili, 2 moduli reali (m11-admin + m12-daily-use), 16 test.
- **7–8 set 2026 — Cantiere F0 locale completato:** struttura repo, Next.js+TS strict,
  Supabase locale, modello dati F0 con invarianti DB (RS-3), audit log append-only,
  auth minimale Owner+MFA-ready, CI locale verde 8/8. `cd app && npm run ci`
  come unico comando di verifica.
- **18 ago 2026 — Capitolato v1.5** (`docs/capitolato.md`): generazione media aperta
  a servizi esterni (RF-4.5), materiali offline (RF-4.7), RS-2 aggiornato.
- Voci precedenti: cronologia in git.

## Prossimo (in ordine)

1. **Push su GitHub** (`feature/design-refresh` → `origin`) dei 11 commit F1 commerciale.
   Da decidere insieme prima di eseguire (policy: push shared branch = azione visibile
   agli altri, richiede conferma esplicita).
2. **M05 Publishing** (bloccante per produzione, oggi 0% implementato): scelta priorità
   canali (WhatsApp + email per utilità voucher/richiami/avvisi RF-5.5a, poi social),
   architettura adapter (RS-2, uno per canale), coda BullMQ per idempotenza invii
   (RS-4, RNF-4), integrazione con `assertBudgetOk` di M11.
3. **RF-1.9 Richieste dati personali** (export/cancellazione), quick win legale.
4. **RN-41/42/43 Capacità rider Lenny** prima di attivare motore promozioni.
5. **M08b Email assistenza** (info@/help@) routing semi-autonomo, bassa priorità.
6. **M13 advertising RF-13.x** (motore promo con tetti spesa reali), dopo M05.
7. **Connettori M1 reali verso gestionali** Lenny/Stazione, decisione: SQL diretto vs
   API driver. Bloccante per test end-to-end con dati veri.
8. **F0-b hosting** ancora aperto (§15.A): DigitalOcean App Platform vs Droplet,
   Supabase Pro, GitHub Actions, 2FA reale, backup cifrato remoto. Non blocca lo
   sviluppo locale ma serve prima di andare in produzione.

## Decisioni prese in corso d'opera

- **23 set 2026 — Rendering template PNG server-side accettato in dev**
  (satori + @resvg/resvg-js, ~2MB, bloccante 500-2000ms). Per la produzione servirà
  coda BullMQ (RS-4). Trade-off consapevole: per lo sviluppo l'esperienza è OK,
  in prod si sposta in background.
- **23 set 2026 — Full-text search archivio con `ilike` invece di tsvector**.
  L'indice GIN tsvector italian è predisposto in migrazione ma non usato: overkill
  per volumi F1 (<10k drafts). Si rivaluta a >10k.
- **23 set 2026 — Topic classifier heuristico deterministico invece che AI-based.**
  Motivo: zero costo, zero latenza, comportamento predicibile. L'AI ha costi e
  latenza che non giustificano l'accuratezza incrementale per una classificazione
  a 7 label. Manual override sempre disponibile.
- **7 set 2026 — Prototipo Streamlit conservato come riferimento**, non archiviato
  e non cancellato. Vive isolato su branch, non tocca main.
- **7 set 2026 — Nuova piattaforma in `app/`** dentro lo stesso repo (§9.1 monolite,
  un solo deployable).
- **18 ago 2026 — Generazione media AI aperta ai servizi esterni** (v1.5): cadono
  i divieti su prodotti/persone/sedi/cibo. Restano fermi RN-72 (no dati inventati),
  autorizzazione terzi bloccante per partner con vincolo (Eni), RS-2 adapter
  intercambiabile.
- **14 ago 2026 — Stack: Supabase (Postgres+pgvector+storage+auth) + BullMQ/Upstash
  Redis + Next.js monolite.** n8n escluso (fuori RS-1 + RA-8.5).

## Da non dimenticare

- Il QR alla colonnina è **l'unica voce con scadenza di calendario** (picco di agosto).
- La deroga RF-6.25 è **dormiente**: al lancio si implementa solo il Modello A.
- **Hosting applicazione ancora aperto** (App Platform vs Droplet su DigitalOcean):
  decidere prima di aprire F0-b.
- **Rotare la chiave Anthropic in `app/.env.local`** (finita nel transcript Claude
  Code del 17 set): console.anthropic.com → API Keys → rigenera → sostituisci.
- **Credito Anthropic esaurito** durante tour manuale M4-γ: prima di riprendere
  test end-to-end sui percorsi AI, ricaricare (≥$5 basta per il tour).
- **UTM tagging oggi è solo preview.** L'applicazione effettiva ai link avverrà nei
  publisher adapter di M14 (auto-publishing), quando arriverà. Utility già pronta.
- **`npm run ci` step 4/6 (dep-cruiser CLI)** fallisce su node 20 (richiede 22+).
  Il controllo RS-1 equivalente gira comunque via `tests/boundaries/*.test.ts` ed è
  verde. Da decidere: upgrade node o rimuovere step ridondante dal ci.sh.
