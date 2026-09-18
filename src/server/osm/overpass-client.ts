import { z } from "zod";

import { RUNNABLE_HIGHWAY_TYPES } from "@/server/coverage/coverage-rules";
import type { AreaImport } from "@/server/repositories/area-repository";
import type { CatalogCityBoundary } from "@/server/repositories/city-catalog-repository";

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";
// Overpass usage policy asks clients to identify themselves.
const USER_AGENT = "PlanetRun/0.1 (+https://planet-run.vercel.app)";
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 20_000;

/** OSM relation for the Île-de-France region (admin_level 4). */
export const ILE_DE_FRANCE_RELATION_ID = 8649;

/**
 * INSEE department codes inside Île-de-France. Catalog seeding queries one department at a time so
 * Overpass can return full `members` geometries (a single region-wide `out geom` often omits them).
 */
export const ILE_DE_FRANCE_DEPARTMENT_INSEE_CODES = ["75", "77", "78", "91", "92", "93", "94", "95"] as const;

const latLonSchema = z.object({ lat: z.number(), lon: z.number() });

const relationMemberSchema = z.object({
  type: z.string(),
  role: z.string(),
  geometry: z.array(latLonSchema).optional(),
});

/** City street fetch: the target relation must include members. */
const cityFetchResponseSchema = z.object({
  elements: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("relation"),
        id: z.number(),
        tags: z.record(z.string(), z.string()),
        members: z.array(relationMemberSchema),
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

/**
 * Catalog fetch: Overpass may return relations without `members` when the payload is huge or
 * incomplete — those entries are skipped rather than failing the whole seed.
 */
const catalogFetchResponseSchema = z.object({
  elements: z.array(
    z.object({
      type: z.string(),
      id: z.number().optional(),
      tags: z.record(z.string(), z.string()).optional(),
      members: z.array(relationMemberSchema).optional(),
      geometry: z.array(latLonSchema).optional(),
    }),
  ),
});

export type OverpassClient = {
  /** Fetches a city boundary relation and the runnable streets inside it. */
  fetchCity: (osmRelationId: number) => Promise<AreaImport>;
  /** Fetches admin_level=8 boundaries inside Île-de-France (no streets — catalog seed). */
  fetchAdminCitiesInRegion: (regionRelationId: number) => Promise<CatalogCityBoundary[]>;
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

export function buildAdminCitiesInDepartmentQuery(inseeDepartmentCode: string): string {
  return `[out:json][timeout:180];
area["ref:INSEE"="${inseeDepartmentCode}"]["admin_level"="6"]->.dep;
rel(area.dep)["boundary"="administrative"]["admin_level"="8"];
out geom;`;
}

/** @deprecated Prefer department batches via {@link buildAdminCitiesInDepartmentQuery}. */
export function buildAdminCitiesInRegionQuery(regionRelationId: number): string {
  return `[out:json][timeout:300];
rel(id:${regionRelationId});
map_to_area->.region;
rel(area.region)["boundary"="administrative"]["admin_level"="8"];
out geom;`;
}

const toPositions = (points: z.infer<typeof latLonSchema>[]) => points.map(({ lat, lon }) => [lon, lat]);

function toCatalogBoundary(element: {
  type: string;
  id?: number;
  tags?: Record<string, string>;
  members?: z.infer<typeof relationMemberSchema>[];
}): CatalogCityBoundary | null {
  if (element.type !== "relation" || element.id == null || !element.tags) return null;
  if (element.tags.boundary !== "administrative") return null;
  const adminLevel = Number(element.tags.admin_level);
  // Communes only — never seed départements / régions as coverage cities.
  if (adminLevel !== 8) return null;
  const boundaryLines = (element.members ?? []).flatMap((member) =>
    member.type === "way" && member.geometry && member.geometry.length >= 2 ? [toPositions(member.geometry)] : [],
  );
  if (boundaryLines.length === 0) return null;
  return {
    osmRelationId: element.id,
    name: element.tags.name ?? String(element.id),
    adminLevel,
    boundaryLines,
  };
}

function toAreaImport(osmRelationId: number, response: z.infer<typeof cityFetchResponseSchema>): AreaImport {
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
      const response = cityFetchResponseSchema.parse(await query(buildCityQuery(osmRelationId)));
      return toAreaImport(osmRelationId, response);
    },
    async fetchAdminCitiesInRegion(regionRelationId) {
      // Île-de-France: one Overpass call per département keeps geometries complete.
      const departmentCodes =
        regionRelationId === ILE_DE_FRANCE_RELATION_ID ? ILE_DE_FRANCE_DEPARTMENT_INSEE_CODES : null;

      if (!departmentCodes) {
        const response = catalogFetchResponseSchema.parse(await query(buildAdminCitiesInRegionQuery(regionRelationId)));
        return response.elements.flatMap((element) => {
          const city = toCatalogBoundary(element);
          return city ? [city] : [];
        });
      }

      const byId = new Map<number, CatalogCityBoundary>();
      for (const inseeCode of departmentCodes) {
        const response = catalogFetchResponseSchema.parse(await query(buildAdminCitiesInDepartmentQuery(inseeCode)));
        for (const element of response.elements) {
          const city = toCatalogBoundary(element);
          if (city) byId.set(city.osmRelationId, city);
        }
        // Be polite between department queries on the public Overpass instance.
        await wait(2_000);
      }
      return [...byId.values()];
    },
  };
}
