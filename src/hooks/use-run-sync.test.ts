import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";

import { useRunSync } from "./use-run-sync";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const failed: RunSyncActionResult = { status: "error", reason: "missing-permission", message: "Reconnect please." };

describe("useRunSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs on demand and announces the result", async () => {
    const syncAction = vi.fn().mockResolvedValue({ status: "success", syncedRuns: 12 });
    const { result } = renderHook(() => useRunSync({ syncAction, syncOnMount: false }));
    expect(result.current.status).toBe("idle");

    act(() => result.current.sync());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("12 runs synced"));
    expect(result.current).toMatchObject({ status: "idle", failure: null });
  });

  it("uses the singular for a single run", async () => {
    const syncAction = vi.fn().mockResolvedValue({ status: "success", syncedRuns: 1 });
    const { result } = renderHook(() => useRunSync({ syncAction, syncOnMount: false }));

    act(() => result.current.sync());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1 run synced"));
  });

  it("leaves the syncing state and exposes the failure when the sync fails", async () => {
    const syncAction = vi.fn().mockResolvedValue(failed);
    const { result } = renderHook(() => useRunSync({ syncAction, syncOnMount: true }));

    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.failure).toMatchObject({ reason: "missing-permission", message: "Reconnect please." });
    expect(toast.error).toHaveBeenCalledWith("Reconnect please.");
  });

  it("reports syncing immediately when a sync on mount is expected", async () => {
    let resolveSync: (result: RunSyncActionResult) => void = () => {};
    const syncAction = vi.fn(() => new Promise<RunSyncActionResult>((resolve) => (resolveSync = resolve)));
    const { result } = renderHook(() => useRunSync({ syncAction, syncOnMount: true }));

    expect(result.current.status).toBe("syncing");

    // React entangles pending async transitions across tests: always settle them.
    await act(async () => resolveSync({ status: "success", syncedRuns: 0 }));
    expect(result.current.status).toBe("idle");
  });

  it("clears a previous failure after a successful retry", async () => {
    const syncAction = vi
      .fn()
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce({ status: "success", syncedRuns: 3 });
    const { result } = renderHook(() => useRunSync({ syncAction, syncOnMount: false }));

    await act(async () => result.current.sync());
    expect(result.current.status).toBe("failed");

    await act(async () => result.current.sync());
    expect(result.current).toMatchObject({ status: "idle", failure: null });
  });

  it("syncs exactly once on mount when requested", async () => {
    const syncAction = vi.fn().mockResolvedValue({ status: "success", syncedRuns: 0 });
    const { rerender } = renderHook(() => useRunSync({ syncAction, syncOnMount: true }));
    rerender();

    await waitFor(() => expect(syncAction).toHaveBeenCalledTimes(1));
  });

  it("does not sync on mount otherwise", () => {
    const syncAction = vi.fn();
    renderHook(() => useRunSync({ syncAction, syncOnMount: false }));
    expect(syncAction).not.toHaveBeenCalled();
  });
});
