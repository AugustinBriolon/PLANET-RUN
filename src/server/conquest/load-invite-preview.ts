import { isInviteToken } from "@/lib/conquest/invite";
import { getServices } from "@/server/services";
import type { InvitePreview } from "@/server/services/conquest-service";

export async function loadInvitePreview(token: string): Promise<InvitePreview | null> {
  if (!isInviteToken(token)) return null;
  return getServices().conquest.previewInvite(token);
}
