// M05 - log immutabile invii (RF-5.7).
import { getAdminClient } from "@/lib/db/admin";
import type { Job } from "./publish-jobs-repo";

export async function logSent(
  job: Job,
  externalId: string,
  costActualCents: number | null,
  providerResponse: unknown,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_publish_log").insert({
    organization_id: job.organizationId,
    job_id: job.id,
    channel: job.channel,
    provider: job.provider,
    recipient_contact_id: job.recipientContactId,
    recipient_address: job.recipientAddress,
    content_snapshot: job.payload,
    external_id: externalId,
    cost_actual_cents: costActualCents,
    status: "sent",
    provider_response: providerResponse ?? null,
    is_promotional: job.isPromotional,
  });
  if (error) throw new Error(`logSent: ${error.message}`);
}

export async function logFailed(
  job: Job,
  errorMessage: string,
  providerResponse?: unknown,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_publish_log").insert({
    organization_id: job.organizationId,
    job_id: job.id,
    channel: job.channel,
    provider: job.provider,
    recipient_contact_id: job.recipientContactId,
    recipient_address: job.recipientAddress,
    content_snapshot: job.payload,
    external_id: null,
    cost_actual_cents: null,
    status: "failed",
    provider_response: providerResponse
      ? { error: errorMessage, response: providerResponse }
      : { error: errorMessage },
    is_promotional: job.isPromotional,
  });
  if (error) throw new Error(`logFailed: ${error.message}`);
}
