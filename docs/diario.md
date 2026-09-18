# Diario di bordo — Regìa

> Aggiornato: 18 settembre 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- F1.5b-α chiuso su branch `feature/f1-5b-alpha-workflow-programmazione`, pronto
  per merge in `feature/f1-1-layout-shell`. Workflow scheduled+published + calendario
  bisettimanale con drag-and-drop + card impostazioni "Chiavi AI" read-only,
  tutto verificato in locale (62 test verdi). Prossima decisione:
  (a) F1.5b-β (coda BullMQ + scheduler, richiede Redis/Docker o Upstash),
  (b) F1.5c (sessione RF-3.6 guidata + canali multipli),
  (c) F1.6 (edit + test connessione chiavi AI + tetti spesa),
  (d) F1.3 (utenti Editor),
  (e) F1.4 (Data Hub reale),
  (f) merge F1.5b-α ora e riprendere il tour manuale end-to-end di F1.5a+b una
  volta ripristinato il credito Anthropic.

## Fatto

- **18 set 2026 — F1.5b-α Workflow + calendario + programmazione manuale completato.**
  - State machine `content_drafts` estesa con `scheduled` e `published` (RF-3.5,
    coprendo il pezzo del workflow che F1.5a lasciava aperto). Transizioni:
    approved→scheduled→published (terminale). Rewind approved←scheduled
    possibile via "Annulla programmazione".
  - 3 migrazioni DB: `20260918000001` enum extension (idempotente `ADD VALUE
    IF NOT EXISTS`) + `20260918000002` 2 colonne timestamptz + 3 CHECK
    constraint + index parziale + `20260918000003` hotfix biconditional
    `approved_has_timestamp` (originale F1.5a bloccava transizione approved→
    scheduled per contraddizione con `schedule_after_approve`; ampliato a
    `(approved_at IS NOT NULL) = (status IN ('approved','scheduled','published'))`).
  - 5 nuove funzioni repo (`scheduleDraft`/`unscheduleDraft`/`markPublished`
    mutator con race guards; `listScheduledByBrandBetween` +
    `listApprovedNotScheduledByBrand` query), tutte tenant-scoped (pattern IDOR
    fix ripetuto per la quarta volta — impossibile dimenticare).
  - 3 nuove server actions m03 con `requireOwnedDraft` + audit
    `editorial.draft_scheduled|unscheduled|published` + revalidatePath lista +
    calendario.
  - Route `/contenuti/[slug]/calendario`: vista bisettimanale (14gg a rullo)
    coerente con RF-3.6 doppia copertura e V-2 sessioni 30 min. Layout
    responsive (1 col mobile, 2 col tablet, 7 col desktop). Drawer laterale
    "Approvati in attesa" con card trascinabili via `@dnd-kit/core` (~30 KB,
    accessible, mobile touch). Drop su cella futura programma per le 09:00
    default; celle passate non droppable con feedback rosso.
  - Estensione dettaglio draft: branching per status (approved→form datetime
    picker, scheduled→banner blu + bottoni "Annulla"/"Segna pubblicato",
    published→banner grigio terminale). `StatusBadge` a 5 stati applicato sia
    a `[slug]/page.tsx` (lista) che a `[draftId]/page.tsx` (dettaglio) + link
    "Calendario" nell'header lista.
  - Card "Chiavi AI" read-only in `/impostazioni` (RNF-1 + RU-1a): status di
    `ANTHROPIC_API_KEY` e `VOYAGE_API_KEY` letto server-side con maschera
    parziale sicura (`prefix(8) + length`, senza fingerprint slice(-4) — hotfix
    security post-review). Card gated al ruolo owner. Nessuna edit UI, zero
    storage in DB — rimandato a F1.6.
  - 7 nuovi test invarianti in 3 file (enum extended: 2, schedule invariants
    CHECK: 3, scheduled tenant scoping IDOR: 2). Totale test dopo F1.5b-α:
    **62** (era 55). CI locale verde 62/62.
  - 2 nuove dep npm: `@dnd-kit/core@6.3.1` + `@dnd-kit/utilities@3.2.2` (UI
    libraries, non SDK di servizi — RS-2 rispettato).
  - Commit range: `ddbfcbf..HEAD` (~15 commit) su
    `feature/f1-5b-alpha-workflow-programmazione`.
  - Rulings prese durante il cantiere (ledger completo in
    `.superpowers/sdd/2026-09-18-f1-5b-alpha-workflow-programmazione/progress.md`):
    P1 test enum-extended riscritto in indirect (colonne T3 non ancora presenti);
    P2 migrazione 000003 correttiva biconditional approved_has_timestamp
    (plan defect emerso in implementazione);
    P3 docstring `markPublished` fuori sync con codice (published_at
    client-side vs "lato DB", zero impatto runtime — parked);
    P4 minAttr in schedule-form computato al mount (protetto da server-side
    validation, parked);
    P5 auto security review MEDIUM su impostazioni: role gate + rimozione
    slice(-4) fingerprint = hotfix commit a2bb652;
    P6 approved-drawer link a /nuovo (plan-drift-vs-spec fissato in fix round);
    P7 timezone assumption sameLocalDate (progetto UTC+1/+2, parked);
    P8 loading skeleton semplificato (YAGNI, parked).
  - Prossimo sotto-cantiere: F1.5b-β (stato programmato/pubblicato/misurato +
    coda BullMQ RS-4), oppure F1.6 (edit chiavi + tetti spesa), oppure F1.3
    (utenti Editor).
