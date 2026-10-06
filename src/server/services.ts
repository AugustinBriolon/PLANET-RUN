import "server-only";

import { createTokenCipher } from "./crypto/token-cipher";
import { createDatabase, type Database } from "./db/client";
import { getServerEnv } from "./env";
import { createNominatimClient } from "./osm/nominatim-client";
import { createOverpassClient } from "./osm/overpass-client";
import { createActivityRepository } from "./repositories/activity-repository";
import { createAreaRepository } from "./repositories/area-repository";
import { createCityCatalogRepository } from "./repositories/city-catalog-repository";
import { createCityImportQueueRepository } from "./repositories/city-import-queue-repository";
import { createConquestRepository } from "./repositories/conquest-repository";
import { createCoverageRepository } from "./repositories/coverage-repository";
import { createStravaAccountRepository } from "./repositories/strava-account-repository";
import { createUserCityRepository } from "./repositories/user-city-repository";
import { createUserRepository } from "./repositories/user-repository";
import { createAnalysisNotifyService } from "./services/analysis-notify-service";
import { createAccountDeletionService } from "./services/account-deletion-service";
import { createAccountLinkingService } from "./services/account-linking-service";
import { createCityDetectionService } from "./services/city-detection-service";
import { createCityImportQueueService } from "./services/city-import-queue-service";
import { createConquestService } from "./services/conquest-service";
import { createRunSyncService } from "./services/run-sync-service";
import { createRunUploadService } from "./services/run-upload-service";
import { createStravaTokenService } from "./services/strava-token-service";
import { createStravaWebhookService } from "./services/strava-webhook-service";
import { createStravaClient } from "./strava/strava-client";

function buildServices(database: Database) {
  const env = getServerEnv();
  const now = () => new Date();

  const users = createUserRepository(database);
  const accounts = createStravaAccountRepository(database);
  const activities = createActivityRepository(database);
  const areas = createAreaRepository(database);
  const catalog = createCityCatalogRepository(database);
  const coverage = createCoverageRepository(database);
  const conquests = createConquestRepository(database);
  const userCities = createUserCityRepository(database);
  const importQueue = createCityImportQueueRepository(database);
  const nominatim = createNominatimClient();
  const overpass = createOverpassClient();
  const strava = createStravaClient({ clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET });
  const tokens = createStravaTokenService({
    accounts,
    strava,
    cipher: createTokenCipher(env.TOKEN_ENCRYPTION_KEY),
    now,
  });
  const stravaWebhook = createStravaWebhookService({ users, accounts, activities, strava, tokens, coverage });

  return {
    users,
    accounts,
    activities,
    areas,
    catalog,
    coverage,
    userCities,
    conquest: createConquestService({ users, userCities, coverage, conquests }),
    strava,
    cityDetection: createCityDetectionService({
      activities,
      areas,
      catalog,
      userCities,
      importQueue,
      coverage,
      nominatim,
    }),
    cityImportQueue: createCityImportQueueService({ areas, importQueue, overpass, coverage }),
    analysisNotify: createAnalysisNotifyService({ users }),
    accountLinking: createAccountLinkingService({ users, accounts, tokens }),
    accountDeletion: createAccountDeletionService({ users, accounts, strava, tokens, reportError: console.error }),
    runSync: createRunSyncService({
      accounts,
      activities,
      strava,
      tokens,
      coverage,
      users,
      now,
    }),
    stravaWebhook,
    runUpload: createRunUploadService({
      accounts,
      strava,
      tokens,
      importActivity: stravaWebhook.reconcileActivity,
    }),
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
