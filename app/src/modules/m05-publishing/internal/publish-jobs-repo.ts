// M05 - CRUD coda invii + claim/finalize per il worker.
import { getAdminClient } from "@/lib/db/admin";
import { DuplicateJobError } from "./types";
import type { Channel, OutgoingMessage } from "./types";
import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "claimed" | "sent" | "failed" | "dead";

export type EnqueueJobInput = {
  organizationId: string;
  channel: Channel;
  provider: string;
  recipientContactId: string | null;
  recipientAddress: string;
  sourceKind: "test" | "reminder" | "voucher" | "campaign" | "signup_welcome" | "manual";
  sourceId: string | null;
  payload: OutgoingMessage;
  isPromotional: boolean;
  costEstimateCents: number | null;
  sendAfter?: string;  // ISO datetime, default now()
};

export type Job = {
  id: string; organizationId: string; channel: Channel; provider: string;
  recipientContactId: string | null; recipientAddress: string;
  sourceKind: string; sourceId: string | null; payload: OutgoingMessage;
  status: JobStatus; retryCount: number; nextRetryAt: string; sendAfter: string;
  lastError: string | null; sentAt: string | null; externalId: string | null;
  costEstimateCents: number | null; isPromotional: boolean; createdAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJob(row: any): Job {
  return {
    id: row.id, organizationId: row.organization_id, channel: row.channel,
    provider: row.provider, recipientContactId: row.recipient_contact_id,
    recipientAddress: row.recipient_address, sourceKind: row.source_kind,
    sourceId: row.source_id, payload: row.payload,
    status: row.status, retryCount: row.retry_count, nextRetryAt: row.next_retry_at,
    sendAfter: row.send_after, lastError: row.last_error, sentAt: row.sent_at,
    externalId: row.external_id, costEstimateCents: row.cost_estimate_cents,
    isPromotional: row.is_promotional, createdAt: row.created_at,
  };
}

export async function enqueueJob(input: EnqueueJobInput): Promise<Job> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_publish_jobs").insert({
    organization_id: input.organizationId, channel: input.channel, provider: input.provider,
    recipient_contact_id: input.recipientContactId, recipient_address: input.recipientAddress,
    source_kind: input.sourceKind, source_id: input.sourceId, payload: input.payload,
    is_promotional: input.isPromotional, cost_estimate_cents: input.costEstimateCents,
    send_after: input.sendAfter ?? new Date().toISOString(),
  }).select("*").single();
  if (error) {
    if (error.code === "23505" && error.message.includes("dedupe_key")) {
      throw new DuplicateJobError("Invio gia in coda con stesso source+destinatario (idempotenza RF-5.5)");
    }
    throw new Error(`enqueueJob: ${error.message}`);
  }
  return rowToJob(data);
}

export async function getJob(jobId: string): Promise<Job | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_publish_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  return data ? rowToJob(data) : null;
}

/** RS-4: reclaim di job orfani (worker crashato senza aggiornare status). */
export async function reclaimOrphaned(olderThanMinutes = 5): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data, error } = await admin.from("m05_publish_jobs")
    .update({ status: "queued", claim_token: null, claimed_at: null })
    .eq("status", "claimed").lt("claimed_at", cutoff).select("id");
  if (error) throw new Error(`reclaimOrphaned: ${error.message}`);
  return (data ?? []).length;
}

/**
 * RS-4 SKIP LOCKED claim: due tick concorrenti non si pestano.
 * Ritorna i job claimati con lo stesso claim_token (usato in finalize).
 */
export async function claimBatch(n: number): Promise<{ jobs: Job[]; claimToken: string }> {
  const claimToken = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // usiamo rpc perche' Supabase-js non supporta FOR UPDATE SKIP LOCKED direttamente.
  // Definiremo la funzione SQL nel task 6 step 3.
  const { data, error } = await admin.rpc("m05_claim_jobs", { p_limit: n, p_claim_token: claimToken });
  if (error) throw new Error(`claimBatch: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { jobs: ((data ?? []) as any[]).map(rowToJob), claimToken };
}

export async function markSent(jobId: string, claimToken: string, externalId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_publish_jobs").update({
    status: "sent", sent_at: new Date().toISOString(), external_id: externalId,
    claim_token: null, claimed_at: null,
  }).eq("id", jobId).eq("claim_token", claimToken);
  if (error) throw new Error(`markSent: ${error.message}`);
}

const BACKOFF_SECONDS = [60, 300, 900, 3600, 21600];  // 1m, 5m, 15m, 1h, 6h

export async function markFailed(jobId: string, claimToken: string, errorMessage: string): Promise<{ dead: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: current, error: getErr } = await admin.from("m05_publish_jobs")
    .select("retry_count").eq("id", jobId).single();
  if (getErr) throw new Error(`markFailed getCurrent: ${getErr.message}`);
  const nextCount = (current.retry_count ?? 0) + 1;
  if (nextCount > BACKOFF_SECONDS.length) {
    const { error } = await admin.from("m05_publish_jobs").update({
      status: "dead", last_error: errorMessage, claim_token: null, claimed_at: null,
      retry_count: nextCount,
    }).eq("id", jobId).eq("claim_token", claimToken);
    if (error) throw new Error(`markFailed(dead): ${error.message}`);
    return { dead: true };
  }
  const backoff = BACKOFF_SECONDS[nextCount - 1];
  const nextRetry = new Date(Date.now() + backoff * 1000).toISOString();
  const { error } = await admin.from("m05_publish_jobs").update({
    status: "queued", retry_count: nextCount, next_retry_at: nextRetry,
    last_error: errorMessage, claim_token: null, claimed_at: null,
  }).eq("id", jobId).eq("claim_token", claimToken);
  if (error) throw new Error(`markFailed(retry): ${error.message}`);
  return { dead: false };
}
