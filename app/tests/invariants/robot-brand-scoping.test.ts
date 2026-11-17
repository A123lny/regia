// RN-robot T11: verifica brand-scoping dei tool di lettura/scrittura.
// Design §15: il robottino opera solo sul brand attualmente selezionato.
// Tool senza brandId in pageContext devono rifiutare con messaggio chiaro.

import { describe, expect, it } from "vitest";
import { listContactsTool } from "../../src/modules/m14-robot-assistant/internal/tools/list-contacts";
import { searchContactsTool } from "../../src/modules/m14-robot-assistant/internal/tools/search-contacts";
import { createContactTool } from "../../src/modules/m14-robot-assistant/internal/tools/create-contact";
import type { Session } from "../../src/lib/auth/session";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

const SESSION: Session = {
  userId: "00000000-0000-0000-0000-000000000099",
  role: "owner",
  organizationId: ORG_ID,
  previousLoginAt: null,
};

describe("RN-robot T11 · brand-scoping tools", () => {
  it("listContacts rifiuta senza brandId in pageContext", async () => {
    const result = (await listContactsTool.execute(
      { limit: 10 },
      {
        session: SESSION,
        pageContext: { pagePath: "/contatti", pageTitle: "Contatti", brandId: null },
      },
    )) as { error?: string };
    expect(result.error).toBe("brand_non_selezionato");
  });

  it("searchContacts rifiuta senza brandId", async () => {
    const result = (await searchContactsTool.execute(
      { query: "mario" },
      {
        session: SESSION,
        pageContext: { pagePath: "/contatti", pageTitle: "Contatti", brandId: null },
      },
    )) as { error?: string };
    expect(result.error).toBe("brand_non_selezionato");
  });

  it("createContact rifiuta senza brandId", async () => {
    const result = (await createContactTool.execute(
      { firstName: "Test", email: "t@test.com" },
      {
        session: SESSION,
        pageContext: { pagePath: "/contatti", pageTitle: "Contatti", brandId: null },
      },
    )) as { error?: string };
    expect(result.error).toBe("brand_non_selezionato");
  });

  it("createContact rifiuta senza almeno un recapito", async () => {
    const result = (await createContactTool.execute(
      { firstName: "Test" },
      {
        session: SESSION,
        pageContext: {
          pagePath: "/contatti",
          pageTitle: "Contatti",
          brandId: "11111111-1111-1111-1111-111111111111",
        },
      },
    )) as { error?: string };
    expect(result.error).toBe("recapito_mancante");
  });
});
