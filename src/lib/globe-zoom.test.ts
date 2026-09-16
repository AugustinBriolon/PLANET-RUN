import { describe, expect, it } from "vitest";

import { getGlobeZoomToFit } from "./globe-zoom";

describe("getGlobeZoomToFit", () => {
  it("zooms out on small containers", () => {
    expect(getGlobeZoomToFit(375, 373)).toBeLessThan(getGlobeZoomToFit(1000, 900));
  });

  it("depends on the smallest side only", () => {
    expect(getGlobeZoomToFit(2000, 600)).toBe(getGlobeZoomToFit(600, 600));
  });

  it("doubles the zoom-level diameter for a container twice as large", () => {
    expect(getGlobeZoomToFit(1304, 1304, 0.5) - getGlobeZoomToFit(652, 652, 0.5)).toBeCloseTo(1);
  });
});
