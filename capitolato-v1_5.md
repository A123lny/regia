# Capitolato Tecnico — versione 1.5
## Piattaforma di marketing e operazioni commerciali multi-marchio

| Campo | Valore |
|---|---|
| Nome di lavoro | **Regìa** (white label: il nome è configurabile, non cablato) |
| Versione | **1.5 — estensione generazione media esterna e materiali offline** |
| Data | 18 agosto 2026 |
| Committente | Titolare del gruppo Lenny + stazione carburanti |
| Sviluppo | Titolare + Claude (Claude Code), con supporto del team interno per le fonti dati |
| Documenti storici | `docs/archivio/` — capitolato v1.0, addenda v1.1–v1.3, mappa domande, decisioni acquisite |

> **Uso del documento.** Vive in `docs/capitolato.md` nel repository ed è **l'unica fonte di verità** dello sviluppo. Ogni requisito ha un identificativo richiamabile nei task, nei test e nei commit (RQ-1). I punti aperti sono in §15 e non bloccano l'avvio. I documenti in `docs/archivio/` sono storici e non si aggiornano; per le motivazioni delle scelte fa fede `decisioni-acquisite.md`, richiamato puntualmente dall'Appendice B.

### Registro versioni

| Versione | Data | Contenuto |
|---|---|---|
| 1.0 | 5 ago 2026 | Capitolato congelato a valle della raccolta requisiti (mappa 104 punti) |
| 1.1–1.3 | 12 ago 2026 | Addenda: advertising (M13), commenti social, contesto strategico, email per marchio, richieste dati personali, voucher multi-gestionale, aiuto contestuale, RNF-9, predisposizione organizzazione (RN-87) |
| **1.4** | **14 ago 2026** | **Consolidamento in documento unico**: fusione degli addenda, rinumerazione minima (App. A), assorbimento dei requisiti RN operativi (App. B), decisione voucher (M6), disciplina architetturale (§9.4), §15 riscritto come registro operativo |
| **1.5** | **18 ago 2026** | **Generazione media tramite servizi esterni e materiali offline**: RF-4.5 riscritto (cade il divieto assoluto su prodotti/persone/sedi/cibo reali, resta il vincolo sui dati non inventati e sull'autorizzazione terzi), RF-4.3 esteso (diritti/ToS del fornitore esterno), RF-4.6 esteso (anteprima anche per formato stampa/offline), nuovo RF-4.7 (locandine e materiali offline multi-formato), §3.1 esteso (materiali offline nel perimetro incluso), RS-2 aggiornato (due punti di contatto AI distinti, non più uno solo), nota in RA-8.3 (generazione media sotto autonomia progressiva ordinaria, sempre subordinata a RF-6a.2 per i terzi) |

### Famiglie di identificativi

| Prefisso | Ambito |
|---|---|
| RB-x | Obiettivi e regole di business (§2) |
| V-x | Vincoli di progetto (§3.3) |
| RU-x | Ruoli, utenti e permessi (§4) — ex RF-4.x di §4, si veda App. A |
| RF-x | Requisiti funzionali dei moduli (§5, §6) |
| RA-x | Agente AI (§8) |
| RS-x | Requisiti strutturali di architettura (§9.4) |
| RNF-x | Requisiti non funzionali (§10) |
| RQ-x | Qualità e processo di sviluppo (§11) |
| RN-x | Requisiti emersi nella raccolta, assorbiti nei moduli con ID conservato (censimento completo in App. B) |

### Indice

1. Contesto e finalità · 2. Obiettivi · 3. Perimetro · 4. Attori e permessi · 5. Moduli funzionali (M1–M13, M8b) · 6. Partner e soggetti esterni · 7. Piano editoriale · 8. Agente AI · 9. Architettura (9.4 disciplina architetturale) · 10. Requisiti non funzionali · 11. Qualità e sviluppo · 12. Partenza e fasi · 13. Rischi · 14. Il vantaggio strutturale · 15. Punti aperti — registro operativo · App. A corrispondenze ID · App. B censimento RN-1→87 · App. C provenienza delle modifiche

---

## 1. Contesto e finalità

### 1.1 Il gruppo

Due società, con un livello di separazione che nella piattaforma è il **marchio**, non l'azienda:

**Lenny** — software house con il food delivery come primo servizio, destinata a lanciarne altri con nomi propri.
- Food delivery su San Marino: ~50 ristoranti attivi, migliaia di utenti registrati con recapiti e storico ordini completo.
- Spesa a domicilio con preparazione e marchio di un **partner locale** (richiede autorizzazione preventiva per le promozioni che lo coinvolgono).
- **Rider interni**, reclutati direttamente.
- Tre pubblici distinti: ristoranti (B2B), clienti finali (B2C), rider (reclutamento).

**Stazione carburanti a marchio Eni** — arteria principale del centro di San Marino.
- Attivi: carburante, lavaggi, shop. In apertura: **bar** e **officina** (tagliandi, gomme, piccoli lavori).
- Centinaia di veicoli al giorno, con forte quota di turisti italiani attratti dal differenziale di prezzo del carburante.
- Nessun recapito cliente in archivio: la base contatti va costruita da zero.
- Tessere fedeltà cartacee a timbri esistenti ma poco diffuse.

**Marchi nella piattaforma** *(recepito da decisioni §38; RN-33)* — quattro marchi con mittenti e voci distinti:

| Marchio | Perimetro | Note |
|---|---|---|
| **Lenny** | food delivery + spesa a domicilio | mondo a sé |
| **Stazione** | carburante, lavaggi, shop | l'insegna storica |
| **Eni Cafè** | bar | nome definito; voce propria (RN-33: chi cerca un aperitivo non cerca una stazione di servizio) |
| **Officina** | tagliandi, gomme, piccoli lavori | nome da decidere (§15.E); identità collegata alla stazione (RN-60, M2) |

### 1.2 Cosa deve fare il sistema

1. Leggere i dati dai software aziendali (interni e custom) per costruire una base unificata di clienti, prodotti, vendite, margini, giacenze e veicoli.
2. Costruire e mantenere **piani editoriali** per marchio e canale, legati a obiettivi, generando contenuti coerenti con l'identità di ciascun marchio.
3. Pubblicare su **social organici, email, WhatsApp/SMS** e presidiare **Google**.
4. Misurare i risultati e produrre reportistica.
5. Far funzionare un **motore promozionale configurabile** con contatori, voucher, premi incrociati tra marchi e verifica dei margini.
6. Operare con **autonomia progressiva**: tutto parte come proposta soggetta ad approvazione; l'autonomia si concede categoria per categoria, e alcune categorie non la ottengono mai.
7. Gestire, con vincoli forti di autonomia, l'**advertising a pagamento** quando e se attivato (M13) *(recepito da addendum v1.1)*.

### 1.3 Principi guida

- **Tutto è configurazione, non codice** (RN-15). Marchi, partner, canali, meccaniche, soglie, margini, notifiche, limiti: dati modificabili dall'interfaccia. Aggiungere un servizio non è un progetto di sviluppo.
- **White label dal primo giorno** (RN-16). Nome, logo e colori dell'interfaccia sono parametrici: abilita la rivendita del prodotto, coerentemente con la natura di Lenny.
- **L'automazione toglie l'esecuzione, non il giudizio.** Restano al titolare obiettivi, veti, approvazioni e decisioni commerciali.
- **Contenuto variabile, ritmo fisso.** Le aziende non falliscono la comunicazione sull'argomento sbagliato, ma sull'interruzione.
- **Nel dubbio ci si ferma.** Meglio disturbare una volta di troppo che pubblicare una volta di troppo.
- **Separazione dai gestionali.** La piattaforma legge e non scrive: i sistemi che gestiscono ordini e cassa restano intoccati. Unica deroga, puntuale e delimitata: RF-6.25 (voucher), **dormiente al lancio**.

---

## 2. Obiettivi

### 2.1 Obiettivi per marchio (12 mesi)

| Marchio | Primario | Secondario |
|---|---|---|
| **Lenny** | **Frequenza**: aumentare gli ordini per cliente esistente e riattivare i dormienti | Acquisizione, alimentata da turismo estivo e dalla stazione |
| **Stazione** | **Notorietà presso i residenti** e lancio dei nuovi servizi (bar, officina) | Costruzione della base contatti |

Razionale: con ~30.000 residenti il mercato è finito e l'acquisizione ha un tetto; la frequenza no. La stazione ha invece un bacino più ampio grazie al traffico di confine, ma il residente è l'unico che costruisce ricorrenza.

### 2.2 Obiettivo trasversale della stazione

**Alzare la conversione dal carburante agli altri servizi.** Il traffico esiste già ed è gratuito: pochi punti percentuali in più valgono più di qualsiasi campagna verso l'esterno. È il KPI più importante del primo anno.

### 2.3 Stagionalità

Curve **opposte**: Lenny forte da settembre ad aprile, stazione forte d'estate e sotto le festività. Sommate coprono l'anno.

**RB-2.1** Il sistema pianifica sapendo che il marchio forte del momento alimenta quello debole (d'estate la stazione raccoglie contatti per Lenny; d'inverno Lenny spinge officina, gomme, lavaggi).
**RB-2.2** L'obiettivo cambia con la stagione: nei mesi forti si converte e si regge la capacità, nei mesi deboli si trattiene e si semina.
**RB-2.3** Storico dati **≥ 24 mesi**; tutti i confronti sono **anno su anno**, mai mese su mese.
**RB-2.4** Ogni contenuto e ogni promozione sono collegati a un obiettivo: non esistono attività orfane.

---

## 3. Perimetro

### 3.1 Incluso

Multi-marchio con isolamento dati · connettori in sola lettura verso i software interni · piani editoriali e generazione contenuti · pubblicazione su Facebook, Instagram, email, WhatsApp/SMS · presidio Google (aggiornamenti, recensioni) · analytics e report · motore promozionale configurabile con voucher e premi incrociati · gestione recensioni con bozze di risposta · agente ad autonomia progressiva · web app di raccolta contatti · **advertising a pagamento con vincoli forti di autonomia (M13)** *(recepito da addendum v1.1)* · **generazione di immagini e video tramite servizi esterni specializzati, per uso sociale e non (locandine, materiali stampa, pubblicità offline), tramite adapter intercambiabile (RF-4.5, RF-4.7)** *(recepito da addendum v1.5)*.

### 3.2 Escluso

Gestione dei siti web (la piattaforma analizza e suggerisce, non accede) · TikTok, X e altri social (pubblico insufficiente sul territorio) · CRM completo e gestione ordini · modifica dei prezzi nei sistemi aziendali · chatbot verso i clienti finali · produzione video professionale.

*(Modifica v1.1: l'advertising a pagamento non è più escluso — è incluso con vincoli forti di autonomia, modulo M13.)*

### 3.3 Vincoli

- **V-1** Sviluppo condotto dal titolare con assistenza AI: architettura semplice, manutenibile da una persona sola.
- **V-2** Il titolare dispone di **due sessioni settimanali da 30 minuti** per decidere e approvare. Tutto il sistema è dimensionato su questo vincolo.
- **V-3** Il carburante non entra mai nelle meccaniche promozionali.
- **V-4** Budget operativo mensile: stima **~50–80 €/mese di servizi fissi più consumi** (AI, WhatsApp) — decisioni §48.4. Tetto e soglia di allarme da ratificare all'apertura del cantiere (§15.A), con degradazione controllata (RNF-7).

---

## 4. Attori e permessi

| Attore | Ruolo | Note |
|---|---|---|
| Titolare | `Owner` su tutti i marchi | Decisore unico, approva, configura l'autonomia |
| Team di sviluppo interno | accesso tecnico alle fonti | Fornisce utenza di sola lettura e collabora sul riscatto voucher |
| Collaboratore futuro | `Editor` per marchio | Prepara e modifica, non concede autonomia |
| **Agente AI** | `Agent`, utente macchina | Permessi minimi per strumento, log proprio, soggetto a §8 |
| Partner esterni | entità configurabili | Livello di coinvolgimento variabile (§6) |

**RU-1** *(ex RF-4.1 di §4, App. A)* Autorizzazioni per marchio: un utente può avere ruoli diversi su marchi diversi, con **lettura, modifica ed eliminazione separate**.
**RU-1a** *(ex RF-4.1a)* **I dati commerciali sono protetti a parte**: margini, fatturato ed esiti delle promozioni non sono visibili a chi gestisce solo i contenuti, indipendentemente dalla fiducia riposta nella persona.
**RU-1b** *(ex RF-4.1b)* **Accesso partner limitato al proprio perimetro**: un ristoratore vede solo ciò che lo riguarda, non la piattaforma. Livello previsto, attivabile in una fase successiva.
**RU-2** *(ex RF-4.2)* L'agente accede solo tramite strumenti tipizzati: il permesso di generare una bozza non implica quello di pubblicarla.
**RU-3** *(ex RF-4.3)* Configurazione dell'autonomia e gestione delle connessioni: solo `Owner` con autenticazione a due fattori.

---
## 5. Moduli funzionali

### 5.1 M1 — Data Hub

**RF-1.1** Connettori in **sola lettura** verso i software aziendali interni (PostgreSQL/MySQL/API secondo quanto in uso), con utenza dedicata. Nessuna scrittura verso i sistemi sorgente. *Unica deroga, puntuale e delimitata: RF-6.25 (creazione/validazione voucher nel Modello B), dormiente al lancio.*
**RF-1.2** Modello dati canonico multi-marchio: Marchio, Contatto, Prodotto/Servizio, **Veicolo**, Vendita/Ordine, Margine, Giacenza, Segmento, Contatore fedeltà, Voucher, Campagna, Contenuto, Consenso, Partner.
**RF-1.3** **Anagrafica veicolo** (targa, modello, chilometri, data ultimo intervento, tipo gomme) collegata al contatto: è il prerequisito dei richiami officina.
**RF-1.4** **Registro consensi separato per canale** (email ≠ SMS ≠ WhatsApp), con data, provenienza e prova. Blocco a monte di ogni invio non consentito: non è un controllo manuale pre-campagna, è il sistema che non lo consente.
**RF-1.5** **Storico prezzi e costi** con data di validità, incluso il prezzo del carburante praticato.
**RF-1.6** Sincronizzazione: Lenny quasi in tempo reale sugli ordini (serve al controllo capacità), giornaliera sul resto; stazione giornaliera, con prenotazioni officina aggiornate.
**RF-1.7** Deduplicazione contatti e igiene liste: rilevazione duplicati, contatti inattivi, recapiti non validi. Pulizia iniziale della base Lenny prima del primo invio.
**RF-1.8** Segmentazione automatica per recenza, frequenza e valore. **Pochi segmenti robusti**: con liste piccole la segmentazione fine perde significato statistico.
**RF-1.9** *(da addendum v1.2)* Richieste del cliente sui propri dati personali (esportazione/cancellazione, distinte dalla disiscrizione): gestione **interamente manuale**. Il sistema si limita a presentare all'addetto l'elenco di ciò che Regìa possiede su quel contatto (consensi con data e provenienza, voucher emessi/usati, iscrizioni via web app). Non genera risposte, non decide, non automatizza l'invio. I dati che vivono solo nei sistemi di origine vanno richiesti separatamente al team interno.

**RN-76** *(assorbito)* **Gli orari di apertura stanno in un solo posto nel sistema** (dato attuale: 7:30–19:30, lun–sab, domenica chiusa, per tutti i servizi) e da lì alimentano scheda Google, avvisi, risposte automatiche e contenuti. Quando cambiano (orario estivo, festività) si aggiornano una volta e si propagano ovunque.
**RN-77** *(assorbito)* Il sistema **non promette servizi fuori orario e non invia messaggi commerciali a saracinesca chiusa**.
**RN-52** *(assorbito)* **Le zone di consegna sono uno stato variabile** che il sistema conosce: neve (chiusura zone alte, evento improvviso), pioggia (capacità ridotta: non è il momento di promuovere), eventi locali con chiusure stradali. **Vincolo assoluto: mai inviare promozioni a chi abita in una zona temporaneamente non servita.**
**RN-87** *(da addendum v1.3)* In fase di disegno del modello dati (F0), ogni tabella rilevante prevede fin da subito un **campo di riferimento all'organizzazione/cliente** (oggi con un solo valore possibile). Nessuna funzionalità multi-cliente viene costruita o attivata: è una precauzione strutturale a costo pressoché nullo in vista di un'eventuale rivendita white label futura.

### 5.2 M2 — Marchi e identità

**RF-2.1** Struttura a due livelli **società → marchi/servizi**. Ogni marchio ha identità, pubblico, piano, contatori e numeri propri. Aggiungere un marchio è configurazione.
**RF-2.2** Brand kit per marchio: logo (area sostituibile per gestire il vincolo del marchio Eni), colori, font, elementi grafici.
**RF-2.2a** *(da addendum v1.2)* Ogni marchio include nel brand kit un'**identità di invio email propria**: indirizzo mittente e nome visualizzato specifici, dominio autenticato presso il servizio email esterno (SPF/DKIM), impostato una volta per marchio in fase di attivazione. Si configura in M11 (RF-11.2), non nel motore editoriale.
**RF-2.3** Tono di voce per marchio, usato come contesto obbligatorio in ogni generazione. Parla **il marchio**, non il titolare in prima persona. Due voci distinte: Lenny giovane, veloce, digitale; stazione quotidiana, affidabile, di territorio. Registro colloquiale, mai aziendalese.
**RF-2.3a** *(da addendum v1.1)* Ogni marchio ha, oltre a tono di voce e vincoli redazionali, un **contesto strategico esplicito**, obbligatorio in ogni generazione al pari del tono: scopo del marchio e pubblico; obiettivo dell'anno in corso (§2.1); direzione futura. Vale a livello gruppo/società (es. Lenny come software house) e a livello singolo marchio (es. Officina: priorità = fiducia e prime recensioni Google, RN-61; orario continuato come argomento di vendita, RN-78).
**RF-2.4** Rubriche e pilastri per marchio, con pesi di frequenza (§7.2).
**RF-2.5** Vincoli redazionali per marchio: claim vietati, argomenti che richiedono sempre revisione umana, parole bandite.
**RF-2.6** Isolamento per marchio: ogni entità appartiene a un solo marchio; l'interfaccia opera in un contesto marchio esplicito, con vista di gruppo riservata al titolare.
**RF-2.7** **White label**: nome, logo e colori dell'interfaccia configurabili.

**RN-70** *(assorbito)* Il tono di voce di ogni marchio parte da **esempi reali**, non dal foglio bianco: 5–6 post passati per marchio con l'indicazione di cosa piaceva di ciascuno (le poche visualizzazioni non li rendono inutili: servono per il tono, non per il risultato). Da questi si ricavano le linee del brand kit.
**RN-60** *(assorbito)* **L'officina, pur avendo nome proprio, mostra sempre di stare dentro la stazione**: in ogni comunicazione deve essere evidente in un secondo di quale luogo si tratta. Un'insegna nuova non porta fiducia da sola; chi porta l'auto si fida del posto dove fa benzina da anni.

### 5.3 M3 — Motore editoriale

**RF-3.1** Piano editoriale per marchio e periodo, proposto dall'AI a partire da obiettivi, stagionalità, dati di vendita e performance storiche; approvato dal titolare.
**RF-3.2** Calendario unificato multi-marchio e multi-canale.
**RF-3.3** Generazione contenuti per canale nel contesto del marchio, con proposta **singola e già decisa** (le varianti restano disponibili ma nascoste: il vincolo dei 30 minuti non lascia spazio alla scelta tra alternative).
**RF-3.4** **Corsia veloce per le comunicazioni di servizio**: da una riga dettata dal telefono, contenuto pronto per tutti i canali in pochi minuti, da confermare. Più un **calendario ricorrenze** che le anticipa (festività, chiusure, orari ridotti sono prevedibili con mesi di anticipo).
**RF-3.5** Workflow di stato con storicizzazione: bozza → proposto → approvato → programmato → pubblicato → misurato.
**RF-3.6** **Approvazione a copertura doppia**: ogni sessione approva le due settimane successive, così una sessione saltata non interrompe le pubblicazioni.
**RF-3.7** Metadati su ogni contenuto: generato o assistito da AI, modello, revisione umana, destinazione.
**RF-3.8** Nei primi due mesi il sistema chiede **il motivo del rifiuto** (poche parole): è l'unica fonte di apprendimento sui criteri del titolare.
**RF-3.9** **Richiesta anticipata dei materiali**: quando il piano prevede contenuti che richiedono foto non disponibili, il sistema le richiede in fase di pianificazione, non alla pubblicazione.

**RN-53** *(assorbito)* **Calendario eventi locali** (Rally Legend, mercatini e simili, 3–4 l'anno, prevedibili con mesi di anticipo) con effetti configurabili su zone e servizi: l'avviso si prepara prima e si conferma, con comunicazione **mirata a chi abita nelle zone coinvolte**, non generica.
**RN-54** *(assorbito)* Lo stesso evento è **blocco e opportunità**: le zone chiuse non consegnano, le altre hanno spesso più domanda. Il sistema comunica entrambe le cose (dove non si arriva e dove si consegna regolarmente); per la stazione, in quei giorni, la comunicazione utile è pratica (raggiungibilità), non promozionale.
**RN-45** *(assorbito)* **Logica estiva Lenny**: il calo estivo (weekend, ferie) non si contrasta con promozioni — quelle persone non sono in casa. D'estate il sistema concentra su feriali e spesa a domicilio, e usa il periodo per ciò che d'inverno non c'è tempo di fare: contenuti, rete ristoranti, reclutamento rider, preparazione della ripartenza di settembre.

### 5.4 M4 — Media e template

**RF-4.1** Libreria media per marchio: caricamento, etichettatura, ricerca, riuso. Ogni foto scattata resta e si accumula.
**RF-4.2** **Template grafici di marca** riempiti automaticamente. Set iniziale (8): Lenny — ristorante della settimana, annuncio promozionale, avviso di servizio, reclutamento rider; Stazione — servizio in evidenza, avviso di servizio, consiglio pratico stagionale, volti del personale.
**RF-4.3** *(esteso in v1.5)* **Solo materiale utilizzabile**: la piattaforma non impiega immagini prelevate dal web di cui non si abbiano i diritti. Regola di sistema, non accortezza da ricordare. **Per ogni servizio esterno di generazione media collegato (RF-4.5)**, i termini di servizio del fornitore vengono verificati **una volta, al momento del collegamento**, e registrati nella schedina del fornitore (chi detiene i diritti sull'output, usi consentiti, eventuali restrizioni per settore o marchio commerciale). Non è un controllo da rifare a ogni generazione: è una condizione di ammissione del fornitore, verificata come parte della configurazione dell'adapter (RS-2).
**RF-4.4** **Routine di raccolta materiale dai ristoranti**: quando il piano prevede il ristorante della settimana, il sistema prepara il messaggio al locale, traccia chi ha risposto e passa al successivo se il materiale non arriva. Ogni richiesta è anche un contatto con il ristoratore.
**RF-4.5** *(riscritto in v1.5)* **Generazione di immagini e video tramite servizi esterni specializzati** (es. piattaforme di generazione AI di immagini/video), ammessa anche per prodotti, persone, sedi o cibo — non più limitata a sfondi e illustrazioni. Restano fermi, senza eccezioni:
- **RN-72**: nessun dato concreto inventato nel contenuto generato (orari, prezzi, date, nomi vengono dai dati; se mancano, spazio vuoto e domanda);
- **RF-6a.2**: se il contenuto generato coinvolge un marchio o partner con vincoli configurati (es. logo Eni, partner spesa), la pubblicazione entra nello stato **"in attesa di autorizzazione terzi"** e resta bloccata fino alla risposta — **indipendentemente dal livello di autonomia raggiunto** su quella categoria di contenuto (RA-8.3);
- **RF-4.3**: il fornitore usato deve aver superato la verifica diritti/ToS.

Il servizio esterno è raggiunto tramite l'**adapter di generazione media** (RS-2): fornitore intercambiabile, nessuna dipendenza diretta dall'SDK di un singolo servizio nel dominio applicativo.
**RF-4.6** *(esteso in v1.5)* Anteprima fedele **per canale e per formato di output** (social, email, WhatsApp, ma anche stampa/locandina) prima dell'approvazione.
**RF-4.7** *(nuovo in v1.5)* **Materiali oltre i canali social**: i template di marca (RF-4.2) e la generazione media (RF-4.5) coprono anche output destinati a un uso diverso dai social — locandine e materiali equivalenti, in **più formati e dimensioni** configurabili per marchio, con **export ad alta risoluzione** adatto alla stampa. Stessa disciplina di brand kit (RF-2.2), anteprima fedele (RF-4.6) e workflow di approvazione (RF-3.5) dei contenuti social: un formato diverso non è un percorso diverso.

**RN-69** *(assorbito)* **Canale semplice per il materiale dal campo**: un numero WhatsApp dedicato a cui chi lavora sul posto (bar, e in prospettiva rider e officina) manda foto o video con due parole di contesto; il sistema prepara il post nel tono del marchio, il titolare approva. Nessuna piattaforma da imparare, nessuna credenziale da distribuire. *(RN-81: il meccanismo va spiegato al personale prima dell'apertura, non nella confusione dei primi giorni; le foto sono materiale di lavoro dell'azienda.)*
**RN-83** *(assorbito)* **Video**: chi è sul posto registra col telefono, il sistema fa il resto — taglio verticale, testo sovrimpresso nel tono del marchio, sottotitoli. Stesso canale delle foto (RN-69). Nessuna produzione costruita: per il piatto del giorno la credibilità conta più della perfezione.
**RN-84** *(assorbito)* **Revisione mensile dell'archivio media**, accorpata al controllo di sistema (RN-86): il sistema prepara la lista di cosa guardare (materiale non usato da mesi, foto di servizi non più attivi, materiale oltre una certa anzianità); la decisione su cosa tenere resta al titolare.

### 5.5 M5 — Publishing

**RF-5.1** Architettura ad **adapter**: ogni canale ha un'interfaccia comune (pubblica, programma, annulla, stato, metriche). Consente di partire con servizi aggregatori e migrare ad API dirette senza toccare il resto. *(Verificato in addendum v1.3: copre per costruzione ogni servizio esterno futuro.)*
**RF-5.2** Canali: Facebook, Instagram, email, WhatsApp, SMS, **Google** (aggiornamenti e recensioni).
**RF-5.3** Invio email tramite servizio dedicato: la recapitabilità non è replicabile in casa.
**RF-5.4** WhatsApp tramite provider autorizzato, con modelli pre-approvati e solo verso contatti consenzienti. *Distinzione essenziale: i numeri e le caselle esistenti servono a **ricevere**; per **inviare** occorrono registrazione e servizio dedicato.*
**RF-5.5** Coda con ritentativi, idempotenza (nessun doppio invio), stato per singola pubblicazione, notifica in caso di fallimento definitivo.
**RF-5.5a** **Regola di canale:** WhatsApp è riservato a ciò che il cliente è contento di ricevere — voucher guadagnati, richiami officina, avvisi importanti. Le comunicazioni promozionali generiche viaggiano via email. Doppia ragione: su WhatsApp si paga a messaggio e la soglia di fastidio è bassissima — chi blocca il numero è perso per sempre.
**RF-5.6** Fasce orarie configurabili: mai WhatsApp prima delle 9 o dopo le 21; messaggi Lenny nelle ore che precedono i pasti; stazione efficace la mattina presto.
**RF-5.7** Log di pubblicazione immutabile con snapshot del contenuto pubblicato.

**RN-82** *(assorbito)* Sui canali a costo per messaggio il sistema **mostra il costo stimato prima di ogni invio**, così la scelta del canale si fa con il numero davanti (un messaggio marketing su WhatsApp può costare fino a dieci volte un promemoria di utilità — decisioni §48.1).
**RN-62** *(assorbito)* **Protezione degli invii massivi, tre strati reali** (la doppia conferma da sola non funziona): 1) mostrare cosa sta per succedere — messaggio esatto, **numero preciso di destinatari**, segmento, anteprima di tre destinatari reali — con conferma **digitando il numero dei destinatari**; 2) **invio di prova** al numero e alla email del titolare prima della partenza reale; 3) **partenza scaglionata** sui volumi grandi (primi 100, pausa, poi il resto). Rimedio post-errore: → RQ-6.
**RN-63** *(assorbito)* **Messaggio di benvenuto immediato**: chi lascia il contatto è al massimo dell'interesse. Arriva subito il beneficio promesso, più due righe su cosa aspettarsi. Niente presentazione aziendale.
**RN-64** *(assorbito)* **Disiscrizione con scelta esplicita sui canali**: chi si disiscrive dalle email riceve la domanda se vuole uscire anche da WhatsApp. Non si decide al posto della persona: le si chiede.
**RN-65** *(assorbito)* Nella stessa schermata si chiede **il motivo**, con opzioni da toccare (troppi messaggi · non mi interessa · non sono più cliente · campo libero).
**RN-66** *(assorbito)* Tra le opzioni va offerto **"scrivetemi meno"**, non solo l'uscita: buona parte delle disiscrizioni è stanchezza da frequenza, non rifiuto del contenuto.
**RN-67** *(assorbito)* I motivi accumulati diventano un **allarme**: se prevale "troppi messaggi", la pressione commerciale è alta e il sistema lo segnala prima che il danno si estenda.
> **Vincolo tecnico assoluto** *(da RN-64)*: la disiscrizione funziona **sempre**, anche se la pagina non si carica o viene chiusa a metà. Il clic sul link vale già come uscita dal canale di provenienza; il resto è una domanda in più, mai una condizione.

### 5.6 M6 — Motore promozionale e fedeltà

Il cuore commerciale. Non contiene promozioni predefinite: è un **motore configurabile** in tre pezzi.

**RF-6.1 Contatore.** Configurabile: cosa si conta (lavaggi, ordini, spesa, visite), su quale marchio, con quale soglia, se si azzera dopo il premio o nel tempo. **RN-31** *(assorbito)*: il contatore può contare il **valore speso**, non solo i passaggi — premia chi spende di più e dà a chi è vicino alla soglia un motivo per scegliere il servizio superiore. Nel motore è una configurazione.
**RF-6.2 Premio.** Configurabile: voucher a valore fisso, percentuale, servizio gratuito o prodotto; spendibile su quale marchio e su quali categorie.
**RF-6.3 Regole.** Configurabili: durata, scadenza, cumulabilità, destinatari, periodi di validità.

#### Voucher e premi incrociati

**RF-6.4** **Contatori separati per marchio, premi incrociati.** Ogni marchio tiene i propri conti (corretto anche contabilmente: sono società diverse); il ponte è il voucher.
- Stazione → Lenny: N lavaggi → voucher con codice da inserire al checkout Lenny.
- Lenny → Stazione: N ordini → voucher su lavaggio, tagliando, bar o accessori (categoria configurabile).

**RF-6.5** **Emissione automatica e immediata** al raggiungimento della soglia, via WhatsApp o email. Se richiede stampa, memoria o richiesta esplicita, gran parte dei voucher non verrà usata.
**RF-6.6** **Scadenza** (proposta: 60 giorni) con promemoria a −10 giorni: è il promemoria a generare l'ordine, più del voucher stesso.
**RF-6.7** *(riscritto in v1.4 — decisione P3)* **Codice nominale a uso singolo. Lo stato autoritativo del voucher vive in Regìa.** Il ciclo emesso → riscattato → scaduto sta in una tabella di Regìa con vincolo di unicità; il riscatto è una **transazione atomica e idempotente** (la stessa richiesta ripetuta produce lo stesso esito: mai doppio uso, mai doppio rifiuto). La validazione è **avviata dal sistema di destinazione**, che chiama Regìa (Modello A) con due operazioni distinte: **verifica** (mostra lo sconto applicabile, non brucia il codice) e **riscatto** (brucia alla conferma dell'ordine o dello scontrino — un carrello abbandonato non consuma il premio). Mai codici generici condivisibili. Nel percorso di riscatto non c'è alcuna chiamata AI: solo codice (coerente con RA-8.6, RNF-9).
**RF-6.8** **Riscatto senza attrito**: validazione in pochi secondi alla cassa (codice o QR). Se richiede più tempo, nei momenti di coda il meccanismo si spegne in silenzio.
**RF-6.9** Principio di costo: **paga chi riceve il cliente**. Nessuna compensazione tra società; il sistema tiene comunque il conto del valore che scorre in ciascuna direzione.
**RF-6.10** Tessera a timbri **digitale** in sostituzione della cartacea: consente di sapere *chi* ha raggiunto quale soglia e di inviare i solleciti ("ti mancano due lavaggi") — impossibile con il cartoncino.

#### Integrazione voucher con i gestionali

**RF-6.23** *(da addendum v1.2, esteso in v1.4 — P3)* Per ogni gestionale collegato si definisce una **schedina di integrazione**, configurata una volta al momento del collegamento: campi richiesti da quel gestionale, tipi di buono supportati (se un tipo non è supportato, il sistema non lo propone per quel gestionale), valori fissi compilati automaticamente, e **modello di riscatto**: **Modello A** — il gestionale chiama Regìa per verificare e riscattare (default; vale per il checkout Lenny, dove il campo codice esiste già — RN-68 — e per la cassa della stazione); **Modello B** — Regìa scrive il buono dentro il gestionale, per eventuali sistemi futuri capaci di riconoscere solo buoni nel proprio database. Vincoli del Modello B: il buono vale su quel solo gestionale (mai multi-sistema) e lo stato si riconcilia in Regìa al primo sync di lettura; **Regìa resta comunque il registro autoritativo**.
**RF-6.24** *(da addendum v1.2)* La creazione di un buono passa sempre dalla scheda base unica di Regìa (codice, valore, ambito d'uso, scadenza, destinatario); il collegamento verso ogni gestionale scrive solo i campi previsti dalla sua schedina, senza interpretazione al momento della scrittura.
**RF-6.25** *(da addendum v1.2)* **Eccezione di scrittura, delimitata.** L'unica scrittura di Regìa verso i sistemi aziendali, in deroga puntuale a RF-1.1: riguarda esclusivamente la creazione e validazione di voucher nel Modello B, non altri dati o funzionalità. Va segnalata come eccezione nella documentazione tecnica (RQ-5) e coperta dai test obbligatori (RQ-3). **Al lancio il Modello B non è in uso: la deroga è dormiente** e la sola lettura resta integralmente in vigore. *(Motivazione della schedina scritta e non di un'AI che "impara" i gestionali: coerenza con RA-8.5 — mai accesso libero basato su interpretazione propria di sistemi che gestiscono transazioni reali.)*
**RF-6.26** *(nuovo in v1.4 — P3)* **Se Regìa non risponde al momento del riscatto**, il comportamento è configurabile per gestionale nella schedina. **Default: accetta-e-riconcilia** — la cassa onora il buono, registra l'evento e lo conferma a Regìa appena torna raggiungibile; le anomalie emergono in riconciliazione con traccia completa. Motivo: rifiutare davanti al cliente un premio guadagnato è il "meccanismo che si spegne in silenzio" di RF-6.8, mentre il rischio economico nella finestra è minimo (codici nominali, uso singolo, valori unitari piccoli). Eventuali voucher di valore alto → impostabili a rifiuto rigido. Coperto dai test RQ-3.
**RF-6.27** *(nuovo in v1.4 — P3, integrazione)* **Buoni operativi del gestionale** (rimborsi per errori, cortesie): emessi e validati **dal gestionale**, come oggi, fuori dal perimetro di emissione di Regìa. Le due famiglie di codici sono **distinguibili** (spazio codici o prefisso separato), così ogni punto di validazione sa se risolvere in casa o chiamare Regìa. Regìa li **legge in sola lettura** per i conteggi e i seguiti di RN-28 (→ M7). **Non contano nella pressione commerciale** (RA-8.4): sono servizio al cliente, non vendita.

#### Margini

**RF-6.11** **Il margine minimo è un valore vivo**, non una costante: modificabile in qualsiasi momento per categoria, con **storico e data di validità** (una promozione passata resta leggibile con le condizioni di allora).
**RF-6.12** Il sistema **ricorda** di rivedere le soglie quando i costi si muovono e **avvisa** se una promozione attiva scende sotto il minimo per un rincaro sopravvenuto.
**RF-6.13** Caso opposto: se il margine si allarga, il sistema propone di spingere.
**RF-6.14** **Segnale distintivo del gruppo**: il prezzo del carburante è **ricavo** per la stazione e **costo** per Lenny (muove i rider). Il sistema lo legge dai dati aziendali e avvisa quando i margini Lenny si stringono — allarme che nessuna piattaforma esterna potrebbe dare.

#### Regole commerciali fisse

**RF-6.15** Il **carburante non si sconta mai**: margine troppo sottile, prezzo esposto in strada. Funziona da aggancio, non da oggetto della promozione.
**RF-6.16** Su Lenny, **mai sconti sul cibo a carico di Lenny**: erodono la commissione, unica marginalità. Le leve sono consegna, fasce deboli, cofinanziamento del ristorante, riattivazione.
**RF-6.17** In officina, **mai sconti sulla tariffa oraria**: si vende con servizio incluso o controllo gratuito. Lo sconto sul meccanico insinua il dubbio sulla qualità.
**RF-6.18** **Nessuna promozione se la capacità rider non regge** la fascia oraria: una promozione troppo efficace su un delivery produce ritardi, recensioni negative e clienti persi proprio tra i nuovi.

> **Gestione della capacità Lenny** *(RN-41/42/43 assorbiti)*. Su Lenny la domanda in alcune fasce già supera la capacità: il motore **non genera domanda, la gestisce e la sposta** (RN-41). Due leve: **RN-42** — incentivo mirato a spostare gli ordini dalle fasce di punta a quelle tarde, **non pubblicizzato a tutti** ma offerto solo a chi ordina abitualmente nella fascia piena, come proposta personale; **RN-43** — richieste di disponibilità ai rider **quantificate** ("servono tre rider venerdì 19–21") invece che generiche, con avviso in tempo reale a chi non è di turno se le fasce si chiudono prima del previsto.

**RF-6.19** Nessuno sconto sui prodotti del partner spesa senza il suo assenso (§6).
**RF-6.20** Promozione dei ristoranti nuovi o con pochi ordini, con costo **a carico del ristorante** in cambio di visibilità: standard di settore, impostato come regola di rete.
**RF-6.21** Taratura delle soglie: 10 va bene per un'abitudine lenta come il lavaggio; su Lenny 10 ordini sono troppi se il cliente medio ne fa 1-2 al mese. Soglie più basse e ripetute, o a tempo ("3 ordini questo mese"), coerenti con l'obiettivo frequenza. Valori definitivi da tarare sui dati reali (§15.C).

#### Automazioni ricorrenti

**RF-6.22** Benvenuto · ringraziamento post-acquisto · **richiamo officina a data certa** (tagliando, gomme) · promemoria voucher in scadenza · sollecito contatori · riattivazione dormienti · richiesta recensione dopo un'esperienza positiva. Spesso più redditizie delle promozioni.

#### Officina: flussi, richiami, preventivi *(RN assorbiti)*

**RN-29** Due flussi distinti: **programmato** (tagliandi, gomme, lavori grossi — prenotazione online, promemoria, richiami, riempimento dei periodi vuoti) e **al volo** (interventi rapidi: il canale di acquisizione — non si pianifica, ma richiede la **registrazione al banco** in 30 secondi: nome, telefono, targa; chi entra per una lampadina riceve il promemoria del tagliando otto mesi dopo). Il calendario prenotazioni lascia **spazi liberi ogni giorno**: se è pieno, il lavoro al volo non è più accettabile.
**RN-30** Tre livelli di richiamo: **gomme** (data quasi fissa, stagionale, due finestre l'anno) · **tagliando** (calcolato sui **chilometri reali del cliente**: registrati a ogni intervento, dal secondo passaggio il sistema conosce la percorrenza annua; al primo si usa un intervallo standard per tipo di veicolo) · **segnalazione del meccanico** (nota di dieci secondi sulla scheda → richiamo mirato alla scadenza che decide lui; il tasso di risposta più alto dei tre). *Requisito lato sistema officina: un campo per le note del meccanico.*
**RN-73** **Il preventivo è l'oggetto centrale del processo officina** (modello senza magazzino: il materiale si ordina solo dopo l'accettazione). Ciclo di vita tracciato: emesso → in attesa di risposta → accettato → materiale ordinato → lavoro eseguito.
**RN-74** **Recupero dei preventivi in sospeso** — l'automazione più redditizia dell'officina: promemoria gentile dopo qualche giorno a chi ha chiesto un preventivo e non ha risposto. Lavora su persone che hanno già dichiarato interesse.
**RN-75** **Senza magazzino i tempi dipendono dal fornitore**: nessuna promessa di rapidità sui lavori che richiedono materiale; nella stagione delle gomme si **anticipano i clienti abituali** prima dell'ondata; il sistema non promuove un servizio quando il materiale non è disponibile in tempi ragionevoli.

#### Shop *(RN assorbiti)*

**RN-35** Gli articoli dello shop non sono acquisti d'impulso ma **di necessità**: il marketing efficace è l'**aggancio al momento giusto** (dopo il tagliando, inizio inverno per l'antigelo, pre-vacanze), non la promozione generica. È l'unico servizio con promozioni su **singoli prodotti** e primo candidato alle proposte automatiche su giacenze lente.
**RN-36** **Il meccanico che segnala i tergicristalli consumati è di fatto una vendita dello shop**: il collegamento officina → shop è parte del motore.

#### Meccanismo di invito

*(Il "porta un amico" è definito in M7, RF-7.7: stessa struttura dei voucher, nessuna logica nuova nel motore.)*

---
### 5.7 M7 — Rete ristoranti

**RF-7.1** I ~50 ristoranti si gestiscono come **rete di micro-partner**, non come lista di destinatari: schede con adesione, andamento ordini, ultimo contatto, segnali di raffreddamento.
**RF-7.2** Il sistema indica **chi contattare questa settimana**, non manda email di massa. Con questi numeri la relazione è quasi uno a uno.
**RF-7.3** **Contenuti pronti da far ricondividere** ai locali: ogni ristorante ha una sua pagina e un suo pubblico. Sono ~50 megafoni gratuiti verso clienti che Lenny non raggiunge direttamente.
**RF-7.4** *(riposizionato in sequenza — App. A)* Perdere un ristorante costa più di una promozione: i segnali di raffreddamento hanno priorità sulle attività di acquisizione.
**RF-7.5** **Misurazione del tempo ordine → ritiro per ristorante**, distinguendo lentezza cronica da lentezza per fascia. Alimenta: la conversazione col ristoratore basata su dati, la spiegazione delle recensioni sui tempi, e tempi realistici per singolo ristorante nell'app (il ritardo percepito si riduce senza che nessuno debba essere più veloce).
**RF-7.6** **Nessuna promessa pubblica sui tempi di consegna**: dipendono dai ristoranti, e prometterli significherebbe assumersi la colpa di errori di terzi. La comunicazione punta su varietà, comodità, copertura e rider.
**RF-7.7** **Meccanismo di invito** (porta un amico): contatore con premio a entrambi, stessa struttura dei voucher. Attivo sulla stazione dove la capacità è libera; su Lenny resta disponibile ma spento finché la capacità rider non lo consente. Premio preferito: servizio aggiuntivo o superiore, non sconto in euro. Proposto ai clienti abituali subito dopo un'esperienza riuscita. **RN-57** *(assorbito)*: l'invito è una **porta d'ingresso multi-servizio**, non un singolo lavaggio scontato — al lavaggio si affianca un caffè al bar o uno sconto sul primo tagliando, così il nuovo cliente scopre due o tre servizi invece di uno; è il canale più efficace per far partire bar e officina.

**Analisi di mercato della rete** *(RN assorbiti)*
**RN-37** Il confronto di un locale va fatto **dentro la categoria**, non sul totale: una pizzeria al 10% degli ordini di pizza va bene con dieci pizzerie, male con tre.
**RN-38** Il problema della rete non è chi va male, è **quanti fanno la stessa cosa**: il sistema indica **quali categorie sono sature e quali mancano** rispetto alla domanda. È una decisione da gestore di mercato, non da marketing.
**RN-39** Diagnosi del singolo locale ridotta a due domande: come va rispetto ai suoi simili · ha visualizzazioni ma non ordini (foto o prezzo) oppure non ha visualizzazioni (posizionamento). Il gusto personale non è un problema da risolvere.

**Relazione con i ristoratori** *(RN assorbiti)*
**RN-47** **Report mensile automatico** al ristoratore (via WhatsApp): andamento rispetto al mese precedente, piatti più richiesti, **posizione rispetto alla media della propria categoria**. Costa nulla da generare, fidelizza e dà un pretesto naturale per parlarsi.
**RN-48** **Ingresso di un nuovo ristorante**: il sistema prepara il pacchetto di lancio (post, banner, messaggio pronto da far ricondividere); il titolare approva. Il lancio è una **sequenza** (seconda uscita a 1–2 settimane), con **sorveglianza dei primi 30 giorni**: segnalazione dei nuovi ingressi sotto la media della loro categoria dopo un mese, quando si può ancora intervenire.
**RN-28** **Gestione degli errori di consegna** (coupon a carico del ristorante, prassi esistente): 1) **conteggio per ristorante** — un coupon ogni tanto è fisiologico, tre al mese sono un problema da affrontare col locale; 2) **verifica dell'utilizzo** — se il coupon non viene usato il cliente non è recuperato, solo compensato → secondo contatto; 3) **richiesta recensione dopo il rientro riuscito**, non prima; 4) **distinzione per anzianità**: il cliente al primo o secondo ordine con un problema sparisce — va segnalato per un intervento in più. *(I coupon sono buoni operativi del gestionale: RF-6.27.)*

### 5.8 M8 — Recensioni e reputazione

**RF-8.1** **Flusso giornaliero**, fuori dalle due sessioni settimanali: una recensione senza risposta per giorni è visibile a chiunque.
**RF-8.2** **Negative**: notifica immediata con bozza di risposta già pronta, da approvare o correggere in pochi secondi dal telefono. Il tempo di leggere la bozza è anche il tempo per calmarsi.
**RF-8.3** **Positive**: risposta breve, approvazione in blocco una volta al giorno.
**RF-8.4** **Casi gravi** (problema reale e serio): **solo segnalazione, senza bozza**. Prima si risolve con la persona, poi si risponde in pubblico.
**RF-8.5** Nessuna risposta pubblica parte mai in autonomia (§8.2).
**RF-8.6** Tempi: poche ore per il delivery (cliente ancora recuperabile), un giorno per la stazione. Oltre le 24 ore la risposta non serve più a chi ha scritto, solo a chi legge.
**RF-8.7** Regola di contenuto: su Lenny la risposta pubblica **non scarica mai la colpa sul ristorante** — la questione si risolve privatamente con il locale.
**RF-8.8** **Richiesta di recensione dopo la risoluzione**: il cliente a cui si è rimediato è il più disposto a lasciarne una positiva.
**RF-8.9** *(da addendum v1.1)* I **commenti sui post social** seguono lo stesso schema delle recensioni: domande fattuali semplici → bozza pronta, approvazione rapida (schema RF-8.3); commenti negativi, polemici o problemi reali → **mai risposta autonoma**, notifica con bozza (schema RF-8.2/8.4, già in §8.2); spam o fuori tema → segnalati, nessuna risposta.

**RN-61** *(assorbito)* **Scheda Google dal giorno zero per l'officina**: le prime 5–6 recensioni valgono più di tutte le successive e vanno **chieste attivamente** ai primi clienti soddisfatti. Nome, pagine, scheda e template pronti **settimane prima** dell'apertura (→ §15.E).

### 5.8b M8b — Email di assistenza per servizio *(da addendum v1.1)*

**RF-8b.1** Le sole caselle info@/help@ **fisicamente collegabili alla piattaforma** — quelle che oggi si perdono (mai lette, nessun presidio umano regolare) — vengono instradate secondo lo schema già usato per assistenza e recensioni: domande fattuali semplici (dato oggettivo disponibile: orari, stato, disponibilità) → risposta diretta o bozza pronta; tutto il resto → notifica al responsabile del servizio competente (non un calderone unico — coerente con RU-1a), mai risposta automatica autonoma. **Esclusione esplicita**: le caselle già presidiate da una persona attiva non entrano in questo modulo. *(Nota RN-51: la logica "il sistema risponde da solo alle domande di stato con il dato reale" vale qui; il chatbot verso i clienti finali resta escluso, §3.2.)*

### 5.9 M9 — Analytics e misurazione

**RF-9.1** Ingestione metriche per canale: social, email, WhatsApp, Google.
**RF-9.2** **Attribuzione tramite voucher nominali**: ogni codice sa a chi appartiene, da quale marchio proviene, quando è stato speso e quanto ha generato dopo. Il travaso di clienti tra marchi è misurabile con precisione.
**RF-9.3** Strumenti di collegamento contenuto → vendita, in ordine di affidabilità: codice o QR nel contenuto · prenotazione online officina (collegamento completo, alto valore) · domanda in cassa (indicazione, non dato).
**RF-9.4** **Il carburante entra come dato, non come oggetto di misurazione**: non si comunica e non si sconta. Serve per volume di traffico, calcolo della conversione verso gli altri servizi, e come costo Lenny.
**RF-9.5** KPI per natura del servizio: lavaggio e bar = **frequenza di ritorno**; officina = **quanti dei richiamati tornano** (numero secco, il risultato più leggibile dei primi mesi); Lenny = ordini per cliente e riattivazioni.
**RF-9.6** Misura di periodo con confronto **anno su anno**. Una parte dell'effetto non sarà mai attribuibile: è normale e va accettato, meglio di un'illusione di precisione.
**RF-9.7** Report periodici generati dall'AI, che arrivano **prima** della sessione di decisione, non dentro: i 30 minuti servono a decidere, non a leggere.
**RF-9.8** Dashboard per marchio e vista di gruppo.

**RN-85** *(assorbito)* Collegamento alle statistiche dei siti + **marcatura automatica dei link** in uscita dalla piattaforma: si distingue quali visite arrivano dai contenuti e quali no. Sul sito Eni in costruzione va previsto da subito (→ RF-10.4).
**RN-40** *(assorbito)* **La regolarità settimanale della spesa a domicilio è misurabile**: il sistema rileva chi salta la settimana — nella spesa la perdita di un abituale vale molto più di un ordine mancato e avviene in silenzio.

### 5.10 M10 — Raccolta contatti

**RF-10.1** **Web app leggera**: nessun download, nessuna registrazione lunga. Percorso: QR (colonnina, scontrino, locandina) → una pagina → recapito → beneficio immediato (caffè, sconto lavaggio, buono Lenny).
**RF-10.2** **Doppia offerta alla stessa colonnina**, distinta da una sola domanda in iscrizione: al **residente/pendolare** la relazione (officina, bar, vantaggi ricorrenti); al **turista** il consumo immediato più il ritorno l'anno successivo.
**RF-10.3** Consenso raccolto correttamente da subito, separato per canale.
**RF-10.4** Il **sito Eni in costruzione** va progettato come porta d'ingresso dei dati: prenotazione officina con targa e modello, pagina di atterraggio del QR, iscrizione ai vantaggi, link tracciati (RN-85). Farlo ora costa nulla; aggiungerlo dopo significa rifare metà lavoro.

**RN-46** *(assorbito)* **Il pubblico da raccogliere è il residente e il pendolare** — chi passa ogni settimana e ha un'auto da mantenere: è anche chi ordina la cena a novembre. Il turista serve alla stazione per il consumo immediato, non è un pubblico Lenny. Pagina del QR e cartelli **almeno bilingui** italiano/inglese per l'estate (decisioni §34).
**RN-80** *(assorbito)* **Ogni compito richiesto al personale deve costare pochi secondi**, altrimenti nei momenti di punta non verrà svolto. La registrazione contatti passa dal QR: sposta il lavoro sul cliente, che ha tempo mentre fa benzina. Nessun modulo da compilare al banco.
**RN-79** *(assorbito)* **La figura al banco è il punto di raccolta naturale dei contatti** — l'unica persona che vede passare tutti, dal cliente del pieno a quello del caffè.

### 5.11 M11 — Amministrazione

**RF-11.1** Gestione marchi, utenti, ruoli, partner.
**RF-11.2** Connessioni esterne: credenziali cifrate in secret store, stato di salute, riautorizzazione guidata.
**RF-11.3** **Audit log consultabile**: ogni azione umana e dell'agente, filtrabile ed esportabile.
**RF-11.4** Pannello autonomia e **interruttore di arresto** raggiungibili in due tocchi da telefono.
**RF-11.5** *(generalizzato in v1.1)* Monitor costi per marchio con tetti e allarmi, esteso a **ogni categoria di spesa**: costi AI, servizi esterni (email, WhatsApp, pubblicazione social), advertising a pagamento (M13).

### 5.12 M12 — Uso quotidiano

**RF-12.1 Schermata iniziale, in quest'ordine:** in alto **cosa devi fare** (approvazioni in attesa, recensioni da gestire, avvisi), subito sotto **come sta andando** (tendenza della settimana, contenuti con i risultati migliori). Tutto in una schermata leggibile in pochi secondi da telefono.
> Motivazione dell'ordine: ciò che si apre per primo è ciò che si guarda davvero. Con due sessioni da 30 minuti, mettere i grafici in cima farebbe scivolare le approvazioni in fondo.

**RF-12.2 Archivio e ricerca:** filtri per **data**, **marchio**, **tipo di contenuto** ed **etichetta di argomento** (officina, bar, consegna, promozione, avviso), più ricerca testuale. Ricerche tipiche previste: ritrovare un contenuto per riproporlo · rivedere l'esito di una promozione passata · contare voucher emessi e riscattati.
**RF-12.3 Doppio uso delle etichette:** oltre a filtrare, misurano **l'equilibrio editoriale**. Il sistema segnala squilibri del tipo "officina 2 uscite, delivery 18".
**RF-12.4 Contenuti ricorrenti:** archivio dei contenuti che tornano ogni anno pressoché identici (chiusure natalizie ed estive, orari festivi, promemoria cambio gomme, consigli pre-partenza). Il sistema li ripropone aggiornati; il titolare conferma.
**RF-12.5** Ogni ricorrenza ha una **finestra di preavviso** propria: la proposta si apre quando è il momento giusto di prepararla, non il giorno dell'uscita. Le ricorrenze sono tra le prime categorie candidate all'autonomia (§8.3).
**RF-12.6 Assenza del titolare:** dopo alcuni giorni senza approvazioni il sistema avvisa; se l'assenza prosegue, propone di delegare a un sostituto con **permessi ridotti** (contenuti e recensioni sì, promozioni e configurazioni no). Senza delega, la piattaforma continua a pubblicare quanto già approvato e accoda il resto: non si ferma e non improvvisa.
**RF-12.7** *(da addendum v1.3)* Ogni pagina e sezione dell'interfaccia ha un'**icona di aiuto contestuale**, sempre presente e disponibile a chiunque abbia accesso a quella sezione secondo i propri permessi (RU-1) — supporto permanente, non solo onboarding. La spiegazione è **esaustiva**: come funziona la sezione nel dettaglio; **se e come è collegata ad altre sezioni** (dove si propaga una modifica fatta lì); cosa serve fare per usarla correttamente (prerequisiti, ordine delle azioni). Riguarda l'interfaccia gestionale (Owner, Editor, sostituto delegato — RU-1, RF-12.6); resta distinta dalla formazione del personale operativo, che ha il canale semplificato via WhatsApp (RN-69/81).

**RN-86** *(assorbito)* **Controllo mensile**: il sistema ricorda l'appuntamento e presenta la lista già pronta — costi del mese, connessioni in scadenza, avvisi dei fornitori, foto da rivedere (RN-84), anomalie. Circa dieci minuti, una volta al mese. Responsabile: il titolare.

### 5.13 M13 — Advertising e presenza a pagamento *(da addendum v1.1, default v1.3)*

**RF-13.1** Configurazione tetti di spesa mensili per marchio e per categoria (sponsorizzate social, Google Ads ricerca, Google Ads display), impostabile e modificabile da interfaccia. Nessun intervento di codice per cambiare un tetto (RN-15).
**RF-13.2** *(versione v1.3, che sostituisce la proposta v1.1)* Interruttore acceso/spento per marchio e per categoria. **Tutti gli interruttori partono spenti, per ogni marchio, senza eccezioni**: l'accensione di qualsiasi categoria di advertising, su qualsiasi marchio, è sempre una decisione esplicita del titolare — mai un default suggerito o applicato dal sistema (coerente con RA-8.1). Nessuna spesa parte su un marchio o una categoria disattivata, indipendentemente dal budget configurato.
**RF-13.3** Il piano editoriale (RF-3.1) mostra, per ogni contenuto candidato alla spinta a pagamento, la spesa stimata prevista — prima dell'approvazione, non dopo (coerente con RF-9.7).
**RF-13.4** Classificazione per contenuto/campagna, impostata esplicitamente e non implicita: **solo organico** · **spinto entro budget configurato** · **candidato a spinta maggiore** (richiede approvazione esplicita, RF-13.6).
**RF-13.5** Architettura ad adapter (RF-5.1) verso Google Ads API e Meta Ads API: fornitore sostituibile senza toccare il resto del sistema.
**RF-13.6 Superamento tetto — mai automatico.** Se una campagna richiederebbe più budget del tetto configurato, il sistema non lo supera mai da sé. Propone lo sforamento con motivazione onesta e concreta (perché conviene ora, cosa si perde restando nel tetto, per quanto tempo servirebbe). Il titolare approva o rifiuta, come per ogni altra categoria mai autonoma (§8.2).
**RF-13.7 SEO organica.** La piattaforma analizza e suggerisce (testi, struttura, parole chiave), coerente col vincolo di non gestire/accedere ai siti (§3.2). Nessuna spesa a consumo: rientra nel monitoraggio generale dei costi (RNF-7).

---

## 6. Partner e soggetti esterni

**RF-6a.1** Il partner è un'**entità configurabile**, non un caso cablato. Attributi: livello di coinvolgimento (da informare / che approva / che cofinanzia / con diritto di veto sulla denominazione), tempo di preavviso, referente, traccia delle risposte.
**RF-6a.2** Stato **"in attesa di autorizzazione terzi"** nel flusso di approvazione, con materiali pronti da inviare e blocco della pubblicazione fino alla risposta.
**RF-6a.3** Casi noti: **partner della spesa** (da informare preventivamente) e **marchio Eni**. Per Eni: **uso del logo confermato libero** (RN-59); resta da verificare la parte promozionale — come nominare il carburante nelle comunicazioni (§15.B). Il modello copre entrambi i casi senza modifiche.

---

## 7. Piano editoriale

### 7.1 Ritmo di partenza

Conservativo per scelta: meglio alzare tra due mesi perché regge, che scoprire di non starci dietro.

| Marchio | Frequenza |
|---|---|
| Lenny (periodo forte) | 3 uscite/settimana su Facebook+Instagram · 1 email/mese · WhatsApp con parsimonia |
| Stazione | 2 uscite/settimana su Facebook+Instagram · aggiornamenti Google · richiami officina (individuali, fuori conteggio) |
| Entrambi | corsia veloce avvisi, sempre disponibile |

**RN-34** *(assorbito)* **Il bar ha un ritmo diverso da tutti gli altri servizi**: si comunica ogni giorno, perché la decisione del cliente è quotidiana (piatto del giorno, aperitivo, colazione). Contenuti che invecchiano in ore → strumenti veloci (storie più che post), foto al banco più che grafiche (canale RN-69). Sarà il servizio che genera più contenuti di tutti, col minor sforzo.

### 7.2 Rubriche

**Lenny:** ristorante della settimana (attiva la rete come megafoni) · servizio (rete, zone, orari, spesa) · commerciale · dietro le quinte (rider e team, utile anche al reclutamento).

**Stazione:** servizio (orari, festività, chiusure — il contenuto più letto in assoluto) · i servizi con i volti di chi ci lavora · consigli pratici stagionali (costruiscono fiducia e vendono officina senza sembrare vendita) · commerciale (peso ridotto).

**Equilibrio:** ~50% utile/servizio · ~25% persone e attività · ~25% commerciale. Oltre un terzo di contenuti commerciali il pubblico si logora.

**RF-7a.1** Piano editoriale **reclutamento rider** con calendario che **precede** le campagne commerciali: la capacità di consegna è il vincolo di tutto il resto.
**RN-27** *(assorbito)* La campagna social di reclutamento è mirata a chi **non sta cercando lavoro** (studenti, chi arrotonda, chi ha vincoli familiari): pubblico che gli annunci tradizionali non raggiungono. Messaggio concreto ("solo i weekend", "due ore all'ora di cena"); le testimonianze dei rider attuali rientrano nella rubrica "dietro le quinte".

### 7.3 Nota sul materiale fotografico

Le foto scattate col telefono sul posto (il meccanico al lavoro, il caffè appena fatto, l'auto sul ponte) rendono più delle fotografie professionali su questi canali: vengono riconosciute come vere. Non serve materiale perfetto.

---

## 8. L'agente AI

Sezione prevalente: in caso di conflitto con altre parti del capitolato, vale questa.

### 8.1 Livelli di autonomia

| Livello | Comportamento |
|---|---|
| **L0** | Solo suggerimento in chat o report |
| **L1** | Prepara tutto, **nulla parte senza approvazione** |
| **L2** | Esegue entro i limiti e notifica; annullabile entro una finestra |
| **L3** | Esegue senza finestra di annullamento (solo categorie a rischio minimo) |

**RA-8.1** Stato iniziale: **tutte le categorie a L1**.

### 8.2 Mai autonomo — per sempre

Lancio di promozioni · comunicazioni che coinvolgono il partner spesa o il marchio Eni · primo contatto verso un pubblico mai raggiunto · risposte pubbliche a lamentele, recensioni negative, polemiche (inclusi i commenti social, RF-8.9) · comunicazioni relative a incidenti e disservizi · qualsiasi cosa tocchi i prezzi nei sistemi aziendali · **attivazione o modifica di una campagna a pagamento · qualsiasi spesa oltre il tetto configurato, su qualunque categoria di costo** *(esteso da addendum v1.1)*.

> **RA-8.2** Questo elenco resta manuale **non** perché il sistema non ne sarà capace, ma perché sono decisioni che devono restare del titolare. Non va allargato quando l'automazione funzionerà bene: è precisamente allora che verrà la tentazione.

### 8.3 Autonomo solo dopo averlo dimostrato

Avvisi di servizio ricorrenti e prevedibili · richiami officina (messaggi individuali a data certa, il caso più sicuro) · promemoria voucher e contatori · pubblicazione di contenuti già approvati nel piano · report.

**RA-8.3** Il sistema conta le proposte approvate senza modifiche per categoria; a 9 su 10 **propone** il passaggio di livello, ma la decisione resta manuale. Se dopo il passaggio riprendono le correzioni, propone il ritorno indietro. L'autonomia si allarga sui numeri, non per entusiasmo o stanchezza.

> **Nota** *(v1.5)*: la **generazione** di media tramite servizio esterno (RF-4.5) segue questo stesso percorso di autonomia progressiva ordinaria — non è bloccata a L1 per sempre. Ciò che resta sempre non autonomo, a prescindere dal livello raggiunto sulla generazione, è la **pubblicazione** quando il contenuto rientra in una categoria di §8.2 (es. tocca un marchio o partner con vincolo, RF-6a.2) o quando la categoria del contenuto stesso è tra quelle mai autonome. Generazione e pubblicazione sono due controlli distinti nel codice (RA-8.6) e vanno testati separatamente (RQ-3).

### 8.4 Limiti

| Limite | Valore di partenza |
|---|---|
| Contenuti social | max 1/giorno per marchio |
| Invii massivi | oltre qualche centinaio di destinatari serve assenso esplicito |
| **Pressione commerciale** | **max 2 messaggi commerciali/mese per persona, sommando entrambe le aziende** |
| Avvisi di servizio | fuori conteggio (servizio al cliente, non vendita) |
| Orari | mai WhatsApp prima delle 9 o dopo le 21 |

**RA-8.4** Il limite di pressione si calcola **per persona, non per marchio**: senza questa regola le promozioni incrociate raddoppierebbero i messaggi allo stesso destinatario. *(I buoni operativi del gestionale sono fuori conteggio: RF-6.27.)*

### 8.5 Permessi e sicurezza

**RA-8.5** L'agente agisce solo tramite **strumenti tipizzati** con permessi granulari. Nessun accesso diretto a database o servizi esterni.
**RA-8.6** Gli strumenti verificano da sé livello di autonomia e limiti: **il modello propone, il codice dispone**. La sicurezza non dipende dal comportamento del modello.
**RA-8.7** I dati provenienti dall'esterno (recensioni, commenti, record, pagine web) sono trattati come **non fidati**: passati come contenuto delimitato, mai come istruzioni. Suite di test dedicata prima di ogni rilascio che tocchi l'agente.
**RA-8.8** Output destinato a esecuzione validato con schemi rigidi: non conforme → scarto e log, mai esecuzione approssimativa.

### 8.6 Comportamento e controllo

**RN-72** *(assorbito)* **I dati concreti non si inventano mai, nemmeno a piena autonomia.** Orari, prezzi, date, indirizzi, nomi provengono dai sistemi aziendali; se un dato manca, il sistema lascia lo spazio vuoto e lo chiede. È la differenza tra un contenuto brutto — che si corregge — e un contenuto sbagliato, che è già stato pubblicato.
**RA-8.9** **Nel dubbio si ferma sempre** e chiede, registrando il contesto.
**RA-8.10** **Interruttore di arresto** globale e per marchio, in due tocchi da telefono, **per sempre** — anche quando la fiducia sarà consolidata. Sospende ogni automazione, riporta tutto a L1, notifica. Il riavvio richiede conferma esplicita.
**RA-8.11** Memoria: correzioni ricevute, motivi dei rifiuti, esiti delle promozioni, preferenze di stile. Serve perché migliori invece di ripetere gli stessi errori. Risiede nel database della piattaforma (PostgreSQL + pgvector), non nel modello: un cambio di modello non comporta perdita di memoria (RNF-8).
**RA-8.12** Tracciabilità: per ogni azione sono conservati origine, contesto, motivazione, strumenti invocati, esito e costo. Il titolare può sempre ricostruire perché l'agente ha fatto una cosa.

### 8.7 Notifiche

Tutte attive all'inizio — servono a capire cosa fa il sistema e a costruire fiducia — ma **divise per gravità**:

- **Suono e vibrazione**: errore in pubblicazione · problema di consegna che mette a rischio promozioni attive · contenuto rifiutato dall'agente per argomento delicato · **recensione negativa**.
- **Silenziose**: tutto il resto (pubblicazioni, conferme richieste, andamento).
- **Riassunto serale** di quanto accaduto.
- **Configurabili voce per voce e marchio per marchio.**

---
## 9. Architettura

### 9.1 Impostazione

**Monolite modulare** (un solo deployable, moduli interni separati) più **coda di lavoro** per tutto ciò che è asincrono. Nessun microservizio: semplicità operativa per uno sviluppatore singolo, con confini interni puliti per estrazioni future.

### 9.2 Stack — confermato

| Livello | Scelta |
|---|---|
| Linguaggio | **TypeScript** end-to-end |
| Web | Next.js (interfaccia + API), responsive |
| Coda | BullMQ su Redis (Redis fornito da **Upstash**, serverless a consumo) |
| Database | **Supabase** — PostgreSQL + pgvector nativo *(deciso — P7, piano Pro attivo)* |
| Media | Storage S3-compatibile **di Supabase** (stesso account, protocollo S3 nativo — nessun fornitore a parte) |
| AI | Anthropic API (Claude) con tool use, prompt versionati nel repository |
| Hosting applicazione | **Aperto** (§15.A): dove girano l'app Next.js e i worker della coda. Supabase copre database, storage e autenticazione, non l'esecuzione dell'applicazione — resta un fornitore da scegliere a parte |
| Ambienti | sviluppo / prova / produzione, con **dati finti in prova** |

### 9.3 Confini

La piattaforma **non si fonde** con i software aziendali: sistemi separati che si parlano, in sola lettura (unica deroga delimitata: RF-6.25, dormiente al lancio). Una modifica al marketing non deve poter toccare ciò che gestisce ordini e cassa.

### 9.4 Disciplina architetturale e qualità costruttiva *(nuova in v1.4 — P4)*

> Principio della sezione: **robusta per costruzione, ottimizzata dove misurato.** Per i volumi reali del progetto (migliaia di contatti, ~50 ristoranti, bacino da ~30.000 residenti) la robustezza è figlia della semplicità, non dell'ottimizzazione. Nessun requisito di questa sezione aggiunge componenti a runtime: solo disciplina e regole di verifica automatica — l'unico tipo di costo che una persona sola può permettersi di pagare per sempre (V-1).

**RS-1 — Confini di modulo vincolanti.** I moduli M1–M13 esistono come confini reali nel codice: ogni modulo espone un'interfaccia interna esplicita, ed è vietato importare gli interni o leggere le tabelle di un altro modulo direttamente. La regola è verificata automaticamente dalla CI, non affidata all'attenzione (lo strumento specifico si sceglie e si verifica in F0). È ciò che rende vere le "estrazioni future" promesse da §9.1.

**RS-2 — Dipendenze solo verso interfacce.** Il dominio dipende dalle interfacce degli adapter, mai dagli SDK dei fornitori; vale per i canali (RF-5.1), per email/WhatsApp, e anche per l'AI. *(Aggiornato in v1.5)* L'AI ha **due punti di contatto distinti** nel sistema, non uno: generazione testuale (Anthropic API, coerente con §15.C e RNF-9) e generazione media — immagini/video (adapter verso servizi esterni specializzati, RF-4.5), fornitore sostituibile senza toccare il dominio. Ciascun punto di contatto resta comunque unico nel proprio ambito: nessun accesso diretto a un SDK di terzi fuori dall'adapter dedicato. Cambiare fornitore = scrivere un adapter nuovo, zero modifiche altrove (RNF-8).

**RS-3 — Invarianti nel database, non solo nell'applicazione.** Le regole che non devono rompersi mai — voucher a uso singolo, nessun invio senza consenso su quel canale, unicità dei contatori — sono vincoli del database (unique, chiavi esterne, check) e transazioni, non solo controlli nel codice. Serve direttamente i test non negoziabili RQ-3: un invariante nel database è testabile e non aggirabile da un bug applicativo.

**RS-4 — Asincrono disciplinato.** Ogni job in coda ha chiave di idempotenza persistita, ritentativi con attesa crescente e limite massimo, e una coda dei falliti definitivi con notifica (attua RNF-4 e RNF-6). Il percorso che pubblica contenuti già approvati non contiene chiamate AI né decisioni: solo esecuzione (RNF-9, RF-6.7).

**RS-5 — Configurazione come dato, con storico.** "Tutto è configurazione" (RN-15) tradotto in regola costruttiva: marchi, canali, soglie, regole commerciali e limiti vivono in tabelle con data di validità — il pattern già fissato per i margini (RF-6.11) diventa lo standard per ogni parametro. Mai costanti nel codice.

**RS-6 — Convenzionalità obbligatoria.** Framework e librerie si usano nel modo documentato ufficialmente; niente pattern esotici né astrazioni premature. Ogni deroga va motivata per iscritto nel registro delle decisioni. È la mitigazione strutturale del rischio "dipendenza da una sola persona" (§13): codice noioso è codice riprendibile da chiunque.

**RS-7 — Prestazioni a budget, non a sensazione.** Obiettivi misurabili solo dove il capitolato li fissa: riscatto voucher in pochi secondi (RF-6.8), schermata iniziale leggibile in pochi secondi da telefono (RF-12.1, RNF-5), corsia veloce in pochi minuti (RF-3.4). Vietata l'ottimizzazione speculativa: nessuna cache, denormalizzazione o componente aggiuntivo senza una misura che dimostri il problema.

**RS-8 — Schema del database versionato.** Ogni modifica allo schema passa da migrazioni versionate nel repository e applicate dalla pipeline; nessun intervento manuale in produzione. Insieme a RNF-3 rende il sistema interamente ricostruibile.

---

## 10. Requisiti non funzionali

**RNF-1** Sicurezza applicativa secondo OWASP ASVS livello 2; autenticazione a due fattori per `Owner`; cifratura in transito e a riposo; credenziali in secret store, mai nel repository.
**RNF-2** Sicurezza AI secondo OWASP Top 10 per applicazioni LLM (§8.5).
**RNF-3** Backup giornalieri cifrati con **test di ripristino trimestrale documentato**. Obiettivi: perdita dati ≤ 24h, ripristino ≤ 8h.
**RNF-4** Idempotenza degli invii: nessun doppio invio in caso di ritentativo. Le programmazioni sopravvivono ai riavvii.
**RNF-5** Interfaccia responsive: approvazioni, recensioni e interruttore di arresto pienamente utilizzabili da telefono.
**RNF-6** Monitoraggio di uptime, code, integrazioni, con allarme al titolare.
**RNF-7** *(generalizzato in v1.1)* Contatore costi **per ogni categoria di spesa** (AI, servizi esterni, advertising) per marchio, con tetto mensile e degradazione controllata: sospensione dei task non urgenti, avviso. Nessuno sforamento è mai autonomo (§8.2).
**RNF-8** Dati e consensi risiedono **nella piattaforma**; i fornitori esterni sono esecutori sostituibili.
**RNF-9** *(da addendum v1.3)* Se il servizio AI non risponde o è inaffidabile: le pubblicazioni **già approvate e programmate continuano regolarmente** (non dipendono da una chiamata AI al momento della pubblicazione); i task che richiedono generazione o proposta AI **si accodano** invece di fallire o bloccare il sistema; il titolare viene **avvisato**. Stesso principio dell'assenza del titolare (RF-12.6): non si ferma e non improvvisa.

---

## 11. Qualità e sviluppo

**RQ-1** Il capitolato vive in `docs/` ed è la fonte di verità; ogni task cita gli identificativi che implementa. Un file `CLAUDE.md` definisce convenzioni e vincoli per lo sviluppo assistito.
**RQ-1a** *(nuovo in v1.4 — P4)* **Il `CLAUDE.md` non è lasciato all'improvvisazione.** Contenuto obbligatorio: RS-1..8 in forma sintetica, RQ-7, i vincoli fissi (sola lettura con deroga dormiente RF-6.25, categorie §8.2, RA-8.6), convenzioni di nomi e struttura. È **versionato nel repository**, aggiornato a ogni variazione del capitolato, ed è un **deliverable di F0, primo commit**. Va tenuto asciutto e per riferimento (regole sintetiche + rimando a `docs/capitolato.md`), non per duplicazione: file lunghi riducono l'aderenza dello strumento. Le regole vivono solo nel `CLAUDE.md` versionato, mai in memorie locali della macchina.
**RQ-2** Git, integrazione continua a ogni push (lint, tipi, test, scansione dipendenze), nessun deploy manuale in produzione.
**RQ-3** *(esteso in v1.1)* **Test obbligatori senza eccezioni**: consensi · limiti di autonomia · calcolo margini e soglie · nessun doppio invio · voucher a uso singolo (inclusi Modello A/B, RF-6.26) · interruttore di arresto · injection sull'agente · **nessun superamento del tetto di spesa pubblicitaria configurato senza approvazione esplicita**.
**RQ-4** Valutazioni sui prompt critici: ogni modifica ai prompt o cambio di modello deve superarle prima del rilascio.
**RQ-5** Documentazione operativa: ripristino backup, riconnessione servizi, procedura di arresto, gestione errore pubblicato. La deroga RF-6.25 è segnalata esplicitamente come eccezione.
**RQ-6** **Procedura di rimedio**: se esce un contenuto sbagliato o un invio a destinatari errati — notifica immediata, cancellazione ove possibile (per email e WhatsApp già partiti non esiste ritiro: l'unica difesa reale è il controllo preventivo, RN-62), bozza di rettifica pronta. Decisa a freddo, non nel momento.
**RQ-7** *(nuovo in v1.4 — P4)* **Definition of done.** Un task è finito solo con: TypeScript strict senza eccezioni non motivate, lint pulito, test degli invarianti toccati, ID dei requisiti citati (RQ-1), CI verde (RQ-2). **Regola del campo pulito**: ogni task lascia l'area toccata in ordine — nessun codice morto, nessuna duplicazione introdotta, nomi coerenti, fattorizzazione rispettata. I refactoring ampi diventano **task espliciti a sé**, non lavoro infilato in altri task.

---

## 12. Partenza e fasi

### 12.1 Da dove si comincia

**Lenny + lavaggi, insieme.** Sono i due pezzi pronti oggi: Lenny ha contatti, storico e tracciamento completo; i lavaggi hanno tessera e abitudine consolidata. Sono anche i due estremi del **primo voucher incrociato**, quindi la prima versione dimostra già il meccanismo che tiene insieme il gruppo invece di collaudare un lato solo.

### 12.2 Maturazione dei servizi

| Servizio | Ingresso |
|---|---|
| Lenny (delivery + spesa) | subito |
| Lavaggi | subito |
| Carburante | mai come oggetto di comunicazione — solo come dato |
| Eni Cafè (bar) | campagna di lancio all'apertura (data non definita, §15.E) |
| Officina | campagna di lancio + richiami automatici (richiede prenotazione online; data non definita, §15.E) |

Bar e officina servono anche da **collaudo del motore campagne** su qualcosa di realmente necessario. Per l'officina, i preparativi (nome, pagine, scheda Google, template) vanno pronti **settimane prima** dell'apertura (RN-61).

### 12.3 Fasi

| Fase | Contenuto | Criterio di uscita |
|---|---|---|
| **F0** | Repository, `CLAUDE.md` (RQ-1a), integrazione continua, ambienti, autenticazione, multi-marchio, modello dati (con campo organizzazione, RN-87), audit log, backup | ripristino backup provato **e** controlli RS-1/RS-8 attivi in CI dal primo commit |
| **F1** | Data Hub su Lenny e lavaggi, consensi, brand kit, template, piano editoriale, generazione contenuti, coda approvazioni | un mese di piano generato e approvato per entrambi i marchi |
| **F2** | Publishing (social, email, WhatsApp, Google), recensioni, metriche, report | 4 settimane senza incidenti di consenso o doppi invii |
| **F3** | Motore promozionale, contatori, voucher incrociati (Modello A), web app raccolta contatti | primo ciclo voucher completato e misurato |
| **F4** | Lancio bar e officina, richiami veicolo, autonomia progressiva sulle categorie idonee | ≥ 90% approvazioni pulite sulle categorie promosse |
| **F5+** | Nuovi servizi Lenny, eventuale rivendita white label (oggi solo predisposizione RN-87) | da ridefinire |

---

## 13. Rischi

| Rischio | Mitigazione |
|---|---|
| Promozione più efficace della capacità rider | RF-6.18, RN-41/42/43, blocco preventivo |
| Errore dell'agente reso pubblico | L1 di default, limiti, arresto, procedura di rimedio |
| Voucher condivisi e abusati | codice nominale a uso singolo, stato autoritativo in Regìa (RF-6.7) |
| Riscatto lento alla cassa che spegne il meccanismo | RF-6.8, validazione in pochi secondi; RF-6.26 se Regìa non risponde |
| Rincaro carburante che erode i margini Lenny | RF-6.14, allarme automatico |
| Consensi Lenny insufficienti | verifica preventiva (§15.B); in caso, prima campagna = richiesta di consenso con incentivo |
| Vincoli contrattuali Eni | logo confermato libero (RN-59); resta la parte promozionale (§15.B); area logo sostituibile (RF-2.2) |
| Spesa pubblicitaria fuori controllo | M13: tutto spento di default (RF-13.2), tetti per categoria, sforamento mai autonomo (RF-13.6, §8.2), test RQ-3 |
| Materiale fotografico non disponibile | richiesta anticipata (RF-3.9), routine ristoranti (RF-4.4), canale dal campo (RN-69) |
| Dipendenza da una sola persona | documentazione, runbook, backup testati, codice convenzionale (RS-6, RQ-7) |
| Cambio fornitori esterni | architettura ad adapter (RS-2), dati e consensi in piattaforma (RNF-8) |

---

## 14. Il vantaggio strutturale

Due elementi non replicabili da alcuna piattaforma acquistabile sul mercato, perché derivano dal possedere entrambi i lati:

1. **Il voucher incrociato.** Il costo reale è il costo industriale del servizio regalato, non il suo valore facciale: un lavaggio da 10 € pesa molto meno di 10 € di sconto e in più porta fisicamente una persona in stazione, dove esistono altri servizi da scoprire.
2. **Il doppio segno del prezzo del carburante.** Ricavo per la stazione, costo per Lenny, nello stesso istante. Nessun fornitore esterno vede entrambi i lati, quindi nessuno può dare quell'allarme.

A questi si aggiunge la condizione tecnica: **software interamente propri, team interno, dati completi, margini calcolabili.** È la situazione che nella maggior parte dei progetti simili manca, ed è la ragione per cui la Fase 1 può essere sensibilmente più breve del normale.

---

## 15. Punti aperti — registro operativo *(riscritto in v1.4 — P5)*

Ogni punto ha: cosa, chi lo chiude, entro quando (agganciato alle fasi), e **default prudente finché resta aperto** — nessun punto aperto lascia il sistema nell'ambiguità. I numeri tra parentesi rimandano alla mappa domande (archivio storico). Usciti dal registro perché già risolti altrove: comportamento oltre budget (79 → RNF-7, §8.2), primo risultato utile (104 → criterio di uscita F1), logo Eni (→ RN-59), qualità base Lenny (14 → lavoro RF-1.7 in F1), numeri di partenza (27 → Data Hub e RB-2.3 in F1, resta la query in B).

### 15.A — All'apertura del cantiere (prima settimana di F0)

| Cosa | In carico | Default finché aperto |
|---|---|---|
| **Database, storage, autenticazione** (76) — *deciso in P7*: **Supabase** (PostgreSQL + pgvector nativo, storage S3-compatibile incluso, auth integrata), piano Pro già attivo. Resta finché non si deciderà un server proprio — nessuna scadenza fissata | Titolare | — (chiuso) |
| **Hosting applicazione** (76) — dove girano Next.js e i worker BullMQ; Redis via Upstash. Provider da scegliere | Titolare | Sviluppo in locale + CI; il criterio di uscita di F0 richiede ambienti veri: non oltrepassa F0 |
| **Budget** (78) — ratifica del tetto: stima ~50–80 €/mese fissi + consumi (decisioni §48.4) e soglia di allarme, ora da ricalcolare con Supabase Pro + Upstash | Titolare | RNF-7 configurato con valori prudenti provvisori |

### 15.B — In carico al titolare, da lanciare subito (tempi morti; servono a F1/F2)

| Cosa | Serve per | Default finché aperto |
|---|---|---|
| **Consensi Lenny** (15): quanti utenti hanno acconsentito alle promozioni | F2, primo invio | Il blocco tecnico esiste comunque (RF-1.4). Se la quota è bassa: prima campagna = richiesta di consenso con incentivo (§13) |
| **Vincoli promozionali Eni**: come nominare il carburante nelle comunicazioni | F1 template, F3 promo stazione | Le meccaniche che lo nominano nascono nello stato "in attesa di autorizzazione terzi" (RF-6a.2) |
| **Utenti Lenny poco attivi** (query: un solo ordine; fermi da 3 e 6 mesi) | F2/F3 riattivazione; chiude la parte manuale del punto 27 | Nessuno: è una lettura, non una decisione |
| **5–6 post passati per marchio** con indicazione di cosa piaceva (RN-70) | F1 brand kit | Il tono si imposta da RF-2.3 e si raffina con RF-3.8 |

### 15.C — In F1, sui dati reali

| Cosa | Note |
|---|---|
| **Soglie dei contatori** (RF-6.21) | Configurazione, non codice: si tarano quando il Data Hub mostra i numeri veri |
| **Modello AI per compito** (91) | Quale modello per generazione e quale per l'agente; l'architettura regge il cambio (RS-2, RQ-4). Si decide alla prima generazione reale |
| **Giorni e orari delle due sessioni** (7) | Si fissano quando i canali sono attivi e il piano gira (cavallo F1→F2) |

### 15.D — In F2, per scelta esplicita e con prezzi aggiornati

| Cosa | Note |
|---|---|
| **Fornitori**: aggregatore social (84), email (85), WhatsApp/SMS (86) | Dati e orientamenti già raccolti (decisioni §48); l'adapter (RF-5.1) rende la scelta reversibile. Alla firma si compilano i **criteri di uscita per fornitore** (92) — il principio è già legge (RNF-8) |
| **Responsabilità template WhatsApp** (94) | Chi tiene aggiornati i modelli pre-approvati: si assegna quando il canale si attiva |

### 15.E — Dipendenze esterne senza data

| Cosa | Note |
|---|---|
| **Date di apertura bar e officina** | Gate delle campagne di lancio (F4). Appena una data esiste, il sistema sollecita i preparativi RN-61: nome officina, pagine, scheda Google, template pronti **settimane prima** |
| **Nome dell'officina** | Blocca i preparativi di cui sopra, non la piattaforma |

### 15.F — Quando serve, nessuna urgenza

| Cosa | Note |
|---|---|
| **Tetti advertising per categoria** (v1.1) | Si fissano solo quando un interruttore M13 viene acceso; il default "tutto spento" (RF-13.2) rende il punto dormiente per costruzione |
| **Nome della piattaforma** (77) | White label (RF-2.7), modificabile sempre. "Regìa" resta nome di lavoro |

### Opportunità con scadenza *(voce a scadenza — rimuovere alla prima revisione dopo agosto 2026)*

**Il QR alla colonnina.** Agosto è il picco di traffico della stazione e finisce tra poche settimane: un QR alla pompa verso una pagina anche rudimentale — beneficio immediato in cambio del recapito — raccoglie contatti utilizzabili a settembre, quando Lenny riparte. Realizzabile in pochi giorni, **fuori e prima della piattaforma**. Tre condizioni perché quei contatti siano poi utilizzabili: consenso corretto e separato per canale fin da subito (RF-10.3), pagina almeno bilingue (RN-46), offerta pensata per residenti e pendolari (RN-46). È l'unica voce del progetto con una scadenza di calendario.

---
## Appendice A — Corrispondenze degli identificativi rinumerati *(P1: rinumerazione minima)*

Rinumerati solo i casi rotti (ID duplicati tra §4 Attori e M4 Media). Il modulo M4 conserva RF-4.x.

| ID in v1.0 (§4 Attori) | ID in v1.4 |
|---|---|
| RF-4.1 | **RU-1** |
| RF-4.1a | **RU-1a** |
| RF-4.1b | **RU-1b** |
| RF-4.2 | **RU-2** |
| RF-4.3 | **RU-3** |

Riposizionamenti senza cambio di ID: **RF-7.4** (in v1.0 compariva dopo RF-7.7; in v1.4 è in sequenza). Ogni riferimento a RF-4.1/4.1a/4.1b/4.2/4.3 nei documenti storici va letto secondo questa tabella; i riferimenti interni alla v1.4 sono già aggiornati (RF-12.7 → RU-1; M8b → RU-1a).

---

## Appendice B — Censimento RN-1 → RN-87 con destinazione *(P2)*

Prova che nulla è andato perso nella fusione. Per le motivazioni estese di ogni RN fa fede `docs/archivio/decisioni-acquisite.md`. Legenda: **coperto** = già espresso da un requisito del capitolato; **assorbito** = testo operativo integrato in v1.4 nella sezione indicata; **archivio** = contesto o motivazione, resta nel documento storico; **recepito** = confluito in una decisione o riscrittura di v1.4.

| RN | Destinazione |
|---|---|
| RN-1 | Coperto da RF-2.1 |
| RN-2 | Coperto da RF-1.3 |
| RN-3 | Coperto da RF-6.18 |
| RN-4 | Coperto da RF-6a.2 |
| RN-5 | Coperto da RF-6.4, RF-9.2 |
| RN-6 | Coperto da RA-8.4 |
| RN-7 | Coperto da RB-2.3 |
| RN-8 | Coperto da RF-7.1/7.2/7.3 |
| RN-9 | Coperto da RF-5.2, M8 |
| RN-10 | Coperto da RF-3.4 |
| RN-11 | Coperto da RF-10.1 |
| RN-12 | Coperto da RF-10.2 |
| RN-13 | Coperto da RF-1.4, RF-10.3 |
| RN-14 | Coperto da RF-7a.1 |
| RN-15 | Coperto da §1.3; tradotto in regola costruttiva da RS-5 |
| RN-16 | Coperto da RF-2.7 |
| RN-17 | Coperto da RF-6a.1 |
| RN-18 | Coperto da RF-6.5/6.6/6.7/6.8 |
| RN-19 | Coperto da RF-6.11/6.12/6.13 |
| RN-20 | Coperto da RF-6.14 |
| RN-21 | Coperto da RU-1/1a/1b |
| RN-22 | Coperto da RF-12.1 |
| RN-23 | Coperto da RF-12.2/12.3 |
| RN-24 | Coperto da RF-12.4/12.5 |
| RN-25 | Coperto da RF-12.6 |
| RN-26 | Coperto da RF-5.5a |
| RN-27 | Assorbito in §7.2 |
| RN-28 | Assorbito in M7 (rimando da RF-6.27) |
| RN-29 | Assorbito in M6 (officina) |
| RN-30 | Assorbito in M6 (officina) |
| RN-31 | Assorbito in M6 (RF-6.1) |
| RN-32 | Archivio (targeting detailing: caso applicativo di RF-1.8 + RF-5.5a) |
| RN-33 | Assorbito in §1.1 (tabella marchi) |
| RN-34 | Assorbito in §7.1 |
| RN-35 | Assorbito in M6 (shop) |
| RN-36 | Assorbito in M6 (shop) |
| RN-37 | Assorbito in M7 |
| RN-38 | Assorbito in M7 |
| RN-39 | Assorbito in M7 |
| RN-40 | Assorbito in M9 |
| RN-41 | Assorbito in M6 (capacità Lenny) |
| RN-42 | Assorbito in M6 (capacità Lenny) |
| RN-43 | Assorbito in M6 (capacità Lenny) |
| RN-44 | Archivio (formazione rider: pratica gestionale; il riuso del materiale rientra in RF-4.1 M4) |
| RN-45 | Assorbito in M3 |
| RN-46 | Assorbito in M10 |
| RN-47 | Assorbito in M7 |
| RN-48 | Assorbito in M7 |
| RN-49 | Archivio (contesto: monopolio e frequenza) |
| RN-50 | Archivio (contesto: rete come barriera) |
| RN-51 | Recepito come nota in M8b; chatbot resta escluso (§3.2) |
| RN-52 | Assorbito in M1 |
| RN-53 | Assorbito in M3 |
| RN-54 | Assorbito in M3 |
| RN-55 | Coperto da RF-7.7 |
| RN-56 | Coperto da RF-7.7 |
| RN-57 | Assorbito in M7 (RF-7.7) |
| RN-58 | Coperto da RF-7.5 |
| RN-59 | Recepito in RF-6a.3, §13, §15.B (logo libero; resta la parte promozionale) |
| RN-60 | Assorbito in M2 |
| RN-61 | Assorbito in M8; richiamato in §12.2 e §15.E |
| RN-62 | Assorbito in M5 |
| RN-63 | Assorbito in M5 |
| RN-64 | Assorbito in M5 (incluso vincolo assoluto disiscrizione) |
| RN-65 | Assorbito in M5 |
| RN-66 | Assorbito in M5 |
| RN-67 | Assorbito in M5 |
| RN-68 | Recepito in RF-6.23 (Modello A al checkout Lenny) |
| RN-69 | Assorbito in M4 |
| RN-70 | Assorbito in M2 |
| RN-71 | Coperto da RA-8.1 |
| RN-72 | Assorbito in §8.6 |
| RN-73 | Assorbito in M6 (officina) |
| RN-74 | Assorbito in M6 (officina) |
| RN-75 | Assorbito in M6 (officina) |
| RN-76 | Assorbito in M1 |
| RN-77 | Assorbito in M1 |
| RN-78 | Recepito nel contesto strategico del marchio Officina (RF-2.3a); testo in archivio |
| RN-79 | Assorbito in M10 |
| RN-80 | Assorbito in M10 |
| RN-81 | Assorbito in M4 (nota a RN-69) |
| RN-82 | Assorbito in M5 |
| RN-83 | Assorbito in M4 |
| RN-84 | Assorbito in M4 (aggancio a RN-86) |
| RN-85 | Assorbito in M9 (richiamo in RF-10.4) |
| RN-86 | Assorbito in M12 |
| RN-87 | Assorbito in M1 e §12.3 (F0) |

---

## Appendice C — Provenienza delle modifiche e decisioni di stesura *(P6)*

### C.1 Provenienza per sezione

| Sezione | Provenienza |
|---|---|
| §1.1 tabella marchi | decisioni §38 (RN-33, RN-60) |
| §1.2 punto 7, §3.1/§3.2, M13, RF-8.9, RF-2.3a, M8b, estensione §8.2, RNF-7/RF-11.5 generalizzati, RQ-3 esteso | addendum v1.1 |
| RF-2.2a, RF-1.9, RF-6.23/6.24/6.25 | addendum v1.2 |
| RF-13.2 (tutto spento), RF-12.7, RNF-9, RN-87 | addendum v1.3 |
| RU-x, riposizionamento RF-7.4, App. A | consolidamento v1.4 — P1 |
| Assorbimento RN nei moduli, App. B | consolidamento v1.4 — P2 |
| RF-6.7 riscritto, RF-6.23 esteso, RF-6.26, RF-6.27, nota "deroga dormiente" | consolidamento v1.4 — P3 |
| §9.4 (RS-1..8), RQ-1a, RQ-7, criterio F0 esteso | consolidamento v1.4 — P4 |
| §15 registro operativo, V-4 aggiornato | consolidamento v1.4 — P5 |
| §9.2 (Database/Media/Coda/Hosting applicazione), §15.A (database-storage-auth chiuso, hosting applicazione riaperto distinto) | decisione post-congelamento — P7 (Supabase confermato, n8n escluso, Redis via Upstash) |
| RF-4.5 riscritto, RF-4.3/RF-4.6 estesi, RF-4.7 nuovo, §3.1 esteso, RS-2 aggiornato (due punti di contatto AI), nota in RA-8.3 | decisione post-congelamento — v1.5 (generazione media tramite servizi esterni, materiali offline) |
| Tutto il resto | capitolato v1.0 invariato |

### C.2 Decisioni meccaniche di stesura (collocazioni e riformulazioni, nessun cambio di significato)

1. Advertising aggiunto anche a §1.2 e §3.1 per coerenza con la modifica v1.1 a §3.2.
2. RN-33 collocato in §1.1 (struttura marchi) anziché in M2: è struttura del gruppo, non identità di un marchio.
3. RN-29/30/73/74/75 raggruppati in M6 sotto "Officina: flussi, richiami, preventivi"; RN-35/36 sotto "Shop": M6 è la sede delle logiche commerciali di servizio.
4. RN-41/42/43 raggruppati in M6 dopo RF-6.18 come "Gestione della capacità Lenny": governano il comportamento del motore promozionale.
5. RN-28 collocato in M7 (relazione con la rete) con rimando da RF-6.27: il conteggio serve alla conversazione col ristoratore.
6. RN-40 collocato in M9: è una rilevazione, non un'automazione.
7. RN-78 non riportato come testo autonomo: confluisce nel contesto strategico Officina (RF-2.3a).
8. Nuovi ID assegnati in stesura: RF-6.26 (indisponibilità al riscatto, P3d), RF-6.27 (buoni operativi, integrazione P3).
9. Riferimenti incrociati aggiornati: RF-12.7 e M8b puntano a RU-1/RU-1a; "§6.4" del testo v1.0 → §6; richiami a RF-6.25 aggiunti in §1.3, RF-1.1, §9.3, RQ-5.
10. RA-8.11 integra la nota (da addendum v1.3, contesto RNF-9) sulla memoria nel database e non nel modello.
11. "Recensione negativa" mantenuta nell'elenco suono/vibrazione di §8.7 come da capitolato v1.0 (la variante senza, nelle decisioni §14.6, è precedente).
12. §12.2: "Lenny (delivery + spesa)" e "Eni Cafè" allineati alla tabella marchi di §1.1.
13. La mappa domande e i contatori interni dei documenti storici non sono stati corretti: i file d'archivio si etichettano, non si riscrivono (P6); le discrepanze note sono documentate nella riga di avvertenza da apporre in testa a ciascun file archiviato.

### C.3 Avvertenza da apporre ai documenti archiviati

> *Documento storico — superato dal capitolato consolidato v1.4 (`docs/capitolato.md`). Non aggiornare. I riferimenti di sezione e i contatori interni possono riflettere strutture precedenti; per gli ID rinumerati si veda l'Appendice A della v1.4.*

---

*Capitolato 1.5 — 18 agosto 2026, estensione di v1.4 (consolidata e congelata il 14 agosto 2026). Sostituisce come fonte operativa: capitolato v1.0, addenda v1.1–v1.3, capitolato v1.4, mappa domande, decisioni acquisite (che restano in `docs/archivio/` come registro storico delle motivazioni). Aggiornamenti tracciati nel repository.*
