# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Planet Run imports a runner's Strava activities and draws every run on a 3D globe, and computes the percentage of
a city's streets covered from OpenStreetMap data (pilot: Colombes / La Garenne-Colombes, ADR 0008). Roadmap: full
GPS streams, coverage above city level (department/region/country), badges, Garmin, and a paid token to re-link
another Strava account. The Next.js version in use (16) has breaking changes: read the
bundled docs referenced in the root `CLAUDE.md` / `AGENTS.md` before touching framework APIs (e.g. `proxy.ts`
replaces middleware, request APIs are async, `refresh()` from `next/cache` in Server Actions).

## Commands

```bash
pnpm db:up                 # Postgres 17 + PostGIS in Docker (host port 5433), waits until healthy
pnpm db:migrate            # apply drizzle/ migrations to the DATABASE_URL in .env.local (currently production Neon!)
pnpm db:generate --name x  # generate a migration after editing src/server/db/schema.ts (needs DATABASE_URL)
pnpm osm:import-city <id>  # (re-)import a city's streets from OSM and re-match every runner against it
pnpm dev                   # http://localhost:3000

pnpm lint && pnpm typecheck && pnpm format:check
pnpm test                          # unit tests (Vitest project "unit", jsdom)
pnpm test src/lib/format.test.ts   # single file; add `-t "name"` to filter by test name
pnpm test:integration              # repositories against the planet_run_test database (Docker must be up)
pnpm test:e2e                      # Playwright on a production build (next build + next start on :3100)

pnpm strava:webhook:subscribe https://<public-host>/api/webhooks/strava   # once per environment
```

On this machine Docker Desktop's credential helper may be missing from `PATH`; prefix Docker commands with
`PATH="$HOME/Applications/Docker.app/Contents/Resources/bin:$PATH"` if an image pull fails with
`docker-credential-desktop`.

`.env.local` holds secrets (see `.env.example`). It points at the production Neon database shared with Vercel
(ADR 0007): anything run with it (`pnpm dev`, `db:migrate`, scripts) touches real tester data. Never run destructive
queries or unreleased migrations against it; integration tests use `TEST_DATABASE_URL` / Docker instead. Only `STRAVA_CLIENT_ID`/`STRAVA_CLIENT_SECRET` come from the
Strava app settings; the others are generated locally. Server env is validated lazily by `getServerEnv()`
(`src/server/env.ts`), so builds do not need secrets.

## Architecture

Decisions and trade-offs are recorded in `docs/adr/` — read them before changing auth, map, import or test
strategy.

**Layers (dependency direction: app → services → repositories/clients):**

- `src/server/services.ts` is the composition root. It is the only place that instantiates the database, cipher,
  Strava client, repositories and services. Only the database pool is cached on `globalThis`: services must be
  rebuilt after hot reloads, or `instanceof StravaApiError` breaks in development. Pages, Server Actions, route
  handlers and the Auth.js callback call `getServices()`.
- `src/server/services/*` hold business rules and receive every dependency as an argument (`createXService(deps)`),
  including `now()`. Never import the database or `fetch` inside a service.
- `src/server/repositories/*` are Drizzle factories returning narrow interfaces. Multi-table writes that must be
  atomic live in one repository method (`createWithUser` uses a transaction).
- `src/server/strava/*` wraps the Strava HTTP API with zod-validated responses and `StravaApiError`
  (`isRateLimited`, `isMissingPermission`, `isApplicationInactive`, `isNotFound`, parsed from Strava error details).
- `src/lib/*` is pure and client-safe (polyline → GeoJSON, stats, street coverage shares, formatting). The server
  maps DB rows to the `RunSummary` DTO (`src/server/runs/to-run-summary.ts`) so user ids and tokens never reach
  the client.

**Identity:** Strava is the only sign-in (`src/auth.ts`, Auth.js v5, JWT sessions, `checks: ["pkce", "state"]`).
The `jwt` callback runs `AccountLinkingService`, and the cookie only stores the internal user id. The database
enforces one Strava athlete ↔ one user (PK on `athlete_id`, unique `user_id`). Strava tokens are stored
AES-256-GCM encrypted and refreshed 5 minutes before expiry by `StravaTokenService`. Always use
`getCurrentUser()` / `requireCurrentUser()` from `src/server/session.ts` rather than `auth()` alone: they also
check that the user still exists in the database (deleted users would otherwise loop between `/login` and `/globe`).

