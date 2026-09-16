# Fly to city from coverage list

**Date:** 2026-09-16  
**Status:** Approved — implementing  
**Goal:** Clicking a city name in `CityCoverageList` flies the globe from the current camera to that city's full boundary, with motion that matches Planet Run's existing map language.

## Context

Planet Run already:

- Lists per-city street coverage in `CityCoverageList` (name + ember progress bar + mono %).
- Stores each city's `areas.boundary` (PostGIS `MultiPolygon`) keyed by `osm_relation_id`.
- Flies the camera on first load via `FlyToBounds` → `map.fitBounds` (padding 96, maxZoom 12, ~3200 ms entrance; 0 when `prefers-reduced-motion`).

`CityCoverage` today has no geometry — only `areaId`, `name`, meters. Clicks therefore need bounds from the server.

## Requirements

1. Clicking a city name frames the **entire city** (`areas.boundary` bbox), not only covered streets.
2. Animation starts from the **current** camera (no reset to orbit).
3. Path feels like a natural hop: the farther the destination, the more the camera eases out before settling (MapLibre `fitBounds` from current view + duration scaled by distance).
4. UI stays aligned with the dashboard: quiet typography, ember accent, mono stats, light motion — no new chrome, cards, or badges.
5. Respect `prefers-reduced-motion` (instant fit).

## Non-goals

- Highlighting streets of the selected city.
- Persisting selection across syncs or reloads.
- Flying to cities the user has not covered (list only shows covered cities).
- React Query / client fetch of bounds on click.

## Design

### Data

Extend `CityCoverage`:

```ts
export type CityCoverage = {
  areaId: number;
  name: string;
  coveredMeters: number;
  totalMeters: number;
  bounds: LngLatBounds; // [[west, south], [east, north]]
};
```

`listCityCoverage` adds the bbox from PostGIS, e.g. `ST_Extent(area.boundary)` (or equivalent envelope), parsed into `LngLatBounds` in the same shape as `getTracesBounds`.

Reuse `LngLatBounds` from `@/lib/runs/run-geojson` (or move the type to a shared geo module if duplication hurts — prefer reuse first, YAGNI on a new package).

### Camera

Generalize the existing fly helper (keep name `FlyToBounds` or rename lightly if the API grows):

- Props: `bounds`, shared `padding` / `maxZoom` defaults (96 / 12) so entrance and city hops share framing language.
- On bounds change: `map.fitBounds(bounds, { padding, maxZoom, duration, essential: false })`.
- **Entrance:** initial `bounds` = run traces (unchanged).
- **City click:** parent sets focus bounds to that city's `bounds`.
- **Duration:** derived from distance between current map center (or current bounds center) and target bounds center — clamped (e.g. ~600–2500 ms). Reduced motion → `0`.
- Re-clicking the same city may no-op if `boundsKey` unchanged; acceptable. Optional later: bump a nonce to re-fly.

State lives in `GlobeDashboard` (single owner of map focus), not inside the list.

### List UI (design alignment)

Keep the existing Streets block (uppercase mono label, ember bar, mono %).

- Turn the city **name** into a text button (not the whole row, not a card).
- Hover / focus: `text-ember` or foreground emphasis + focus ring consistent with settings / privacy links (`focus-visible:ring-2 focus-visible:ring-ring`).
- No selected chip, no map pin, no extra icon unless needed for affordance — prefer underline-on-hover or ember text so the panel stays calm.
- `aria-label` like `Fly to {name}` for screen readers.
- Entrance stagger (`motion.li`) stays as today.

### Wiring

```
CityCoverageList onSelectCity(areaId)
  → GlobeDashboard setFocusBounds(city.bounds)
  → FlyToBounds reacts via boundsKey
```

`RunStatsPanel` / `EmptyRunsState` unchanged except passing the callback through where the list mounts (`RunStatsPanel` only today).

### Tests

- Unit: SQL/mapper (or repository fake) returns `bounds` on `CityCoverage`.
- Unit: duration helper scales with distance and clamps; reduced-motion path is 0 when wired via the component’s existing hook.
- Unit: `CityCoverageList` calls `onSelectCity` with `areaId` on name click.
- Integration (if coverage tests already assert list shape): include bounds fixtures.

## Alternatives considered

| Option | Why not |
| --- | --- |
| Bounds from `coveredStreets` client-side | Frames runs, not the whole city (rejected). |
| `flyTo` + `cameraForBounds` | Slightly richer arc; more code. Start with `fitBounds` + distance duration; switch only if motion feels flat. |
| Fetch bounds on click | Extra latency; list payload already small. |

## Open points (resolved)

- Framing: **full city boundary**.
- Motion: **from current view**, duration ∝ distance (not fixed cinematic entrance).
- Visual language: **match existing Streets list** — minimal, ember, mono.

## Success criteria

- Click any listed city → globe settles on that commune’s extent.
- Hop from city A to city B starts mid-view, no full-page remount.
- Entrance dive on first load still works.
- List still looks like the same Streets section, just with clickable names.
