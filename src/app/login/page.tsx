import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { AccountDeletedNotice } from "@/components/login/account-deleted-notice";
import { GarminConnectButton } from "@/components/login/garmin-connect-button";
import { LoginGlobe } from "@/components/login/login-globe";
import { PrivacyTrigger } from "@/components/login/privacy-trigger";
import { SignInError } from "@/components/login/sign-in-error";
import { StravaConnectButton } from "@/components/brand/strava-connect-button";
import { FadeInItem, FadeInStagger } from "@/components/motion/fade-in-stagger";
import { getSignInErrorMessage } from "@/lib/sign-in-error-message";
import { getCurrentUser } from "@/server/session";

import { signInWithStrava } from "./actions";

export const metadata: Metadata = {
  title: "Sign in · Planet Run",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/globe");
  const { error, deleted } = await searchParams;
  const errorMessage = getSignInErrorMessage(error);

  return (
    <main className="starfield relative h-lvh overflow-hidden">
      <section aria-label="Planet preview" className="absolute inset-0 max-sm:-translate-y-[12dvh]">
        <LoginGlobe />
      </section>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-6">
        <PlanetRunLogo className="pointer-events-auto text-base" />
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">48.8566° N · 2.3522° E</p>
      </header>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 sm:inset-x-auto sm:top-1/2 sm:right-10 sm:bottom-auto sm:w-full sm:max-w-md sm:-translate-y-1/2">
        <FadeInStagger className="glass-panel pointer-events-auto flex max-h-[calc(100dvh-2rem)] scroll-fade flex-col gap-6 overflow-y-auto rounded-xl p-6 sm:gap-8 sm:p-8">
          <FadeInItem className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.2em] text-ember uppercase">Every run, one planet</p>
            <h1 className="text-3xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-4xl">
              See every place you&apos;ve ever run.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              Connect your running history and watch it light up the globe. Street-by-street coverage of your city,
              region and country is coming next.
            </p>
          </FadeInItem>

          <FadeInItem className="flex flex-col gap-3">
            {deleted === "1" && <AccountDeletedNotice />}
            {errorMessage && <SignInError message={errorMessage} />}
            <form action={signInWithStrava}>
              <StravaConnectButton />
            </form>
            <GarminConnectButton />
          </FadeInItem>

          <FadeInItem>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No account to create. Planet Run only reads your activities and never posts to Strava. <PrivacyTrigger />
            </p>
          </FadeInItem>
        </FadeInStagger>
      </div>
    </main>
  );
}
