import { NextResponse } from "next/server";
import { z } from "zod";

import { parseProfileVisibility } from "@/lib/conquest/visibility";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

/** Authenticated snapshot for the mobile home / coverage screens. */
export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const services = getServices();
  const [cities, account, rematchPending] = await Promise.all([
    services.coverage.listCityCoverage(userOrError.id),
    services.accounts.findByUserId(userOrError.id),
    services.coverage.hasPendingMatch({ userId: userOrError.id }),
  ]);

  return NextResponse.json({
    user: {
      id: userOrError.id,
      displayName: userOrError.displayName,
      avatarUrl: userOrError.avatarUrl,
      profileVisibility: userOrError.profileVisibility,
    },
    sync: {
      historyComplete: Boolean(account?.lastSyncedAt),
      analysisPending: userOrError.analysisNotifyPending || rematchPending,
    },
    cities: cities.map((city) => ({
      areaId: city.areaId,
      name: city.name,
      status: city.status,
      share: toCoverageShare(city),
      coveredMeters: city.coveredMeters,
      totalMeters: city.totalMeters,
      bounds: city.bounds,
    })),
  });
}

const patchSchema = z
  .object({
    profileVisibility: z.enum(["public", "private"]).optional(),
    expoPushToken: z.string().min(8).nullable().optional(),
  })
  .refine((value) => value.profileVisibility !== undefined || value.expoPushToken !== undefined);

/** Update visibility and/or the Expo push token used when analysis finishes in the background. */
export async function PATCH(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const services = getServices();
  if (parsed.data.profileVisibility) {
    const visibility = parseProfileVisibility(parsed.data.profileVisibility);
    if (!visibility) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    await services.conquest.setVisibility(userOrError.id, visibility);
  }
  if (parsed.data.expoPushToken !== undefined) {
    await services.users.updatePushToken(userOrError.id, parsed.data.expoPushToken);
  }

  const user = await services.users.findById(userOrError.id);
  return NextResponse.json({
    profileVisibility: user?.profileVisibility ?? userOrError.profileVisibility,
    expoPushTokenRegistered: Boolean(user?.expoPushToken),
  });
}
