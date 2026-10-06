const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type AnalysisCompletePush = {
  to: string;
  title: string;
  body: string;
};

export function analysisCompletePayload(token: string): AnalysisCompletePush {
  return {
    to: token,
    title: "Your streets are ready",
    body: "All your runs are mapped. Open Cityfil to see your coverage.",
  };
}

/** Sends one Expo push. Failures are logged by the caller — never throw into the city pipeline. */
export async function sendExpoPush(message: AnalysisCompletePush): Promise<void> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`Expo push failed (${response.status})`);
  }
}
