import { createDatabase } from "../src/server/db/client";
import { createCoverageRepository } from "../src/server/repositories/coverage-repository";

/**
 * Rematch all (or one user's) runs with `coverage_matched_at IS NULL`.
 * Use after migration 0007 or when the UI stays on "Matching…".
 *
 * Usage:
 *   DATABASE_URL=... pnpm exec tsx --env-file=.env.local scripts/rematch-coverage.ts
 *   DATABASE_URL=... pnpm exec tsx --env-file=.env.local scripts/rematch-coverage.ts --user-id=<uuid>
 */
async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL is required");

  const userArg = process.argv.find((arg) => arg.startsWith("--user-id="));
  const userId = userArg?.slice("--user-id=".length);
  if (userArg && !userId) throw new Error("Invalid --user-id value");

  const database = createDatabase(connectionUrl);
  const coverage = createCoverageRepository(database);
  const scope = userId ? { userId } : undefined;

  let total = 0;
  try {
    for (;;) {
      const matched = await coverage.matchPendingActivities(scope);
      total += matched;
      console.log(`Matched batch of ${matched} (total ${total})`);
      if (matched === 0) break;
    }
    console.log(`Done. Rematched ${total} run(s).`);
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
