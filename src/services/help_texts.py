"""
Aiuto contestuale — estensione per il prototipo (M12, RF-12.7).

Copre in forma semplificata:
- RF-12.7 Ogni pagina/sezione ha un'icona di aiuto contestuale sempre
  presente, con spiegazione esaustiva: come funziona la sezione, come è
  collegata ad altre sezioni (dove si propaga una modifica), cosa serve
  fare per usarla correttamente (prerequisiti, ordine delle azioni).

Persistenza: nessuna, sono testi statici configurabili in codice
(potrebbero diventare JSON/CMS in futuro senza cambiare l'interfaccia).
"""
from typing import Dict, Optional

HELP_TEXTS: Dict[str, Dict[str, str]] = {
    "Home": {
        "come_funziona": "Riepilogo di ciò che serve decidere ora (approvazioni, recensioni, avvisi) e di come sta andando (voucher, contatti).",
        "collegamenti": "Aggrega dati da Workflow, Recensioni, Rete ristoranti, Amministrazione (costi) e Analytics.",
        "come_usarla": "Controllala a inizio sessione: i numeri in alto sono le priorità della giornata.",
    },
    "Crea contenuto": {
        "come_funziona": "Genera un contenuto (testo + media) per un canale e una marca, salvandolo come bozza nel workflow.",
        "collegamenti": "Il contenuto creato appare in Workflow; i media generati/riusati provengono dalla Libreria media.",
        "come_usarla": "Scegli marca e canale, scrivi il brief, genera o riusa un'immagine dalla libreria, poi passa a Workflow per proporlo.",
    },
    "Workflow": {
        "come_funziona": "Gestisce lo stato dei contenuti: bozza → proposto → approvato → programmato → pubblicato → misurato.",
        "collegamenti": "I contenuti approvati sono pronti per la Pubblicazione; i rifiuti richiedono un motivo (tracciato nell'Audit log).",
        "come_usarla": "Approva o rifiuta con motivazione; solo chi ha il permesso può pubblicare.",
    },
    "Calendario": {
        "come_funziona": "Vista cronologica unificata di tutti i contenuti, multi-marchio, con avviso di squilibrio editoriale.",
        "collegamenti": "Legge gli stessi contenuti di Workflow; l'equilibrio editoriale confronta i conteggi tra marche.",
        "come_usarla": "Usalo per pianificare: se una marca è molto sotto-rappresentata, il sistema te lo segnala.",
    },
    "Identità marchi": {
        "come_funziona": "Definisce brand kit, tono di voce, contesto strategico e vincoli redazionali per ogni marca.",
        "collegamenti": "Il contesto qui definito è obbligatorio in ogni generazione di contenuto (Crea contenuto).",
        "come_usarla": "Compila tono e contesto strategico prima di generare contenuti: è la base di coerenza del marchio.",
    },
    "Fedeltà": {
        "come_funziona": "Motore contatori e voucher: emissione automatica al raggiungimento soglia, verifica e riscatto separati.",
        "collegamenti": "I voucher emessi alimentano l'Analytics (tasso di riscatto) e possono essere premi incrociati tra marche.",
        "come_usarla": "Configura soglia e premio per marca; il riscatto è idempotente, mai doppio uso.",
    },
    "Recensioni": {
        "come_funziona": "Classifica automaticamente le recensioni (positiva/negativa/grave) e prepara bozze di risposta.",
        "collegamenti": "I casi gravi restano solo segnalazione, mai bozza automatica; nessuna risposta pubblica parte in autonomia.",
        "come_usarla": "Rivedi le bozze pronte quotidianamente; i casi gravi vanno gestiti prima privatamente, poi in pubblico.",
    },
    "Raccolta contatti": {
        "come_funziona": "Web app leggera per la raccolta contatti con consenso separato per canale (email/WhatsApp/SMS).",
        "collegamenti": "I contatti raccolti alimentano il Data Hub (igiene liste, segmentazione) e possono ricevere il voucher di benvenuto da Fedeltà.",
        "come_usarla": "Verifica sempre il consenso per canale prima di ogni invio: è bloccato a monte se assente.",
    },
    "Data Hub": {
        "come_funziona": "Modello dati canonico: anagrafica veicolo, storico prezzi, deduplicazione contatti, segmentazione, richieste dati personali.",
        "collegamenti": "I veicoli in scadenza alimentano i richiami officina; la segmentazione può guidare Analytics e Advertising.",
        "come_usarla": "Le richieste di esportazione/cancellazione dati vanno sempre gestite manualmente: il sistema non risponde da solo.",
    },
    "Rete ristoranti": {
        "come_funziona": "Gestisce i ristoranti partner come rete di micro-partner, con priorità di contatto e rilevamento raffreddamento.",
        "collegamenti": "Gli ordini registrati qui alimentano l'Analytics; i contatti si tracciano nell'Audit log.",
        "come_usarla": "Controlla prima i ristoranti in raffreddamento: hanno priorità sull'acquisizione di nuovi partner.",
    },
    "Pubblicazione": {
        "come_funziona": "Coda di pubblicazione multi-canale con ritentativi, idempotenza e log immutabile.",
        "collegamenti": "Pubblica contenuti già approvati in Workflow; rispetta le fasce orarie e la regola WhatsApp.",
        "come_usarla": "Programma, poi invia o annulla dalla coda; il log in fondo mostra lo storico immutabile.",
    },
    "Advertising": {
        "come_funziona": "Interruttori e tetti di spesa per marca/categoria, tutti spenti di default; sforamento mai automatico.",
        "collegamenti": "La classificazione dei contenuti (solo organico/spinto/candidato) si riflette nel Calendario editoriale.",
        "come_usarla": "Accendi esplicitamente ogni categoria prima di poter registrare spesa; le richieste di sforamento vanno approvate a mano.",
    },
    "Email assistenza": {
        "come_funziona": "Instrada le caselle info@/help@ collegate: domande fattuali → bozza pronta, tutto il resto → responsabile competente.",
        "collegamenti": "Nessun collegamento diretto ad altri moduli; le email 'da instradare' non hanno mai risposta automatica.",
        "come_usarla": "Rivedi la coda quotidianamente; per le email instradate scrivi sempre tu la risposta finale.",
    },
    "Agente AI": {
        "come_funziona": "Motore di autonomia progressiva: livelli L0-L3 per categoria, categorie sempre manuali, suggerimenti di promozione/retrocessione.",
        "collegamenti": "Il livello qui configurato determina se un'azione (es. pubblicazione ricorrente) può eseguire da sola altrove nel sistema.",
        "come_usarla": "Il sistema propone, non applica: il passaggio di livello va sempre confermato manualmente.",
    },
    "Analytics": {
        "come_funziona": "Aggrega metriche già raccolte dagli altri moduli in una dashboard per marca (voucher, recensioni, contatti).",
        "collegamenti": "Nessuna scrittura: legge solo da Fedeltà, Recensioni, Raccolta contatti e Workflow.",
        "come_usarla": "Confronta l'andamento per marca; il tasso di riscatto voucher è un buon indicatore di efficacia promozionale.",
    },
    "Amministrazione": {
        "come_funziona": "Gestione marchi, autonomia per categoria, interruttore di arresto generale, monitor costi, delega.",
        "collegamenti": "L'interruttore di arresto blocca le pubblicazioni automatiche ovunque nel sistema; la delega limita i permessi di un sostituto.",
        "come_usarla": "Sezione riservata all'Owner: verifica il monitor costi mensilmente e gestisci la delega in caso di assenza.",
    },
    "Audit log": {
        "come_funziona": "Elenco cronologico e immutabile delle azioni rilevanti compiute nel sistema.",
        "collegamenti": "Riceve eventi da quasi tutti i moduli (approvazioni, rifiuti, modifiche di configurazione).",
        "come_usarla": "Consultalo per ricostruire chi ha fatto cosa e quando, specialmente in caso di dubbi o contestazioni.",
    },
}

DEFAULT_HELP = {
    "come_funziona": "Sezione del prototipo Regìa.",
    "collegamenti": "Vedi la documentazione del capitolato per i dettagli.",
    "come_usarla": "Esplora i controlli disponibili nella pagina.",
}


def get_help(section: str) -> Dict[str, str]:
    """Ritorna il testo di aiuto esaustivo per una sezione (RF-12.7)."""
    return HELP_TEXTS.get(section, DEFAULT_HELP)
