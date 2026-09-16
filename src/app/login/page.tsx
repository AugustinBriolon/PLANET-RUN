import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { GarminConnectButton } from "@/components/login/garmin-connect-button";
import { LoginGlobe } from "@/components/login/login-globe";
import { SignInError } from "@/components/login/sign-in-error";
import { StravaConnectButton } from "@/components/login/strava-connect-button";
import { FadeInItem, FadeInStagger } from "@/components/motion/fade-in-stagger";
import { getSignInErrorMessage } from "@/lib/sign-in-error-message";
import { getCurrentUser } from "@/server/session";

import { signInWithStrava } from "./actions";

export const metadata: Metadata = {
  title: "Sign in · Planet Run",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/globe");
  const errorMessage = getSignInErrorMessage((await searchParams).error);

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.25fr_1fr]">
      <section aria-label="Planet preview" className="starfield relative h-[46dvh] overflow-hidden lg:h-auto">
        <LoginGlobe />
        <p className="pointer-events-none absolute bottom-6 left-6 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          48.8566° N · 2.3522° E
        </p>
      </section>

      <section className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
        <FadeInStagger className="mx-auto flex w-full max-w-md flex-col gap-8">
          <FadeInItem>
            <PlanetRunLogo className="text-lg" />
          </FadeInItem>

          <FadeInItem className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.2em] text-ember uppercase">Every run, one planet</p>
            <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl">
              See every place you&apos;ve ever run.
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Connect your running history and watch it light up the globe. Street-by-street coverage of your city,
              region and country is coming next.
            </p>
          </FadeInItem>

          <FadeInItem className="flex flex-col gap-3">
            {errorMessage && <SignInError message={errorMessage} />}
            <form action={signInWithStrava}>
              <StravaConnectButton />
            </form>
            <GarminConnectButton />
          </FadeInItem>

          <FadeInItem>
            <p className="text-sm leading-relaxed text-muted-foreground">
              No account to create. Planet Run only reads your activities and never posts to Strava.
            </p>
          </FadeInItem>
        </FadeInStagger>
      </section>
    </main>
  );
}
