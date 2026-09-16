import { z } from "zod";

import { RUNNABLE_HIGHWAY_TYPES } from "@/server/coverage/coverage-rules";
import type { AreaImport } from "@/server/repositories/area-repository";

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";
// Overpass usage policy asks clients to identify themselves.
const USER_AGENT = "PlanetRun/0.1 (+https://planet-run.vercel.app)";
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 20_000;

const latLonSchema = z.object({ lat: z.number(), lon: z.number() });

const overpassResponseSchema = z.object({
  elements: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("relation"),
        id: z.number(),
        tags: z.record(z.string(), z.string()),
        members: z.array(z.object({ type: z.string(), role: z.string(), geometry: z.array(latLonSchema).optional() })),
      }),
      z.object({
        type: z.literal("way"),
        id: z.number(),
        tags: z.record(z.string(), z.string()),
        geometry: z.array(latLonSchema),
      }),
      z.object({ type: z.literal("node") }),
    ]),
  ),
});

export type OverpassClient = {
  /** Fetches a city boundary relation and the runnable streets inside it. */
  fetchCity: (osmRelationId: number) => Promise<AreaImport>;
};

type OverpassClientConfig = {
  fetch?: typeof fetch;
  endpoint?: string;
  wait?: (milliseconds: number) => Promise<void>;
};

export function buildCityQuery(osmRelationId: number): string {
  const highways = RUNNABLE_HIGHWAY_TYPES.join("|");
  return `[out:json][timeout:120];
rel(id:${osmRelationId})->.city;
.city out geom;
.city map_to_area->.cityArea;
way(area.cityArea)["highway"~"^(${highways})$"]["area"!="yes"]["access"!~"^(private|no)$"];
out tags geom;`;
}

const toPositions = (points: z.infer<typeof latLonSchema>[]) => points.map(({ lat, lon }) => [lon, lat]);

function toAreaImport(osmRelationId: number, response: z.infer<typeof overpassResponseSchema>): AreaImport {
  const relation = response.elements.find((element) => element.type === "relation" && element.id === osmRelationId);
  if (relation?.type !== "relation" || relation.tags.boundary !== "administrative") {
    throw new Error(`OSM relation ${osmRelationId} is not an administrative boundary`);
  }

  return {
    osmRelationId,
    name: relation.tags.name ?? String(osmRelationId),
    adminLevel: Number(relation.tags.admin_level),
    boundaryLines: relation.members.flatMap((member) =>
      member.type === "way" && member.geometry ? [toPositions(member.geometry)] : [],
    ),
    streets: response.elements.flatMap((element) =>
      element.type === "way" && element.geometry.length >= 2
        ? [
            {
              osmWayId: element.id,
              name: element.tags.name ?? null,
              highway: element.tags.highway ?? "unknown",
              coordinates: toPositions(element.geometry),
            },
          ]
        : [],
    ),
  };
}

export function createOverpassClient({
  fetch: fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: OverpassClientConfig = {}): OverpassClient {
  async function query(body: string): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT },
        body: new URLSearchParams({ data: body }),
      });
      if (response.ok) return response.json();
      // The public Overpass instance sheds load with these statuses; waiting usually helps.
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw new Error(`Overpass request failed: ${response.status}`);
      }
      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  return {
    async fetchCity(osmRelationId) {
      const response = overpassResponseSchema.parse(await query(buildCityQuery(osmRelationId)));
      return toAreaImport(osmRelationId, response);
    },
  };
}
