# Diario di bordo — Regìa

> Aggiornato: 14 settembre 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- F1.1 chiuso. Prossima decisione: apertura F1.2 (M2 brand kit editabile) o altro sotto-cantiere di F1.

## Fatto

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
