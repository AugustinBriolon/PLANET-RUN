import { describe, expect, it, vi } from "vitest";

import { createNominatimClient } from "./nominatim-client";

describe("createNominatimClient", () => {
  it("requests extratags and returns a supported administrative relation", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        osm_type: "relation",
        osm_id: 7444,
        address: { city: "Colombes" },
        extratags: { admin_level: "8" },
      }),
    );

    const client = createNominatimClient({
      fetch: fetchImpl,
      wait: async () => {},
    });

    await expect(client.reverseGeocode(48.92, 2.25)).resolves.toEqual({
      name: "Colombes",
      osmRelationId: 7444,
      adminLevel: 8,
    });

    const requestUrl = fetchImpl.mock.calls.at(0)?.at(0);
    expect(String(requestUrl)).toContain("extratags=1");
  });

  it("returns null when admin_level is missing or unsupported", async () => {
    const client = createNominatimClient({
      fetch: vi.fn(async () =>
        Response.json({
          osm_type: "relation",
          osm_id: 1,
          address: { city: "Somewhere" },
        }),
      ),
      wait: async () => {},
    });

    await expect(client.reverseGeocode(48.92, 2.25)).resolves.toBeNull();
  });
});
