"use client";

import { AnimatePresence, motion } from "motion/react";
import { Footprints, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { StravaIcon } from "@/components/brand/strava-icon";
import { Button } from "@/components/ui/button";
import type { RunSyncStatus } from "@/hooks/use-run-sync";
import type { RunSyncFailure } from "@/lib/runs/run-sync-result";
import { cn } from "@/lib/utils";

import { PanelFooter } from "./panel-footer";

export type EmptyRunsStateProps = {
  status: RunSyncStatus;
  failure: RunSyncFailure | null;
  onRetry: () => void;
  reconnectAction: () => Promise<void>;
  deleteDataAction: () => Promise<void>;
  className?: string;
};

type StateContent = { key: string; icon: ReactNode; title: string; description: string };

function getContent(status: RunSyncStatus, failure: RunSyncFailure | null): StateContent {
  if (status === "syncing") {
    return {
      key: "syncing",
      icon: <LoaderCircle className="size-6 animate-spin text-ember" aria-hidden="true" />,
      title: "Pulling your runs from Strava…",
      description: "Your whole history is on its way. Big archives can take a few seconds.",
    };
  }
  if (status === "failed" && failure) {
    return {
      key: `failed-${failure.reason}`,
      icon: <TriangleAlert className="size-6 text-destructive" aria-hidden="true" />,
      title: "Your runs couldn't be imported",
      description: failure.message,
    };
  }
  return {
    key: "empty",
    icon: <Footprints className="size-6 text-ember" aria-hidden="true" />,
    title: "No outdoor runs yet",
    description: "Runs with a GPS trace will appear here. Record one, then hit sync.",
  };
}

/** Shown while the globe has no runs: first import in progress, import failed, or no runs on Strava. */
export function EmptyRunsState({
  status,
  failure,
  onRetry,
  reconnectAction,
  deleteDataAction,
  className,
}: EmptyRunsStateProps) {
  const content = getContent(status, failure);
  const needsReconnect = status === "failed" && failure?.reason === "missing-permission";
  const canRetry = status === "failed" && !needsReconnect;

  return (
    <section
      aria-live="polite"
      aria-busy={status === "syncing"}
      className={cn("glass-panel w-full max-w-sm rounded-xl p-6 text-center", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={content.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          {content.icon}
          <h2 className="text-lg font-semibold tracking-tight">{content.title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{content.description}</p>

          {needsReconnect && (
            <form action={reconnectAction} className="mt-2 w-full">
              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-strava px-4 text-sm font-semibold text-strava-foreground transition-[filter] duration-150 ease-out outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <StravaIcon className="size-4" />
                Reconnect Strava
              </button>
            </form>
          )}
          {canRetry && (
            <Button variant="outline" size="lg" onClick={onRetry} className="mt-2">
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          )}
        </motion.div>
      </AnimatePresence>
      <PanelFooter deleteDataAction={deleteDataAction} />
    </section>
  );
}
