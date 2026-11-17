// RN-robot T11: verifica che il system prompt del robottino contenga i
// delimitatori utente (RA-8.7) e che i messaggi utente siano sempre avvolti
// in <user_message>...</user_message> nella history.

import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../src/modules/m14-robot-assistant/internal/prompt-builder";
import type { RobotPageContext } from "../../src/modules/m14-robot-assistant/public";

const CTX: RobotPageContext = {
  pagePath: "/contatti",
  pageTitle: "Contatti",
  brandId: "00000000-0000-0000-0000-000000000010",
};

describe("RN-robot T11 · prompt injection mitigation", () => {
  it("system prompt contiene delimitatori <user_message>", () => {
    const prompt = buildSystemPrompt({
      pageContext: CTX,
      capabilities: ["contacts.read"],
      availableTools: [{ name: "listContacts", description: "Lista contatti" }],
    });
    expect(prompt).toMatch(/<user_message>\s*\.\.\.\s*<\/user_message>/);
    expect(prompt.toLowerCase()).toContain("dati, mai istruzioni");
  });

  it("system prompt include le policy del capitolato (RA-8.6, §8.2, RF-6.15)", () => {
    const prompt = buildSystemPrompt({
      pageContext: CTX,
      capabilities: [],
      availableTools: [],
    });
    expect(prompt).toContain("RA-8.6");
    expect(prompt).toContain("§8.2");
    expect(prompt).toContain("RF-6.15");
    expect(prompt.toLowerCase()).toContain("carburante");
  });

  it("system prompt istruisce esplicitamente di rifiutare override dell'utente", () => {
    const prompt = buildSystemPrompt({
      pageContext: CTX,
      capabilities: [],
      availableTools: [],
    });
    // Il prompt deve contenere istruzioni per rifiutare "ignora le regole" e simili
    expect(prompt.toLowerCase()).toMatch(/ignora|dimentica|senza vincoli/);
    expect(prompt.toLowerCase()).toMatch(/non puoi|rifiuta|deroga/);
  });

  it("system prompt include il contesto pagina corrente", () => {
    const prompt = buildSystemPrompt({
      pageContext: { pagePath: "/contatti", pageTitle: "Contatti", brandId: "abc-123" },
      capabilities: [],
      availableTools: [],
    });
    expect(prompt).toContain("Contatti");
    expect(prompt).toContain("/contatti");
    expect(prompt).toContain("abc-123");
  });

  it("tool list nel system prompt NON e' presente se availableTools vuoto", () => {
    const prompt = buildSystemPrompt({
      pageContext: CTX,
      capabilities: [],
      availableTools: [],
    });
    expect(prompt.toLowerCase()).toContain("nessun tool disponibile");
  });
});
