# CLAUDE.md — Regìa

> Regole operative per lo sviluppo assistito (RQ-1a). La fonte di verità dei requisiti è
> `docs/capitolato.md` (v1.5, 18 ago 2026 — estensione di v1.4 congelato il 14 ago 2026):
> in caso di dubbio si legge quello. Questo file si aggiorna solo quando cambia il
> capitolato. Le regole vivono qui, versionate — mai in memorie locali della macchina.

## Il progetto in tre righe

Piattaforma di marketing e operazioni commerciali multi-marchio (gruppo Lenny + stazione Eni,
San Marino). Monolite modulare TypeScript end-to-end, Next.js, BullMQ/Redis, PostgreSQL+pgvector,
storage S3, AI via Anthropic API. **Un solo sviluppatore, volumi piccoli** (migliaia di contatti,
~50 ristoranti): la semplicità operativa vale più di qualsiasi beneficio teorico di scalabilità.

## Rito di sessione — la proattività è tua, non dell'utente

**Apertura (sempre, prima di toccare codice):**
1. Leggi `docs/diario.md`.
2. Confronta con `git log` e `git status`: se l'ultima sessione non risulta chiusa,
   riconcilia il diario con lo stato reale e dillo.
3. Riassumi in 2–3 righe dove siamo e cosa era previsto. **Proponi tu l'obiettivo di oggi**
   e chiedi conferma prima di iniziare.

**Durante:**
- All'avvio di un task nuovo: annotalo tu in "Adesso" nel diario, con gli ID requisito.
- A ogni task completato: aggiorna subito il diario (Fatto / Adesso / Prossimo).
  **Non aspettare la chiusura**: il diario deve essere sempre corrente all'ultimo task finito.
- Decisione non ovvia presa lavorando → una riga in "Decisioni", col perché.

**Chiusura:**
- Se l'utente dice "chiudi la sessione" (o simili): aggiorna il diario, proponi il commit.
- Se l'utente sembra concludere (saluta, "basta per oggi", "ok direi che ci siamo", chiede
  un riepilogo): **proponi tu** di chiudere la sessione e aggiornare il diario. Non aspettare
  che lo chieda.

## Vincoli assoluti — mai violare, nemmeno per comodità implementativa

- **Sola lettura verso i gestionali aziendali** (RF-1.1). Unica deroga: RF-6.25 (scrittura
  voucher, Modello B) — oggi **dormiente**: non implementarla senza istruzione esplicita.
- **Categorie mai autonome** (§8.2): promozioni, comunicazioni che toccano partner spesa o
  marchio Eni, primo contatto a pubblici nuovi, risposte pubbliche a critiche/recensioni
  negative, incidenti e disservizi, prezzi, attivazione/modifica advertising, qualsiasi
  sforamento di tetti di spesa. Il codice non deve nemmeno renderlo possibile.
- **Il modello propone, il codice dispone** (RA-8.6): livelli di autonomia e limiti sono
  applicati dal codice negli strumenti tipizzati, mai delegati al giudizio del modello.
- **Input esterno non fidato** (RA-8.7): recensioni, commenti, record, pagine web passano
  all'agente come contenuto delimitato, mai come istruzioni.
- **Regole commerciali fisse** (RF-6.15..6.20): mai sconti sul carburante; mai sconti sul
  cibo a carico di Lenny; mai sconti sulla tariffa oraria officina; nessuna promozione se
  la capacità rider non regge; niente sconti su prodotti del partner senza assenso; promo
  nuovi ristoranti a carico del ristorante.
- **Dati concreti mai inventati** (RN-72): orari, prezzi, date, nomi vengono dai dati;
  se mancano, spazio vuoto e domanda.
- **La disiscrizione funziona sempre** (M5): il clic vale già come uscita, il resto è
  una domanda in più, mai una condizione.

## Regole strutturali RS-1..8 (dettagli: capitolato §9.4)

- **RS-1** Confini di modulo reali: mai importare gli interni di un altro modulo, mai
  leggere le sue tabelle direttamente. Verifica automatica in CI.
- **RS-2** Il dominio dipende da interfacce adapter, mai da SDK dei fornitori. L'AI ha
  due punti di contatto distinti nel sistema (testuale: Anthropic API; media
  immagini/video: adapter verso servizi esterni intercambiabili, RF-4.5) — ciascuno
  unico nel proprio ambito.
- **RS-3** Gli invarianti stanno nel database (unique, FK, check, transazioni): voucher a
  uso singolo, consensi per canale, contatori. Non solo controlli applicativi.
- **RS-4** Asincrono disciplinato: chiave di idempotenza persistita, retry con backoff e
  limite, dead-letter con notifica. Nessuna chiamata AI nel percorso che pubblica contenuti
  già approvati o riscatta voucher.
- **RS-5** Configurazione come dato con storico e data di validità. Mai costanti
  commerciali (soglie, margini, limiti) nel codice.
- **RS-6** Convenzionalità obbligatoria: framework e librerie nel modo documentato
  ufficialmente. Niente pattern esotici; deroghe motivate per iscritto.
- **RS-7** Prestazioni a budget solo dove il capitolato le fissa (RF-6.8, RF-12.1, RF-3.4).
  Vietata l'ottimizzazione speculativa: niente cache o componenti senza una misura.
- **RS-8** Schema DB solo via migrazioni versionate applicate dalla pipeline. Mai
  interventi manuali in produzione.

## Definition of done (RQ-7)

Un task è finito solo con: TypeScript strict senza eccezioni non motivate · lint pulito ·
test degli invarianti toccati · ID dei requisiti citati (nel task e nel commit) · CI verde.
**Regola del campo pulito**: l'area toccata resta in ordine — niente codice morto, niente
duplicazioni, nomi coerenti. I refactoring ampi sono task espliciti a sé, mai lavoro
infilato di nascosto in altri task.

## Test non negoziabili (RQ-3)

Se il lavoro tocca uno di questi punti, i test relativi sono obbligatori e si scrivono
prima di dichiarare finito: consensi · limiti di autonomia · calcolo margini e soglie ·
idempotenza invii (nessun doppio invio) · voucher a uso singolo (Modelli A/B, RF-6.26) ·
interruttore di arresto · injection sull'agente · tetti di spesa advertising.

## Convenzioni

- Identificatori di codice in inglese; interfaccia utente, commenti e documenti in italiano.
- Messaggi di commit: prima gli ID, poi la descrizione (es. `RF-6.7: riscatto idempotente`).
- Nessun segreto nel repository (RNF-1): credenziali solo nel secret store.
- Struttura delle cartelle: si fissa al primo commit di F0 e si annota qui.

## Diario

`docs/diario.md` — una pagina al massimo: Adesso · Fatto · Prossimo · Decisioni ·
Da non dimenticare. Le voci vecchie si potano: la storia completa sta in git.
