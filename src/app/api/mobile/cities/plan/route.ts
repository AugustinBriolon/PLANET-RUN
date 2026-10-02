import { NextResponse } from "next/server";
import { z } from "zod";

import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

const querySchema = z.object({
  areaId: z.coerce.number().int().positive(),
  distanceKm: z.coerce.number().min(2).max(30),
});

/**
 * Build a visible “run these uncovered streets” target for one city.
 * Packs unfinished segments near the uncovered cluster up to ~run distance.
 * Not a routed GPX yet — it is the conquest highlight layer athletes can see and chase.
 */
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

  const services = getServices();
  const cities = await services.coverage.listCityCoverage(userOrError.id);
  const city = cities.find((entry) => entry.areaId === parsed.data.areaId);
  if (!city) {
    return NextResponse.json({ error: "city_not_found" }, { status: 404 });
  }
  if (city.status !== "ready") {
    return NextResponse.json({ error: "city_pending" }, { status: 409 });
  }

  const share = toCoverageShare(city);
  const remainingMeters = Math.max(0, city.totalMeters - city.coveredMeters);
  const budgetMeters = parsed.data.distanceKm * 1000;
  const plan = await services.coverage.getRunPlanStreets(
    userOrError.id,
    city.areaId,
    budgetMeters,
  );
  const estimatedShareGain =
    city.totalMeters <= 0 ? 0 : Math.min(1 - (share ?? 0), plan.targetMeters / city.totalMeters);

  return NextResponse.json({
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
      estimatedShareGain,
      streets: plan.streets,
      note: "Highlighted streets are still uncovered and fit about one outing at your distance. Run that pocket to raise your conquest %.",
    },
  });
}
