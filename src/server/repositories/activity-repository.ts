import { and, asc, eq, sql } from "drizzle-orm";

import type { Database } from "@/server/db/client";
import { activities, type Activity, type NewActivity } from "@/server/db/schema";

export type ActivityRepository = {
  listByUser: (userId: string) => Promise<Activity[]>;
  upsertMany: (records: NewActivity[]) => Promise<void>;
  deleteForUser: (userId: string, stravaActivityId: number) => Promise<void>;
};

export function createActivityRepository(database: Database): ActivityRepository {
  return {
    async listByUser(userId) {
      return database.query.activities.findMany({
        where: eq(activities.userId, userId),
        orderBy: asc(activities.startDate),
      });
    },
    async upsertMany(records) {
      if (records.length === 0) return;
      await database
        .insert(activities)
        .values(records)
        .onConflictDoUpdate({
          target: activities.stravaActivityId,
          set: {
            name: sql`excluded.name`,
            sportType: sql`excluded.sport_type`,
            startDate: sql`excluded.start_date`,
            distanceMeters: sql`excluded.distance_meters`,
            movingTimeSeconds: sql`excluded.moving_time_seconds`,
            elevationGainMeters: sql`excluded.elevation_gain_meters`,
            summaryPolyline: sql`excluded.summary_polyline`,
            // A changed trace (e.g. a cropped activity) must be matched against streets again.
            coverageMatchedAt: sql`CASE WHEN ${activities.summaryPolyline} = excluded.summary_polyline THEN ${activities.coverageMatchedAt} END`,
            updatedAt: new Date(),
          },
          // Never let a payload move an activity to another user.
          setWhere: sql`${activities.userId} = excluded.user_id`,
        });
    },
    async deleteForUser(userId, stravaActivityId) {
      await database
        .delete(activities)
        .where(and(eq(activities.userId, userId), eq(activities.stravaActivityId, stravaActivityId)));
    },
  };
}
