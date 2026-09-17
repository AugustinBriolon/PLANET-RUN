import { afterEach, describe, expect, it } from "vitest";

import {
  MANUAL_SYNC_MAX_ATTEMPTS,
  MANUAL_SYNC_WINDOW_MS,
  consumeManualSyncAttempt,
  resetManualSyncRateLimitForTests,
  tryConsumeManualSync,
} from "./manual-sync-rate-limit";

describe("consumeManualSyncAttempt", () => {
  const windowMs = MANUAL_SYNC_WINDOW_MS;
  const maxAttempts = MANUAL_SYNC_MAX_ATTEMPTS;

  it("allows the first attempts within the window", () => {
    let attempts: number[] = [];
    const start = 1_000_000;

    for (let index = 0; index < maxAttempts; index++) {
      const consumed = consumeManualSyncAttempt(attempts, start + index * 1_000);
      expect(consumed.result).toEqual({ ok: true });
      attempts = consumed.attemptsMs;
    }

    expect(attempts).toHaveLength(maxAttempts);
  });

  it("denies the next attempt and reports retryAfterMs from the oldest", () => {
    const start = 1_000_000;
    const attempts = Array.from({ length: maxAttempts }, (_, index) => start + index * 1_000);
    const now = start + 60_000;
    const consumed = consumeManualSyncAttempt(attempts, now);

    expect(consumed.result).toEqual({
      ok: false,
      retryAfterMs: start + windowMs - now,
    });
    expect(consumed.attemptsMs).toEqual(attempts);
  });

  it("drops attempts that fall outside the window", () => {
    const oldest = 1_000_000;
    const attempts = [oldest, oldest + 1_000, oldest + 2_000, oldest + 3_000, oldest + 4_000];
    const now = oldest + 4_000 + windowMs + 1;
    const consumed = consumeManualSyncAttempt(attempts, now);

    expect(consumed.result).toEqual({ ok: true });
    expect(consumed.attemptsMs).toEqual([now]);
  });
});

describe("tryConsumeManualSync", () => {
  afterEach(() => {
    resetManualSyncRateLimitForTests();
  });

  it("isolates limits per user", () => {
    const now = new Date("2026-09-17T12:00:00Z");

    for (let index = 0; index < MANUAL_SYNC_MAX_ATTEMPTS; index++) {
      expect(tryConsumeManualSync("user-a", now).ok).toBe(true);
    }

    expect(tryConsumeManualSync("user-a", now)).toMatchObject({ ok: false });
    expect(tryConsumeManualSync("user-b", now)).toEqual({ ok: true });
  });
});
