import type { Activity } from "@/server/db/schema";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";

/** Records which activities were matched, without simulating actual street geometry. */
export function createInMemoryCoverageRepository(
  activityRows: Map<number, Activity>,
  now: () => Date = () => new Date(),
) {
  const matchCalls: Array<{ userId: string } | undefined> = [];

  const coverage: CoverageRepository = {
    async matchPendingActivities(scope) {
      matchCalls.push(scope);
      let matched = 0;
      for (const [id, activity] of activityRows) {
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
    async listCityCoverage() {
      return [];
    },
    async getCoveredStreets() {
      return { type: "FeatureCollection", features: [] };
    },
  };

  return { coverage, matchCalls };
}
