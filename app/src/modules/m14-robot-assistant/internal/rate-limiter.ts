// RN-robot T9: rate limit in-memory per utente.
// Limite: MAX_MESSAGES_PER_MINUTE messaggi per user.
// In-memory è accettabile per un solo processo Vercel (single instance).
// Se passeremo a multi-instance, migrare a Redis/Upstash.

const MAX_MESSAGES_PER_MINUTE = 20;
const WINDOW_MS = 60_000;

const bucket = new Map<string, number[]>();

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

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
