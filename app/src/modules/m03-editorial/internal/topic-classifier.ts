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
// Non esaustive: fallback = "altro".
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
      "revisione",
      "auto",
      "vettura",
      "manutenzione",
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
      "pranzo",
      "brioche",
      "cornetto",
      "cappuccino",
      "espresso",
      "menu",
      "menù",
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
      "spesa",
      "ordine",
      "ristorante",
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
      "servizio",
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

  // Match keyword: prima categoria con almeno una parola presente vince.
  // L'ordine in KEYWORD_RULES definisce la priorità in caso di overlap.
  for (const rule of KEYWORD_RULES) {
    for (const w of rule.words) {
      // Word boundary loose: verifica che la keyword sia una parola intera
      // (evita "caffe" che matcherebbe "caffeina" — non è un problema qui
      // ma manteniamo comportamento predicibile).
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(body)) return rule.label;
    }
  }

  return "altro";
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
