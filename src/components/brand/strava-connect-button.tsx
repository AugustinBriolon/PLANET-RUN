"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

// Official asset from the Strava API brand guidelines: it must be shown unaltered, at its native 48px height.
const CONNECT_BUTTON = { src: "/brand/strava/connect-with-strava-orange.svg", width: 237, height: 48 };

/** Submit button for a Strava authorization form; shows progress while redirecting to Strava. */
export function StravaConnectButton({ className }: { className?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "w-fit rounded-md transition-[filter,transform,opacity] duration-150 ease-out hover:brightness-110 active:translate-y-px",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:animate-pulse disabled:cursor-progress disabled:hover:brightness-100",
        className,
      )}
    >
      <Image {...CONNECT_BUTTON} alt="" priority />
      <span className="sr-only">{pending ? "Connecting to Strava…" : "Connect with Strava"}</span>
    </button>
  );
}
