import { describe, expect, it, vi } from "vitest";

import type { User } from "@/server/db/schema";

import { createAnalysisNotifyService } from "./analysis-notify-service";

const now = new Date("2026-10-06T12:00:00Z");

function user(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    displayName: "Ada",
    avatarUrl: null,
    profileVisibility: "private",
    expoPushToken: null,
    analysisNotifyPending: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("createAnalysisNotifyService", () => {
  it("skips when analysis is not pending", async () => {
    const users = {
      findById: vi.fn(async () => user()),
      setAnalysisNotifyPending: vi.fn(),
    };
    await expect(createAnalysisNotifyService({ users }).notifyIfPending("user-1")).resolves.toBe("skipped");
    expect(users.setAnalysisNotifyPending).not.toHaveBeenCalled();
  });

  it("clears the flag when pending but no token is stored", async () => {
    const users = {
      findById: vi.fn(async () => user({ analysisNotifyPending: true })),
      setAnalysisNotifyPending: vi.fn(),
    };
    await expect(createAnalysisNotifyService({ users }).notifyIfPending("user-1")).resolves.toBe("cleared");
    expect(users.setAnalysisNotifyPending).toHaveBeenCalledWith("user-1", false);
  });
});
