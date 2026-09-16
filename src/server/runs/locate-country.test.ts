import { describe, expect, it } from "vitest";

import { locateCountry } from "./locate-country";

describe("locateCountry", () => {
  it.each([
    ["Colombes", [2.2525, 48.9226], "FR"],
    ["Central Park", [-73.9654, 40.7829], "US"],
    ["Kyoto", [135.7681, 35.0116], "JP"],
    ["Saint-Denis, Réunion", [55.4504, -20.8789], "FR"],
  ] as const)("locates %s", (_, position, countryCode) => {
    expect(locateCountry([...position])).toBe(countryCode);
  });

  it("returns null in the open ocean", () => {
    // Maritime zones are generalized by the library, so use a point far from any coast.
    expect(locateCountry([-140, -40])).toBeNull();
  });
});
