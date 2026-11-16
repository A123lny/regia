// RN-robot T6: tool describePage — descrizione hardcoded della pagina corrente.
// Non richiede query al DB ne' chiamate AI: lookup su dizionario statico.

import type { RobotTool } from "./registry";

const PAGE_DESCRIPTIONS: Record<string, string> = {
  "/": "Cruscotto: panoramica sintetica dell'organizzazione (contatti totali, contenuti pianificati, reminder in scadenza).",
  "/contatti":
    "Contatti: elenco e gestione dei contatti del brand selezionato. Puoi creare nuovi contatti, modificarli, archiviarli, gestire i consensi (email/SMS/WhatsApp), vedere ordini e veicoli associati.",
  "/calendario":
    "Calendario editoriale: visualizzazione mensile e giornaliera dei contenuti programmati (post social, email, SMS), con drag-drop per spostare, e creazione di nuovi contenuti.",
  "/marchi":
    "Marchi: gestione dei brand della tua organizzazione. Per ogni brand puoi configurare logo, tono di voce, orari di apertura, canali social, pillar editoriali.",
  "/segmenti":
    "Segmenti: definizione di pubblici dinamici basati su criteri (consenso, ordini, inattività). Usati dalle campagne.",
  "/campagne":
    "Campagne: invii massivi a segmenti o liste di contatti, con tracking di consegna e aperture.",
  "/governance":
    "Governance: regole di autonomia dell'AI, tetti di spesa, revisione approvazioni, abilitazione assistente.",
  "/impostazioni":
    "Impostazioni: configurazione dell'account owner (kill switch AI, white label, connettori).",
  "/fornitori":
    "Fornitori: anagrafica fornitori con categoria, partita IVA, contatti principali, note.",
  "/analytics":
    "Analytics: report e attribuzione contenuti-vendite, performance editoriali, metriche loyalty.",
  "/fedelta":
    "Fedeltà: catalogo premi, voucher emessi e riscattati, tier membri.",
  "/iscrizioni":
    "Iscrizioni: landing QR per acquisire contatti nuovi, metriche di conversione per brand.",
  "/governance/tasks":
    "Task operative: lista delle attività da fare generate da reminder e segnali di churn.",
};

export const describePageTool: RobotTool = {
  name: "describePage",
  description:
    "Descrive cosa si può fare nella pagina attualmente aperta dall'utente. Usa questo quando l'utente chiede 'dove sono?', 'cosa c'è qui?', 'cosa posso fare?'.",
  input_schema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (_input, ctx) => {
    const base = "/" + (ctx.pageContext.pagePath.split("/").filter(Boolean)[0] ?? "");
    return {
      pagePath: ctx.pageContext.pagePath,
      pageTitle: ctx.pageContext.pageTitle,
      description:
        PAGE_DESCRIPTIONS[ctx.pageContext.pagePath] ??
        PAGE_DESCRIPTIONS[base] ??
        "Pagina della Regìa. Chiedi all'utente cosa cerca di preciso.",
    };
  },
};
