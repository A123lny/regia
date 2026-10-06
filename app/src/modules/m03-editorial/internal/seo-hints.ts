// RF-13.7 Suggerimenti SEO organica (analyzer euristico deterministico).
//
// Capitolato: "La piattaforma analizza e suggerisce (testi, struttura, parole
// chiave), coerente col vincolo di non gestire/accedere ai siti. Nessuna spesa
// a consumo." Stessa filosofia del topic classifier RN-85: zero costo, zero
// latenza, comportamento predicibile. Nessuna chiamata AI esterna.
//
// Analizza un testo (copia social, post, email, descrizione sito) e produce
// 3-6 hint actionable con severity. L'Owner li legge come checklist, non
// come verdetto automatico.

export type SeoHintSeverity = "good" | "info" | "warning";

export type SeoHint = {
  key: string;
  severity: SeoHintSeverity;
  label: string;
  detail: string;
};

// Stop-words italiane (sottoinsieme minimo per densita' parole chiave).
const STOP_WORDS = new Set<string>([
  "il",
  "lo",
  "la",
  "i",
  "gli",
  "le",
  "un",
  "una",
  "uno",
  "di",
  "a",
  "da",
  "in",
  "con",
  "su",
  "per",
  "tra",
  "fra",
  "e",
  "ed",
  "o",
  "ma",
  "se",
  "che",
  "del",
  "dello",
  "della",
  "dei",
  "degli",
  "delle",
  "al",
  "allo",
  "alla",
  "ai",
  "agli",
  "alle",
  "dal",
  "dallo",
  "dalla",
  "dai",
  "dagli",
  "dalle",
  "nel",
  "nello",
  "nella",
  "nei",
  "negli",
  "nelle",
  "col",
  "coi",
  "sul",
  "sullo",
  "sulla",
  "sui",
  "sugli",
  "sulle",
  "è",
  "sono",
  "sei",
  "siamo",
  "siete",
  "ha",
  "hai",
  "ho",
  "abbiamo",
  "avete",
  "hanno",
  "non",
  "si",
  "ci",
  "vi",
  "ne",
  "ti",
  "mi",
  "lo",
  "li",
  "le",
  "lei",
  "lui",
  "noi",
  "voi",
  "loro",
  "come",
  "quando",
  "dove",
  "perche",
  "cosa",
  "chi",
  "cui",
  "quale",
  "quali",
  "molto",
  "tutto",
  "tutti",
  "tutta",
  "tutte",
  "anche",
  "ancora",
  "piu",
  "meno",
  "bene",
  "male",
]);

// Verbi all'imperativo tipici in CTA italiane (lemma + principali flessioni).
const CTA_VERBS = [
  "prenota",
  "scopri",
  "chiama",
  "chiamaci",
  "vieni",
  "passa",
  "scrivi",
  "scrivici",
  "ordina",
  "ordinaci",
  "contatta",
  "contattaci",
  "visita",
  "iscriviti",
  "iscrivetevi",
  "approfitta",
  "richiedi",
  "clicca",
  "guarda",
  "entra",
  "vieni",
  "prova",
  "assaggia",
  "ritira",
  "porta",
  "lascia",
  "fissa",
];

// Pattern per riconoscere numeri concreti (prezzo, data, orario, percentuale).
const CONCRETE_NUMBER_RE =
  /(\d+[,.]?\d*)\s*(€|eur|euro|%|ore?|minuti?|km|kg|gg|giorni?|mesi?|anni?|\/\d|:\d)/i;
const DATE_RE =
  /\b\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?\b|\b\d{1,2}\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/i;
