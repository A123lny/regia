// RF-8.2/8.3/8.4 Classifier euristico deterministico (zero AI, zero latenza).
// Soglia prudente: rating <= 3 = negative (3 stelle gia' borderline).
// Keyword 'grave' sovrascrive il rating a 'serious' (RF-8.4).

import type { ReviewClassification } from "./types";

export const GRAVE_KEYWORDS = [
  "allergia",
  "intossic",
  "avvelenam",
  "infortun",
  "denuncia",
  "avvocato",
  "carabinier",
  "polizia",
  "infezion",
  "veleno",
  "sangue",
] as const;

export function classifyReview(
  rating: number,
  text: string | null,
): { classification: ReviewClassification; reason: string } {
  const lower = (text ?? "").toLowerCase();
  const hit = GRAVE_KEYWORDS.find((k) => lower.includes(k));
  if (hit) return { classification: "serious", reason: `keyword:${hit}` };
  if (rating <= 3) return { classification: "negative", reason: `rating:${rating}` };
  return { classification: "positive", reason: `rating:${rating}` };
}
