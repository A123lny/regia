# Integrazioni AI: di cosa ha bisogno la piattaforma

Ultimo aggiornamento: 2026-11-24.

Questo documento risponde a **una sola domanda**: quali tipi di intelligenza artificiale servono a Regìa per funzionare come il capitolato prevede?

Non elenca i provider. Elenca le **capacità** (cosa l'AI deve saper fare) e per ciascuna dice **a quale funzione utente serve**, **che tipo di input e output ha**, **quali vincoli di sicurezza** deve rispettare. La scelta del fornitore concreto viene dopo, caso per caso.

---

## 1. Le 8 capacità AI necessarie

In ordine di importanza operativa:

1. **Generazione di testo "con stile"** — scrivere post, avvisi, risposte nel tono del marchio.
2. **Conversazione con strumenti** — un assistente in-app che capisce il contesto e sa eseguire azioni, dietro conferma.
3. **Classificazione e topic labeling** — capire di cosa parla un testo (post, recensione, messaggio).
4. **Ricerca semantica (RAG)** — trovare "roba simile" nel manuale e nello storico, per dare risposte fondate e non ripetere errori.
5. **Analisi sentiment e sintesi** — capire se una recensione è positiva/negativa/grave, riassumere il mese.
6. **Generazione e ritocco immagini** — creare visual brandizzati per i post, auto-crop, alt-text accessibilità.
7. **Comprensione audio** — trascrivere un vocale in avviso rapido pronto da approvare.
8. **Suggerimenti proattivi basati su dati** — l'AI osserva lo storico e consiglia cosa fare oggi.

Le prime quattro sono **indispensabili**: senza, la piattaforma non mantiene le promesse del capitolato. Le altre quattro sono **differenzianti**: trasformano Regìa da strumento utile a strumento strategico.

---

## 2. Capacità #1 — Generazione di testo "con stile"

### A cosa serve

Ogni post, ogni avviso, ogni risposta a recensione passa da qui. È la funzione più visibile della piattaforma.

Casi d'uso già coperti dall'architettura attuale:

- **Post social** (Facebook/Instagram) a partire da una frase del titolare.
- **Avviso rapido** (chiusura, orario straordinario) in tono asciutto, non promozionale.
- **Piano editoriale** con N bozze consecutive (fino a 30) bilanciate per rubrica.
- **Risposta a recensione** nel tono del marchio.

Da completare:

- **Testo campagna email** (soggetto + corpo).
- **Testo SMS** (limite 160 caratteri, link tracciati).
- **Testo WhatsApp** (template approvati).
- **Copy landing pubblica** (headline, benefit, pulsante).

### Caratteristiche richieste

- Deve rispettare un **brand kit** (tono di voce, pilastri, parole bandite, argomenti sensibili).
- Deve seguire **esempi passati approvati** (few-shot: "fai come questi 3 post").
- Deve **evitare pattern già rifiutati** dal titolare (anti-pattern recupero storico).
- Deve **non inventare dati** (prezzi, orari, date non forniti → spazio vuoto, mai inventato).
- Deve **restituire solo testo**, pronto per Facebook/Instagram (niente markdown, niente asterischi).

### Vincoli di sicurezza non negoziabili

- Mai risposta a recensione grave in automatico.
- Mai promozione senza approvazione umana.
- Mai primo contatto a pubblici nuovi in automatico.
- Mai sconti su carburante / cibo Lenny / officina (regole commerciali fisse).
- Il testo prodotto è **sempre una bozza**: pubblica solo l'umano.

### Stato oggi

Funzionante al 70%. Mancano email / SMS / WhatsApp / landing copy.

---

## 3. Capacità #2 — Conversazione con strumenti (il robottino)

### A cosa serve

Un assistente testuale in-app che il titolare usa come "secondo cervello":

- "Fammi vedere tutti i voucher che scadono questa settimana"
- "Crea un contatto Mario Rossi, telefono 333..."
- "Approva la bozza per Lenny di stasera"
- "Com'è andata l'ultima campagna email?"

Il valore sta nel **non dover imparare la UI**: l'utente chiede, l'AI capisce, esegue.

### Caratteristiche richieste

- **Function calling** nativo: il modello sa quando usare uno strumento (tool) invece di rispondere a parole.
- **Streaming**: il testo appare mano a mano, l'esperienza è fluida.
- **Conferma obbligatoria** prima di qualsiasi azione che modifica dati (crea, cancella, emette voucher, approva). Il modello propone, il codice dispone.
- **Contesto di pagina**: se sei su una scheda contatto, il robottino sa chi è.
- **Ownership check**: il robottino non può toccare dati di un'altra organizzazione, anche se gli viene chiesto.
- **Capability check**: se l'utente è Editor non può emettere voucher via robot (come non può via UI).
- **Memoria breve** (conversazione corrente) + **memoria lunga** opzionale (feedback ricorrenti dell'owner, per migliorare il tono).

### Vincoli di sicurezza

- Input esterno (recensioni, commenti) arriva sempre **delimitato** (`<user_message>...</user_message>`), mai come istruzione.
- Nessuna escalation di privilegio: l'LLM non può chiamare uno strumento per cui l'utente non ha capability.
- Snapshot del dato al momento della proposta: l'approvazione lavora sul testo che l'utente ha letto, non su una versione cambiata dopo (hash binding).
- Rate limit per utente (evita abuso + costi).
- Kill switch: l'owner spegne tutto, robottino incluso.

### Stato oggi

Funzionante con 35+ strumenti già coperti. Mancano:

- Memoria lunga delle preferenze dell'owner.
- Risposta con **riferimenti al manuale** (serve RAG — vedi §5).

---

## 4. Capacità #3 — Classificazione e topic labeling

### A cosa serve

Dato un testo (post, recensione, commento), dire **di cosa parla** e **in che categoria sta**.

Esempi:

- Post appena generato → `officina`, `bar`, `consegna`, `promozione`, `avviso`, `ricorrenza`, `altro`.
- Recensione in arrivo → `positiva`, `negativa`, `grave` (la grave non riceve mai risposta AI).
- Richiesta del titolare → `avviso di servizio` oppure `post promozionale` (così il sistema sceglie il prompt giusto).

### Caratteristiche richieste

- **Deterministica** quando possibile (keyword matching + regole), per non spendere chiamate AI.
- **AI-assistita** solo quando la keyword non basta (input ambiguo, lingue multiple, slang).
- Deve restare **leggibile dal codice** (enum fisso), non "classi aperte": il resto della piattaforma lavora su valori prevedibili.

### Vincoli di sicurezza

- Nessun dato personale va mai in prompt di classificazione se non è necessario (minimizzazione).
- La categoria "grave" di una recensione **non deve mai ricevere draft AI**: hardcoded nel flusso.

### Stato oggi

Il **topic classifier post** è deterministico (keyword scoring). La **classificazione recensioni** esiste ma il flusso di arrivo recensioni non è ancora attivo (serve collegare la fonte Google Business).

---

## 5. Capacità #4 — Ricerca semantica (RAG)

### A cosa serve

Due usi ben distinti:

**Uso A — Manuale operativo**  
Il titolare chiede al robottino "come funziona il flusso dei promemoria?". Oggi il robottino risponde "a memoria" dal suo system prompt. Con RAG sul manuale, risponde con citazioni esatte di come è documentato il flusso. **Elimina le allucinazioni** sulle funzioni della piattaforma.

**Uso B — Anti-ripetizione delle bozze**  
Quando l'AI genera un nuovo post su un tema, cerca i **3 post rifiutati più simili** per vedere cosa l'owner aveva già bocciato su argomento analogo. Impara dagli errori senza training vero.

### Caratteristiche richieste

- **Vettori** (embeddings) di dimensione piccola (512-1024) per costi contenuti.
- Database vettoriale integrato (già presente in Postgres via pgvector).
- Indice **tenant-scoped**: il manuale è condiviso, ma le bozze rifiutate sono per organizzazione.
- Pipeline di indicizzazione automatica: quando aggiungo un documento al manuale, viene chunked e indicizzato.

### Vincoli di sicurezza

- I vettori **non contengono dati personali** di contatti o fornitori. Solo bozze editoriali e documentazione.
- Il retrieval è best-effort: se il servizio embeddings è giù, la generazione procede senza (RNF-9).

### Stato oggi

- Uso B già attivo (embeddings sulle rejection_reason, retrieval nei prompt di M03).
- Uso A: infrastruttura pronta (tabella `manuale_chunks` + pgvector 768d) ma **non popolata**. Manca: una routine che prenda il capitolato e la documentazione e la indicizzi.

---

## 6. Capacità #5 — Analisi sentiment e sintesi

### A cosa serve

Il titolare apre Regìa a fine mese e vede:

> "Questo mese 12 recensioni. 8 positive, 3 neutre, 1 grave (già gestita). Temi ricorrenti nei commenti: *servizio veloce* (molto apprezzato), *parcheggio* (segnalato 4 volte come problema), *qualità pizza margherita* (positivo). Suggerimento: parla del parcheggio nel prossimo avviso."

Oggi deve leggersi 12 recensioni una per una.

### Caratteristiche richieste

- Input: testo (recensione, commento, messaggio).
- Output: etichetta sentiment (pos/neg/neutro) + lista di temi estratti.
- Report mensile aggregato per marchio.
- Alert se un tema negativo compare 3+ volte nello stesso mese.

### Vincoli di sicurezza

- Niente PII nella sintesi (nomi di clienti non vanno nel report "temi del mese").
- Il sentiment è **informativo**, mai usato per rifiutare automaticamente un contenuto o un contatto.

### Stato oggi

**Non implementato**. Serve: fetch recensioni (attivo solo come infrastruttura), + classificazione sentiment, + aggregazione mensile.

---

## 7. Capacità #6 — Generazione e ritocco immagini

### A cosa serve

Oggi per ogni post il titolare deve avere una foto pronta. La maggior parte dei post resta "muto" perché mancano le immagini.

Casi d'uso:

- **Generare un visual brandizzato** da descrizione testuale ("una pizza margherita vista dall'alto in stile Lenny").
- **Auto-crop** per formato Facebook (1:1), Instagram (4:5), Stories (9:16).
- **Alt-text automatico** per accessibilità e SEO ("pizza margherita con basilico su tagliere di legno").
- **Rimozione sfondo** per compositing con template.

### Caratteristiche richieste

- Stile **brand-coerente**: il visual deve "sembrare" del marchio, non generico stock.
- **Watermark opzionale** (logo del marchio).
- Output in formati web (WebP preferito).
- Costo basso per non esplodere il budget (~€0.01-0.04 a immagine).

### Vincoli di sicurezza

- **Mai persone reali riconoscibili** generate dall'AI (deepfake risk).
- **Mai marchi protetti** di competitor nel visual.
- Prompt di generazione **filtrati** per policy vietate (RF-6.15..6.20: niente carburante in sconto, ecc.).
- Immagine generata resta sempre una **bozza**: l'owner approva prima di allegarla a un post.

### Stato oggi

**Non implementato**. Modulo `media-providers` predisposto (registri ToS) ma non collegato a nessun generatore.

---

## 8. Capacità #7 — Comprensione audio

### A cosa serve

Il titolare è al banco, non ha tempo per aprire Regìa e scrivere. Preme un pulsante nella app e dice:

> "Da domani giovedì chiusi per inventario, riapriamo venerdì mattina alle 7."

L'AI trascrive e trasforma in un **avviso rapido pronto** nel tono del marchio, da approvare con un click.

### Caratteristiche richieste

- Input: audio breve (10-60 secondi), formati comuni (WAV, MP3, OGG).
- Output: testo trascritto + bozza di post di servizio generata da quel testo.
- Supporto italiano (lingua primaria), ideale anche dialetti locali.
- Latenza: sotto i 5 secondi end-to-end per un messaggio di 10s.

### Vincoli di sicurezza

- Audio **non viene salvato** oltre il tempo della trascrizione (privacy).
- Nessuna trascrizione di conversazioni non consentite dal titolare.

### Stato oggi

**Non implementato**. L'infrastruttura Gemini già configurata in piattaforma supporta input audio nativo: integrazione a ~1 giornata di lavoro + un bottone "registra" nella UI.

---

## 9. Capacità #8 — Suggerimenti proattivi basati su dati

### A cosa serve

Oggi l'AI aspetta che l'utente chieda qualcosa. Un'AI proattiva osserva lo storico e **suggerisce** cosa fare:

- "Il tuo pubblico Lenny risponde meglio ai post di sera (engagement 3x). Programma il prossimo per le 19."
- "Negli ultimi 30 giorni hai parlato tanto di consegna e poco di qualità prodotto. Vuoi un piano che riequilibri?"
- "Il contatto Mario Rossi non ordina da 45 giorni ed è nel tuo top 10% di spesa. Fai un follow-up."

### Caratteristiche richieste

- Osserva **metriche di engagement** (click, risposte, riscatti voucher) — serve collegare M05 publish_log + webhook social.
- Osserva **comportamento clienti** (ordini, frequenza, scontrino medio).
- Osserva **il calendario editoriale** vs equilibrio pilastri (RF-12.1 esiste già per topic labels).
- Produce **suggerimenti azionabili** (non report), con un bottone "fai così" che precompila l'azione.

### Vincoli di sicurezza

- I suggerimenti sono **informativi**, non eseguono niente in automatico.
- Nessuna decisione commerciale (prezzi, promozioni) viene suggerita senza che il titolare la validi.

### Stato oggi

**Infrastruttura parziale**: la dashboard "Oggi" ha una lista "Da fare" ma oggi è reattiva (allerta su stati critici). Il passo proattivo "ecco cosa potresti fare per migliorare" manca.

---

## 10. Riassunto: che AI servono, e dove stiamo

| # | Capacità | Oggi | Priorità per completare il capitolato |
|---|---|---|---|
| 1 | Generazione testo con stile | ~70% | ⭐⭐⭐ (email/SMS/WhatsApp/landing) |
| 2 | Conversazione con strumenti | ~85% | ⭐⭐ (memoria lunga + RAG manuale) |
| 3 | Classificazione / topic | ~80% | ⭐⭐ (sentiment recensioni + topic chat) |
| 4 | Ricerca semantica (RAG) | ~30% | ⭐⭐⭐ (indicizzare il manuale) |
| 5 | Sentiment e sintesi | 0% | ⭐⭐⭐ (report mensile recensioni) |
| 6 | Immagini generate / ritoccate | 0% | ⭐⭐ (visual brandizzati) |
| 7 | Comprensione audio | 0% | ⭐ (nice-to-have operativo) |
| 8 | Suggerimenti proattivi | ~10% | ⭐⭐ (richiede dati di engagement) |

---

## 11. Decisioni che servono prima di scegliere i fornitori

Rispondi a queste e chiudiamo il quadro:

1. **Quale budget mensile totale per AI** metti a tetto? Serve per dimensionare le capacità e scegliere fra opzioni economiche o premium.
2. **Priorità**: cosa vuoi attivare per primo tra le 8 capacità? Il mio suggerimento è ordine 1, 4, 5, 2 (completare testo, poi RAG, poi sentiment, poi memoria robot).
3. **Google Business**: hai l'accesso e vuoi attivare il fetch recensioni? Senza, non ha senso parlare di capacità #5 nel breve.
4. **Il "manuale" da indicizzare**: è `docs/capitolato.md`? C'è altra documentazione? Oppure vuoi che il robottino conosca anche procedure operative interne (es. come si gestiscono i voucher in cassa)?
5. **Immagini**: hai uno stile visivo di riferimento (foto reali del locale? illustrazioni? mix)? Questo cambia la scelta del generatore.
6. **Audio**: registrare dalla web app è ok, o serve anche da WhatsApp del titolare?

Rispondi a questi 6 punti e nel prossimo documento ti porto le **opzioni concrete di fornitori** per ciascuna capacità scelta, con prezzi veri e trade-off.