const TIME_RE = /\b\d{1,2}[:\.]\d{2}\b|\bdalle\s+\d|\balle\s+\d|\bore\s+\d/i;

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function sentenceSplit(text: string): string[] {
  return text
    .split(/[\.\!\?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function analyzeSeoHints(text: string): SeoHint[] {
  const hints: SeoHint[] = [];
  const trimmed = text.trim();
  if (trimmed.length === 0) return hints;

  const words = tokenizeWords(trimmed);
  const sentences = sentenceSplit(trimmed);
  const firstLine = trimmed.split(/\n/)[0]?.trim() ?? "";

  // 1) Lunghezza testo
  if (trimmed.length < 50) {
    hints.push({
      key: "length-too-short",
      severity: "warning",
      label: "Testo molto breve",
      detail: `${trimmed.length} caratteri. Potrebbe non reggere da solo su un canale: aggiungi contesto, numero o call-to-action.`,
    });
  } else if (trimmed.length > 2000) {
    hints.push({
      key: "length-too-long",
      severity: "warning",
      label: "Testo molto lungo per social",
      detail: `${trimmed.length} caratteri. Instagram taglia a 2200, Facebook e email reggono, ma per social breve meglio accorciare.`,
    });
  } else if (trimmed.length >= 150 && trimmed.length <= 1200) {
    hints.push({
      key: "length-ok",
      severity: "good",
      label: "Lunghezza adeguata",
      detail: `${trimmed.length} caratteri, range che regge bene su piu canali.`,
    });
  }

  // 2) Titolo iniziale (prima riga breve, no punteggiatura finale)
  const firstLineOk =
    firstLine.length > 0 &&
    firstLine.length <= 80 &&
    !/[.;:,]$/.test(firstLine) &&
    firstLine !== trimmed;
  if (!firstLineOk && trimmed.length > 100) {
    hints.push({
      key: "no-headline",
      severity: "info",
      label: "Manca un titolo di apertura",
      detail:
        "Una prima riga corta e incisiva (max 80 caratteri, senza punto finale) funziona da aggancio: aiuta sia su social sia come oggetto email.",
    });
  } else if (firstLineOk) {
    hints.push({
      key: "has-headline",
      severity: "good",
      label: "Apertura chiara",
      detail: `"${firstLine.slice(0, 60)}${firstLine.length > 60 ? "…" : ""}" funziona come aggancio.`,
    });
  }

  // 3) CTA (verbo all'imperativo nelle ultime 2 frasi)
  const lastSentences = sentences.slice(-2).join(" ").toLowerCase();
  const hasCta = CTA_VERBS.some((v) => new RegExp(`\\b${v}\\b`, "i").test(lastSentences));
  if (!hasCta) {
    hints.push({
      key: "no-cta",
      severity: "warning",
      label: "Nessuna call-to-action rilevata",
      detail:
        'Suggerisci cosa fare dopo (es. "prenota", "scopri", "chiamaci", "passa in bar"). Senza CTA il lettore legge e passa oltre.',
    });
  } else {
    hints.push({
      key: "has-cta",
      severity: "good",
      label: "Call-to-action presente",
      detail: "C'e' un verbo all'imperativo che indica cosa fare dopo.",
    });
  }

  // 4) Numeri concreti (prezzo/data/orario/percentuale)
  const concreteNumbers =
    CONCRETE_NUMBER_RE.test(trimmed) || DATE_RE.test(trimmed) || TIME_RE.test(trimmed);
  if (!concreteNumbers) {
    hints.push({
      key: "no-concrete-numbers",
      severity: "info",
      label: "Nessun dato concreto",
      detail:
        "Prezzi, date, orari, percentuali rendono il messaggio piu credibile. Se stai annunciando una promo o un servizio, un numero aiuta.",
    });
  } else {
    hints.push({
      key: "has-concrete-numbers",
      severity: "good",
      label: "Dati concreti presenti",
      detail: "Prezzo, data, orario o percentuale rilevati: aumentano credibilita e intenzione.",
    });
  }

  // 5) Densita parole chiave (ripetizione eccessiva)
  const wordCounts = new Map<string, number>();
  for (const w of words) {
    if (STOP_WORDS.has(w) || w.length < 4) continue;
    wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
  }
  const topRepeated = Array.from(wordCounts.entries())
    .filter(([, n]) => n >= 4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (topRepeated.length > 0) {
    hints.push({
      key: "high-density",
      severity: "warning",
      label: "Parole chiave ripetute",
      detail: topRepeated
        .map(([w, n]) => `"${w}" ×${n}`)
        .concat("— considera di variare o diluire.")
        .join(" "),
    });
  }

  // 6) Frasi troppo lunghe
  const longSentences = sentences.filter((s) => tokenizeWords(s).length > 25).length;
  if (longSentences > 0 && sentences.length > 2) {
    hints.push({
      key: "long-sentences",
      severity: "info",
      label: `${longSentences} frase/i oltre 25 parole`,
      detail:
        "Spezza in due. Frasi corte si leggono anche di fretta, su mobile. 15-20 parole e' il range dolce.",
    });
  }

  return hints;
}

export function countBySeverity(hints: SeoHint[]): Record<SeoHintSeverity, number> {
  const counts: Record<SeoHintSeverity, number> = { good: 0, info: 0, warning: 0 };
  for (const h of hints) counts[h.severity]++;
  return counts;
}
