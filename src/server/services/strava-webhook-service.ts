import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import type { UserRepository } from "@/server/repositories/user-repository";
import { StravaApiError, type StravaClient } from "@/server/strava/strava-client";
import { isMappableRun, toActivityRecord } from "@/server/strava/run-activity";
import type { StravaWebhookEvent } from "@/server/strava/strava-types";

import type { StravaTokenService } from "./strava-token-service";

export type StravaWebhookService = {
  handleEvent: (event: StravaWebhookEvent) => Promise<void>;
};

type Dependencies = {
  users: UserRepository;
  accounts: StravaAccountRepository;
  activities: ActivityRepository;
  strava: StravaClient;
  tokens: StravaTokenService;
  coverage: Pick<CoverageRepository, "matchPendingActivities">;
};

/**
 * Strava webhook payloads are not signed, so they are treated as hints only:
 * the actual state is always re-read from the Strava API before changing data.
 */
export function createStravaWebhookService({
  users,
  accounts,
  activities,
  strava,
  tokens,
  coverage,
}: Dependencies): StravaWebhookService {
  async function handleDeauthorization(athleteId: number) {
    const account = await accounts.findByAthleteId(athleteId);
    if (!account) return;
    if (await tokens.isAuthorizationRevoked(account)) {
      await users.delete(account.userId);
    }
  }

  async function reconcileActivity(athleteId: number, activityId: number) {
    const account = await accounts.findByAthleteId(athleteId);
    if (!account) return;

    const accessToken = await tokens.getValidAccessToken(account);
    try {
      const activity = await strava.getActivity(accessToken, activityId);
      // Public activities of other athletes are readable too: never import them.
      if (activity.athlete.id !== athleteId) return;
      if (isMappableRun(activity)) {
        await activities.upsertMany([toActivityRecord(activity, account.userId)]);
        // Best effort: street coverage is a supplementary feature, a failure here must not fail the webhook.
        await coverage.matchPendingActivities({ userId: account.userId }).catch((error: unknown) => {
          console.error(error);
        });
      } else {
        await activities.deleteForUser(account.userId, activityId);
      }
    } catch (error) {
      if (!(error instanceof StravaApiError && error.isNotFound)) throw error;
      await activities.deleteForUser(account.userId, activityId);
    }
  }

  return {
    async handleEvent(event) {
      if (event.object_type === "athlete") {
        if (event.updates?.authorized === "false") await handleDeauthorization(event.owner_id);
        return;
      }
      await reconcileActivity(event.owner_id, event.object_id);
    },
  };
}
