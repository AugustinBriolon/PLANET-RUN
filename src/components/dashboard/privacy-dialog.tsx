"use client";

import { useEffect, useRef } from "react";

import { PrivacyPolicy } from "@/components/privacy/privacy-policy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PrivacyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PrivacyDialog({ open, onOpenChange }: PrivacyDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90dvh,40rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        initialFocus={titleRef}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12">
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">
            Privacy
          </DialogTitle>
          <DialogDescription className="sr-only">
            What Planet Run stores about you, why, and how to delete it.
          </DialogDescription>
        </DialogHeader>
        <div ref={scrollRef} className="overflow-y-auto px-4 py-4">
          <PrivacyPolicy compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}
