import { NextResponse } from "next/server";
import { z } from "zod";

import { isPlanStartAllowed, PLAN_START_MAX_DISTANCE_METERS } from "@/lib/coverage/plan-start";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

const querySchema = z
  .object({
    areaId: z.coerce.number().int().positive(),
    distanceKm: z.coerce.number().min(2).max(30),
    /** Changes the start among nearby unfinished streets on regenerate. */
    salt: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
    startLat: z.coerce.number().min(-90).max(90).optional(),
    startLng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((query) => (query.startLat == null) === (query.startLng == null), {
    message: "startLat and startLng go together",
  });

/**
 * Build a continuous run route for one city: unfinished streets chained into one path.
 * Distance is a soft preference (±15–20%); walkability beats matching the km exactly.
 */
export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    areaId: url.searchParams.get("areaId"),
    distanceKm: url.searchParams.get("distanceKm"),
    salt: url.searchParams.get("salt") ?? undefined,
    startLat: url.searchParams.get("startLat") ?? undefined,
    startLng: url.searchParams.get("startLng") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const services = getServices();
  const cities = await services.coverage.listCityCoverage(userOrError.id);
  const city = cities.find((entry) => entry.areaId === parsed.data.areaId);
  if (!city) {
    return NextResponse.json({ error: "city_not_found" }, { status: 404 });
  }
  if (city.status !== "ready") {
    return NextResponse.json({ error: "city_pending" }, { status: 409 });
  }

  const { startLat, startLng } = parsed.data;
  const start = startLat != null && startLng != null ? { lat: startLat, lng: startLng } : undefined;
  if (start) {
    const distances = await services.coverage.listCityDistances(userOrError.id, start);
    const distanceMeters = distances.get(city.areaId) ?? Infinity;
    if (!isPlanStartAllowed(distanceMeters)) {
      return NextResponse.json(
        {
          error: "start_too_far",
          distanceMeters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : null,
          maxMeters: PLAN_START_MAX_DISTANCE_METERS,
        },
        { status: 422 },
      );
    }
  }

  const share = toCoverageShare(city);
  const remainingMeters = Math.max(0, city.totalMeters - city.coveredMeters);
  const budgetMeters = parsed.data.distanceKm * 1000;
  const plan = await services.coverage.getRunPlanStreets(userOrError.id, city.areaId, budgetMeters, {
    salt: parsed.data.salt,
    start,
  });
  const estimatedShareGain =
    city.totalMeters <= 0 ? 0 : Math.min(1 - (share ?? 0), plan.targetMeters / city.totalMeters);

  return NextResponse.json(
    {
      city: {
        areaId: city.areaId,
        name: city.name,
        share,
        coveredMeters: city.coveredMeters,
        totalMeters: city.totalMeters,
        remainingMeters,
        bounds: city.bounds,
      },
      preference: { distanceKm: parsed.data.distanceKm },
      plan: {
        targetMeters: Math.round(plan.targetMeters),
        targetKm: Math.round((plan.targetMeters / 1000) * 10) / 10,
        pathMeters: Math.round(plan.pathMeters),
        pathKm: Math.round((plan.pathMeters / 1000) * 10) / 10,
        jumpCount: plan.jumpCount,
        jumpMeters: Math.round(plan.jumpMeters),
        estimatedShareGain,
        startsFromPosition: start != null,
        streets: plan.streets,
        note: "Follow the gold route on unfinished streets. Gray links are walkable connectors that do not add coverage. The path stays on the street network (no shortcuts through blocks). Distance is approximate.",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
