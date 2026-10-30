// M02 Brand — tipi condivisi (RF-2.3, RF-2.3a, RF-2.4, RF-2.5).

export type SensitiveTopicKind = "claim_vietato" | "revisione_umana";

export type BrandKit = {
  brandId: string;
  toneOfVoice: string;
  strategicPurpose: string;
  strategicYearGoal: string;
  strategicDirection: string;
  toneExamples: ToneExample[];
  updatedAt: string;
};

// RN-70: esempio di post passato con nota su cosa piaceva.
// Fino a 10 esempi per brand. Alimentano il prompt M3 come few-shot per il tono.
export type ToneExample = {
  text: string;
  note: string;
};

export const MAX_TONE_EXAMPLES = 10;
export const TONE_EXAMPLE_TEXT_MAX = 500;
export const TONE_EXAMPLE_NOTE_MAX = 200;

export function isValidToneExamples(value: unknown): value is ToneExample[] {
  if (!Array.isArray(value)) return false;
  if (value.length > MAX_TONE_EXAMPLES) return false;
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const o = item as Record<string, unknown>;
    if (typeof o["text"] !== "string" || typeof o["note"] !== "string") return false;
    const text = o["text"].trim();
    if (text.length === 0 || text.length > TONE_EXAMPLE_TEXT_MAX) return false;
    if (o["note"].length > TONE_EXAMPLE_NOTE_MAX) return false;
  }
  return true;
}

export type BrandPillar = {
  id: string;
  brandId: string;
  name: string;
  weight: number;
  sortOrder: number;
  createdAt: string;
};

export type BrandForbiddenWord = {
  id: string;
  brandId: string;
  word: string;
  createdAt: string;
};

export type BrandSensitiveTopic = {
  id: string;
  brandId: string;
  topic: string;
  kind: SensitiveTopicKind;
  note: string;
  createdAt: string;
};

export type BrandKitWithLists = {
  kit: BrandKit;
  pillars: BrandPillar[];
  forbiddenWords: BrandForbiddenWord[];
  sensitiveTopics: BrandSensitiveTopic[];
};
