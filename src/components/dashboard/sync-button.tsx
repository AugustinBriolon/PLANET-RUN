"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SyncButtonProps = {
  isSyncing: boolean;
  onSync: () => void;
  className?: string;
};

export function SyncButton({ isSyncing, onSync, className }: SyncButtonProps) {
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={onSync}
      disabled={isSyncing}
      aria-busy={isSyncing}
      className={cn("glass-panel group", className)}
    >
      <RefreshCw
        aria-hidden="true"
        className={cn("transition-transform duration-300 ease-out group-hover:rotate-90", isSyncing && "animate-spin")}
      />
      {isSyncing ? "Syncing…" : "Sync runs"}
    </Button>
  );
}
