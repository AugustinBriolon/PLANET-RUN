import type { Activity } from "@/server/db/schema";
import {
  MATCH_ACTIVITY_BATCH_SIZE,
  type CoverageRepository,
} from "@/server/repositories/coverage-repository";

/** Records which activities were matched, without simulating actual street geometry. */
export function createInMemoryCoverageRepository(
  activityRows: Map<number, Activity>,
  now: () => Date = () => new Date(),
) {
  const matchCalls: Array<{ userId: string } | undefined> = [];

  const coverage: CoverageRepository = {
    async hasPendingMatch(scope) {
      for (const activity of activityRows.values()) {
        if (activity.coverageMatchedAt) continue;
        if (scope && activity.userId !== scope.userId) continue;
        return true;
      }
      return false;
    },
    async matchPendingActivities(scope) {
      matchCalls.push(scope);
      let matched = 0;
      for (const [id, activity] of activityRows) {
        if (matched >= MATCH_ACTIVITY_BATCH_SIZE) break;
        if (activity.coverageMatchedAt) continue;
        if (scope && activity.userId !== scope.userId) continue;
        activityRows.set(id, { ...activity, coverageMatchedAt: now() });
        matched++;
      }
      return matched;
    },
    async markAllActivitiesPending() {
      for (const [id, activity] of activityRows) activityRows.set(id, { ...activity, coverageMatchedAt: null });
    },
    async markActivitiesPendingForArea() {
      // In-memory fake has no segment graph; treat like a full rematch request.
      for (const [id, activity] of activityRows) activityRows.set(id, { ...activity, coverageMatchedAt: null });
    },
    async listCityCoverage() {
      return [];
    },
    async getCoveredStreets() {
      return { type: "FeatureCollection", features: [] };
    },
    async getUncoveredFocus() {
      return null;
    },
    async listActivityIdsInArea() {
      return new Set<number>();
    },
    async getUncoveredStreets() {
      return { type: "FeatureCollection", features: [] };
    },
    async listCityDistances() {
      return new Map<number, number>();
    },
    async getRunPlanStreets() {
      return {
        streets: { type: "FeatureCollection", features: [] },
        targetMeters: 0,
        pathMeters: 0,
        startsFromPosition: false,
        jumpCount: 0,
        jumpMeters: 0,
      };
    },
    async sumActivityDistanceInArea() {
      return 0;
    },
    async listSeasonCoveredMeters() {
      return [];
    },
  };

  return { coverage, matchCalls };
}
