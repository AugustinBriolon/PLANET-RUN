# 13. Partial street coverage credit with a hard map threshold

Date: 2026-10-07

## Status

Accepted

## Context

ADR 0008 matches a street segment as covered when ≥85% of its length falls within 20 m of a run's
`summary_polyline`. That binary rule correctly keeps perpendicular crossings out of the hard covered
set, but it creates cliffs: a near-miss along a street (roughly 50–84% touched) earns nothing toward
the city percentage, then jumps to full segment credit once the threshold is crossed.

Options considered for reducing cliffs without rewriting the product contract (OSM streets, PostGIS
matching, mobile `share` field):

## Decision

**Keep the hard 85% threshold for map layers and conquest titles.** Gold covered streets and 100%
unlocks still require `covered_share ≥ minCoveredShare`.

**Store the raw touched share on each match** (`activity_street_segments.covered_share`) and compute
the displayed city percentage with a soft ramp:

- below `softCreditFloor` (0.5): no credit
- between floor and `minCoveredShare` (0.85): linear credit from 0 → 1
- at or above 0.85: full segment length

`CityCoverage.coveredMeters` / API `share` use soft credit. `strictCoveredMeters` / `toStrictCoverageShare`
feed Founder / Conqueror completion so soft progress cannot unlock titles early.

Constants live in `src/server/coverage/coverage-rules.ts` and stay calibratable.

## Options considered

### Option A — Soft ramp + hard map (chosen)

- Pros: reduces % cliffs; map and titles stay honest; single mobile `share` field (backward compatible).
- Cons: soft % can sit slightly above the hard map gold until near-misses cross 85%; crossings near ~0.8
  may earn partial soft credit (documented trade-off; hard set still excludes them).

### Option B — Dual `share` / `softShare` in the mobile API

- Pros: client can choose which number to show.
- Cons: breaks or complicates every consumer; unnecessary if soft is the display % and hard stays server-side.

### Option C — Lower the binary threshold only (e.g. 0.7)

- Pros: one-line change.
- Cons: inflates hard map/titles with crossings; does not give gradual progress.

## Consequences

- Migration `0007_partial_coverage_credit.sql` adds `covered_share` and resets `coverage_matched_at`
  so every run is rematched.
- Matching inserts segments from `softCreditFloor` upward; UI % uses `softCoverageCredit`.
- Integration expectations for "crossing earns nothing" still apply to the hard covered set and piece
  counts used for map assertions may include soft-only near-miss rows.
