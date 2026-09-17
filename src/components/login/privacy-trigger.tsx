"use client";

import { useState } from "react";

import { PrivacyDialog } from "@/components/dashboard/privacy-dialog";

/** Opens the privacy policy in a dialog instead of navigating away, so the globe never reloads. */
export function PrivacyTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-foreground underline underline-offset-4 outline-none hover:text-ember focus-visible:ring-2 focus-visible:ring-ring"
      >
        Privacy
      </button>
      <PrivacyDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
