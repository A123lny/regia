// RN-85 (assorbito in M9, richiamo RF-10.4).
// Marcatura automatica dei link in uscita dai contenuti generati.
// Convenzione Google Analytics: utm_source, utm_medium, utm_campaign, utm_content.
//
// Uso: al momento della pubblicazione (M14 futuro) o della preview umana, si
// applica applyUtmToLinks(text, params) che aggiunge i query param a ogni URL
// http(s) nel testo, preservando i param esistenti (non sovrascrive se già
// presenti — l'utente può voler forzare un utm specifico manualmente).

export type UtmParams = {
  utm_source: string; // canale (es. "instagram", "facebook", "email")
  utm_medium: string; // tipo (es. "social", "email", "cpc")
  utm_campaign: string; // di solito brand-slug (es. "lenny-restaurant")
  utm_content?: string; // di solito draft-id per attribuzione fine
  utm_term?: string; // parola chiave opzionale
};

// Regex per URL http(s) — semplice ma robusta per casi comuni di testo AI.
// Match: schema + host + path/query/fragment.
// Non matcha URL relativi (li lasciamo intatti — non sono link tracciabili in social).
// Fine URL: whitespace, virgole, punti finali, parentesi di chiusura.
const URL_REGEX = /https?:\/\/[^\s<>"'()\[\]{}]+/g;

/**
 * Applica UTM params a un singolo URL. Preserva query esistente.
 * Se un utm_* è già presente nell'URL, NON viene sovrascritto (rispetta override manuale).
 * Preserva fragment (#anchor).
 */
export function tagUrl(url: string, params: UtmParams): string {
  // Rimuovi trailing punctuation comune in copy italiana (. , ; : ! ?)
  // Non rimuoviamo parentesi che non sono già escluse dal regex — URL può contenerle valide.
  const trailingPunctMatch = url.match(/[.,;:!?]+$/);
  const trailingPunct = trailingPunctMatch ? trailingPunctMatch[0] : "";
  const cleanUrl = trailingPunct ? url.slice(0, -trailingPunct.length) : url;

  let base: string;
  let search: string;
  let hash: string;
  try {
    const u = new URL(cleanUrl);
    base = `${u.protocol}//${u.host}${u.pathname}`;
    search = u.search; // include leading '?'
    hash = u.hash; // include leading '#'
  } catch {
    // URL malformato: ritorna intatto (safety).
    return url;
  }

  const existing = new URLSearchParams(search);
  const toAdd: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (existing.has(k)) continue; // rispetta override esistente
    toAdd.push([k, String(v)]);
  }
  for (const [k, v] of toAdd) existing.set(k, v);

  const finalSearch = existing.toString();
  const rebuilt = finalSearch ? `${base}?${finalSearch}${hash}` : `${base}${hash}`;
  return rebuilt + trailingPunct;
}

/**
 * Sostituisce ogni URL http(s) nel testo con la sua versione UTM-tagged.
 * Deterministico: stessi input → stesso output.
 */
export function applyUtmToLinks(text: string, params: UtmParams): string {
  return text.replace(URL_REGEX, (match) => tagUrl(match, params));
}

/**
 * Estrae la lista di URL http(s) presenti nel testo (per anteprima UI).
 * Ordine di apparizione, con eventuali duplicati preservati.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? [...matches] : [];
}

/**
 * Compone params standard per un draft social. Convenzione piattaforma:
 * - utm_source: slug piattaforma (es. instagram, facebook, email)
 * - utm_medium: "social" per social post, "email" per newsletter (in M5 futuro)
 * - utm_campaign: brand slug (identifica brand)
 * - utm_content: draft id (attribuzione fine)
 */
export function composeUtmForDraft(input: {
  platformSource: string;
  medium: "social" | "email" | "sms";
  brandSlug: string;
  draftId: string;
}): UtmParams {
  return {
    utm_source: input.platformSource,
    utm_medium: input.medium,
    utm_campaign: input.brandSlug,
    utm_content: input.draftId,
  };
}
