import { Watch } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Placeholder until the Garmin Connect Developer Program access is granted. */
export function GarminConnectButton() {
  return (
    <button
      type="button"
      disabled
      aria-describedby="garmin-availability"
      className="flex h-12 w-fit cursor-not-allowed items-center gap-3 rounded-md border border-border px-4 text-[0.95rem] font-medium text-muted-foreground"
    >
      <Watch className="size-5" aria-hidden="true" />
      <span className="flex-1 text-left">Connect with Garmin</span>
      <Badge id="garmin-availability" variant="secondary">
        Coming soon
      </Badge>
    </button>
  );
}
