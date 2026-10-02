import { NextResponse } from "next/server";

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
