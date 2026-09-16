import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createTestDatabase } from "./test-database";

export default async function setup() {
  const { database, close } = createTestDatabase();
  try {
    await migrate(database, { migrationsFolder: "drizzle" });
  } finally {
    await close();
  }
}
