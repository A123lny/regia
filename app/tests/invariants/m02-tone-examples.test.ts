// RN-70 Tono da esempi reali: validator shape + persistenza + inclusione
// nel prompt formattato per AI.

import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  isValidToneExamples,
  MAX_TONE_EXAMPLES,
  TONE_EXAMPLE_TEXT_MAX,
  getBrandKitWithLists,
  formatBrandContextForAI,
} from "@/modules/m02-brand/public";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata.");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

describe("RN-70 · validatore shape tone_examples", () => {
  it("accetta array vuoto", () => {
    expect(isValidToneExamples([])).toBe(true);
  });

  it("accetta array con 1 esempio valido", () => {
    expect(isValidToneExamples([{ text: "Post di prova", note: "" }])).toBe(true);
  });

  it("accetta esempio con nota", () => {
    expect(isValidToneExamples([{ text: "Post", note: "tono diretto" }])).toBe(true);
  });

  it("rifiuta più di 10 esempi", () => {
    const arr = Array.from({ length: MAX_TONE_EXAMPLES + 1 }, (_, i) => ({
      text: `Post ${i}`,
      note: "",
    }));
    expect(isValidToneExamples(arr)).toBe(false);
  });

  it("rifiuta testo vuoto", () => {
    expect(isValidToneExamples([{ text: "", note: "" }])).toBe(false);
    expect(isValidToneExamples([{ text: "   ", note: "" }])).toBe(false);
  });

  it("rifiuta testo troppo lungo", () => {
    const long = "a".repeat(TONE_EXAMPLE_TEXT_MAX + 1);
    expect(isValidToneExamples([{ text: long, note: "" }])).toBe(false);
  });

  it("rifiuta non-array", () => {
    expect(isValidToneExamples(null)).toBe(false);
    expect(isValidToneExamples({})).toBe(false);
    expect(isValidToneExamples("post")).toBe(false);
  });

  it("rifiuta campi mancanti o tipi sbagliati", () => {
    expect(isValidToneExamples([{ text: "post" }])).toBe(false);
    expect(isValidToneExamples([{ text: 123, note: "" }])).toBe(false);
    expect(isValidToneExamples([{ text: "post", note: 123 }])).toBe(false);
  });
});

describe("RN-70 · persistenza + injection nel prompt", () => {
  it("scrittura tone_examples via UPDATE + rilettura via getBrandKitWithLists", async () => {
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    const brandId = (brand as { id: string }).id;

    const examples = [
      { text: "Oggi pizza napoletana che fa gola", note: "tono diretto, immagine sensoriale" },
      { text: "Il banco oggi profuma di fritto", note: "scena concreta" },
    ];
    // Snapshot stato attuale per ripristino
    const { data: before } = await admin
      .from("brand_kits")
      .select("tone_examples")
      .eq("brand_id", brandId)
      .maybeSingle();
    const originalExamples = ((before as { tone_examples: unknown }).tone_examples ??
      []) as unknown[];

    try {
      // UPDATE
      const { error } = await admin
        .from("brand_kits")
        .update({ tone_examples: examples })
        .eq("brand_id", brandId);
      expect(error).toBeNull();

      // Rilettura
      const kit = await getBrandKitWithLists(brandId);
      expect(kit).not.toBeNull();
      expect(kit!.kit.toneExamples).toHaveLength(2);
      expect(kit!.kit.toneExamples[0]!.text).toBe("Oggi pizza napoletana che fa gola");

      // Injection nel prompt formattato (RN-70 few-shot)
      const prompt = await formatBrandContextForAI(brandId);
      expect(prompt).toContain("Esempi di tono");
      expect(prompt).toContain("RN-70");
      expect(prompt).toContain("Oggi pizza napoletana che fa gola");
      expect(prompt).toContain("tono diretto");
    } finally {
      await admin
        .from("brand_kits")
        .update({ tone_examples: originalExamples })
        .eq("brand_id", brandId);
    }
  });

  it("CHECK DB rifiuta più di 10 esempi (constraint brand_kits_tone_examples_is_array)", async () => {
    const { data: brand } = await admin
      .from("brands")
      .select("id")
      .eq("organization_id", ORG_ID)
      .eq("slug", "lenny")
      .maybeSingle();
    const brandId = (brand as { id: string }).id;

    const tooMany = Array.from({ length: 11 }, (_, i) => ({ text: `Post ${i}`, note: "" }));
    const { error } = await admin
      .from("brand_kits")
      .update({ tone_examples: tooMany })
      .eq("brand_id", brandId);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("23514");
  });
});
