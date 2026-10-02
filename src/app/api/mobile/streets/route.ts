import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

/**
 * Covered street geometries for the mobile globe (ember lines over the basemap).
 * Optional `areaId` trims the payload when the athlete focuses one city.
 */
export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const url = new URL(request.url);
  const areaParam = url.searchParams.get("areaId");
  const areaId = areaParam ? Number(areaParam) : null;

  const streets = await getServices().coverage.getCoveredStreets(userOrError.id);
  if (areaId == null || !Number.isFinite(areaId)) {
    return NextResponse.json(streets);
  }

  return NextResponse.json({
    type: "FeatureCollection",
    features: streets.features.filter((feature) => feature.properties.areaId === areaId),
  });
}
