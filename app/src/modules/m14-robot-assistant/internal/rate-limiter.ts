// RN-robot T9: rate limit in-memory per utente.
//
// KNOWN LIMITATION: in-memory è accettabile SOLO su Hobby Vercel plan a single
// instance (staging demo). Su production multi-instance questo rate limit è
// inefficace (ogni instance ha il proprio Map). Migrare a Upstash/Redis o a
// una Postgres table con atomic increment prima di passare a Pro/Enterprise.
// Tracciato in roadmap: vedere ledger .superpowers/sdd/ e issue follow-up.

const MAX_MESSAGES_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

const bucket = new Map<string, number[]>();

export type RateLimitCheck = { ok: true } | { ok: false; retryAfterMs: number };

export function checkRateLimit(userId: string): RateLimitCheck {
  const now = Date.now();
  const timestamps = bucket.get(userId) ?? [];
  // Pulizia dei vecchi
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_MESSAGES_PER_MINUTE) {
    const oldest = recent[0]!;
    const retryAfterMs = WINDOW_MS - (now - oldest);
    bucket.set(userId, recent);
    return { ok: false, retryAfterMs };
  }

  recent.push(now);
  bucket.set(userId, recent);
  return { ok: true };
}

/** Utility per test: svuota il bucket. */
export function resetRateLimit(userId?: string): void {
  if (userId) bucket.delete(userId);
  else bucket.clear();
}
