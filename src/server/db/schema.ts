import {
  bigint,
  bigserial,
  boolean,
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
  /** Public profiles appear on a city's hall of fame; private ones only to invited rivals. */
  profileVisibility: text().notNull().default("private"),
  /** Expo push token for "your streets are ready" when the first import finishes in the background. */
  expoPushToken: text(),
  /** Set while the first history + city analysis is in flight; cleared after the completion push. */
  analysisNotifyPending: boolean().notNull().default(false),
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
  /** Next Strava activity page to fetch during the first full-history import; null when idle. */
  historySyncPage: integer(),
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

/** Administrative area with street segments imported (costly; shared across athletes). */
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

/**
 * Cheap boundary-only city registry (no street segments). Used to discover cities without Nominatim
 * and to decide which heavy street imports to queue — keeps Neon storage focused on streets we need.
 */
export const cityCatalog = pgTable(
  "city_catalog",
  {
    osmRelationId: bigint({ mode: "number" }).primaryKey(),
    name: text().notNull(),
    adminLevel: smallint().notNull(),
    boundary: geometry({ type: "MultiPolygon" }).notNull(),
    ...timestamps,
  },
  (table) => [index().using("gist", table.boundary)],
);

/** Street pieces of equal length, clipped to the area they belong to. */
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
    /** False for pedestrian connectors used only to navigate run plans. */
    countsForCoverage: boolean("counts_for_coverage").notNull().default(true),
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

/**
 * Cities a runner has been detected in. Street geometry lives in the shared `areas` /
 * `street_segments` tables so a second athlete who runs the same city reuses that analysis.
 */
export const userCities = pgTable(
  "user_cities",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    osmRelationId: bigint({ mode: "number" }).notNull(),
    name: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.osmRelationId] }), index().on(table.osmRelationId)],
);

/** Grid cells whose start points were already reverse-geocoded for this user (success or miss). */
export const userGeocodeCells = pgTable(
  "user_geocode_cells",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cellKey: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.cellKey] })],
);

/** Global queue of cities whose streets still need to be fetched from Overpass into `areas`. */
export const cityImportQueue = pgTable("city_import_queue", {
  osmRelationId: bigint({ mode: "number" }).primaryKey(),
  name: text().notNull(),
  status: text().notNull().default("pending"),
  attempts: integer().notNull().default(0),
  lastError: text(),
  /** Higher values are imported first (this user's run count on that city). */
  priority: integer().notNull().default(0),
  ...timestamps,
});

/**
 * First time a runner reached 100% of a city's streets. Never updated: later runs
 * compete for Keeper / Conqueror without moving Founder.
 */
export const cityConquests = pgTable(
  "city_conquests",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    areaId: bigint({ mode: "number" }).notNull(),
    completedAt: timestamp({ withTimezone: true }).notNull(),
    completionDistanceMeters: doublePrecision().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.areaId] }), index().on(table.areaId, table.completedAt)],
);

/** One-time link to become rivals on a city. */
export const cityInvites = pgTable(
  "city_invites",
  {
    token: text().primaryKey(),
    inviterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    areaId: bigint({ mode: "number" }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.inviterId, table.areaId)],
);

/** Two runners who compare coverage on one city. userLow < userHigh. */
export const cityRivalries = pgTable(
  "city_rivalries",
  {
    areaId: bigint({ mode: "number" }).notNull(),
    userLow: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHigh: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.areaId, table.userLow, table.userHigh] })],
);

export type User = typeof users.$inferSelect;
export type StravaAccount = typeof stravaAccounts.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type UserCity = typeof userCities.$inferSelect;
export type CityConquest = typeof cityConquests.$inferSelect;
export type CityInvite = typeof cityInvites.$inferSelect;
