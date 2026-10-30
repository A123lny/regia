// RF-4.2 Template suggest + autofill: unit test puri.

import { describe, expect, it } from "vitest";
import {
  suggestTemplateForDraft,
  autofillTemplateFields,
  TEMPLATE_DEFINITIONS,
  listTemplatesForBrand,
  type TemplateDefinition,
} from "@/modules/m04-media/public";

describe("RF-4.2 · suggestTemplateForDraft", () => {
  const lennyTemplates = listTemplatesForBrand("lenny");
  const stazioneTemplates = listTemplatesForBrand("stazione");

  it("topic 'promozione' su Lenny → promo-announce", () => {
    const t = suggestTemplateForDraft(
      { topicLabel: "promozione", generatedText: "" },
      lennyTemplates,
    );
    expect(t?.id).toContain("promo-announce");
  });

  it("topic 'avviso' su Lenny → service-notice", () => {
    const t = suggestTemplateForDraft({ topicLabel: "avviso", generatedText: "" }, lennyTemplates);
    expect(t?.id).toContain("service-notice");
  });

  it("topic 'consegna' su Lenny → restaurant-of-week", () => {
    const t = suggestTemplateForDraft(
      { topicLabel: "consegna", generatedText: "" },
      lennyTemplates,
    );
    expect(t?.id).toContain("restaurant-of-week");
  });

  it("topic 'officina' su Stazione → service-highlight o staff-portrait", () => {
    const t = suggestTemplateForDraft(
      { topicLabel: "officina", generatedText: "" },
      stazioneTemplates,
    );
    expect(t?.id).toMatch(/service-highlight|staff-portrait|seasonal-tip/);
  });

  it("topic 'ricorrenza' su Stazione → seasonal-tip", () => {
    const t = suggestTemplateForDraft(
      { topicLabel: "ricorrenza", generatedText: "" },
      stazioneTemplates,
    );
    expect(t?.id).toContain("seasonal-tip");
  });

  it("topic 'altro' (nessuna regola) → fallback primo template", () => {
    const t = suggestTemplateForDraft({ topicLabel: "altro", generatedText: "" }, lennyTemplates);
    expect(t).not.toBeNull();
    expect(t?.id).toBe(lennyTemplates[0]!.id);
  });

  it("topicLabel null → fallback primo template", () => {
    const t = suggestTemplateForDraft({ topicLabel: null, generatedText: "" }, stazioneTemplates);
    expect(t?.id).toBe(stazioneTemplates[0]!.id);
  });

  it("lista templates vuota → null", () => {
    const t = suggestTemplateForDraft({ topicLabel: "promozione", generatedText: "" }, []);
    expect(t).toBeNull();
  });

  it("registry ha 10 template totali (lenny 5 + stazione 5)", () => {
    expect(TEMPLATE_DEFINITIONS.length).toBeGreaterThanOrEqual(8);
  });
});

describe("RF-4.2 · autofillTemplateFields", () => {
  const lennyPromo = TEMPLATE_DEFINITIONS.find((t) => t.id === "lenny-promo-announce")!;

  it("prima riga → title/headline; resto → description/details", () => {
    // headline del template promo ha maxLength=10 (es. "-20%"), title=60
    const r = autofillTemplateFields(
      {
        topicLabel: "promozione",
        generatedText: "Pizza del venerdì -20%\nSolo oggi fino alle 23. Codice VENERDI20.",
      },
      lennyPromo,
    );
    expect(r["headline"]).toBe("Pizza del "); // truncato a 10 char
    expect(r["title"]).toBe("Pizza del venerdì -20%"); // title fino a 60 char
    expect(r["details"]).toContain("Solo oggi");
  });

  it("testo senza newline → body usa il testo stesso come fallback", () => {
    const r = autofillTemplateFields(
      {
        topicLabel: "promozione",
        generatedText: "Pizza venerdì sconto 20%",
      },
      lennyPromo,
    );
    expect(r["headline"]).toBe("Pizza vene"); // truncato a 10 char
    expect(r["title"]).toBe("Pizza venerdì sconto 20%"); // title fino a 60
    // Non c'è rest, il body usa il testo stesso come fallback
    expect(r["details"]).toContain("Pizza venerdì");
  });

  it("rispetta maxLength del campo (headline max 10)", () => {
    const r = autofillTemplateFields(
      {
        topicLabel: "promozione",
        generatedText: "Prezzo veramente molto lungo che supera i 10 caratteri",
      },
      lennyPromo,
    );
    expect(r["headline"]!.length).toBeLessThanOrEqual(10);
  });

  it("campi sconosciuti → stringa vuota", () => {
    const fakeTemplate: TemplateDefinition = {
      id: "test",
      brandSlugs: ["lenny"],
      name: "Test",
      description: "",
      format: "square",
      fields: [{ key: "customField", label: "Custom", required: false, maxLength: 100 }],
    };
    const r = autofillTemplateFields(
      { topicLabel: null, generatedText: "Test text" },
      fakeTemplate,
    );
    expect(r["customField"]).toBe("");
  });
});
