# Fly to City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Click a city in `CityCoverageList` to `fitBounds` on that city's full boundary from the current camera, with duration scaled by distance.

**Architecture:** Extend `CityCoverage` with PostGIS bbox; lift focus bounds state in `GlobeDashboard`; generalize `FlyToBounds` duration via a pure helper; make city names text buttons.

**Tech Stack:** Next.js, MapLibre (`fitBounds`), PostGIS, Vitest, Testing Library.

## Global Constraints

- Frame the **entire city** (`areas.boundary`), not covered streets only.
- Animate from the **current** camera; duration ∝ distance (clamped ~600–2500 ms); `prefers-reduced-motion` → 0.
- UI aligned with Streets list: text button, ember hover, focus ring — no cards/chips/icons.
- Reuse `LngLatBounds` from `@/lib/runs/run-geojson`.
- English code/docs; Conventional Commits only when the user asks to commit.

---

### Task 1: Bounds on `CityCoverage` + repository

**Files:**

- Modify: `src/lib/coverage/street-coverage.ts`
- Modify: `src/server/repositories/coverage-repository.ts`
- Modify: `tests/integration/street-coverage.test.ts`
- Modify: `src/components/dashboard/run-stats-panel.test.tsx` (fixture bounds)

**Produces:** `CityCoverage.bounds: LngLatBounds`

- [x] Add `bounds` to the type; SELECT `ST_XMin/YMin/XMax/YMax(area.boundary)`; map to `[[west,south],[east,north]]`.
- [x] Assert Squareville bounds ≈ `[[2,48],[2.01,48.01]]` in integration test.
- [x] Update panel test fixtures with dummy bounds.

### Task 2: Fly duration helper + `FlyToBounds`

**Files:**

- Create: `src/lib/map/fly-duration.ts`
- Create: `src/lib/map/fly-duration.test.ts`
- Modify: `src/components/globe/fly-to-bounds.tsx`

**Produces:** `flyDurationMs(distanceDegrees, { reducedMotion })`

- [x] TDD the helper (0 if reduced motion; clamp 600–2500; increases with distance).
- [x] `FlyToBounds` reads map center vs target center, uses helper for `duration`.

### Task 3: Clickable list + dashboard wiring

**Files:**

- Modify: `src/components/dashboard/city-coverage-list.tsx`
- Create: `src/components/dashboard/city-coverage-list.test.tsx`
- Modify: `src/components/dashboard/run-stats-panel.tsx`
- Modify: `src/components/dashboard/globe-dashboard.tsx`

**Produces:** `onSelectCity(areaId: number)` → `setFocusBounds(city.bounds)`

- [x] Name button with `aria-label={`Fly to ${name}`}`, ember hover, focus ring.
- [x] `GlobeDashboard` holds `focusBounds` state initialized from run `bounds`; passes handler through panel.

### Task 4: Verify

- [x] Unit tests + typecheck green.
- [x] Integration street-coverage still green (if DB available).
