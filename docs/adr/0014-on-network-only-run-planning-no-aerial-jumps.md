# 14. On-network only run planning (no aerial jumps)

Date: 2026-10-07

## Status

Accepted

Supersedes the aerial-hop clause of [ADR 0012](0012-separate-coverage-scoring-from-walkable-run-planning.md) (walkability over hops capped at ~100–120 m). Soft distance preference and navigation connectors from ADR 0012 remain in force.

## Context

ADR 0012 stopped multi-kilometre building-crossing hops, but the planner later reintroduced short aerial jumps (`appendJump`, `MAX_AERIAL_JUMP_METERS` ≈ 120 m) and a silent GPS→seed chord when the athlete start could not walk the graph to the seed. Field use showed that even ~80 m tip→entry chords cut through courtyards and blocks. Athletes expect the drawn plan to follow the OSM street plan literally.

Long continuous OSM LineStrings (hundreds of metres on one aligned road) are not shortcuts: they are real road geometry and must stay allowed.

## Decision

1. **Zero aerial shortcuts.** `buildRunPlanRoute` never inserts tip→entry or GPS→seed straight lines. Proximity hops and jump budgets are removed. `jumpCount` / `jumpMeters` stay in the API but are always `0`.
2. **On-network only.** Growth uses graph edges only (coverage streets, covered bridges, and `counts_for_coverage = false` connectors). Disconnected unfinished pockets are not linked off-network; the plan stays in the reachable component.
3. **Long on-road edges are fine.** Any length is allowed when walking an OSM / connector LineString or a chain of graph edges.
4. **Athlete start.** Snap GPS to the nearest graph node within `MAX_ANCHOR_SNAP_METERS` (~180 m). Require a street walk to a **reachable** unfinished seed (`shortestPath`, capped by `MAX_START_CONNECTOR_METERS`). Never invent a chord. If snap/path fails, the API layer retries a **city-centered** on-network plan and sets `startsFromPosition: false` — never an empty route solely because GPS was on.
5. **Distance preference.** Load the **full city** street graph. After conquest, **clear segment usage** and fill by rewalking the graph (including back through the unfinished pocket) so tips that ended in cul-de-sacs can rejoin the wider covered network. Uncovered metres are credited once. Verified on Joigny (~60 km open): 5 / 8 / 12 km budgets land near target. The mobile UI shows `~X km of Y km` if still under.

## Options considered

### Option A — Snap + require graph path; no aerial hops (chosen)

- Pros: plan matches what athletes can follow on the map; long roads stay intact; API shape unchanged.
- Cons: disconnected pockets or off-street GPS yield empty / shorter plans until connectors exist.

### Option B — Keep ≤120 m aerial hops

- Pros: stitches nearby pockets when OSM is incomplete.
- Cons: still crosses private space / courtyards; violates “respect the street plan”.

### Option C — Keep GPS as first vertex with a short snap chord

- Pros: `coordinates[0]` equals the athlete position.
- Cons: still draws an off-network segment; surprising when the gap is tens of metres.

## Consequences

- Plans may undershoot budget more often when the walkable graph is fragmented; connectors from ADR 0012 remain the fix (re-import).
- Mobile clients that styled `jump` legs keep working; diagnostics stay at zero.
- Anchored plans start on the snapped street, not necessarily on the raw GPS coordinate.
