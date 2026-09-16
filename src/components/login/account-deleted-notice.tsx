import { CircleCheck } from "lucide-react";

export function AccountDeletedNotice() {
  return (
    <p
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary px-3.5 py-3 text-sm text-foreground"
    >
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-ember" aria-hidden="true" />
      Your Planet Run data has been deleted and Strava access revoked.
    </p>
  );
}
