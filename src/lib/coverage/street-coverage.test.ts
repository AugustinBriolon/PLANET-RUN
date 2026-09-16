import { describe, expect, it } from "vitest";

import { toCoverageShare } from "./street-coverage";

const city = { areaId: 1, name: "Colombes" };

describe("toCoverageShare", () => {
  it("divides covered street length by the city's total", () => {
    expect(toCoverageShare({ ...city, coveredMeters: 250, totalMeters: 1000 })).toBe(0.25);
  });

  it("stays within 0 and 1 even with inconsistent totals", () => {
    expect(toCoverageShare({ ...city, coveredMeters: 1200, totalMeters: 1000 })).toBe(1);
    expect(toCoverageShare({ ...city, coveredMeters: 10, totalMeters: 0 })).toBe(0);
  });
});
