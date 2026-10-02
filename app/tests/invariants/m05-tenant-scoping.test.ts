import { describe, it, expect } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import {
  getChannelCredentials,
  upsertChannelCredentials,
} from "@/modules/m05-publishing/internal/credentials-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M05 tenant scoping (RN-87)", () => {
  it("credentials org A non leggibili da org B", async () => {
    const orgA = "00000000-0000-0000-0000-000000000001";
    const orgB = "00000000-0000-0000-0000-000000000002";
    await admin.from("organizations").upsert({ id: orgB, name: "Test B" });
    await upsertChannelCredentials({
      organizationId: orgA,
      channel: "email",
      provider: "resend",
      apiKey: "re_test_A",
      config: { from: "a@x" },
    });
    const bView = await getChannelCredentials(orgB, "email");
    expect(bView).toBeNull();
  });
});