- **17 set 2026 — Hotfix RNF-9 in F1.5a scoperto dal tour manuale.**
  - Il catch in `runGenerateSocialPost` era troppo stretto: coglieva solo errori
    API/timeout Voyage, ma la config missing (`VoyageConfigError`) veniva
    propagata verso `error.tsx`, bloccando la generazione anche quando il resto
    del sistema è a posto.
  - Fix: import di `VoyageConfigError` + `instanceof` esteso. Commento aggiornato
    per esplicitare che F1.5a può girare senza Voyage (retrieval anti-pattern
    diventa utile solo con un corpus di rifiuti, non è day-1 critical).
  - `actions.ts:rejectContentDraft` già catchava tutti gli errori (`catch (err)`
    a maglie larghe), quindi nessun fix lì.
  - Commit `393323f` su `feature/f1-1-layout-shell`, CI 55/55, push OK.
  - Test dedicato non aggiunto: richiederebbe mocking di Anthropic+Supabase che
    il progetto oggi non usa. Da valutare in F1.5b quando/se si aggiungono
    infrastrutture di test unit-with-mocks.
- **16–17 set 2026 — F1.5a M3 Motore editoriale (generazione singola) completato.**
  - Adapter AI (RS-2, unica porta per canale): `lib/ai/anthropic.ts` (Claude Sonnet 4.6, timeout 30s, pricing hardcoded) + `lib/ai/voyage.ts` (embeddings vector(512), timeout 15s).
  - Modulo `m03-editorial` (RS-1) con `public.ts` che espone 3 types, 2 query, 3 server actions. Orchestrazione con brand kit di M02 + retrieval semantico rifiuti via pgvector (RF-3.8, HNSW cosine filtered).
  - Injection guard XML marker `<owner-input>`/`<anti-pattern-recenti>` per input Owner e reason rifiuti (RA-8.7): 4 test unit dedicati con tentativi di tag-escape.
  - 3 migrazioni DB: `content_drafts` (7 check, 3 FK, enum status) + embeddings vector(512) con constraint embedding-only-if-rejected + RLS denial-by-default; RPC `fetch_similar_rejections`.
  - Route `/contenuti/*` (5 pagine, sidebar aggiornata): elenco marchi, lista drafts per brand con badge status, form generazione con anti-slot-machine rate limit 10s, dettaglio draft con approva/rifiuta con motivo obbligatorio 1-500 char (RF-3.8 dataset apprendimento).
  - Server actions con `requireOwnedBrand`/`requireOwnedDraft` (RN-87, RU-1a Owner-only), audit `editorial.draft_*` per ogni generate/approve/reject (RF-11.3, RA-8.12), fallback Voyage down su reject (RNF-9).
  - Fix cross-tenant IDOR estesi al repo per entrambe le query esposte: `getContentDraft` (T11 fix) e `listContentDraftsByBrand` (final review fix). Repo-layer defense = impossibile dimenticare per futuri caller. 2 invariant test cross-org/same-org dedicati.
  - 25 nuovi test in 10 file (7 invarianti DB + 1 boundaries m03 + 4 injection guard + 2 tenant-scoping IDOR). Totale test dopo F1.5a: **55** (era 30). CI locale verde 55/55 (lint + format + typecheck + boundaries + migrazioni + tutti i test).
  - Commit range: `59c39ab..8379d4b` su `feature/f1-5a-editorial-engine` (16 commit inclusi 2 fix round IDOR).
  - Prossimo sotto-cantiere: F1.5b (stato programmato/pubblicato/misurato + coda BullMQ RS-4), oppure F1.3 utenti Editor, oppure F1.4 Data Hub.
