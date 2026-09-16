import "server-only";

import { createTokenCipher } from "./crypto/token-cipher";
import { createDatabase, type Database } from "./db/client";
import { getServerEnv } from "./env";
import { createActivityRepository } from "./repositories/activity-repository";
import { createStravaAccountRepository } from "./repositories/strava-account-repository";
import { createUserRepository } from "./repositories/user-repository";
import { createAccountLinkingService } from "./services/account-linking-service";
import { createRunSyncService } from "./services/run-sync-service";
import { createStravaTokenService } from "./services/strava-token-service";
import { createStravaWebhookService } from "./services/strava-webhook-service";
import { createStravaClient } from "./strava/strava-client";

function buildServices(database: Database) {
  const env = getServerEnv();
  const now = () => new Date();

  const users = createUserRepository(database);
  const accounts = createStravaAccountRepository(database);
  const activities = createActivityRepository(database);
  const strava = createStravaClient({ clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET });
  const tokens = createStravaTokenService({
    accounts,
    strava,
    cipher: createTokenCipher(env.TOKEN_ENCRYPTION_KEY),
    now,
  });

  return {
    users,
    accounts,
    activities,
    accountLinking: createAccountLinkingService({ users, accounts, tokens }),
    runSync: createRunSyncService({ accounts, activities, strava, tokens, now }),
    stravaWebhook: createStravaWebhookService({ users, accounts, activities, strava, tokens }),
  };
}

type Services = ReturnType<typeof buildServices>;

// Only the connection pool survives hot reloads. Services are rebuilt with the reloaded modules,
// otherwise `instanceof` checks would compare against stale class definitions in development.
const globalForDatabase = globalThis as typeof globalThis & { planetRunDatabase?: Database };

let services: Services | undefined;

/** Composition root: the only place wiring concrete implementations together. */
export function getServices(): Services {
  globalForDatabase.planetRunDatabase ??= createDatabase(getServerEnv().DATABASE_URL);
  services ??= buildServices(globalForDatabase.planetRunDatabase);
  return services;
}
