import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "../src/server/db/client";

async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL is not set");

  const database = createDatabase(connectionUrl);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.$client.end();
  console.log("Migrations applied");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
