# 8. Compute street coverage from OpenStreetMap with PostGIS

Date: 2026-09-16

## Status

Accepted

## Context

Planet Run's core roadmap feature is the percentage of a city's streets a runner has covered. This requires a
source of street geometry and a rule for deciding when a run "covers" a street. The product owner picked
Colombes and La Garenne-Colombes as a pilot, and validated it with real data before committing:

- 116 of the product owner's 170 imported runs pass through the pilot bounding box.
- The two cities hold about 144 km of runnable streets (1,195 ways), a volume light enough for the public
  Overpass API and for PostGIS on a single request.
- Strava's `summary_polyline` (already stored, see ADR 0005) was compared against the full GPS stream on three
  runs: the median deviation is 1 m and the 90th percentile 1–2 m, except near the start and end of runs, where
  it reaches 150–250 m. Those are the athlete's Strava privacy zones — end points Strava removes from the
  simplified trace but keeps in the full stream.

## Decision

We will compute coverage per city from OpenStreetMap street geometry, matched against the `summary_polyline`
already stored per run, using PostGIS. Full GPS streams are not fetched, and coverage is limited to cities that
have been explicitly imported (the pilot only, for now).

**Data model** (`src/server/db/schema.ts`, migration `drizzle/0001_street_coverage.sql`):

- `areas` — one row per imported city (OSM administrative relation, `admin_level` 8), with its boundary as a
  PostGIS `MultiPolygon` and the total street length used as the percentage's denominator.
- `street_segments` — streets clipped to their city and cut into pieces of at most 50 m, so partial coverage of
  a long street is visible instead of an all-or-nothing street.
- `activity_street_segments` — which segments each run has covered; cascades from both `activities` and
  `street_segments`, so deleting a run or re-importing a city cannot leave orphaned rows.
- `activities.coverage_matched_at` — null until a run has been matched; reset whenever its trace changes
  (`upsertMany` compares the stored polyline) so a corrected activity is re-evaluated.

**Import** (`scripts/import-osm-city.ts`, `src/server/osm/overpass-client.ts`,
`src/server/repositories/area-repository.ts`): fetches a city's boundary and runnable streets from the public
Overpass API, clips streets to the boundary and splits them into segments entirely in PostGIS (`ST_Intersection`,
`ST_LineSubstring`), and replaces the city's segments on every run. Runnable streets are `primary`, `secondary`,
`tertiary`, `unclassified`, `residential`, `living_street` and `pedestrian` OSM `highway` values, excluding
private and no-access ways; motorways, service roads (parking, driveways) and dedicated cycle paths are excluded.

**Matching** (`src/server/repositories/coverage-repository.ts`, `src/server/coverage/coverage-rules.ts`): a
segment counts as covered when at least 85% of its length falls within 20 m of a run's trace. That share was
chosen from the pilot's own street width and grid, checked with integration tests: it keeps a street a run only
crosses uncovered, while a run along a street — even on its far sidewalk — still covers it. Matching runs after
every sync and every webhook event, scoped to the affected runner, and is a swallowed best-effort step: a
PostGIS error must not fail the sync or the webhook.

**Runs are matched from `summary_polyline`, not the full GPS stream.** The precision comparison above showed no
meaningful gain from the full stream for street-level matching, and fetching it for every run would consume a
large share of Strava's per-application rate limit and need a background job. The trade-off is that streets
inside an athlete's privacy zone (usually around home) are never credited, matching what Strava itself shows to
other apps.

**Coverage is city-only for now**, not department, region or country. Those require every street in a much
larger area — roughly 1,000,000 km for France — which does not fit a single Overpass request or the pilot's
per-city import model. That is deferred to a dedicated import pipeline (a bulk OSM extract, not Overpass) once
the city-level model is validated with real users.

**Performance.** The matching query originally took over 100 seconds for 170 runs: Postgres inlined the CTE
computing each run's search corridor (`ST_Buffer`) and recomputed it once per street segment scanned instead of
once per run. Forcing `WITH ... AS MATERIALIZED` fixed this to about 1 second for the same 170 runs (see
`src/server/repositories/coverage-repository.ts`), confirmed with `EXPLAIN` before and after.

## Options considered

### Option A — OpenStreetMap via Overpass, matched with PostGIS (chosen)

- Pros: free, worldwide coverage, and PostGIS is already the target database (ADR 0002); Overpass needs no
  account for the request volume of a two-city pilot.
- Cons: the public Overpass instance is shared infrastructure that can throttle or return 5xx under load
  (handled with retries in `overpass-client.ts`); a country-scale rollout needs a different import path.

### Option B — Fetch full GPS streams for street-level precision

- Pros: exact trace, including inside privacy zones (for the athlete's own coverage).
- Cons: the precision measurement showed no meaningful benefit for this matching threshold; costs Strava API
  rate limit budget per run and requires a background job. Rejected for the pilot; may be revisited once street
  coverage matters more than the summary trace can support.

### Option C — Coverage percentages above city level from the start

- Pros: matches the product's long-term vision (city, department, region, country, world) in one pass.
- Cons: no data source at that scale fits the current per-city Overpass import; would require a bulk OSM extract
  and a different, heavier pipeline before any pilot result exists. Rejected until the city-level model is
  proven.

### Option D — A simpler crossing-insensitive rule (any intersection counts as covered)

- Pros: simpler query, no share threshold to tune.
- Cons: a run merely crossing a street would count it as covered, inflating percentages in a dense grid like the
  pilot cities. Rejected after checking against the pilot's actual street spacing.

## Consequences

### Positive

- Coverage percentages are visible in the dashboard for real running data, computed automatically after every
  sync and webhook event.
- The 50 m segment size makes partial street coverage visible instead of only complete streets.
- The MATERIALIZED fix keeps coverage matching well inside a webhook's response budget for a single run, and
  fast enough after a full sync to run inline rather than needing a queue.

### Negative

- Coverage only exists for imported cities; a runner training entirely outside Colombes and La Garenne-Colombes
  sees no Streets section yet.
- Streets inside a runner's Strava privacy zone are never credited.
- Re-importing a city (`pnpm osm:import-city`) recomputes every runner's coverage for it, which takes seconds per
  hundred runs — fine for the pilot's scale, but will need to move to a background job before a country-scale
  rollout.
- The public Overpass API is a shared, best-effort service; a national-scale import will need a dedicated OSM
  extract instead.

### Neutral

- The map attributes OpenStreetMap ("© OpenStreetMap contributors") whenever the interactive globe is shown,
  alongside the existing CARTO basemap attribution.
- Coverage rules (segment length, match distance, covered share) are centralized in
  `src/server/coverage/coverage-rules.ts` so they can be tuned from one place as more cities are added.

## References

- https://wiki.openstreetmap.org/wiki/Overpass_API
- https://postgis.net/docs/ST_LineSubstring.html
- https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION
