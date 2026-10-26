// RA-8.6 Guard post-generazione: controlla che il modello non abbia violato
// vincoli brand-specifici. Se fallisce, la bozza viene rigettata.

import type { BrandContext } from "./prompt-builder";

export type DraftValidation = { ok: true } | { ok: false; reason: string };

const LENNY_BLAME_PATTERN = /ristorante[^.]{0,80}(colpa|problemi?|errori?|sbaglio|disservizi)/i;

export function validateDraft(draft: string, brand: BrandContext): DraftValidation {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty draft" };
  if (trimmed.length > 500) return { ok: false, reason: `length ${trimmed.length} > 500` };

  if (brand.slug === "lenny" && LENNY_BLAME_PATTERN.test(trimmed)) {
    return { ok: false, reason: "RF-8.7: draft scarica colpa su ristorante partner" };
  }

  return { ok: true };
}
