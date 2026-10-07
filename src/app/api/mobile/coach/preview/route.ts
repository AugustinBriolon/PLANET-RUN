import { NextResponse } from "next/server";
import { z } from "zod";

import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

/**
 * Coach preview + focus point for the next outing.
 * Full street-graph routing is still upcoming; this returns actionable advice:
 * remaining distance, estimated sessions, and a lat/lng in the uncovered cluster.
 */
const NEW_STREET_EFFICIENCY = 0.4;
/** Assumed easy-run pace for time estimates (min / km). */
const PACE_MIN_PER_KM = 6;

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

  const services = getServices();
  const cities = await services.coverage.listCityCoverage(userOrError.id);
  const city = cities.find((entry) => entry.areaId === parsed.data.areaId);
  if (!city) {
    return NextResponse.json({ error: "city_not_found" }, { status: 404 });
  }

  const share = toCoverageShare(city);
  const remainingMeters = Math.max(0, city.totalMeters - city.coveredMeters);
  const remainingKm = remainingMeters / 1000;
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
  const estimatedMinutesPerRun = Math.round(parsed.data.distanceKm * PACE_MIN_PER_KM);

  const focus =
    city.status === "ready" && remainingMeters > 0
      ? await services.coverage.getUncoveredFocus(userOrError.id, city.areaId)
      : null;

  const tips: string[] = [];
  if (city.status === "pending") {
    tips.push("Street import is still running for this city — sync again in a bit.");
  } else if (city.status === "matching") {
    tips.push("Streets are in; run matching is still catching up — pull to refresh shortly.");
  } else if (remainingMeters <= 0) {
    tips.push("This city looks fully covered at the current matching rules. Pick another city or sync new runs.");
  } else {
    tips.push(
      `~${remainingKm.toFixed(1)} km of streets left. Aim for loops that stay on new blocks instead of commuting on covered avenues.`,
    );
    if ((share ?? 0) < 0.25) {
      tips.push("Early coverage: explore a new neighborhood each outing rather than re-running the same park loop.");
    } else if ((share ?? 0) > 0.7) {
      tips.push("Late-game: short hops between leftover pockets beat one long out-and-back.");
    }
    if (focus) {
      tips.push("Open the focus pin in Maps, then freestyle a loop that fans out from there.");
    }
  }

  return NextResponse.json({
    city: {
      areaId: city.areaId,
      name: city.name,
      status: city.status,
      share,
      coveredMeters: city.coveredMeters,
      totalMeters: city.totalMeters,
      remainingMeters,
      remainingKm: Math.round(remainingKm * 10) / 10,
      bounds: city.bounds,
    },
    preference: { distanceKm: parsed.data.distanceKm },
    estimate: {
      newMetersPerRun: Math.round(newMetersPerRun),
      estimatedRuns,
      estimatedShareGain,
      estimatedMinutesPerRun,
      note: "Assumes ~40% of each run covers new streets until the route graph can propose a polyline.",
    },
    advice: {
      tips,
      focus: focus ? { lng: focus[0], lat: focus[1] } : null,
    },
  });
}
