import {
  bigint,
  bigserial,
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

type GeometryType = "LineString" | "MultiPolygon";

/** PostGIS geometry in WGS 84. Values are read and written with SQL functions, never as raw column data. */
const geometry = customType<{ data: string; config: { type: GeometryType } }>({
  dataType: (config) => `geometry(${config?.type ?? "Geometry"}, 4326)`,
});

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
    /** Null until the run has been matched against street segments; reset whenever the run changes. */
    coverageMatchedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [index().on(table.userId, table.startDate)],
);

/** Administrative area imported from OpenStreetMap (admin_level 8 = city). */
export const areas = pgTable(
  "areas",
  {
    osmRelationId: bigint({ mode: "number" }).primaryKey(),
    name: text().notNull(),
    adminLevel: smallint().notNull(),
    boundary: geometry({ type: "MultiPolygon" }).notNull(),
    streetLengthMeters: doublePrecision().notNull(),
    ...timestamps,
  },
  (table) => [index().using("gist", table.boundary)],
);

/** Runnable street pieces of equal length, clipped to the area they belong to. */
export const streetSegments = pgTable(
  "street_segments",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    areaId: bigint({ mode: "number" })
      .notNull()
      .references(() => areas.osmRelationId, { onDelete: "cascade" }),
    osmWayId: bigint({ mode: "number" }).notNull(),
    name: text(),
    highway: text().notNull(),
    path: geometry({ type: "LineString" }).notNull(),
    lengthMeters: doublePrecision().notNull(),
  },
  (table) => [index().using("gist", table.path), index().on(table.areaId)],
);

export const activityStreetSegments = pgTable(
  "activity_street_segments",
  {
    activityId: bigint({ mode: "number" })
      .notNull()
      .references(() => activities.stravaActivityId, { onDelete: "cascade" }),
    segmentId: bigint({ mode: "number" })
      .notNull()
      .references(() => streetSegments.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.activityId, table.segmentId] }), index().on(table.segmentId)],
);

export type User = typeof users.$inferSelect;
export type StravaAccount = typeof stravaAccounts.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
