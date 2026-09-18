import type { ReactNode } from "react";

export const PRIVACY_LAST_UPDATED = "September 18, 2026";
export const PRIVACY_CONTACT_EMAIL = "augustin.briolon@gmail.com";

const INLINE_LINK_CLASS =
  "text-foreground underline underline-offset-4 outline-none hover:text-ember focus-visible:ring-2 focus-visible:ring-ring";

function PolicySection({ title, children, compact }: { title: string; children: ReactNode; compact?: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className={`font-semibold tracking-tight ${compact ? "text-base" : "text-lg"}`}>{title}</h2>
      <div
        className={`flex flex-col gap-3 text-muted-foreground ${compact ? "text-sm leading-relaxed" : "text-base leading-relaxed"}`}
      >
        {children}
      </div>
    </section>
  );
}

/** Shared privacy policy body used by the public page and the in-app dialog. */
export function PrivacyPolicy({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col ${compact ? "gap-6" : "gap-8"}`}>
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-[0.2em] text-ember uppercase">Last updated {PRIVACY_LAST_UPDATED}</p>
        {!compact && <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>}
        <p className={`text-muted-foreground ${compact ? "text-sm leading-relaxed" : "text-base leading-relaxed"}`}>
          Your runs reveal where you live and train. Planet Run keeps only what it needs to draw them on your globe,
          shows them to nobody but you, and lets you erase everything in one click.
        </p>
      </div>

      <PolicySection title="What we store" compact={compact}>
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

      <PolicySection title="How it is used" compact={compact}>
        <p>
          Your data is used for one purpose: showing your runs and totals on your own globe. It is not visible to other
          users, not sold, not used for advertising and not used to train AI models.
        </p>
      </PolicySection>

      <PolicySection title="Who processes it" compact={compact}>
        <p>
          Planet Run is hosted on Vercel and stores data in a managed PostgreSQL database run by Neon. Countries are
          computed on our servers without calling any external service. To detect which cities you have run in, we
          reverse-geocode a small number of run start points through OpenStreetMap Nominatim; those requests contain
          approximate coordinates, not your full routes. Street geometry for coverage comes from the OpenStreetMap
          Overpass API and is shared across athletes for the same city. Map backgrounds are loaded from CARTO: like any
          online map, tile requests reveal the area you are looking at, but not your runs.
        </p>
      </PolicySection>

      <PolicySection title="How long we keep it" compact={compact}>
        <p>
          Until you delete it. If you revoke Planet Run from your Strava settings, Strava notifies us and your data is
          deleted automatically.
        </p>
      </PolicySection>

      <PolicySection title="Deleting your data" compact={compact}>
        <p>
          Open the settings icon on your globe and choose <span className="text-foreground">Delete my data</span>. Your
          profile, runs and tokens are permanently erased and Planet Run&apos;s access to Strava is revoked. You can
          also revoke access at any time from{" "}
          <a href="https://www.strava.com/settings/apps" className={INLINE_LINK_CLASS}>
            strava.com/settings/apps
          </a>
          .
        </p>
      </PolicySection>

      <PolicySection title="Contact" compact={compact}>
        <p>
          Questions about your data, or a request you cannot complete in the app? Write to{" "}
          <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className={INLINE_LINK_CLASS}>
            {PRIVACY_CONTACT_EMAIL}
          </a>
          .
        </p>
      </PolicySection>
    </div>
  );
}
