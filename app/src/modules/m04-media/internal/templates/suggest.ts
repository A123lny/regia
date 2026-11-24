// RF-4.2 Template suggestion + autofill da draft.
// Puro, deterministico, nessun AI: mappa topic → template id tramite needle match
// sui 10 template registry esistenti (lenny-*, stazione-*). Autofill prende la
// prima riga del testo come title/headline e il resto come details/description.

import type { TemplateDefinition } from "./template-types";

type DraftLike = {
  topicLabel: string | null;
  generatedText: string;
};

// Mapping topic → template priorità (dal più coerente al fallback).
// Note:
// - "restaurant-of-week" è una card "ristorante in evidenza" con nome specifico.
//   Non è l'ovvia prima scelta per un post "consegne a pranzo". Prima era
//   l'unica opzione sotto "consegna" e portava a casi tipo: post su "pranzo
//   a domicilio" veniva autofillato nel campo "Nome ristorante".
// - "promo-announce" e "service-highlight" sono più generici e corretti
//   quando il post parla di un servizio/offerta, non di un singolo ristorante.
const TOPIC_TO_TEMPLATE_NEEDLES: Record<string, string[]> = {
  promozione: ["promo-announce", "service-highlight", "locandina"],
  avviso: ["service-notice"],
  officina: ["service-highlight", "staff-portrait", "seasonal-tip"],
  bar: ["service-highlight", "seasonal-tip"],
  consegna: ["service-highlight", "promo-announce"],
  ricorrenza: ["seasonal-tip", "service-highlight"],
};

// Needles che riconoscono un post "ristorante in evidenza" (nome proprio
// + ristorante): solo in questo caso restaurant-of-week è davvero il
// template giusto.
const RESTAURANT_HIGHLIGHT_PATTERNS = [
  /\b(ristorante|trattoria|pizzeria|osteria)\b\s+["«]?[A-Z]/,
  /scopri[a-z]*\s+(il|la)\s+(ristorante|trattoria|pizzeria)/i,
  /ristorante\s+della\s+settimana/i,
];

function looksLikeRestaurantHighlight(text: string): boolean {
  return RESTAURANT_HIGHLIGHT_PATTERNS.some((re) => re.test(text));
}

/**
 * Suggerisce il template più coerente con il topic del draft.
 * Fallback: primo template disponibile per il brand.
 * Null se la lista è vuota.
 */
export function suggestTemplateForDraft(
  draft: DraftLike,
  availableTemplates: TemplateDefinition[],
): TemplateDefinition | null {
  if (availableTemplates.length === 0) return null;
  const topic = (draft.topicLabel ?? "").toLowerCase();
  const text = draft.generatedText ?? "";

  // Bypass: se il topic è consegna MA il testo non riguarda un ristorante
  // specifico, evita restaurant-of-week.
  const needles = [...(TOPIC_TO_TEMPLATE_NEEDLES[topic] ?? [])];
  if (topic === "consegna" && looksLikeRestaurantHighlight(text)) {
    needles.unshift("restaurant-of-week");
  }

  for (const needle of needles) {
    const match = availableTemplates.find((t) => t.id.includes(needle));
    if (match) return match;
  }
  // Fallback: preferisci un template "generico" (promo/service-highlight)
  // all'eventuale restaurant-of-week che richiede un nome ristorante.
  const generic = availableTemplates.find(
    (t) => t.id.includes("promo-announce") || t.id.includes("service-highlight"),
  );
  return generic ?? availableTemplates[0] ?? null;
}

/** Taglia una stringa al limite max senza spezzare a metà parola. */
function truncateAtWord(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const slice = s.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  // Taglia all'ultimo spazio; se lo spazio è troppo vicino all'inizio (perde
  // troppo), accetta un taglio hard.
  return (lastSpace > maxLen * 0.5 ? slice.slice(0, lastSpace) : slice).trimEnd();
}

/**
 * Pre-compila i campi di un template usando il testo del draft.
 * - "name" → è un NOME PROPRIO (ristorante, persona, luogo). Non riempire
 *   con il titolo del post: resta vuoto, l'utente lo scrive. Questo evita
 *   il caso "il post diventa il nome ristorante".
 * - title/headline/tip/role → prima frase (fino al primo punto), max 80 char.
 * - service → primo segmento breve del titolo, max 40 char.
 * - description/details/body/subtitle/quote/kicker → testo lungo, troncato
 *   senza spezzare parole.
 */
export function autofillTemplateFields(
  draft: DraftLike,
  template: TemplateDefinition,
): Record<string, string> {
  const text = (draft.generatedText || "").replace(/\s+/g, " ").trim();
  const firstSentenceEnd = text.search(/[.!?]\s/);
  const firstSentence =
    firstSentenceEnd > 0 ? text.slice(0, firstSentenceEnd + 1).trim() : text;

  const SHORT_TITLE_KEYS = new Set(["title", "headline", "tip", "role"]);
  const VERY_SHORT_KEYS = new Set(["service"]);
  const BODY_KEYS = new Set(["description", "details", "body", "subtitle", "quote", "kicker"]);
  // Campi "nome proprio" che NON vanno autofillati dal testo generato:
  // il post non è un nome.
  const NAME_KEYS = new Set(["name", "restaurant", "person"]);

  const result: Record<string, string> = {};
  for (const f of template.fields) {
    const max = f.maxLength ?? 200;
    if (NAME_KEYS.has(f.key)) {
      // Lasciato vuoto: UI mostrerà il campo evidenziando che è da compilare.
      result[f.key] = "";
    } else if (SHORT_TITLE_KEYS.has(f.key)) {
      result[f.key] = truncateAtWord(firstSentence, Math.min(max, 80));
    } else if (VERY_SHORT_KEYS.has(f.key)) {
      result[f.key] = truncateAtWord(firstSentence, Math.min(max, 40));
    } else if (BODY_KEYS.has(f.key)) {
      result[f.key] = truncateAtWord(text, max);
    } else {
      result[f.key] = "";
    }
  }
  return result;
}
