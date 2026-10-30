// RF-4.2 Template suggestion + autofill da draft.
// Puro, deterministico, nessun AI: mappa topic → template id tramite needle match
// sui 10 template registry esistenti (lenny-*, stazione-*). Autofill prende la
// prima riga del testo come title/headline e il resto come details/description.

import type { TemplateDefinition } from "./template-types";

type DraftLike = {
  topicLabel: string | null;
  generatedText: string;
};

const TOPIC_TO_TEMPLATE_NEEDLES: Record<string, string[]> = {
  promozione: ["promo-announce", "service-highlight", "locandina"],
  avviso: ["service-notice"],
  officina: ["service-highlight", "staff-portrait", "seasonal-tip"],
  bar: ["service-highlight", "seasonal-tip"],
  consegna: ["restaurant-of-week", "rider-recruitment", "promo-announce"],
  ricorrenza: ["seasonal-tip", "service-highlight"],
};

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
  const needles = TOPIC_TO_TEMPLATE_NEEDLES[topic] ?? [];
  for (const needle of needles) {
    const match = availableTemplates.find((t) => t.id.includes(needle));
    if (match) return match;
  }
  return availableTemplates[0] ?? null;
}

/**
 * Pre-compila i campi di un template usando il testo del draft.
 * Prima riga → title/headline/service/name (campi "titolo").
 * Resto → description/details/body/subtitle/quote (campi "contenuto").
 * Campi sconosciuti → stringa vuota.
 */
export function autofillTemplateFields(
  draft: DraftLike,
  template: TemplateDefinition,
): Record<string, string> {
  const text = draft.generatedText.trim();
  const firstLineEnd = text.indexOf("\n");
  const firstLine = (firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)).trim();
  const rest = (firstLineEnd === -1 ? "" : text.slice(firstLineEnd + 1)).trim();

  const TITLE_KEYS = new Set(["title", "headline", "service", "name", "tip", "role"]);
  const BODY_KEYS = new Set(["description", "details", "body", "subtitle", "quote", "kicker"]);

  const result: Record<string, string> = {};
  for (const f of template.fields) {
    const max = f.maxLength ?? 200;
    if (TITLE_KEYS.has(f.key)) {
      result[f.key] = firstLine.slice(0, max);
    } else if (BODY_KEYS.has(f.key)) {
      // Preferisci il rest; se vuoto, usa primo brano del testo.
      const content = rest || text;
      result[f.key] = content.slice(0, max);
    } else {
      result[f.key] = "";
    }
  }
  return result;
}
