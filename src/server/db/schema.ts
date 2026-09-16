import { bigint, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  displayName: text().notNull(),
  avatarUrl: text(),
  ...timestamps,
});

/**
 * One Strava athlete is bound to exactly one user and vice versa
 * (primary key on athlete, unique constraint on user).
 */
export const stravaAccounts = pgTable("strava_accounts", {
  athleteId: bigint({ mode: "number" }).primaryKey(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  accessTokenEncrypted: text().notNull(),
  refreshTokenEncrypted: text().notNull(),
  tokenExpiresAt: timestamp({ withTimezone: true }).notNull(),
  lastSyncedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const activities = pgTable(
  "activities",
  {
    stravaActivityId: bigint({ mode: "number" }).primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    sportType: text().notNull(),
    startDate: timestamp({ withTimezone: true }).notNull(),
    distanceMeters: doublePrecision().notNull(),
    movingTimeSeconds: integer().notNull(),
    elevationGainMeters: doublePrecision().notNull(),
    summaryPolyline: text().notNull(),
    ...timestamps,
  },
  (table) => [index().on(table.userId, table.startDate)],
);

export type User = typeof users.$inferSelect;
export type StravaAccount = typeof stravaAccounts.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
