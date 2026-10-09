import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CityfilLogo } from "@/components/brand/cityfil-logo";
import { PrivacyPolicy } from "@/components/privacy/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy · Cityfil",
  description: "What Cityfil stores about you, why, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-10 px-6 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))] sm:pt-[max(4rem,env(safe-area-inset-top,0px))] sm:pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex items-center justify-between gap-4">
        <CityfilLogo className="text-base" />
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
