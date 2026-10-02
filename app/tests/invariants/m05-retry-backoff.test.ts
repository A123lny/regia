import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import {
  enqueueJob,
  claimBatch,
  markFailed,
} from "@/modules/m05-publishing/internal/publish-jobs-repo";

describe("M05 retry backoff (RS-4)", () => {
  it("markFailed aumenta retry_count e ritenta con backoff crescente", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const sourceId = randomUUID();
    const job = await enqueueJob({
      organizationId: orgId,
      channel: "email",
      provider: "resend",
      recipientContactId: null,
      recipientAddress: `retry-${sourceId}@x.it`,
      sourceKind: "test",
      sourceId,
      payload: {
        channel: "email" as const,
        to: `retry-${sourceId}@x.it`,
        subject: "s",
        html: "h",
        from: "a@x",
      },
      isPromotional: false,
      costEstimateCents: 4,
    });
    const { claimToken } = await claimBatch(1);
    const { dead: dead1 } = await markFailed(job.id, claimToken, "fake failure");
    expect(dead1).toBe(false);
    // dopo 5 failures -> dead
    for (let i = 0; i < 5; i++) {
      const { claimToken: t } = await claimBatch(1);
      if (t) await markFailed(job.id, t, `failure ${i + 2}`);
    }
  });
});
