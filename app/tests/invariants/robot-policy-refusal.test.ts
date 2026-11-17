// RN-robot T11: verifica che il system prompt dichiari TUTTE le policy del
// capitolato che il modello deve rispettare.
// NOTA: il comportamento reale di rifiuto dipende dal modello LLM (Gemini),
// non testabile senza invocare l'API. Qui testiamo che le policy siano
// PRESENTI nel system prompt, condizione necessaria perche' il modello le
// applichi. Test E2E con chiamata vera al modello sono in Playwright (T12).

import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../src/modules/m14-robot-assistant/internal/prompt-builder";
import type { RobotPageContext } from "../../src/modules/m14-robot-assistant/public";

const CTX: RobotPageContext = {
  pagePath: "/",
  pageTitle: "Cruscotto",
  brandId: null,
};

function buildFull() {
  return buildSystemPrompt({
    pageContext: CTX,
    capabilities: [],
    availableTools: [],
  });
}

describe("RN-robot T11 · policy refusal (prompt-level)", () => {
  it("system prompt dichiara §8.2 categorie mai autonome", () => {
    const prompt = buildFull();
    expect(prompt).toContain("§8.2");
    const lower = prompt.toLowerCase();
    expect(lower).toContain("promozion");
    expect(lower).toContain("recensioni");
    expect(lower).toContain("prezzi");
    expect(lower).toContain("advertising");
  });

  it("system prompt dichiara RF-6.15 (niente sconti carburante)", () => {
    const prompt = buildFull();
    expect(prompt).toContain("RF-6.15");
    expect(prompt.toLowerCase()).toContain("carburante");
  });

  it("system prompt dichiara RF-6.20 (niente promo rider/altri vincoli)", () => {
    const prompt = buildFull();
    // RF-6.15..6.20 citato come range
    expect(prompt).toMatch(/RF-6\.15.*6\.20|RF-6\.15.*RF-6\.20/);
  });

  it("system prompt dichiara RA-8.6 (il modello propone, il codice dispone)", () => {
    const prompt = buildFull();
    expect(prompt).toContain("RA-8.6");
  });

  it("system prompt dichiara RN-72 (dati concreti mai inventati)", () => {
    const prompt = buildFull();
    expect(prompt).toContain("RN-72");
    const lower = prompt.toLowerCase();
    expect(lower).toMatch(/non inventare|non lo so|dati concreti/);
  });

  it("system prompt prescrive stile italiano e confermare prima di distruttive", () => {
    const prompt = buildFull();
    expect(prompt.toLowerCase()).toContain("italiano");
    expect(prompt.toLowerCase()).toMatch(/confer|distruttiv/);
  });
});
