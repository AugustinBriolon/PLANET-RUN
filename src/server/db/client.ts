import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema> & { $client: Sql };

export function createDatabase(connectionUrl: string): Database {
  return drizzle({ connection: connectionUrl, schema, casing: "snake_case" });
}
