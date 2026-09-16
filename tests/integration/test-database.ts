import { sql } from "drizzle-orm";

import { createDatabase } from "@/server/db/client";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://planet_run:planet_run@localhost:5433/planet_run_test";

export function createTestDatabase() {
  const database = createDatabase(TEST_DATABASE_URL);
  return {
    database,
    reset: () => database.execute(sql`TRUNCATE users, strava_accounts, activities CASCADE`),
    close: () => database.$client.end(),
  };
}
