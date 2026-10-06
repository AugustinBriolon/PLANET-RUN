import { formatPercent } from "@/lib/format";

/** Public invite card: coverage and vacant titles, never the names of title holders. */
export type InviteSharePreview = {
  inviterName: string;
  cityName: string;
  inviterShare: number | null;
  founderOpen: boolean;
  conquerorOpen: boolean;
  keeperOpen: boolean;
};

export type TitleChip = { name: "Founder" | "Conqueror" | "Keeper"; open: boolean };

export function inviteShareHeadline(preview: InviteSharePreview): string {
  return `${preview.inviterName} challenged you on ${preview.cityName}`;
}

export function inviteShareDescription(preview: InviteSharePreview): string {
  const share = preview.inviterShare == null ? "unmapped streets" : formatPercent(preview.inviterShare);
  const open = openTitleNames(preview);
  if (open.length === 0) {
    return `They're at ${share}. The titles are claimed — take the streets anyway.`;
  }
  return `They're at ${share}. ${open.join(" · ")} still open.`;
}

export function openTitleNames(preview: InviteSharePreview): string[] {
  return titleChips(preview)
    .filter((chip) => chip.open)
    .map((chip) => chip.name);
}

export function titleChips(preview: InviteSharePreview): TitleChip[] {
  return [
    { name: "Founder", open: preview.founderOpen },
    { name: "Conqueror", open: preview.conquerorOpen },
    { name: "Keeper", open: preview.keeperOpen },
  ];
}
