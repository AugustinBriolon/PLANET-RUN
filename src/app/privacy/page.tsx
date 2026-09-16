import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { PrivacyPolicy } from "@/components/privacy/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy · Planet Run",
  description: "What Planet Run stores about you, why, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-6 py-12 sm:py-16">
      <header className="flex items-center justify-between gap-4">
        <PlanetRunLogo className="text-base" />
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the globe
        </Link>
      </header>

      <PrivacyPolicy />
    </main>
  );
}
