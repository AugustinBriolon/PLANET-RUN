import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AttributionInfo } from "./attribution-info";

// Official "Powered by Strava" logo from the Strava API brand guidelines, shown unaltered.
const POWERED_BY_STRAVA = { src: "/brand/strava/powered-by-strava-white.svg", width: 365, height: 37 };

/** Strava attribution, map data attribution and a link to the settings page. */
export function PanelFooter() {
  return (
    <footer className="mt-3 flex items-center justify-between border-t border-border pt-2.5 sm:mt-4 sm:pt-3">
      <Image {...POWERED_BY_STRAVA} alt="Powered by Strava" className="h-3 w-auto" />
      <div className="flex items-center gap-2">
        <AttributionInfo />
        <Link
          href="/settings"
          aria-label="Settings"
          className="group -m-1.5 flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Settings
            className="size-4 transition-transform duration-300 ease-out group-hover:rotate-45"
            aria-hidden="true"
          />
        </Link>
      </div>
    </footer>
  );
}
