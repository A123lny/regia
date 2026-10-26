// RF-8.2/8.3/8.4 Classifier deterministico - tabella casi.
// Nessuna connessione DB.

import { describe, expect, it } from "vitest";
import { classifyReview } from "@/modules/m08-reviews/public";

describe("RF-8.2/8.3/8.4 · M08 classifier euristico", () => {
  it("rating 5 testo neutro → positive", () => {
    const r = classifyReview(5, "Tutto perfetto, torneremo");
    expect(r.classification).toBe("positive");
    expect(r.reason).toBe("rating:5");
  });

  it("rating 4 testo neutro → positive", () => {
    expect(classifyReview(4, "Buona esperienza").classification).toBe("positive");
  });

  it("rating 3 testo neutro → negative (soglia prudente)", () => {
    const r = classifyReview(3, "Nella media");
    expect(r.classification).toBe("negative");
    expect(r.reason).toBe("rating:3");
  });

  it("rating 1 testo neutro → negative", () => {
    expect(classifyReview(1, "Male").classification).toBe("negative");
  });

  it("rating 5 ma testo 'allergia' → serious (keyword sovrascrive)", () => {
    const r = classifyReview(5, "Ho avuto un'allergia dopo cena");
    expect(r.classification).toBe("serious");
    expect(r.reason).toBe("keyword:allergia");
  });

  it("rating 1 e testo 'avvocato' → serious (keyword prevale)", () => {
    const r = classifyReview(1, "Ho chiamato il mio avvocato");
    expect(r.classification).toBe("serious");
    expect(r.reason).toBe("keyword:avvocato");
  });

  it("case-insensitive: 'ALLERGIA' matcha", () => {
    expect(classifyReview(5, "ALLERGIA grave").classification).toBe("serious");
  });

  it("testo null → gestito senza throw (positive da rating)", () => {
    expect(classifyReview(5, null).classification).toBe("positive");
  });

  it("testo vuoto → gestito senza throw", () => {
    expect(classifyReview(2, "").classification).toBe("negative");
  });

  it("keyword 'intossic' matcha 'intossicazione' (prefisso)", () => {
    expect(classifyReview(5, "intossicazione alimentare").classification).toBe("serious");
  });

  it("keyword 'carabinier' matcha 'carabinieri' (prefisso)", () => {
    expect(classifyReview(5, "chiamati i carabinieri").classification).toBe("serious");
  });
});
