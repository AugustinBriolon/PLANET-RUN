import type { UserRepository } from "@/server/repositories/user-repository";
import { analysisCompletePayload, sendExpoPush } from "@/server/push/expo-push";

export type AnalysisNotifyService = {
  /** Sends the completion push once, then clears the pending flag even if there is no token. */
  notifyIfPending: (userId: string) => Promise<"sent" | "cleared" | "skipped">;
};

export function createAnalysisNotifyService({
  users,
}: {
  users: Pick<UserRepository, "findById" | "setAnalysisNotifyPending">;
}): AnalysisNotifyService {
  return {
    async notifyIfPending(userId) {
      const user = await users.findById(userId);
      if (!user?.analysisNotifyPending) return "skipped";

      if (user.expoPushToken) {
        try {
          await sendExpoPush(analysisCompletePayload(user.expoPushToken));
          await users.setAnalysisNotifyPending(userId, false);
          return "sent";
        } catch (error) {
          console.error("Analysis complete push failed", error);
          await users.setAnalysisNotifyPending(userId, false);
          return "cleared";
        }
      }

      await users.setAnalysisNotifyPending(userId, false);
      return "cleared";
    },
  };
}
