// RF-12.2 Classifier heuristico topic_label.
// Analizza il theme_input (input libero dell'utente o generato dal piano) e
// deduce l'etichetta di argomento. Deterministico, zero AI: pattern matching
// su parole chiave in italiano — sufficiente per volumi F1.

export const TOPIC_LABELS = [
  "officina",
  "bar",
  "consegna",
  "promozione",
  "avviso",
  "ricorrenza",
  "altro",
] as const;

export type TopicLabel = (typeof TOPIC_LABELS)[number];

// Ordine importa: prefissi strutturati vincono sui keyword.
const PREFIX_RULES: Array<{ prefix: string; label: TopicLabel }> = [
  { prefix: "SERVIZIO", label: "avviso" },
  { prefix: "RICORRENZA", label: "ricorrenza" },
];

// Keyword italiane comuni per ciascuna categoria (case-insensitive).
// Scoring: ogni match conta 1, vince la categoria con score piu' alto;
// in caso di parita', vince quella che compare prima nell'array.
// Teniamo fuori parole generiche (pranzo, ristorante, spesa) che creavano
// false positive sistematici: "post consegne a pranzo" classificato Bar;
// "Ristorante della settimana" classificato Consegna.
const KEYWORD_RULES: Array<{ label: TopicLabel; words: string[] }> = [
  {
    label: "officina",
    words: [
      "officina",
      "meccanico",
      "meccanica",
      "cambio gomme",
      "gomme",
      "pneumatici",
      "tagliando",
      "auto",
      "vettura",
      "manutenzione",
    ],
  },
  {
    label: "consegna",
    words: [
      "consegna",
      "consegne",
      "delivery",
      "domicilio",
      "rider",
      "asporto",
      "take away",
      "take-away",
    ],
  },
  {
    label: "bar",
    words: [
      "bar",
      "caffe",
      "caffè",
      "colazione",
      "aperitivo",
      "brioche",
      "cornetto",
      "cappuccino",
      "espresso",
    ],
  },
  {
    label: "promozione",
    words: [
      "promozione",
      "promo",
      "sconto",
      "offerta",
      "coupon",
      "voucher",
      "buono",
      "omaggio",
      "regalo",
      "premio",
    ],
  },
  {
    label: "avviso",
    words: [
      "avviso",
      "chiusura",
      "chiuso",
      "orario",
      "orari",
      "festivo",
      "cambio orario",
      "riapertura",
    ],
  },
];

/**
 * Rimuove prefisso strutturato [X] o [X:Y] e ritorna il resto in lowercase.
 * Usato per il matching keyword sul corpo del tema.
 */
function stripPrefix(theme: string): string {
  return theme.replace(/^\[[^\]]+\]\s*/, "").toLowerCase();
}

/**
 * Estrae il prefisso [X] o [X:Y] dal theme_input, se presente.
 * Ritorna il label originale in maiuscolo (es. "SERVIZIO"), o null.
 */
function extractPrefix(theme: string): string | null {
  const m = theme.match(/^\[([^\]]+)\]/);
  if (!m || !m[1]) return null;
  // Il prefisso può essere "RICORRENZA:qualcosa" — prendi solo la parte prima di ':'
  const rawParts = m[1].split(":");
  const first = rawParts[0];
  if (!first) return null;
  return first.trim().toUpperCase();
}

/**
 * Classifica un theme_input in una TopicLabel deterministica.
 * Priorità: prefisso strutturato > keyword match > "altro".
 */
export function classifyTopicLabel(themeInput: string): TopicLabel {
  const prefix = extractPrefix(themeInput);
  if (prefix) {
    const prefixMatch = PREFIX_RULES.find((r) => r.prefix === prefix);
    if (prefixMatch) return prefixMatch.label;
  }

  const body = stripPrefix(themeInput);
  if (!body) return "altro";

  // Scoring: ogni categoria raccoglie il numero di keyword distinte matchate.
  // Vince il punteggio piu' alto; parita' -> prima nell'ordine delle regole.
  let bestLabel: TopicLabel = "altro";
  let bestScore = 0;
  for (const rule of KEYWORD_RULES) {
    let score = 0;
    for (const w of rule.words) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(body)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLabel = rule.label;
    }
  }
  return bestLabel;
}

// Labels display per UI italiana.
export const TOPIC_LABEL_UI: Record<TopicLabel, { label: string; color: string }> = {
  officina: { label: "Officina", color: "#d89b4a" },
  bar: { label: "Bar", color: "#c25a3b" },
  consegna: { label: "Consegna", color: "#87a96b" },
  promozione: { label: "Promozione", color: "#7a6857" },
  avviso: { label: "Avviso", color: "#6b7280" },
  ricorrenza: { label: "Ricorrenza", color: "#8b6f9e" },
  altro: { label: "Altro", color: "#9ca3af" },
};
