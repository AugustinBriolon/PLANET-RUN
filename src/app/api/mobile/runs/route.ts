import { NextResponse } from "next/server";

import { getTracesBounds, toRunStartPoints, toRunTraces } from "@/lib/runs/run-geojson";
import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { toRunSummary } from "@/server/runs/to-run-summary";
import { getServices } from "@/server/services";

/** All of the athlete's run traces as GeoJSON for the mobile globe. */
export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const activities = await getServices().activities.listByUser(userOrError.id);
  const runs = activities.map(toRunSummary);
  const traces = toRunTraces(runs);
  const startPoints = toRunStartPoints(traces);

  return NextResponse.json({
    runCount: runs.length,
    traces,
    startPoints,
    bounds: getTracesBounds(traces),
  });
}
