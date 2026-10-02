import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

/**
 * Covered and/or uncovered street geometries for the mobile conquest map.
 * `kind=covered|uncovered|both` (default both when areaId set; covered-only when global).
 */
export async function GET(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const url = new URL(request.url);
  const areaParam = url.searchParams.get("areaId");
  const areaId = areaParam ? Number(areaParam) : null;
  const kind = url.searchParams.get("kind") ?? (areaId != null ? "both" : "covered");

  const coverage = getServices().coverage;
  const covered = await coverage.getCoveredStreets(userOrError.id);
  const coveredFiltered =
    areaId != null && Number.isFinite(areaId)
      ? {
          type: "FeatureCollection" as const,
          features: covered.features.filter((feature) => feature.properties.areaId === areaId),
        }
      : covered;

  if (kind === "covered") {
    return NextResponse.json({ covered: coveredFiltered, uncovered: { type: "FeatureCollection", features: [] } });
  }

  if (areaId == null || !Number.isFinite(areaId)) {
    return NextResponse.json(
      { error: "areaId_required_for_uncovered" },
      { status: 400 },
    );
  }

  const uncovered = await coverage.getUncoveredStreets(userOrError.id, areaId);
  if (kind === "uncovered") {
    return NextResponse.json({ covered: { type: "FeatureCollection", features: [] }, uncovered });
  }

  return NextResponse.json({ covered: coveredFiltered, uncovered });
}
