import Image from "next/image";

import { AttributionInfo } from "./attribution-info";
import { SettingsMenu } from "./settings-menu";

// Official "Powered by Strava" logo from the Strava API brand guidelines, shown unaltered.
const POWERED_BY_STRAVA = { src: "/brand/strava/powered-by-strava-white.svg", width: 365, height: 37 };

export type PanelFooterProps = {
  signOutAction: () => Promise<void>;
  deleteDataAction: () => Promise<void>;
};

/** Strava attribution, map data attribution and account settings, shared by every dashboard panel. */
export function PanelFooter({ signOutAction, deleteDataAction }: PanelFooterProps) {
  return (
    <footer className="mt-3 flex items-center justify-between border-t border-border pt-2.5 sm:mt-4 sm:pt-3">
      <Image {...POWERED_BY_STRAVA} alt="Powered by Strava" className="h-3 w-auto" />
      <div className="flex items-center gap-2">
        <AttributionInfo />
        <SettingsMenu signOutAction={signOutAction} deleteDataAction={deleteDataAction} />
      </div>
    </footer>
  );
}
