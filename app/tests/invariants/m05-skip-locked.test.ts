import { describe, it, expect } from "vitest";
import { enqueueJob, claimBatch } from "@/modules/m05-publishing/internal/publish-jobs-repo";
import { randomUUID } from "node:crypto";

describe("M05 SKIP LOCKED (RS-4)", () => {
  it("due claimBatch concorrenti non doppio-claim lo stesso job", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    for (let i = 0; i < 3; i++) {
      const sourceId = randomUUID();
      await enqueueJob({
        organizationId: orgId,
        channel: "email",
        provider: "resend",
        recipientContactId: null,
        recipientAddress: `skl${i}@x.it`,
        sourceKind: "test",
        sourceId,
        payload: { channel: "email", to: `skl${i}@x.it`, subject: "s", html: "h", from: "a@x" },
        isPromotional: false,
        costEstimateCents: 4,
      });
    }
    const [r1, r2] = await Promise.all([claimBatch(10), claimBatch(10)]);
    const ids1 = new Set(r1.jobs.map((j) => j.id));
    const ids2 = new Set(r2.jobs.map((j) => j.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
    // Nessuna sovrapposizione tra i due batch è la proprietà essenziale di SKIP LOCKED.
    // Il numero totale può variare in base ai job accodati da altri test nella suite.
    // Quello che garantiamo: nessun job viene claimato due volte.
  });
});
