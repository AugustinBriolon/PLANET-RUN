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
      kind: "hit",
      result: {
        name: "Colombes",
        osmRelationId: 7444,
        adminLevel: 8,
      },
    });

    const requestUrl = fetchImpl.mock.calls.at(0)?.at(0);
    expect(String(requestUrl)).toContain("extratags=1");
  });

  it("returns miss for départements and other non-commune admin levels", async () => {
    const client = createNominatimClient({
      fetch: vi.fn(async () =>
        Response.json({
          osm_type: "relation",
          osm_id: 7_437,
          address: { county: "Hauts-de-Seine" },
          extratags: { admin_level: "6" },
        }),
      ),
      wait: async () => {},
    });

    await expect(client.reverseGeocode(48.92, 2.25)).resolves.toEqual({ kind: "miss" });
  });

  it("returns retryable on 5xx so cells are not permanently blacklisted", async () => {
    const client = createNominatimClient({
      fetch: vi.fn(async () => new Response("upstream", { status: 503 })),
      wait: async () => {},
    });

    await expect(client.reverseGeocode(48.92, 2.25)).resolves.toEqual({ kind: "retryable" });
  });

  it("returns retryable on network failure", async () => {
    const client = createNominatimClient({
      fetch: vi.fn(async () => {
        throw new Error("network down");
      }),
      wait: async () => {},
    });

    await expect(client.reverseGeocode(48.92, 2.25)).resolves.toEqual({ kind: "retryable" });
  });
});
