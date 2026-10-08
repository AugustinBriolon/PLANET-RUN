"use server";

import type { CoveredStreets } from "@/lib/coverage/street-coverage";
import { NO_COVERED_STREETS } from "@/lib/coverage/street-coverage";
import { getServices } from "@/server/services";
import { getCurrentUser } from "@/server/session";

/** Loads unfinished street geometry for one city (mobile and web city detail). */
export async function getUncoveredStreetsAction(areaId: number): Promise<CoveredStreets> {
  const user = await getCurrentUser();
  if (!user || !Number.isFinite(areaId)) return NO_COVERED_STREETS;
  return getServices().coverage.getUncoveredStreets(user.id, areaId);
}
