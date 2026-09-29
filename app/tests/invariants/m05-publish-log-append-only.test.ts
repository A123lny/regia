import { describe, it, expect, beforeEach } from "vitest";
import { getAdminClient } from "@/lib/db/admin";

const admin = getAdminClient() as any;

describe("m05_publish_log append-only (RF-5.7)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  let jobId: string;
  let logId: string;

  beforeEach(async () => {
    // crea job + log con indirizzo univoco per dedupe_key
    const ts = Date.now();
    const recipient = `test-${ts}@x.it`;
    const { data: j, error: jobErr } = await admin.from("m05_publish_jobs").insert({
      organization_id: orgId, channel: "email", provider: "resend",
      recipient_address: recipient, source_kind: "test", source_id: null,
      payload: { channel: "email", to: recipient, subject: "test", html: "<p>test</p>", from: "sender@x.it" },
    }).select("id").single();
    if (jobErr || !j) throw new Error(`Failed to create job: ${jobErr?.message}`);
    jobId = j.id;

    const { data: l, error: logErr } = await admin.from("m05_publish_log").insert({
      organization_id: orgId, job_id: jobId, channel: "email", provider: "resend",
      recipient_address: recipient, content_snapshot: { subject: "test" }, status: "sent",
    }).select("id").single();
    if (logErr || !l) throw new Error(`Failed to create log: ${logErr?.message}`);
    logId = l.id;
  });

  it("blocca UPDATE su un log entry", async () => {
    const { error } = await admin.from("m05_publish_log")
      .update({ external_id: "modified" }).eq("id", logId);
    expect(error?.message).toMatch(/append-only/i);
  });

  it("blocca DELETE su un log entry", async () => {
    const { error } = await admin.from("m05_publish_log").delete().eq("id", logId);
    expect(error?.message).toMatch(/append-only/i);
  });
});
