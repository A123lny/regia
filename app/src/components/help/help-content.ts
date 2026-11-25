// Testi help contestuale per ogni pagina.
// Ogni entry: title + body Markdown-like (semplice, senza parsing avanzato).
// Chiave = pageKey esplicito passato a <HelpButton />.

export type HelpEntry = {
 title: string;
 body: string;
};

export const HELP_TEXTS: Record<string, HelpEntry> = {
 dashboard: {
 title: "Home",
 body:
 "La home riassume cosa devi fare e come sta andando: bozze da approvare, contenuti programmati/pubblicati, ricorrenze in arrivo, materiali da raccogliere, equilibrio editoriale.\n\n" +
 "Le 4 card in alto sono cliccabili: aprono la sessione di approvazione o la lista filtrata.\n\n" +
 "I banner arancioni (ricorrenze, materiali) e quello viola (equilibrio) appaiono solo se ci sono elementi in attesa.",
 },
 marchi: {
 title: "Marchi",
 body:
 "Gestisci l'anagrafica dei marchi del gruppo. Ogni marchio ha logo, colore, font, identità email e brand kit (tono, pilastri, parole vietate).\n\n" +
 "• Aggiungi marchio: bottone in alto a destra. Puoi caricare il logo già in creazione.\n" +
 "• Modifica: menu ⋮ sulla riga → include upload/rimozione logo + identità email.\n" +
 "• Archivia: soft-delete. Il marchio sparisce da menù e liste, ma i contenuti storici restano.",
 },
 "brand-kit": {
 title: "Brand kit",
 body:
 "Il brand kit di questo marchio: tono di voce, contesto strategico, rubriche/pilastri con pesi, parole bandite, argomenti sensibili.\n\n" +
 "L'AI usa TUTTI questi dati come contesto obbligatorio ad ogni generazione.\n\n" +
 "Bottone 'Libreria media' in alto: gestisci foto e video del marchio.",
 },
 contenuti: {
 title: "Contenuti",
 body:
 "Vista principale: scegli un marchio per generare, approvare, programmare contenuti.\n\n" +
 "Filtri rapidi dalla sidebar: Bozze / Approvate / Programmate / Pubblicate / Archivio.\n\n" +
 "Da /contenuti/[marchio] hai 4 bottoni: Nuovo contenuto (single-shot), Pianifica settimane (batch AI multi-post), Avviso rapido (avviso di servizio), Calendario (vista per-marchio).",
 },
 "contenuti-archivio": {
 title: "Archivio contenuti",
 body:
 "Ricerca full-text su tutti i contenuti generati. Filtra per data, marchio, stato.\n\n" +
 "Utile per ritrovare un post per riproporlo o rivedere l'esito di una promo passata.",
 },
 calendario: {
 title: "Calendario editoriale",
 body:
 "Vista cross-brand di tutti i contenuti programmati/pubblicati nei prossimi 14 giorni.\n\n" +
 "• Click su un post → anteprima modal.\n" +
 "• Drag&drop tra giorni → riprogramma (mantiene l'ora).\n" +
 "• Click sulla data del giorno → day-view con drag verticale per cambiare ora + azioni edit/togli/elimina.",
 },
 sessione: {
 title: "Sessione approvazione",
 body:
 "Wizard per approvare in blocco le bozze cross-marchio.\n\n" +
 "Per ogni bozza: Approva · Rifiuta (con motivo obbligatorio, serve al sistema per imparare —) · Salta.\n\n" +
 "Consigliato in 2 sessioni settimanali da 30 minuti (copertura doppia).",
 },
 piano: {
 title: "Piano editoriale AI",
 body:
 "Genera N bozze in un colpo. Il sistema distribuisce i temi tra i pilastri del marchio in base al loro peso, considera stagionalità e giorno della settimana, evita ripetizioni.\n\n" +
 "Il piano crea bozze in stato 'draft': approvale poi col wizard Sessione.",
 },
 servizio: {
 title: "Avviso rapido",
 body: "Per comunicazioni di servizio (chiusure, orari straordinari, avvisi). Poche parole in ingresso → post pronto in tono asciutto, senza linguaggio promozionale.",
 },
 "libreria-media": {
 title: "Libreria media",
 body:
 "Immagini per i contenuti del marchio. Upload drag&drop (PNG/JPEG/WebP/SVG, max 20MB).\n\n" +
 "• Tag e caption per ricerca.\n" +
 "• Un'immagine si allega a un draft dal dettaglio del draft stesso.\n" +
 "• Bottone Download HR per scaricare in alta risoluzione per stampa/pubblicazione manuale.",
 },
 team: {
 title: "Team",
 body:
 "Membri dell'organizzazione con ruolo (Owner/Marketing/Delegato).\n\n" +
 "• Owner: tutto. Approva/rifiuta contenuti, gestisce marchi, gestisce team.\n" +
 "• Marketing (Editor): genera, programma, pubblica, edita brand kit. NON approva/rifiuta.\n\n" +
 "Nuovi membri via script CLI dev-create-member.sh (invito email arriverà con).",
 },
 impostazioni: {
 title: "Impostazioni",
 body:
 "Profilo, ambiente, chiavi AI, Team, Account social, Kill switch AI, Tetti spesa AI, Salute connessioni, Aspetto piattaforma (white label), Ricorrenze annuali.\n\n" +
 "Ogni card è pensata per fare una cosa specifica — non c'è pericolo di rompere niente.",
 },
 "impostazioni-canali": {
 title: "Canali di invio",
 body:
 "Configura i canali per far uscire i messaggi da Regia.\n\n" +
 "- **Email (Resend)**: crea un account su resend.com, genera una API key (dashboard → API Keys → Create), incollala qui, indica il from address (deve essere su un dominio verificato in Resend).\n" +
 "- **WhatsApp (Twilio)**: crea un account su twilio.com, attiva WhatsApp Business, ottieni Account SID + Auth Token dalla console, inseriscili qui. In v1 usiamo template pre-approvati (creati da Twilio Console).\n\n" +
 'Le API key sono cifrate in Supabase Vault: dopo il salvataggio non le vedi più. Test invia un ping al provider; se ok, il canale diventa 🟢 Verificato. Attiva lo switch "Abilitato" per aprire il canale al motore invii.',
 },
 audit: {
 title: "Registro attività",
 body:
 "Registro di TUTTE le azioni: chi ha fatto cosa, quando.\n\n" +
 "Filtri per tipo di attore:\n" +
 "• Utente: azioni umane (Owner, Marketing).\n" +
 "• Agente: azioni fatte da bot AI.\n" +
 "• Sistema: automazioni non attribuibili (cron, cleanup).\n\n" +
 "Solo Owner ha accesso.",
 },
 "da recuperare": {
 title: "Da recuperare",
 body:
 "nella spesa a domicilio, perdere un abituale vale più di un ordine mancato.\n\n" +
 "**Segnali automatici:**\n" +
 "• skipped_week (HIGH): ≥4 ordini nelle 4 settimane precedenti + 0 nell'ultima.\n" +
 "• dropped_frequency (MED): ordini ultimi 30gg ≤ 50% dei 30gg precedenti (baseline ≥2).\n" +
 "• silence_gap (MED): 30+gg senza ordini per chi ne aveva ≥3 nell'anno.\n" +
 "• inactivity (HIGH): 60+gg senza ordini per chi ne aveva ≥1 nell'anno.\n\n" +
 "**Ricalcola segnali** (Owner): scan idempotente via UNIQUE parziale. **Risolvi**: quando cliente ricontattato / tornato attivo, marca con motivo (audit).",
 },
 fornitori: {
 title: "Fornitori",
 body:
 "Partner spesa (fornitori Lenny). Anagrafica + assenso nessuno sconto sui prodotti del partner senza il suo assenso.\n\n" +
 "**Assenso generale**: se attivo, sblocca l'emissione di voucher che possono ricadere sui prodotti del partner. Serve motivo/scadenza (accordo contrattuale).\n\n" +
 "**Enforcement**: alla creazione voucher a valore/percentuale su Lenny, il sistema verifica prodotti legati a fornitori senza assenso e blocca. Solo Owner può override.\n\n" +
 "Modifica: solo Owner (decisione contrattuale).",
 },
 "contatti-duplicati": {
 title: "Duplicati contatti",
 body:
 "pulizia liste: rileva contatti che condividono email/telefono/WhatsApp normalizzati (case + spazi + prefissi ignorati).\n\n" +
 "**Merge (Owner-only, distruttivo):**\n" +
 "• Scegli il **survivor** — suggerito quello con più dati (score in alto).\n" +
 "• Il duplicato viene archiviato con is_duplicate_of.\n" +
 "• Tutti i dati agganciati migrano al survivor: ordini, voucher, veicoli, eventi contatore, signup, reminders.\n" +
 "• Consensi fusi con priorità: granted > revoked > never per canale.\n\n" +
 "Non transazionale ma idempotente: se fallisce a metà, ripetendola completi il merge.",
 },
 promemoria: {
 title: "Promemoria",
 body:
 "Motore retention promemoria automatici che spesso sono più redditizi delle promozioni.\n\n" +
 "**Tipi generati automaticamente:**\n" +
 "• **Benvenuto** — quando un contatto si iscrive via landing (scheduled dopo 1h).\n" +
 "• **Richiamo officina** — veicoli con last_service_at ≈12 mesi (tagliando dovuto entro 30gg).\n" +
 "• **Voucher in scadenza** — voucher issued con expires_at nei prossimi 10gg.\n" +
 "• **Vicino alla soglia** — contatti a ≥80% del threshold di un contatore (fedeltà).\n" +
 "• **Cliente dormiente** — nessun ordine negli ultimi 60gg + almeno un consenso granted.\n\n" +
 "**Ricalcola promemoria** (Owner-only): scan idempotente su veicoli/voucher/ordini/contatori. Chiamalo periodicamente (o dopo eventi significativi). UNIQUE parziale in DB impedisce duplicati sui pending.\n\n" +
 "Le azioni **Marca inviato** e **Ignora** liberano il record dallo stato pending (audit-loggate).",
 },
 governance: {
 title: "Governance",
 body:
 "Registro delle regole di autonomia agente () e vincoli commerciali ().\n\n" +
 "**Livelli:**\n" +
 "• **Mai autonomo** — l'agente AI non può agire in autonomia, sempre approvazione umana.\n" +
 "• **Approvazione umana** — può proporre, ma serve conferma esplicita.\n" +
 "• **Autonomo** — può agire in autonomia (con audit log completo).\n\n" +
 "**Applicata dal codice** = c'è una guardia applicativa che impedisce la violazione (es. discount_forbidden sui prodotti). Le altre sono documentazione operativa.\n\n" +
 "**Prodotti a sconto vietato**: carburanti Stazione + tariffe officina sono flaggati per default. Se crei un'offerta voucher a valore/percentuale su un brand che contiene prodotti flaggati, il sistema **blocca** l'operazione — l'Owner può forzare con conferma esplicita, che finisce in audit.",
 },
 analytics: {
 title: "Analytics",
 body:
 "Cruscotto commerciale. Vista aggregata di tutti i pezzi: contatti, ordini, fedeltà, campagne, ristoranti Lenny, iscrizioni.\n\n" +
 "Selettore periodo in alto (7/30/90 giorni). I trend confrontano il periodo con quello immediatamente precedente della stessa durata.\n\n" +
 "Metriche chiave:\n" +
 "• **Trend**: ↑ crescita, ↓ calo, — stabile (differenza <1%).\n" +
 "• **Tasso riscatto voucher**: redeemed / totale emessi (attivi + scaduti + annullati).\n" +
 "• **Vicini alla soglia**: top 5 clienti con % maggiore verso il premio (esclusi già raggiunti).\n" +
 "• **Conversion landing**: voucher benvenuto emessi / signup totali per landing.\n\n" +
 "Solo lettura: nessuna azione qui.",
 },
 iscrizioni: {
 title: "Iscrizioni",
 body:
 "Landing pubbliche di raccolta contatti (). Nessun login richiesto: il cliente scansiona QR o segue un link e compila un form 1-pagina.\n\n" +
 "Ogni landing:\n" +
 "• Slug URL (visibile in /iscriviti/<slug>) da stampare su colonnina/scontrino/locandina.\n" +
 "• Titolo + benefit (cosa riceve chi si iscrive).\n" +
 "• Voucher benvenuto opzionale: emette un codice all'iscrizione.\n" +
 "• Domanda 'residente vs turista' con testi personalizzabili — tagga automatico il contatto.\n\n" +
 "Backend: rate-limit anti-abuse (3 signup/15min per IP), dedup su email/telefono, upsert consensi per canale, audit via signup_events. Il QR fisico va generato esternamente.",
 },
 ristoranti: {
 title: "Ristoranti Lenny",
 body:
 "I ~50 ristoranti come rete di micro-partner. Non è una lista destinatari: sono relazioni una a una.\n\n" +
 "• KPI in alto: attivi · in da risentire · da contattare (>30gg) · mai partiti.\n" +
 "• Cooling flag: quando un ristorante 'si sta raffreddando' — ordini in calo, incidenti, cliente insoddisfatto. Motivo obbligatorio.\n" +
 "• Timeline attività: log cronologico dei contatti (chiamate, incontri, follow-up) con esito. Ogni voce aggiorna last_contact_at.\n" +
 "• Tempo medio ordine→ritiro: base per conversazioni coi ristoratori sui tempi reali.\n\n" +
 "Perdere un ristorante costa più di una promozione — priorità sulla acquisizione.",
 },
 segmenti: {
 title: "Gruppi",
 body:
 "Insiemi di contatti per marchio, definiti da criteri.\n\n" +
 "Criteri disponibili:\n" +
 "• Ordini negli ultimi N giorni (recency positiva).\n" +
 "• Silenzio da N giorni (dormienti: NESSUN ordine nel periodo).\n" +
 "• Min. numero ordini · Min. spesa totale (frequency & value).\n" +
 "• Consenso richiesto su un canale specifico (email/SMS/WhatsApp).\n" +
 "• Tag richiesti (AND) / tag da escludere (NOT).\n\n" +
 "Il conteggio è ricalcolato al salvataggio. Icona ↻ nella tabella per rifresh manuale. Con volumi (~10k contatti) il calcolo on-demand è veloce.",
 },
 campagne: {
 title: "Campagne",
 body:
 "Predisposizione invii cross-canale. la campagna resta in stato draft/scheduled: l'invio effettivo arriverà con M5 (adapter email/SMS/WhatsApp).\n\n" +
 "Flusso:\n" +
 "1. Crea campagna (marchio, segmento, canale, opz. contenuto M3, data programmata).\n" +
 "2. Quando invii manualmente, marca 'inviata' con esiti (tentati/consegnati/falliti). Solo Owner (audit-critical).\n\n" +
 "Vincolo: mai autonomo su primi contatti a pubblici nuovi o comunicazioni che toccano partner con vincolo (Eni, ristoranti). Il codice non blocca — è responsabilità dell'operatore.",
 },
 fedelta: {
 title: "Fedeltà",
 body:
 "Contatori, offerte e voucher a uso singolo (,).\n\n" +
 "• **Contatori**: cosa si conta (passaggi/valore speso/ordini), soglia, azzeramento (dopo premio / annuale / mai). Configurazione strategica (solo Owner).\n" +
 "• **Offerte**: tipo premio (valore fisso €, sconto %, servizio gratis), marchio che emette e marchio dove si spende (incrociati), scadenza default, cumulabilità.\n" +
 "• **Voucher**: istanze emesse a contatti specifici. Codice unico stampabile/inviabile. Uso singolo garantito in DB (mai doppio riscatto).\n" +
 "• **Riscatta**: campo codice al banco. Il sistema valida stato, scadenza e appartenenza in un'operazione atomica.\n\n" +
 "Costi: paga chi riceve il cliente. Nessuna compensazione tra società — il sistema tiene il conto.",
 },
 catalogo: {
 title: "Catalogo",
 body:
 "Prodotti e servizi per marchio. Ogni prodotto ha:\n" +
 "• SKU + nome + categoria + unità (pezzo, litro, kg, ora, servizio).\n" +
 "• Prezzo e costo attuali (in centesimi in DB, mostrati in €).\n" +
 "• Storico prezzi — ogni cambio apre un nuovo snapshot.\n" +
 "• Margine minimo — sotto questa soglia il sistema segnala promozioni non convenienti. Solo Owner (materia strategica).\n\n" +
 "Fonte: manuale (creato qui), gestionale (importato via sync futuro), import (batch iniziale).",
 },
 ordini: {
 title: "Ordini",
 body:
 "Vendite cross-marchio. sola lettura — la scrittura viene fatta importando dai gestionali.\n\n" +
 "Ogni ordine ha: cliente (opzionale = ospite), canale (delivery, cassa, officina, carburante, ecc.), stato (in attesa, completato, annullato, rimborsato), righe con snapshot prezzo (storicità).\n\n" +
 "Filtri: marchio · canale · stato · range date. Click su una riga → drawer con testata + righe + link al contatto.",
 },
 contatti: {
 title: "Contatti",
 body:
 "Anagrafica canonica cross-marchio. Ogni contatto ha:\n" +
 "• Recapiti (email/telefono/WhatsApp): serve almeno uno.\n" +
 "• Consensi separati per canale: email ≠ SMS ≠ WhatsApp. Il consenso è BLOCCANTE per ogni invio, il sistema non permette di inviare senza. Solo Owner può cambiarlo (materia legale).\n" +
 "• Veicoli agganciati: targa, modello, km, gomme. Prerequisito dei richiami officina.\n\n" +
 "Filtri: marchio · fonte · canale+stato consenso · ricerca testo.\n" +
 "Click su una riga → drawer laterale con dettagli, consensi, veicoli.",
 },
 "provider-media": {
 title: "Provider media esterna",
 body:
 "registrazione fornitori AI per generazione immagini/video (fal.ai FLUX, Replicate, DALL-E, ecc.). I ToS si verificano UNA VOLTA alla registrazione, non ad ogni generazione.\n\n" +
 "**Campi:**\n" +
 "• **Tipo**: immagini / video / entrambi.\n" +
 "• **Diritti sull'output** (chi detiene cosa): user (noi, chi paga), provider (dobbiamo chiedere permesso ad ogni uso commerciale), shared (co-ownership — il provider può usare l'output), public domain.\n" +
 "• **Usi ammessi**: spunta SOLO ciò che il provider dichiara nei suoi T&C (commerciale, editoriale, personale). Se nessun uso e' spuntato il provider non può generare nulla.\n" +
 "• **Settori vietati**: cosa il provider esclude esplicitamente (tabacco, alcool, armi, politica, religione, ecc.). Il codice li usera' per bloccare richieste.\n\n" +
 "**usa solo template interni** — questa infrastruttura dorme finche non si collega un provider reale. Nessuna generazione AI esterna accade senza un provider attivo registrato.\n\n" +
 "RA-8.6 rispettato: il modello non decide a run-time quali usi sono ammessi, legge solo 'c'e' un provider attivo per questo uso?' e si ferma se no.",
 },
 "zone-consegna": {
 title: "Zone di consegna",
 body:
 "le zone di consegna sono variabili per clima/eventi/chiusure stradali. Oggi un rider può andare, domani con la neve no.\n\n" +
 "**Zone**: per marchio Lenny, con prefissi CAP coperti (es. 47900, 47891). Un contatto appartiene a una zona se il suo CAP ha uno di questi prefissi.\n\n" +
 "**Blackout** (banner rosso in alto quando attivo):\n" +
 "• Tipo: neve, pioggia, evento, chiusura stradale, altro.\n" +
 "• Inizio obbligatorio + fine opzionale (lascia vuoto se non sai).\n" +
 "• Guard applicativo: finche c'e' un blackout attivo su una zona, le promo food/consegna per i contatti di quella zona vengono bloccate dal motore/campagne.\n\n" +
 "**Chiudi blackout** appena il problema rientra: libera di nuovo gli invii. Registro attività tiene traccia di tutto.",
 },
 "contatti-dati-personali": {
 title: "Richieste dati personali (GDPR)",
 body:
 "dossier completo di ciò che Regia sa su un contatto. Serve per rispondere a richieste di accesso o cancellazione imposte dal GDPR.\n\n" +
 "**Export** (azione legale, non distruttiva):\n" +
 "• Scarica JSON con anagrafica, consensi per canale, veicoli, voucher emessi, ordini, iscrizioni, reminders, publish log, precedenti richieste.\n" +
 "• Dossier congelato: snapshot persistito su contact_data_requests.dossier_snapshot per audit.\n\n" +
 "**Cancellazione** (irreversibile, Owner-only):\n" +
 "• Nullifica recapiti (email/telefono/WhatsApp), revoca consensi, archivia il contatto.\n" +
 "• Voucher già emessi restano in DB (storicita' commerciale) ma non più agganciati ai recapiti.\n" +
 "• Snapshot dossier conservato come prova dell'adempimento.\n\n" +
 "Entrambe le operazioni sono Owner-only (materia legale). Registro attività completo.",
 },
 "ristoranti-mercato": {
 title: "Analisi mercato rete",
 body:
 "strumento strategico per valutare la saturazione della rete per categoria di cucina.\n\n" +
 "**Non e' marketing**, e' gestione di mercato. Il principio del capitolato: il problema non e' chi va male, e' quanti fanno la stessa cosa.\n\n" +
 "**Metodo:**\n" +
 "- Raggruppa i ristoranti attivi per cuisine_category.\n" +
 "- Conta ordini ultimi 90gg per partner (via brand_orders.partner_restaurant_id).\n" +
 "- Calcola ordini medi per ristorante in ogni categoria.\n" +
 "- Confronta con la mediana rete (±15% = in linea).\n\n" +
 "**Verdetti:**\n" +
 "- **Sotto-offerta** (verde): media >= 1.15x mediana. Pochi ristoranti per la domanda. Opportunita' di inserire un partner nuovo.\n" +
 "- **Equilibrata** (grigio): media entro ±15% mediana.\n" +
 "- **Satura** (rosso): media <= 0.85x mediana. Un nuovo partner diluirebbe la torta.\n\n" +
 "**Limite:** senza connettori M1 reali gli ordini attribuiti sono 0. Il conteggio ristoranti per categoria resta valido (saturazione cardinale), ma il confronto media diventa 'sconosciuto'.",
 },
 "memoria-agente": {
 title: "Memoria agente",
 body:
 "cosa l'agente AI ha imparato dall'uso. Aggregato dai dati di lavoro (bozze, voucher, brand kit). Risiede nel DB di Regia (pgvector + Postgres), **non nel modello AI** — un cambio di modello non la perde.\n\n" +
 "**4 sezioni:**\n" +
 "• **Tasso di approvazione per categoria** (ultimi 90gg): quando una categoria arriva a 9/10 approvate senza modifica → candidata al passaggio di livello di autonomia.\n" +
 "• **Motivi di rifiuto frequenti**: parole chiave ricorrenti dai motivi di rifiuto. Se una parola compare spesso, il brand kit va corretto.\n" +
 "• **Esiti promozioni (voucher)**: issued vs redeemed per offerta. Tasso basso suggerisce offerta poco attrattiva o scadenza stretta.\n" +
 "• **Preferenze di stile per marchio**: pilastri narrativi con peso + conteggio parole vietate / argomenti sensibili.\n\n" +
 "Read-only: nessun dato viene scritto qui. La tracciabilita' del singolo evento sta in /audit.",
 },
 ricorrenze: {
 title: "Ricorrenze annuali",
 body:
 "Eventi che tornano ogni anno (Natale, cambio gomme, chiusure ferie). Il sistema li propone in dashboard quando arriva il periodo (today + preavviso).\n\n" +
 "• Crea nuovo evento con nome, mese, giorno, preavviso, tema suggerito.\n" +
 "• Disattiva se non ti serve più per un anno.\n" +
 "• Elimina se davvero non ricorrerà più.",
 },
};

export function getHelpEntry(pageKey: string): HelpEntry {
 return (
 HELP_TEXTS[pageKey] ?? {
 title: "Aiuto",
 body: "Documentazione non ancora disponibile per questa pagina. Contatta l'amministratore.",
 }
 );
}
