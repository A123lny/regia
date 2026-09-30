// M05 - worker della coda invii (RS-4).
// Chiamato dalla route /api/publisher/tick, che a sua volta e' triggerata da pg_cron.

import { reclaimOrphaned, claimBatch, markSent, markFailed } from "./publish-jobs-repo";
import { logSent, logFailed } from "./publish-log-repo";
import { getAdapter } from "./adapter-registry";
import { loadAdapterCredentials } from "./credentials-repo";

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
