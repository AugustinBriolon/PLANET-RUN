import { SettingsMenu } from "./settings-menu";

export type PanelFooterProps = {
  deleteDataAction: () => Promise<void>;
};

/** Strava attribution and account settings, shared by every dashboard panel. */
export function PanelFooter({ deleteDataAction }: PanelFooterProps) {
  return (
    <footer className="mt-5 flex items-center justify-between border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">Powered by Strava</p>
      <SettingsMenu deleteDataAction={deleteDataAction} />
    </footer>
  );
}