- **14 set 2026 — F1.2 M2 Brand kit editabile completato.**
  - 4 nuove tabelle DB (brand_kits, brand_pillars, brand_forbidden_words, brand_sensitive_topics)
    con RLS denial-by-default, FK cascade, unique/check constraints (RS-3).
  - Seed iniziale dai contenuti del capitolato per i 4 marchi (tono, contesto strategico,
    rubriche §7.2, parole bandite, argomenti sensibili tipo carburante Stazione).
  - Nuovo modulo `m02-brand` (RS-1): `public.ts` con `getBrandKitWithLists`,
    `formatBrandContextForAI` (pronto per M3), 11 server actions con audit log
    (RF-11.3) e role check Owner.
  - Route `/marchi/[slug]` con 6 card editing (tono, contesto strategico, rubriche,
    parole bandite, argomenti sensibili, anteprima AI).
  - 4 nuovi test invarianti (brand-kit-scoping cascade, uniqueness, pillar weight
    range, sensitive topic kind enum). Test totali dopo F1.2: 30.
  - Commit range: `dcfe500..HEAD` su `feature/f1-2-brand-kit` (~11 commit).
  - Prossimo sotto-cantiere: F1.3 utenti/permessi Editor OR F1.5 M3 piano editoriale.
- **14 set 2026 — F1.1 Layout UI + shell completato.**
  - Base grafica editoriale calda: Tailwind v4 + shadcn/ui v4 + Fraunces (serif) + Geist (sans) + palette 11 CSS vars (crema, terracotta, salvia, ecc.) + 4 colori marchio come chip.
  - 6 pagine navigabili: landing pubblica arricchita (hero + 4 marchi + 6 feature card), login card, dashboard M12 con 4 metric card + brand chips + card ambiente, marchi RO, audit log owner-only con filtro, impostazioni profilo + ambiente + logout.
  - 2 moduli reali (m11-admin + m12-daily-use) — RS-1 verificato in CI con dep-cruiser.
  - 16 test totali passing (organization scoping, brand uniqueness, audit append-only, dashboard stats, boundaries, brand-chip UI).
  - Fix intermedi: middleware SSR best-effort con Promise.race + timeout 2s (sblocca server actions React 19 in Next 16 Turbopack); Header filtra brands per organization_id (IDOR fix); role check RU-1a su audit; safeDecodeError login.
  - Commit range: `e200085..HEAD` su `feature/f1-1-layout-shell` (~23 commit inclusi 10 fix round).
  - Prossimo sotto-cantiere: F1.2 = M2 brand kit editabile (editing colori/tono/parole bandite/contesto strategico per marchio).
- **7–8 set 2026 — Cantiere F0 locale completato.**
  - Repo riordinato (`docs/`), scaffolding Next.js+TS strict in `app/`, Supabase locale via CLI, modello dati F0 (organizations, brands, users_profile, audit_events) con invarianti in DB (RS-3), audit log append-only (RF-11.3), adapter Supabase (RS-2), auth minimale con Owner+MFA predisposto (RU-1, RU-3), confini di modulo (RS-1) attivi in CI locale, migrazioni versionate (RS-8), backup+restore provati (RQ-5, RNF-3).
  - Un solo comando di verifica: `cd app && npm run ci` (lint + format + typecheck + boundaries + migrazioni + 8 test — tutto verde).
  - Sequenza commit dettagliata: `.superpowers/sdd/2026-09-07-cantiere-f0/progress.md`.
  - **Fuori scope, aperto:** hosting applicazione (§15.A), Supabase Pro collegato, GitHub Actions, 2FA reale, backup remoto cifrato → **F0-b**, si apre alla scelta dell'hosting.
