import { describe, expect, it } from "vitest";

import {
  cityKmLeft,
  DEFAULT_CITY_MAP_LAYERS,
  toggleCityMapLayer,
} from "./city-map-layers";

describe("DEFAULT_CITY_MAP_LAYERS", () => {
  it("opens a city with streets on and heatmap off", () => {
    expect(DEFAULT_CITY_MAP_LAYERS).toEqual({
      heatmap: false,
      remaining: true,
      covered: true,
    });
  });
});

describe("toggleCityMapLayer", () => {
  it("flips one flag without mutating the input", () => {
    const next = toggleCityMapLayer(DEFAULT_CITY_MAP_LAYERS, "heatmap");
    expect(next.heatmap).toBe(true);
    expect(DEFAULT_CITY_MAP_LAYERS.heatmap).toBe(false);
    expect(next.remaining).toBe(true);
  });
});

describe("cityKmLeft", () => {
  it("rounds to one decimal and never goes negative", () => {
    expect(cityKmLeft({ coveredMeters: 2_340, totalMeters: 10_000 })).toBe(7.7);
    expect(cityKmLeft({ coveredMeters: 12_000, totalMeters: 10_000 })).toBe(0);
  });
});
