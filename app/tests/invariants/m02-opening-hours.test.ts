// RN-76 Orari apertura centralizzati: validatore + helper isBrandOpenAt.
// Unit test puri (no DB).

import { describe, expect, it } from "vitest";
import {
  isValidOpeningHours,
  emptyOpeningHours,
  isBrandOpenAt,
  formatOpeningHoursSummary,
  type OpeningHours,
} from "@/modules/m02-brand/public";

describe("RN-76 · validatore orari apertura", () => {
  it("accetta struttura con tutti i giorni e slot valide", () => {
    const h: OpeningHours = {
      monday: [{ open: "07:30", close: "19:30" }],
      tuesday: [{ open: "07:30", close: "19:30" }],
      wednesday: [{ open: "07:30", close: "19:30" }],
      thursday: [{ open: "07:30", close: "19:30" }],
      friday: [{ open: "07:30", close: "19:30" }],
      saturday: [{ open: "07:30", close: "19:30" }],
      sunday: [],
    };
    expect(isValidOpeningHours(h)).toBe(true);
  });

  it("accetta fasce multiple nello stesso giorno (es. ristorante pranzo+cena)", () => {
    const h = emptyOpeningHours();
    h.monday = [
      { open: "11:00", close: "14:00" },
      { open: "18:00", close: "23:00" },
    ];
    expect(isValidOpeningHours(h)).toBe(true);
  });

  it("rifiuta slot con close <= open", () => {
    const h = emptyOpeningHours();
    h.monday = [{ open: "19:30", close: "07:30" }];
    expect(isValidOpeningHours(h)).toBe(false);
  });

  it("rifiuta orari in formato non HH:mm", () => {
    const h = emptyOpeningHours() as unknown as Record<string, unknown>;
    h["monday"] = [{ open: "7:30", close: "19:30" }]; // mancante zero padding
    expect(isValidOpeningHours(h)).toBe(false);
  });

  it("rifiuta struttura con giorno mancante", () => {
    const h = emptyOpeningHours() as unknown as Record<string, unknown>;
    delete h["sunday"];
    expect(isValidOpeningHours(h)).toBe(false);
  });

  it("rifiuta null, array, string", () => {
    expect(isValidOpeningHours(null)).toBe(false);
    expect(isValidOpeningHours([])).toBe(false);
    expect(isValidOpeningHours("08-18")).toBe(false);
  });
});

describe("RN-76/77 · isBrandOpenAt helper", () => {
  const continuous: OpeningHours = {
    monday: [{ open: "07:30", close: "19:30" }],
    tuesday: [{ open: "07:30", close: "19:30" }],
    wednesday: [{ open: "07:30", close: "19:30" }],
    thursday: [{ open: "07:30", close: "19:30" }],
    friday: [{ open: "07:30", close: "19:30" }],
    saturday: [{ open: "07:30", close: "19:30" }],
    sunday: [],
  };

  // Nota: Date.getDay() usa timezone server. In test uso new Date(iso) senza TZ
  // → interpretato come locale. Scelgo date con offset che non attraversi mezzanotte.
  it("martedì h 10:00 (dentro fascia) → aperto", () => {
    // 2026-10-27 è martedì
    const d = new Date("2026-10-27T10:00:00");
    expect(isBrandOpenAt(continuous, d)).toBe(true);
  });

  it("martedì h 20:00 (fuori fascia) → chiuso", () => {
    const d = new Date("2026-10-27T20:00:00");
    expect(isBrandOpenAt(continuous, d)).toBe(false);
  });

  it("domenica (giorno chiuso) → chiuso", () => {
    // 2026-10-25 è domenica
    const d = new Date("2026-10-25T10:00:00");
    expect(isBrandOpenAt(continuous, d)).toBe(false);
  });

  it("brand senza orari (null) → sempre aperto (piattaforma digitale)", () => {
    const d = new Date("2026-10-25T03:00:00");
    expect(isBrandOpenAt(null, d)).toBe(true);
  });

  it("ristorante: aperto 12:00 pranzo, chiuso 16:00 (pausa), aperto 19:00 cena", () => {
    const h = emptyOpeningHours();
    h.monday = [
      { open: "11:00", close: "14:00" },
      { open: "18:00", close: "23:00" },
    ];
    // 2026-10-26 è lunedì
    expect(isBrandOpenAt(h, new Date("2026-10-26T12:00:00"))).toBe(true);
    expect(isBrandOpenAt(h, new Date("2026-10-26T16:00:00"))).toBe(false);
    expect(isBrandOpenAt(h, new Date("2026-10-26T19:00:00"))).toBe(true);
  });

  it("edge: ora di apertura esatta → aperto; ora di chiusura esatta → chiuso", () => {
    const d = new Date("2026-10-27T07:30:00");
    expect(isBrandOpenAt(continuous, d)).toBe(true);
    const c = new Date("2026-10-27T19:30:00");
    expect(isBrandOpenAt(continuous, c)).toBe(false);
  });
});

describe("RN-76 · formatOpeningHoursSummary", () => {
  it("rende struttura leggibile per riga", () => {
    const h = emptyOpeningHours();
    h.monday = [{ open: "07:30", close: "19:30" }];
    const text = formatOpeningHoursSummary(h);
    expect(text).toContain("Lun 07:30-19:30");
    expect(text).toContain("Dom chiuso");
  });

  it("null → placeholder", () => {
    expect(formatOpeningHoursSummary(null)).toBe("Orari non configurati");
  });
});
