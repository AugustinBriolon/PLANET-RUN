import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { getServices } from "@/server/services";

type PageProps = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export default async function InviteLandingPage({ params }: PageProps) {
  const { token } = await params;
  const preview = /^[a-f0-9]{32}$/.test(token) ? await getServices().conquest.previewInvite(token) : null;
  const appUrl = `planetrun://invite/${token}`;

  return (
    <main className="starfield relative flex min-h-dvh flex-col items-center justify-center px-6">
      <PlanetRunLogo className="absolute top-6 left-6 text-base" />
      <section className="glass-panel flex w-full max-w-md flex-col gap-5 rounded-xl p-8">
        <p className="font-mono text-xs tracking-[0.2em] text-ember uppercase">City rivalry</p>
        {preview ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              {preview.inviterName} invited you to conquer {preview.cityName}.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Open Planet Run to compare your streets on this city. New here? Install the app, sign in with Strava,
              then tap the invite again.
            </p>
            <a
              href={appUrl}
              className="flex min-h-12 items-center justify-center rounded-lg bg-ember text-sm font-semibold text-ember-foreground"
            >
              Open in Planet Run
            </a>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">This invite is no longer valid.</h1>
            <p className="text-sm text-muted-foreground">Ask your rival for a new link — they expire after 14 days.</p>
          </>
        )}
      </section>
    </main>
  );
}
