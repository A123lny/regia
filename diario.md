# Diario di bordo — Regìa

> Aggiornato: 18 agosto 2026 · Una pagina al massimo. Le voci vecchie si potano:
> la storia completa sta in git. Regole d'uso: vedi CLAUDE.md, sezione "Rito di sessione".

## Adesso

- Nessun task di codice in corso: il cantiere F0 non è ancora aperto.

## Fatto

- **18 ago** — Capitolato esteso a **v1.5** (`docs/capitolato.md`): generazione di immagini
  e video tramite servizi esterni specializzati (es. Higsfield), ammessa anche per
  prodotti/persone/sedi/cibo reali (RF-4.5 riscritto, cade il vecchio divieto assoluto);
  nuovo perimetro materiali offline/stampa multi-formato (RF-4.7); RS-2 aggiornato a due
  punti di contatto AI distinti (testo e media). `CLAUDE.md` allineato.
- **14 ago** — Capitolato consolidato **v1.4** congelato (`docs/capitolato.md`): fusione
  addenda, rinumerazione RU-x, RN-1→87 censiti, decisione voucher (RF-6.7/6.23/6.26/6.27,
  deroga RF-6.25 dormiente), disciplina §9.4 (RS-1..8), §15 registro operativo.
- **14 ago** — `CLAUDE.md` e `docs/diario.md` preparati (deliverable primo commit F0, RQ-1a).
- **12 ago** — Addenda v1.1–v1.3 (ora fusi nella v1.4).
- **5 ago** — Capitolato v1.0 (ora in `docs/archivio/`).

## Prossimo (in ordine)

1. **Apertura cantiere F0**: repository con `docs/capitolato.md`, `CLAUDE.md`, questo diario;
   storici in `docs/archivio/` con l'avvertenza dell'Appendice C.3; CI con RS-1/RS-8 attivi
   dal primo commit (criterio di uscita F0); ambienti; autenticazione; modello dati (campo
   organizzazione, RN-87); audit log; backup.
2. **Prima di chiudere F0 — hosting applicazione (§9.2, §15.A)**: ancora da decidere **App
   Platform vs Droplet** su DigitalOcean (account già attivo, gestito dallo sviluppatore
   interno — stessa persona del team dati di §4). Quando ci si arriva: preparare la
   checklist tecnica per lo sviluppatore (OS, Docker, deploy da GitHub, secret store,
   firewall, dominio/SSL, processo sempre acceso per app + worker coda, monitoraggio
   RNF-6) — non prima, si scrive quando la struttura del codice è chiara. Il criterio di
   uscita di F0 richiede un ambiente vero funzionante, non solo il locale.
3. **Decisioni §15.A residue**: ratifica budget (~50–80 €/mese fissi + consumi, ora da
   ricalcolare con Supabase Pro + Upstash + hosting scelto).
4. **In parallelo, in carico al titolare (§15.B)**: consensi Lenny · vincoli promozionali
   Eni (come nominare il carburante) · query utenti poco attivi · 5–6 post passati per
   marchio con cosa piaceva (RN-70).
5. **Fuori e prima della piattaforma, scadenza agosto**: QR alla colonnina (§15,
   "Opportunità con scadenza").

## Decisioni prese in corso d'opera

- **18 ago** — **Generazione media AI aperta ai servizi esterni** (v1.5): il vecchio
  divieto di RF-4.5 (mai su prodotti/persone/sedi/cibo reali) cade. Restano fermi: nessun
  dato concreto inventato (RN-72), autorizzazione terzi obbligatoria e bloccante quando
  coinvolti marchi/partner con vincolo (RF-6a.2, es. Eni), verifica diritti/ToS del
  fornitore in fase di collegamento (RF-4.3 esteso), adapter intercambiabile — nessun
  fornitore specifico cablato (RS-2). La generazione segue l'autonomia progressiva
  ordinaria (RA-8.3); la pubblicazione resta comunque soggetta alle categorie mai
  autonome di §8.2. Aggiunto anche il perimetro materiali offline/stampa (RF-4.7),
  prima assente dal capitolato.
- **14 ago** — **Database/storage/auth: Supabase** (PostgreSQL+pgvector nativo, storage
  S3-compatibile incluso, piano Pro già attivo), fino a eventuale server proprio in futuro.
  **Coda: BullMQ su Redis via Upstash** (serverless, coerente con V-1). **n8n escluso**
  esplicitamente: richiede comunque Redis, sposterebbe logica fuori dal monolite (RS-1),
  fuori dagli strumenti tipizzati dell'agente (RA-8.5). Resta aperto: dove ospitare
  l'applicazione Next.js e i worker (§15.A, non coperto da Supabase).

## Da non dimenticare

- Il QR alla colonnina è **l'unica voce con scadenza di calendario** (picco di agosto).
- La deroga RF-6.25 è **dormiente**: al lancio si implementa solo il Modello A.
- Al primo commit: fissare la struttura delle cartelle e annotarla nel CLAUDE.md.
- **Hosting applicazione ancora aperto** (App Platform vs Droplet su DigitalOcean): non
  bloccare lo sviluppo locale per questo, ma non dimenticarlo prima di chiudere F0.
