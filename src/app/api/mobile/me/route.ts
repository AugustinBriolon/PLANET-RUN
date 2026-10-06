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
  const cities = await services.coverage.listCityCoverage(userOrError.id);

  return NextResponse.json({
    user: {
      id: userOrError.id,
      displayName: userOrError.displayName,
      avatarUrl: userOrError.avatarUrl,
      profileVisibility: userOrError.profileVisibility,
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

const patchSchema = z.object({
  profileVisibility: z.enum(["public", "private"]),
});

/** Update the signed-in runner's hall-of-fame visibility. */
export async function PATCH(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  const visibility = parsed.success ? parseProfileVisibility(parsed.data.profileVisibility) : null;
  if (!visibility) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  await getServices().conquest.setVisibility(userOrError.id, visibility);
  return NextResponse.json({ profileVisibility: visibility });
}
