"use client";

import { ArrowLeft, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { SetVisibilityResult } from "@/app/settings/actions";
import { CityfilLogo } from "@/components/brand/cityfil-logo";
import { DeleteDataDialog } from "@/components/dashboard/delete-data-dialog";
import { SyncButton } from "@/components/dashboard/sync-button";
import { FadeInItem, FadeInStagger } from "@/components/motion/fade-in-stagger";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRunSync } from "@/hooks/use-run-sync";
import type { ProfileVisibility } from "@/lib/conquest/visibility";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";
import { cn } from "@/lib/utils";

export type SettingsPageProps = {
  displayName: string;
  avatarUrl: string | null;
  visibility: ProfileVisibility;
  setVisibilityAction: (visibility: ProfileVisibility) => Promise<SetVisibilityResult>;
  syncAction: () => Promise<RunSyncActionResult>;
  signOutAction: () => Promise<void>;
  deleteDataAction: () => Promise<void>;
};

const VISIBILITY_OPTIONS: readonly {
  value: ProfileVisibility;
  title: string;
  subtitle: string;
}[] = [
  {
    value: "private",
    title: "Private",
    subtitle: "Only people you invite see your streets",
  },
  {
    value: "public",
    title: "Public",
    subtitle: "Appear on city halls of fame",
  },
];

function avatarInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase() || "?";
}

/** Account settings: profile, visibility, Strava sync, sign out and delete. */
export function SettingsPage({
  displayName,
  avatarUrl,
  visibility: initialVisibility,
  setVisibilityAction,
  syncAction,
  signOutAction,
  deleteDataAction,
}: SettingsPageProps) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [visibilityPending, startVisibility] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { status, sync } = useRunSync({ syncAction, syncOnMount: false });

  function chooseVisibility(next: ProfileVisibility) {
    if (next === visibility) return;
    const previous = visibility;
    setVisibility(next);
    startVisibility(async () => {
      const result = await setVisibilityAction(next);
      if (result.status === "error") {
        setVisibility(previous);
        toast.error(result.message);
        return;
      }
      toast.success(next === "public" ? "Profile is public" : "Profile is private");
    });
  }

  return (
    <main className="starfield relative min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-4 px-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-4">
        <CityfilLogo className="text-base" />
        <Link
          href="/globe"
          className="flex items-center gap-1.5 rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to globe
        </Link>
      </header>

      <FadeInStagger className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
        <FadeInItem>
          <section className="glass-panel flex flex-col items-center gap-3 rounded-xl p-8 text-center">
            <Avatar className="size-[88px]">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-ember/15 text-3xl font-semibold text-ember">
                {avatarInitial(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              <p className="text-sm text-muted-foreground">Connected to Strava</p>
            </div>
          </section>
        </FadeInItem>

        <FadeInItem>
          <section className="glass-panel flex flex-col gap-3 rounded-xl p-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
                Profile visibility
              </h2>
              <p className="text-sm text-muted-foreground">
                Public profiles appear on a city&apos;s hall of fame as Founder, Conqueror or Keeper.
              </p>
            </div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Profile visibility" aria-busy={visibilityPending}>
              {VISIBILITY_OPTIONS.map((option) => {
                const selected = visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={visibilityPending}
                    onClick={() => chooseVisibility(option.value)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg border px-4 py-3 text-left outline-none transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
                      selected
                        ? "border-ember/50 bg-ember/10"
                        : "border-border bg-transparent hover:bg-accent/40",
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">{option.title}</span>
                    <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </FadeInItem>

        <FadeInItem>
          <section className="glass-panel flex flex-col gap-3 rounded-xl p-5">
            <div className="flex flex-col gap-1">
              <h2 className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Strava</h2>
              <p className="text-sm text-muted-foreground">
                New outdoor GPS runs import automatically. Sync pulls them right now.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SyncButton isSyncing={status === "syncing"} onSync={sync} />
              <span className="text-sm text-muted-foreground">
                {status === "syncing" ? "Syncing…" : "Sync runs"}
              </span>
            </div>
          </section>
        </FadeInItem>

        <FadeInItem>
          <section className="glass-panel flex flex-col gap-2 rounded-xl p-5">
            <Link
              href="/privacy"
              className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              Privacy
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full min-h-11 items-center gap-3 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LogOut className="size-4 text-muted-foreground" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </section>
        </FadeInItem>

        <FadeInItem>
          <section className="glass-panel flex flex-col gap-3 rounded-xl p-5">
            <p className="text-sm text-muted-foreground">
              Revokes Strava access and wipes your coverage, runs and cities from Cityfil.
            </p>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} className="w-full">
              <Trash2 aria-hidden="true" />
              Delete account
            </Button>
          </section>
        </FadeInItem>
      </FadeInStagger>

      <DeleteDataDialog open={deleteOpen} onOpenChange={setDeleteOpen} deleteAction={deleteDataAction} />
    </main>
  );
}
