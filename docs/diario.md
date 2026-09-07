# Diario di bordo — Regìa

> Aggiornato: 7 settembre 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- **Cantiere F0 aperto** (7 set 2026) — implementazione in corso secondo `docs/superpowers/plans/2026-09-07-cantiere-f0.md`.

## Fatto

- **7 set 2026** — Riordino repo: capitolato in `docs/capitolato.md`, diario in `docs/diario.md`, `docs/archivio/` creato per storici futuri. Struttura cartelle fissata in `CLAUDE.md` (RQ-1a).
- **2–3 set 2026 (recuperato ex-post)** — Prototipo esplorativo Streamlit sul branch `prototype/streamlit`: 17 pagine navigabili, 19 servizi (M1–M13 + M8b + §8 + brand templates + help texts), 18 test, storage JSON, auth minimale. Non è la piattaforma target: serve come **riferimento visivo dei flussi** durante lo sviluppo del vero applicativo TS/Next.js. Nessun merge previsto; il branch resta intatto.
- **18 ago 2026** — Capitolato esteso a **v1.5** (`docs/capitolato.md`): generazione media via servizi esterni (RF-4.5), materiali offline (RF-4.7), RS-2 aggiornato a due punti di contatto AI. `CLAUDE.md` allineato.
- **14 ago 2026** — Capitolato consolidato **v1.4** congelato.
- Voci precedenti: cronologia in git.

## Prossimo (in ordine)

1. Esecuzione dei 14 task di `docs/superpowers/plans/2026-09-07-cantiere-f0.md` — scaffolding, Supabase locale, modello dati F0, auth, audit log, RS-1/RS-8 in CI locale, backup provato.
2. **F0-b (fuori scope del piano corrente):** hosting applicazione (§15.A), Supabase Pro collegato, GitHub Actions, 2FA reale, backup cifrato remoto. Si apre quando si sceglie l'hosting.
3. **F1 (dopo F0-b):** Data Hub su Lenny e lavaggi (RF-1.x), consensi (RF-1.4), brand kit (RF-2.x), primo piano editoriale generato.

## Decisioni prese in corso d'opera

- **7 set 2026** — **Prototipo Streamlit conservato come riferimento**, non archiviato e non cancellato. Motivo: contiene già decisioni di prodotto (flussi UI, distinzioni categoriali, wording) che varranno oro nella traduzione al vero applicativo. Vive isolato sul branch, non tocca `main`.
- **7 set 2026** — **Nuova piattaforma in `app/`** dentro lo stesso repo, non repo separato. Motivo: coerente con §9.1 (monolite modulare, un solo deployable), semplifica citazione ID nei commit (RQ-1), lascia il capitolato accanto al codice che lo implementa.
- **7 set 2026** — **Sviluppo locale prima di GitHub.** Fase locale = F0-locale (questo piano); l'aggancio al cloud è F0-b, che chiude effettivamente il criterio di uscita F0 (§12.3: "ripristino backup provato **e** RS-1/RS-8 attivi in CI").
- **18 ago 2026** — **Generazione media AI aperta ai servizi esterni** (v1.5): il vecchio divieto di RF-4.5 (mai su prodotti/persone/sedi/cibo reali) cade. Restano fermi: nessun dato concreto inventato (RN-72), autorizzazione terzi obbligatoria e bloccante quando coinvolti marchi/partner con vincolo (RF-6a.2, es. Eni), verifica diritti/ToS del fornitore in fase di collegamento (RF-4.3 esteso), adapter intercambiabile — nessun fornitore specifico cablato (RS-2). La generazione segue l'autonomia progressiva ordinaria (RA-8.3); la pubblicazione resta comunque soggetta alle categorie mai autonome di §8.2. Aggiunto anche il perimetro materiali offline/stampa (RF-4.7), prima assente dal capitolato.
- **14 ago 2026** — **Database/storage/auth: Supabase** (PostgreSQL+pgvector nativo, storage S3-compatibile incluso, piano Pro già attivo), fino a eventuale server proprio in futuro. **Coda: BullMQ su Redis via Upstash** (serverless, coerente con V-1). **n8n escluso** esplicitamente: richiede comunque Redis, sposterebbe logica fuori dal monolite (RS-1), fuori dagli strumenti tipizzati dell'agente (RA-8.5). Resta aperto: dove ospitare l'applicazione Next.js e i worker (§15.A, non coperto da Supabase).

## Da non dimenticare

- Il QR alla colonnina è **l'unica voce con scadenza di calendario** (picco di agosto).
- La deroga RF-6.25 è **dormiente**: al lancio si implementa solo il Modello A.
- Al primo commit: fissare la struttura delle cartelle e annotarla nel CLAUDE.md.
- **Hosting applicazione ancora aperto** (App Platform vs Droplet su DigitalOcean): non
  bloccare lo sviluppo locale per questo, ma non dimenticarlo prima di chiudere F0.
