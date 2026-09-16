import { describe, expect, it } from "vitest";

import { getCoveredStreetsBounds, toCoverageShare, type CoveredStreets } from "./street-coverage";

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

describe("getCoveredStreetsBounds", () => {
  const streets: CoveredStreets = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { areaId: 10 },
        geometry: {
          type: "LineString",
          coordinates: [
            [2.2, 48.9],
            [2.3, 48.95],
          ],
        },
      },
      {
        type: "Feature",
        properties: { areaId: 99 },
        geometry: {
          type: "LineString",
          coordinates: [
            [0, 0],
            [1, 1],
          ],
        },
      },
    ],
  };

  it("returns the bbox of covered traces for one city", () => {
    expect(getCoveredStreetsBounds(streets, 10)).toEqual([
      [2.2, 48.9],
      [2.3, 48.95],
    ]);
  });

  it("returns null when the city has no covered streets", () => {
    expect(getCoveredStreetsBounds(streets, 7)).toBeNull();
  });
});
