import { NextResponse } from "next/server";
import { z } from "zod";

import { PLAN_START_MAX_DISTANCE_METERS } from "@/lib/coverage/plan-start";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * The athlete's cities ordered by distance from a position (0 when inside the boundary),
 * plus the limit within which a run plan may start from that position.
 */
export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    lat: url.searchParams.get("lat"),
    lng: url.searchParams.get("lng"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const { coverage } = getServices();
  const [cities, distances] = await Promise.all([
    coverage.listCityCoverage(userOrError.id),
    coverage.listCityDistances(userOrError.id, parsed.data),
  ]);

  const nearby = cities
    .flatMap((city) => {
      const distanceMeters = distances.get(city.areaId);
      if (distanceMeters == null) return [];
      return [
        {
          areaId: city.areaId,
          name: city.name,
          status: city.status,
          share: toCoverageShare(city),
          distanceMeters: Math.round(distanceMeters),
        },
      ];
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return NextResponse.json(
    { planStartMaxMeters: PLAN_START_MAX_DISTANCE_METERS, cities: nearby },
    { headers: { "Cache-Control": "no-store" } },
  );
}
