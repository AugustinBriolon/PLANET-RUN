export const MANUAL_SYNC_MAX_ATTEMPTS = 5;
export const MANUAL_SYNC_WINDOW_MS = 15 * 60 * 1000;

export type ManualSyncConsumeResult = { ok: true } | { ok: false; retryAfterMs: number };

type ConsumeOptions = {
  maxAttempts?: number;
  windowMs?: number;
};

/**
 * Sliding window over attempt timestamps. Denied attempts are not recorded so the
 * window keeps draining from the oldest successful consume.
 */
export function consumeManualSyncAttempt(
  previousAttemptsMs: readonly number[],
  nowMs: number,
  options: ConsumeOptions = {},
): { attemptsMs: number[]; result: ManualSyncConsumeResult } {
  const maxAttempts = options.maxAttempts ?? MANUAL_SYNC_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? MANUAL_SYNC_WINDOW_MS;
  const cutoff = nowMs - windowMs;
  const recent = previousAttemptsMs.filter((timestamp) => timestamp > cutoff).sort((a, b) => a - b);

  if (recent.length >= maxAttempts) {
    const oldest = recent[0]!;
    return {
      attemptsMs: recent,
      result: { ok: false, retryAfterMs: Math.max(0, oldest + windowMs - nowMs) },
    };
  }

  return { attemptsMs: [...recent, nowMs], result: { ok: true } };
}

type GlobalRateLimitState = typeof globalThis & {
  planetRunManualSyncAttempts?: Map<string, number[]>;
};

function attemptStore(): Map<string, number[]> {
  const globalState = globalThis as GlobalRateLimitState;
  globalState.planetRunManualSyncAttempts ??= new Map();
  return globalState.planetRunManualSyncAttempts;
}

/** Process-local limiter for the manual sync server action (not webhooks). */
export function tryConsumeManualSync(userId: string, now: Date = new Date()): ManualSyncConsumeResult {
  const store = attemptStore();
  const { attemptsMs, result } = consumeManualSyncAttempt(store.get(userId) ?? [], now.getTime());
  store.set(userId, attemptsMs);
  return result;
}

/** Test helper — clears in-memory attempt history for this process. */
export function resetManualSyncRateLimitForTests(): void {
  attemptStore().clear();
}
