import { describe, expect, it } from "vitest";

import { getCoveredStreetsBounds, toCoverageShare, type CoveredStreets } from "./street-coverage";

const city = { areaId: 1, name: "Colombes", status: "ready" as const };

describe("toCoverageShare", () => {
  it("divides covered street length by the city's total", () => {
    expect(toCoverageShare({ ...city, coveredMeters: 250, totalMeters: 1000 })).toBe(0.25);
  });

  it("clamps to [0, 1] and treats an empty city as zero", () => {
    expect(toCoverageShare({ ...city, coveredMeters: 1200, totalMeters: 1000 })).toBe(1);
    expect(toCoverageShare({ ...city, coveredMeters: 10, totalMeters: 0 })).toBe(null);
  });

  it("returns null while street analysis is still pending", () => {
    expect(toCoverageShare({ ...city, status: "pending", coveredMeters: 0, totalMeters: 0 })).toBe(null);
  });
});

describe("getCoveredStreetsBounds", () => {
  const streets: CoveredStreets = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { areaId: 1 },
        geometry: {
          type: "LineString",
          coordinates: [
            [2.0, 48.0],
            [2.1, 48.1],
          ],
        },
      },
    ],
  };

  it("returns the bounding box of covered streets for one city", () => {
    expect(getCoveredStreetsBounds(streets, 1)).toEqual([
      [2.0, 48.0],
      [2.1, 48.1],
    ]);
  });

  it("returns null when the city has no covered streets", () => {
    expect(getCoveredStreetsBounds(streets, 99)).toBeNull();
  });
});
