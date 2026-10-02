/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { publicApiOrigin } from "./public-api-origin";

describe("publicApiOrigin", () => {
  it("prefers AUTH_URL when set", () => {
    const request = new Request("https://planet-neghusqat-augustin-briolons-projects.vercel.app/api/mobile/auth/strava");
    expect(publicApiOrigin(request, { AUTH_URL: "https://planet-run.vercel.app" })).toBe("https://planet-run.vercel.app");
  });

  it("uses the request host so production aliases win over VERCEL_URL", () => {
    const request = new Request("https://planet-run.vercel.app/api/mobile/auth/strava");
    expect(publicApiOrigin(request, { VERCEL_URL: "planet-neghusqat-augustin-briolons-projects.vercel.app" })).toBe(
      "https://planet-run.vercel.app",
    );
  });
});
