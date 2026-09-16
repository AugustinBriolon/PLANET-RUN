import Image from "next/image";

import { SettingsMenu } from "./settings-menu";

// Official "Powered by Strava" logo from the Strava API brand guidelines, shown unaltered.
const POWERED_BY_STRAVA = { src: "/brand/strava/powered-by-strava-white.svg", width: 365, height: 37 };

export type PanelFooterProps = {
  signOutAction: () => Promise<void>;
  deleteDataAction: () => Promise<void>;
};

/** Strava attribution and account settings, shared by every dashboard panel. */
export function PanelFooter({ signOutAction, deleteDataAction }: PanelFooterProps) {
  return (
    <footer className="mt-5 flex items-center justify-between border-t border-border pt-3">
      <Image {...POWERED_BY_STRAVA} alt="Powered by Strava" className="h-3 w-auto" />
      <SettingsMenu signOutAction={signOutAction} deleteDataAction={deleteDataAction} />
    </footer>
  );
}