- **7 set 2026** — Riordino repo: capitolato in `docs/capitolato.md`, diario in `docs/diario.md`, `docs/archivio/` creato per storici futuri. Struttura cartelle fissata in `CLAUDE.md` (RQ-1a).
- **2–3 set 2026 (recuperato ex-post)** — Prototipo esplorativo Streamlit sul branch `prototype/streamlit`: 17 pagine navigabili, 19 servizi (M1–M13 + M8b + §8 + brand templates + help texts), 18 test, storage JSON, auth minimale. Non è la piattaforma target: serve come **riferimento visivo dei flussi** durante lo sviluppo del vero applicativo TS/Next.js. Nessun merge previsto; il branch resta intatto.
- **18 ago 2026** — Capitolato esteso a **v1.5** (`docs/capitolato.md`): generazione media via servizi esterni (RF-4.5), materiali offline (RF-4.7), RS-2 aggiornato a due punti di contatto AI. `CLAUDE.md` allineato.
- **14 ago 2026** — Capitolato consolidato **v1.4** congelato.
- Voci precedenti: cronologia in git.

## Prossimo (in ordine)

1. **Decisione aperta:** F0-b (hosting applicazione §15.A, Supabase Pro, GitHub Actions, 2FA reale, backup cifrato remoto) oppure F1 in locale (Data Hub RF-1.x, consensi RF-1.4, brand kit RF-2.x) usando il DB locale senza aspettare l'hosting. Le due strade non sono mutuamente esclusive.
2. **F0-b:** aggancio al cloud — scelta hosting (DigitalOcean App Platform vs Droplet), Supabase Pro collegato, GitHub Actions, 2FA reale. Si apre quando si decide l'hosting.
3. **F1 (dopo o in parallelo a F0-b):** Data Hub su Lenny e lavaggi (RF-1.x), consensi (RF-1.4), brand kit (RF-2.x), primo piano editoriale generato.

## Decisioni prese in corso d'opera

- **7 set 2026** — **Prototipo Streamlit conservato come riferimento**, non archiviato e non cancellato. Motivo: contiene già decisioni di prodotto (flussi UI, distinzioni categoriali, wording) che varranno oro nella traduzione al vero applicativo. Vive isolato sul branch, non tocca `main`.
- **7 set 2026** — **Nuova piattaforma in `app/`** dentro lo stesso repo, non repo separato. Motivo: coerente con §9.1 (monolite modulare, un solo deployable), semplifica citazione ID nei commit (RQ-1), lascia il capitolato accanto al codice che lo implementa.
- **7 set 2026** — **Sviluppo locale prima di GitHub.** Fase locale = F0-locale (questo piano); l'aggancio al cloud è F0-b, che chiude effettivamente il criterio di uscita F0 (§12.3: "ripristino backup provato **e** RS-1/RS-8 attivi in CI").
- **18 ago 2026** — **Generazione media AI aperta ai servizi esterni** (v1.5): il vecchio divieto di RF-4.5 (mai su prodotti/persone/sedi/cibo reali) cade. Restano fermi: nessun dato concreto inventato (RN-72), autorizzazione terzi obbligatoria e bloccante quando coinvolti marchi/partner con vincolo (RF-6a.2, es. Eni), verifica diritti/ToS del fornitore in fase di collegamento (RF-4.3 esteso), adapter intercambiabile — nessun fornitore specifico cablato (RS-2). La generazione segue l'autonomia progressiva ordinaria (RA-8.3); la pubblicazione resta comunque soggetta alle categorie mai autonome di §8.2. Aggiunto anche il perimetro materiali offline/stampa (RF-4.7), prima assente dal capitolato.
- **14 ago 2026** — **Database/storage/auth: Supabase** (PostgreSQL+pgvector nativo, storage S3-compatibile incluso, piano Pro già attivo), fino a eventuale server proprio in futuro. **Coda: BullMQ su Redis via Upstash** (serverless, coerente con V-1). **n8n escluso** esplicitamente: richiede comunque Redis, sposterebbe logica fuori dal monolite (RS-1), fuori dagli strumenti tipizzati dell'agente (RA-8.5). Resta aperto: dove ospitare l'applicazione Next.js e i worker (§15.A, non coperto da Supabase).

## Da non dimenticare

- Il QR alla colonnina è **l'unica voce con scadenza di calendario** (picco di agosto).
- La deroga RF-6.25 è **dormiente**: al lancio si implementa solo il Modello A.
- **Hosting applicazione ancora aperto** (App Platform vs Droplet su DigitalOcean): decidere prima di aprire F0-b.
- **Rotare la chiave Anthropic in `app/.env.local`** (finita nel transcript Claude Code del 17 set): console.anthropic.com → API Keys → rigenera → sostituisci nel file. Nessuna urgenza operativa, solo igiene.
- **Aggiungere credito Anthropic** ($5 basta) prima di riprendere il tour manuale F1.5a.
