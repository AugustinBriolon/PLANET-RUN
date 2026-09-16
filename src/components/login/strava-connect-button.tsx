"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { StravaIcon } from "@/components/brand/strava-icon";
import { cn } from "@/lib/utils";

/** Submit button for the Strava sign-in form; shows progress while redirecting to Strava. */
export function StravaConnectButton({ className }: { className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "group relative flex h-12 w-full items-center gap-3 rounded-lg bg-strava px-4 text-[0.95rem] font-semibold text-strava-foreground",
        "transition-[filter,transform] duration-150 ease-out hover:brightness-110 active:translate-y-px",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-progress disabled:brightness-90",
        className,
      )}
    >
      <StravaIcon className="size-5" />
      <span className="flex-1 text-left">{pending ? "Connecting to Strava…" : "Connect with Strava"}</span>
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <ArrowRight
          className="size-4 transition-transform duration-150 ease-out group-hover:translate-x-1"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
