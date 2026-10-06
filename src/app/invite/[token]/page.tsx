import type { Metadata } from "next";

import { CityfilLogo } from "@/components/brand/cityfil-logo";
import { formatPercent } from "@/lib/format";
import { inviteShareDescription, inviteShareHeadline, titleChips } from "@/lib/conquest/invite-share-card";
import { loadInvitePreview } from "@/server/conquest/load-invite-preview";

type PageProps = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const preview = await loadInvitePreview(token);
  if (!preview) {
    return {
      title: "Invite expired — Cityfil",
      description: "Ask your rival for a new 14-day link.",
      robots: { index: false, follow: false },
    };
  }
  const title = inviteShareHeadline(preview);
  const description = inviteShareDescription(preview);
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, siteName: "Cityfil", type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function InviteLandingPage({ params }: PageProps) {
  const { token } = await params;
  const preview = await loadInvitePreview(token);
  const appUrl = `cityfil://invite/${token}`;

  return (
    <main className="starfield relative flex min-h-dvh flex-col items-center justify-center px-6">
      <CityfilLogo className="absolute top-6 left-6 text-base" />
      <section className="glass-panel flex w-full max-w-md flex-col gap-5 rounded-xl p-8">
        <p className="font-mono text-xs tracking-[0.2em] text-ember uppercase">City rivalry</p>
        {preview ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">{inviteShareHeadline(preview)}</h1>
            <p className="text-4xl font-semibold tracking-tight text-ember">
              {preview.inviterShare == null ? "—" : formatPercent(preview.inviterShare)}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{inviteShareDescription(preview)}</p>
            <ul className="flex flex-wrap gap-2">
              {titleChips(preview).map((chip) => (
                <li
                  key={chip.name}
                  className={
                    chip.open
                      ? "rounded-full bg-ember/15 px-3 py-1 text-xs font-semibold text-ember"
                      : "rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {chip.name} {chip.open ? "open" : "claimed"}
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Open Cityfil to compare your streets on this city. New here? Install the app, sign in with Strava, then
              tap the invite again.
            </p>
            <a
              href={appUrl}
              className="flex min-h-12 items-center justify-center rounded-lg bg-ember text-sm font-semibold text-ember-foreground"
            >
              Open in Cityfil
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
