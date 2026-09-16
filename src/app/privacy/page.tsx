import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PlanetRunLogo } from "@/components/brand/planet-run-logo";

export const metadata: Metadata = {
  title: "Privacy · Planet Run",
  description: "What Planet Run stores about you, why, and how to delete it.",
};

const LAST_UPDATED = "September 16, 2026";

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-6 py-12 sm:py-16">
      <header className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <PlanetRunLogo className="text-base" />
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to the globe
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.2em] text-ember uppercase">Last updated {LAST_UPDATED}</p>
          <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Your runs reveal where you live and train. Planet Run keeps only what it needs to draw them on your globe,
            shows them to nobody but you, and lets you erase everything in one click.
          </p>
        </div>
      </header>

      <PolicySection title="What we store">
        <ul className="list-disc space-y-2 pl-5">
          <li>Your Strava athlete ID, first and last name, and profile photo link.</li>
          <li>
            For your outdoor runs and trail runs only: name, start date, distance, moving time, elevation gain and the
            simplified route Strava provides.
          </li>
          <li>The access tokens Strava issues to Planet Run, encrypted with AES-256-GCM.</li>
        </ul>
        <p>
          We do not collect your email, password, heart rate, photos, private notes or any other activity type. Planet
          Run only requests read access and never posts to Strava.
        </p>
      </PolicySection>

      <PolicySection title="How it is used">
        <p>
          Your data is used for one purpose: showing your runs and totals on your own globe. It is not visible to other
          users, not sold, not used for advertising and not used to train AI models.
        </p>
      </PolicySection>

      <PolicySection title="Who processes it">
        <p>
          Planet Run is hosted on Vercel and stores data in a managed PostgreSQL database. Countries are computed on our
          servers without calling any external service. Map backgrounds are loaded from CARTO: like any online map, tile
          requests reveal the area you are looking at, but not your runs.
        </p>
      </PolicySection>

      <PolicySection title="How long we keep it">
        <p>
          Until you delete it. If you revoke Planet Run from your Strava settings, Strava notifies us and your data is
          deleted automatically.
        </p>
      </PolicySection>

      <PolicySection title="Deleting your data">
        <p>
          Open the settings icon on your globe and choose <span className="text-foreground">Delete my data</span>. Your
          profile, runs and tokens are permanently erased and Planet Run&apos;s access to Strava is revoked. You can
          also revoke access at any time from{" "}
          <a
            href="https://www.strava.com/settings/apps"
            className="text-foreground underline underline-offset-4 outline-none hover:text-ember focus-visible:ring-2 focus-visible:ring-ring"
          >
            strava.com/settings/apps
          </a>
          .
        </p>
      </PolicySection>
    </main>
  );
}
