import { describe, expect, it } from "vitest";

import { clusterPointsByGrid } from "./cluster-points";

describe("clusterPointsByGrid", () => {
  it("keeps a single representative for points in the same ~1 km cell", () => {
    expect(
      clusterPointsByGrid([
        { lat: 48.922, lon: 2.252 },
        { lat: 48.923, lon: 2.253 },
        { lat: 48.9215, lon: 2.251 },
      ]),
    ).toEqual([{ lat: 48.922, lon: 2.252 }]);
  });

  it("keeps separate representatives when points fall in different cells", () => {
    expect(
      clusterPointsByGrid([
        { lat: 48.92, lon: 2.25 },
        { lat: 48.95, lon: 2.35 },
      ]),
    ).toEqual([
      { lat: 48.92, lon: 2.25 },
      { lat: 48.95, lon: 2.35 },
    ]);
  });

  it("returns an empty list for no points", () => {
    expect(clusterPointsByGrid([])).toEqual([]);
  });
});
