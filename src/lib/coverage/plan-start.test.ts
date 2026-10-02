import { describe, expect, it } from "vitest";

import { isPlanStartAllowed, PLAN_START_MAX_DISTANCE_METERS } from "./plan-start";

describe("isPlanStartAllowed", () => {
  it("allows starts inside the city or within the limit of its boundary", () => {
    expect(isPlanStartAllowed(0)).toBe(true);
    expect(isPlanStartAllowed(PLAN_START_MAX_DISTANCE_METERS)).toBe(true);
  });

  it("refuses starts beyond the limit or with an unknown distance", () => {
    expect(isPlanStartAllowed(PLAN_START_MAX_DISTANCE_METERS + 1)).toBe(false);
    expect(isPlanStartAllowed(Infinity)).toBe(false);
    expect(isPlanStartAllowed(Number.NaN)).toBe(false);
  });
});
