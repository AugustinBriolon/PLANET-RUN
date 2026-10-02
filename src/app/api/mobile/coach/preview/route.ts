import { NextResponse } from "next/server";
import { z } from "zod";

import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

/**
 * Rough coach preview: how many preferred-distance runs to finish remaining streets,
 * assuming ~40% of run distance covers new street length (sidewalks, doubling back, etc.).
 */
const NEW_STREET_EFFICIENCY = 0.4;

const querySchema = z.object({
  areaId: z.coerce.number().int().positive(),
  distanceKm: z.coerce.number().min(2).max(30),
});

export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    areaId: url.searchParams.get("areaId"),
    distanceKm: url.searchParams.get("distanceKm"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const cities = await getServices().coverage.listCityCoverage(userOrError.id);
  const city = cities.find((entry) => entry.areaId === parsed.data.areaId);
  if (!city) {
    return NextResponse.json({ error: "city_not_found" }, { status: 404 });
  }

  const share = toCoverageShare(city);
  const remainingMeters = Math.max(0, city.totalMeters - city.coveredMeters);
  const budgetMeters = parsed.data.distanceKm * 1000;
  const newMetersPerRun = budgetMeters * NEW_STREET_EFFICIENCY;
  const estimatedRuns =
    city.status !== "ready" || remainingMeters <= 0 || newMetersPerRun <= 0
      ? null
      : Math.max(1, Math.ceil(remainingMeters / newMetersPerRun));
  const estimatedShareGain =
    city.status !== "ready" || city.totalMeters <= 0
      ? null
      : Math.min(1 - (share ?? 0), newMetersPerRun / city.totalMeters);

  return NextResponse.json({
    city: {
      areaId: city.areaId,
      name: city.name,
      status: city.status,
      share,
      coveredMeters: city.coveredMeters,
      totalMeters: city.totalMeters,
      remainingMeters,
    },
    preference: { distanceKm: parsed.data.distanceKm },
    estimate: {
      newMetersPerRun: Math.round(newMetersPerRun),
      estimatedRuns,
      estimatedShareGain,
      note: "Heuristic until the route graph lands — assumes 40% of the run covers new streets.",
    },
  });
}
