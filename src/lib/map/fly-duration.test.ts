import { describe, expect, it } from "vitest";

import { angularDistanceDegrees, boundsCenter, flyDurationMs } from "./fly-duration";

describe("flyDurationMs", () => {
  it("returns 0 when the user prefers reduced motion", () => {
    expect(flyDurationMs(10, { reducedMotion: true })).toBe(0);
  });

  it("uses the minimum duration for a local hop", () => {
    expect(flyDurationMs(0)).toBe(600);
    expect(flyDurationMs(0.01)).toBeGreaterThanOrEqual(600);
  });

  it("scales up with distance and clamps at the maximum", () => {
    const near = flyDurationMs(1);
    const far = flyDurationMs(8);
    const farther = flyDurationMs(20);
    expect(near).toBeGreaterThan(600);
    expect(near).toBeLessThan(far);
    expect(far).toBe(2500);
    expect(farther).toBe(2500);
  });
});

describe("angularDistanceDegrees", () => {
  it("measures separation between two points", () => {
    expect(angularDistanceDegrees({ lng: 2, lat: 48 }, { lng: 2, lat: 49 })).toBe(1);
  });
});

describe("boundsCenter", () => {
  it("returns the midpoint of a bbox", () => {
    expect(
      boundsCenter([
        [2, 48],
        [4, 50],
      ]),
    ).toEqual({ lng: 3, lat: 49 });
  });
});