**Run import:** `RunSyncService` pages `/athlete/activities` (200 per page), keeps `Run`/`TrailRun` with a
`summary_polyline`, upserts by Strava activity id, and re-scans 7 days before `last_synced_at`. The first sync
auto-starts on the globe page (`useRunSync` with `syncOnMount`). Strava webhooks are unsigned:
`StravaWebhookService` re-reads the activity from the API before any upsert or delete, ignores activities owned
by another athlete, and deletes a user on deauthorization only when Strava rejects the refresh token. Keep these
checks when adding event types. The webhook route acknowledges immediately and processes in `after()`; the single
Strava push subscription points at production. `AccountDeletionService` revokes Strava access (best effort) before
deleting the user, whose rows cascade. Run countries come from `@rapideditor/country-coder` on start points,
server-side only (`src/server/runs/locate-country.ts`).

**Street coverage (ADR 0008):** `src/server/osm/overpass-client.ts` fetches a city's boundary and runnable
streets from OpenStreetMap; `AreaRepository.replaceArea` clips and splits them into ≤50 m segments entirely in
PostGIS and replaces the city atomically. `CoverageRepository.matchPendingActivities` marks a run's segments
covered when ≥85% of a segment's length is within 20 m of the run's `summary_polyline` (rules centralized in
`src/server/coverage/coverage-rules.ts`); it runs after every sync and webhook event, scoped to the affected
user, as a swallowed best-effort step. Its matching query needs `WITH ... AS MATERIALIZED` on the corridor CTEs
— without it Postgres recomputes each run's buffer once per segment scanned instead of once per run (100x+
slower at pilot scale; see the ADR). Import or refresh a city with `pnpm osm:import-city <osm-relation-id>`,
which replaces its segments and re-matches every runner against them. Full GPS streams are never fetched: the
summary polyline is precise enough for street-level matching (see the ADR), so streets inside a runner's Strava
privacy zone are never credited.

**Globe UI:** `src/components/ui/map.tsx` is mapcn, vendored from the shadcn registry and excluded from ESLint.
Do not edit it; refresh it with `pnpm dlx shadcn@latest add @mapcn/map --overwrite`. Planet Run behaviors are
separate children of `<Map>` using `useMap()` (`RunTracesLayer`, `CoveredStreetsLayer`, `GlobeAutoRotate`,
`FlyToBounds`, `FitGlobeToContainer` in `src/components/globe/`). `CoveredStreetsLayer` only draws above zoom
12 to stay legible; the interactive globe carries OpenStreetMap attribution alongside CARTO's. WebGL colors live in `globe-palette.ts` as hex, kept in sync
with the `--ember` token in `globals.css`. The app is dark-only (`dark` class on `<html>`, which mapcn also reads).
Presentational components take props only; the stateful container is `GlobeDashboard`, which receives Server
Actions as props. Animations use Motion (`motion/react`) and must respect reduced motion (`MotionConfig
reducedMotion="user"`, `useReducedMotion` for imperative map/number animations).

## Tests

- Unit tests sit next to the code (`*.test.ts[x]`). Service tests use `tests/fakes/service-harness.ts`
  (in-memory repositories, `vi.fn` Strava client, a marker cipher `enc(...)`, an in-memory coverage repository).
  When a repository interface changes, update the matching fake under `tests/fakes/` and the integration suite
  together.
- `@tests/*` resolves to `tests/*`; `server-only` is aliased to a stub in `vitest.config.mts`.
- Integration tests truncate tables before each test and run serially. Street coverage integration tests
  (`tests/integration/street-coverage.test.ts`) build a small synthetic city instead of calling Overpass.
- CI (`.github/workflows/ci.yml`) runs every suite; E2E there boots with placeholder env values, so signed-out pages
  must not need a real database or Strava credentials.
- E2E cannot cover the signed-in flow (it needs a real Strava OAuth round trip); cover that logic with unit tests.

## Conventions

- All code, UI copy, docs and ADRs are in English.
- Prettier with `printWidth: 120` and the Tailwind class sorter; `src/components/ui` (shadcn output) is ignored.
- Strava brand assets live in `public/brand/strava/` and must be used unaltered (Strava API brand guidelines): every
  Strava OAuth form uses `StravaConnectButton`, and panels showing Strava data keep the "Powered by Strava" logo.
