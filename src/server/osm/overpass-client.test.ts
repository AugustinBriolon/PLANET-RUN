import { describe, expect, it, vi } from "vitest";

import { buildCityQuery, createOverpassClient } from "./overpass-client";

const cityResponse = {
  elements: [
    {
      type: "relation",
      id: 91775,
      tags: { boundary: "administrative", admin_level: "8", name: "La Garenne-Colombes" },
      members: [
        { type: "node", role: "admin_centre" },
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: 48.9, lon: 2.23 },
            { lat: 48.91, lon: 2.26 },
          ],
        },
      ],
    },
    {
      type: "way",
      id: 12,
      tags: { highway: "residential", name: "Rue Voltaire" },
      geometry: [
        { lat: 48.905, lon: 2.24 },
        { lat: 48.906, lon: 2.25 },
      ],
    },
    { type: "way", id: 13, tags: { highway: "residential" }, geometry: [{ lat: 48.9, lon: 2.24 }] },
  ],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  const wait = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);
  return { client: createOverpassClient({ fetch: fetchMock, wait }), fetchMock, wait };
}

describe("buildCityQuery", () => {
  it("selects the relation and only runnable public streets inside it", () => {
    const query = buildCityQuery(91775);

    expect(query).toContain("rel(id:91775)");
    expect(query).toContain(
      '["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"]',
    );
    expect(query).toContain('["access"!~"^(private|no)$"]');
  });
});

describe("createOverpassClient", () => {
  it("maps the boundary and streets to [longitude, latitude] lines", async () => {
    const { client, fetchMock } = setup(jsonResponse(cityResponse));

    await expect(client.fetchCity(91775)).resolves.toEqual({
      osmRelationId: 91775,
      name: "La Garenne-Colombes",
      adminLevel: 8,
      boundaryLines: [
        [
          [2.23, 48.9],
          [2.26, 48.91],
        ],
      ],
      streets: [
        {
          osmWayId: 12,
          name: "Rue Voltaire",
          highway: "residential",
          coordinates: [
            [2.24, 48.905],
            [2.25, 48.906],
          ],
        },
      ],
    });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toEqual({ "User-Agent": "PlanetRun/0.1 (+https://planet-run.vercel.app)" });
  });

  it("retries when the public instance is overloaded", async () => {
    const { client, wait } = setup(new Response("busy", { status: 504 }), jsonResponse(cityResponse));

    await expect(client.fetchCity(91775)).resolves.toMatchObject({ name: "La Garenne-Colombes" });
    expect(wait).toHaveBeenCalledOnce();
  });

  it("gives up on other errors and on relations that are not administrative boundaries", async () => {
    await expect(setup(new Response("bad", { status: 400 })).client.fetchCity(1)).rejects.toThrow(
      "Overpass request failed: 400",
    );

    const notACity = { elements: [{ ...cityResponse.elements[0], tags: { type: "route" } }] };
    await expect(setup(jsonResponse(notACity)).client.fetchCity(91775)).rejects.toThrow(
      "OSM relation 91775 is not an administrative boundary",
    );
  });
});
