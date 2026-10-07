import { z } from "zod";

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org";
const USER_AGENT = "Cityfil/0.1 (+https://planet-run.vercel.app)";
// Nominatim usage policy: max 1 request/second.
const RATE_LIMIT_DELAY_MS = 1100;

const nominatimResponseSchema = z.object({
  address: z.object({
    town: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
  }),
  osm_type: z.enum(["relation", "way", "node"]),
  osm_id: z.number(),
  extratags: z
    .object({
      admin_level: z.string().optional(),
    })
    .optional(),
});

export type NominatimResult = {
  name: string;
  osmRelationId: number;
  adminLevel: number;
};

/**
 * Discriminated reverse-geocode outcome so callers can retry transient failures
 * without permanently blacklisting the grid cell.
 */
export type ReverseGeocodeOutcome =
  | { kind: "hit"; result: NominatimResult }
  | { kind: "miss" }
  | { kind: "retryable" };

export type NominatimClient = {
  /** Reverse-geocode a lat/lon to a commune (admin_level 8), or miss/retryable. */
  reverseGeocode: (lat: number, lon: number) => Promise<ReverseGeocodeOutcome>;
};

type NominatimClientConfig = {
  fetch?: typeof fetch;
  endpoint?: string;
  wait?: (milliseconds: number) => Promise<void>;
};

export function createNominatimClient({
  fetch: fetchImpl = fetch,
  endpoint = DEFAULT_ENDPOINT,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: NominatimClientConfig = {}): NominatimClient {
  let lastRequestTime = 0;

  async function enforceRateLimit() {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await wait(RATE_LIMIT_DELAY_MS - elapsed);
    }
    lastRequestTime = Date.now();
  }

  return {
    async reverseGeocode(lat, lon) {
      await enforceRateLimit();

      let response: Response;
      try {
        response = await fetchImpl(
          `${endpoint}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&extratags=1`,
          {
            headers: { "User-Agent": USER_AGENT },
          },
        );
      } catch {
        return { kind: "retryable" };
      }

      // 5xx / rate-limit / upstream blips — do not blacklist the cell.
      if (response.status >= 500 || response.status === 429) {
        return { kind: "retryable" };
      }
      if (!response.ok) {
        return { kind: "miss" };
      }

      try {
        const data = nominatimResponseSchema.parse(await response.json());

        // Only process administrative relations (cities, towns)
        if (data.osm_type !== "relation") {
          return { kind: "miss" };
        }

        const adminLevel = data.extratags?.admin_level ? Number(data.extratags.admin_level) : null;
        // Communes only (admin_level 8). Accepting 6–7 pulled whole départements into the street queue.
        if (adminLevel !== 8) {
          return { kind: "miss" };
        }

        const name = data.address.city || data.address.town || data.address.county;
        if (!name) {
          return { kind: "miss" };
        }

        return {
          kind: "hit",
          result: {
            name,
            osmRelationId: data.osm_id,
            adminLevel,
          },
        };
      } catch {
        return { kind: "miss" };
      }
    },
  };
}
