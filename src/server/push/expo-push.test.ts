import { describe, expect, it } from "vitest";

import { analysisCompletePayload } from "./expo-push";

describe("analysisCompletePayload", () => {
  it("targets the Expo token with a finished-analysis copy", () => {
    expect(analysisCompletePayload("ExponentPushToken[abc]")).toEqual({
      to: "ExponentPushToken[abc]",
      title: "Your streets are ready",
      body: "All your runs are mapped. Open Cityfil to see your coverage.",
    });
  });
});
