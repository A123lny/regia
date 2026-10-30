// RN-76 Orari apertura — tipi e helper (single source of truth, M2 brand).

export type Weekday =
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Lunedì",
  tuesday: "Martedì",
  wednesday: "Mercoledì",
  thursday: "Giovedì",
  friday: "Venerdì",
  saturday: "Sabato",
  sunday: "Domenica",
};

export type OpeningSlot = {
  /** Formato HH:mm 24h, es. "07:30" */
  open: string;
  /** Formato HH:mm 24h, es. "19:30" */
  close: string;
};

/**
 * RN-76: orari settimanali del brand. Giorno chiuso = array vuoto.
 * Supporta fasce multiple (es. ristorante pranzo + cena).
 */
export type OpeningHours = Record<Weekday, OpeningSlot[]>;

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validazione shape: ogni giorno array di slot con HH:mm valido e close > open. */
export function isValidOpeningHours(value: unknown): value is OpeningHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  for (const day of WEEKDAYS) {
    const slots = obj[day];
    if (!Array.isArray(slots)) return false;
    for (const slot of slots) {
      if (!slot || typeof slot !== "object") return false;
      const s = slot as Record<string, unknown>;
      if (typeof s["open"] !== "string" || typeof s["close"] !== "string") return false;
      if (!HHMM_RE.test(s["open"]) || !HHMM_RE.test(s["close"])) return false;
      if (s["close"] <= s["open"]) return false; // close deve essere > open (string compare funziona su HH:mm)
    }
  }
  return true;
}

/** Costruisce una struttura vuota (tutti giorni chiusi). */
export function emptyOpeningHours(): OpeningHours {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

/**
 * RN-76/77 Verifica se il brand è aperto al momento dato.
 * - Se hours è null → ritorna true (brand senza orari = sempre "aperto",
 *   es. piattaforma digitale Lenny food).
 * - Timezone: usa l'ora locale del server (Europe/Rome in produzione).
 */
export function isBrandOpenAt(hours: OpeningHours | null, when: Date = new Date()): boolean {
  if (hours === null) return true;
  // Date.getDay(): 0=domenica, 1=lunedì, ..., 6=sabato
  const jsDay = when.getDay();
  const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
  const weekday = WEEKDAYS[dayIndex]!;
  const slots = hours[weekday];
  if (slots.length === 0) return false;
  const hh = when.getHours().toString().padStart(2, "0");
  const mm = when.getMinutes().toString().padStart(2, "0");
  const now = `${hh}:${mm}`;
  return slots.some((slot) => now >= slot.open && now < slot.close);
}

/**
 * Rende la struttura leggibile (es. "Lun 07:30-19:30, Mar 07:30-19:30, Dom chiuso").
 * Utile per UI di sola lettura e per inserimento nel prompt AI (M3).
 */
export function formatOpeningHoursSummary(hours: OpeningHours | null): string {
  if (hours === null) return "Orari non configurati";
  const parts: string[] = [];
  for (const day of WEEKDAYS) {
    const label = WEEKDAY_LABELS[day].slice(0, 3);
    const slots = hours[day];
    if (slots.length === 0) {
      parts.push(`${label} chiuso`);
    } else {
      const text = slots.map((s) => `${s.open}-${s.close}`).join(" / ");
      parts.push(`${label} ${text}`);
    }
  }
  return parts.join(", ");
}
