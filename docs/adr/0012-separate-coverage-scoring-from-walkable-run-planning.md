# 12. Separate coverage scoring from walkable run planning

Date: 2026-10-06

## Status

Accepted

## Context

Cityfil scores city progress as a share of OpenStreetMap runnable street length (ADR 0008). The mobile app also generates a continuous run plan from the same `street_segments` graph so athletes can grow that percentage.

Field use showed two planner failures that are not score failures:

1. **Hard distance matching.** `buildRunPlanRoute` stopped at `budgetMeters` (±80 m) and ran a fill phase that burned leftover distance on already-covered streets so the path length matched the preference. Athletes treat the requested km as approximate; abrupt mid-pocket cuts and padding felt wrong.
2. **Unwalkable shortcuts.** When unfinished pockets were disconnected, the planner inserted aerial hops (up to ~2.8 km) with no building or pedestrian check. The coverage highway set also omitted `footway` / `path` / `steps`, so many real pedestrian links were missing and hops were more common.

Replacing the coverage denominator with Apple Maps pedestrian routing was considered and rejected: Apple does not expose a stable inventory of every street in a commune for a shareable %, would fork iOS from web, and would make the score and the plan measure different networks.

## Decision

**Keep OSM street coverage as the score** (ADR 0008 rules unchanged for runnable highways).

**Treat run planning as a separate navigation concern:**

1. **Soft distance band.** Requested distance is a preference band of about 85–120% of the budget. The planner finishes streets and local pockets; it may undershoot or slightly overshoot. The covered-street fill phase is removed.
2. **Walkability over hops.** Aerial jumps are capped at 100 m. Past the soft minimum, the plan stops rather than hopping to pad length.
3. **Navigation connectors.** Overpass also imports `footway`, `path`, and `steps`. They are stored with `counts_for_coverage = false`: they join the plan graph but do not enter `street_length_meters`, matching, or the conquest map layers. Re-import a city to populate connectors.
4. **Honest UI.** Plans report approximate path length (`~X km`), expose jump diagnostics, style connectors/jumps in gray vs gold conquest, and note that gray links do not add coverage.

## Options considered

### Option A — Soft-band planner + OSM connectors (chosen)

- Pros: same score as today; plans stay on OSM geometry; web and mobile stay aligned; connectors improve continuity without inflating %.
- Cons: cities need a re-import to gain connectors; OSM footways can be incomplete or poorly tagged.

### Option B — Apple / Google pedestrian Directions as the plan (and/or score)

- Pros: high-quality turn-by-turn walkability on device.
- Cons: no exhaustive street inventory for city %; licensing and platform lock-in; score and plan diverge; web cannot match.

### Option C — Keep hard budget + aerial hops, only tune constants

- Pros: small code change.
- Cons: does not fix mid-pocket cuts, fill padding, or building-crossing hops; product contract stays broken.

## Consequences

- `street_segments.counts_for_coverage` distinguishes score geometry from navigation-only links (migration `0006_navigation_connectors`).
- Plan API returns `jumpCount` / `jumpMeters` and a softer copy note; mobile shows `~km` and gray connector styling.
- Existing imported cities keep correct % immediately; walkable connectors appear after the next OSM import for that city.
- Upload validation accepts fractional GPS timestamps so finished phone runs are not rejected as “could not be read” (orthogonal reliability fix shipped with this work).
