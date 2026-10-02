import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { enqueueJob } from "@/modules/m05-publishing/internal/publish-jobs-repo";
import { DuplicateJobError } from "@/modules/m05-publishing/public";

describe("M05 idempotenza invii (RF-5.5)", () => {
  it("stesso source+recipient non enqueuato due volte", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    // sourceId random per evitare test pollution tra run consecutive
    const sourceId = randomUUID();
    const payload = {
      channel: "email" as const,
      to: "dup@x.it",
      subject: "s",
      html: "h",
      from: "a@x",
    };
    await enqueueJob({
      organizationId: orgId,
      channel: "email",
      provider: "resend",
      recipientContactId: null,
      recipientAddress: "dup@x.it",
      sourceKind: "test",
      sourceId,
      payload,
      isPromotional: false,
      costEstimateCents: 10,
    });
    await expect(
      enqueueJob({
        organizationId: orgId,
        channel: "email",
        provider: "resend",
        recipientContactId: null,
        recipientAddress: "dup@x.it",
        sourceKind: "test",
        sourceId,
        payload,
        isPromotional: false,
        costEstimateCents: 10,
      }),
    ).rejects.toThrow(DuplicateJobError);
  });
});
