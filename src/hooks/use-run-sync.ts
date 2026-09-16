"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { RunSyncActionResult, RunSyncFailure } from "@/lib/runs/run-sync-result";

export type RunSyncStatus = "idle" | "syncing" | "failed";

export type UseRunSyncOptions = {
  syncAction: () => Promise<RunSyncActionResult>;
  /** Triggers a sync on mount, e.g. right after the very first sign-in. */
  syncOnMount: boolean;
};

export type UseRunSyncResult = {
  status: RunSyncStatus;
  failure: RunSyncFailure | null;
  sync: () => void;
};

function announce(result: RunSyncActionResult) {
  if (result.status === "error") toast.error(result.message);
  else toast.success(result.syncedRuns === 1 ? "1 run synced" : `${result.syncedRuns} runs synced`);
}

export function useRunSync({ syncAction, syncOnMount }: UseRunSyncOptions): UseRunSyncResult {
  const [isPending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<RunSyncActionResult | null>(null);
  const hasAutoSynced = useRef(false);

  const sync = useCallback(() => {
    startTransition(async () => {
      const result = await syncAction();
      setLastResult(result);
      announce(result);
    });
  }, [syncAction]);

  useEffect(() => {
    // Guards against React Strict Mode running effects twice in development.
    if (!syncOnMount || hasAutoSynced.current) return;
    hasAutoSynced.current = true;
    sync();
  }, [syncOnMount, sync]);

  const failure: RunSyncFailure | null = lastResult?.status === "error" ? lastResult : null;
  // Before the mount effect fires, an expected auto-sync already counts as syncing to avoid a flash of "empty".
  const isAwaitingAutoSync = syncOnMount && lastResult === null;
  const status: RunSyncStatus = isPending || (isAwaitingAutoSync && !failure) ? "syncing" : failure ? "failed" : "idle";

  return { status, failure, sync };
}
