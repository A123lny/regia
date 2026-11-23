// M05 - worker della coda invii (RS-4).
// Chiamato dalla route /api/publisher/tick, che a sua volta e' triggerata da pg_cron.

import { reclaimOrphaned, claimBatch, markSent, markFailed } from "./publish-jobs-repo";
import { logSent, logFailed } from "./publish-log-repo";
import { getAdapter } from "./adapter-registry";
import { loadAdapterCredentials } from "./credentials-repo";
import { getAdminClient } from "@/lib/db/admin";

export type TickResult = {
  orphaned: number;
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  errors: Array<{ jobId: string; error: string }>;
};

export async function tickBatch(batchSize = 20): Promise<TickResult> {
  const result: TickResult = { orphaned: 0, claimed: 0, sent: 0, failed: 0, dead: 0, errors: [] };
  result.orphaned = await reclaimOrphaned(5);
  const { jobs, claimToken } = await claimBatch(batchSize);
  result.claimed = jobs.length;
  for (const job of jobs) {
    try {
      // Re-check archived/consent al momento del send (TOCTOU safety).
      // Tra il momento in cui il job e' stato inserito (enqueue) e il momento
      // in cui il worker lo esegue possono passare minuti o ore: l'owner puo'
      // aver archiviato il contatto o revocato il consenso nel frattempo.
      // Senza questa guardia il messaggio verrebbe inviato comunque.
      if (job.recipientContactId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = getAdminClient() as any;
        const { data: contactRow } = await admin
          .from("contacts")
          .select("archived_at")
          .eq("organization_id", job.organizationId)
          .eq("id", job.recipientContactId)
          .maybeSingle();
        if (!contactRow) {
          throw new Error("Contatto destinatario non trovato al momento del send");
        }
        if ((contactRow as { archived_at: string | null }).archived_at !== null) {
          throw new Error("Contatto archiviato dopo enqueue: invio annullato");
        }
      }

      const loaded = await loadAdapterCredentials(job.organizationId, job.channel);
      if (!loaded) throw new Error(`Credenziali ${job.channel} sparite`);
      const adapter = await getAdapter(job.channel, loaded.provider);
      const { externalId, costCents } = await adapter.send(job.payload, loaded.credentials);
      await logSent(job, externalId, costCents, null);
      await markSent(job.id, claimToken, externalId);
      result.sent += 1;
    } catch (err) {
      const errMsg = (err as Error).message;
      const { dead } = await markFailed(job.id, claimToken, errMsg);
      if (dead) {
        await logFailed(job, errMsg);
        result.dead += 1;
      } else {
        result.failed += 1;
      }
      result.errors.push({ jobId: job.id, error: errMsg });
    }
  }
  return result;
}
