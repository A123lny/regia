// M05 - worker della coda invii (RS-4).
// Chiamato dalla route /api/publisher/tick, che a sua volta e' triggerata da pg_cron.

import { reclaimOrphaned, claimBatch, markSent, markFailed, markDead } from "./publish-jobs-repo";
import { logSent, logFailed } from "./publish-log-repo";
import { getAdapter } from "./adapter-registry";
import { loadAdapterCredentials } from "./credentials-repo";
import { gateConsent } from "./gates";
import type { SourceKind } from "./gates";
import { ConsentMissingError, RecipientMismatchError } from "./types";
import type { Channel } from "./types";

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
      // Fail-closed: invio senza contactId permesso solo per sourceKind='test'.
      if (!job.recipientContactId && job.sourceKind !== "test") {
        throw new ConsentMissingError(
          `Job senza contactId non consentito (sourceKind=${job.sourceKind})`,
        );
      }

      // TOCTOU safety: tra enqueue e send possono passare ore. Ri-verifichiamo
      // archived + consent chiamando lo stesso gate dell'enqueue, che
      // internamente controlla archived_at e consent 'granted' per il canale.
      if (job.recipientContactId) {
        await gateConsent(
          job.organizationId,
          job.recipientContactId,
          job.channel as Channel,
          job.sourceKind as SourceKind,
        );
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
      // Terminal errors: consenso revocato, contatto archiviato, mismatch
      // destinatario. Retry non ha senso — segneremmo dead subito per non
      // sprecare chiamate adapter.
      const isTerminal =
        err instanceof ConsentMissingError || err instanceof RecipientMismatchError;
      if (isTerminal) {
        await markDead(job.id, claimToken, errMsg);
        await logFailed(job, errMsg);
        result.dead += 1;
      } else {
        const { dead } = await markFailed(job.id, claimToken, errMsg);
        if (dead) {
          await logFailed(job, errMsg);
          result.dead += 1;
        } else {
          result.failed += 1;
        }
      }
      result.errors.push({ jobId: job.id, error: errMsg });
    }
  }
  return result;
}
