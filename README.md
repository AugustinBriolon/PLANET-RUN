# Planet Run

Planet Run connects to a runner's Strava account, imports every outdoor run and draws them on an interactive 3D
globe, so you can see every place in the world you have ever run. It also tracks the percentage of a city's
streets covered, starting with a Colombes / La Garenne-Colombes pilot. Next up: department, region and country
coverage, and badges.

## Scope and responsibilities

**What it does:**

- Signs runners in with Strava only (no account to create) and binds each Strava athlete to one internal user.
- Imports `Run` and `TrailRun` activities with a GPS trace from the Strava API, on first sign-in and on demand.
- Keeps runs up to date through Strava push webhooks (create, update, delete, deauthorization).
- Renders traces on a globe with totals (runs, distance, time, countries).
- Computes the percentage of a city's streets covered from OpenStreetMap data, for cities that have been
  imported (currently Colombes and La Garenne-Colombes).
- Lets runners permanently delete their data, which also revokes Strava access, and publishes a privacy policy at
  `/privacy`.

**What it does not do (yet):**

- Import full GPS streams or export GPX files — only Strava's simplified `summary_polyline` is stored.
- Compute coverage above city level (department, region, country), award badges, sell re-link tokens, or connect
  Garmin (shown as "coming soon").
- Show a runner's data to anyone else.

**Main dependencies:**

- **Strava API** — OAuth sign-in, activity list and details, push webhooks.
- **PostgreSQL 17 + PostGIS 3.5** — users, encrypted Strava tokens, activities, street segments and coverage.
- **OpenStreetMap (Overpass API)** — city boundaries and street geometry for coverage.
- **CARTO basemaps** — free dark vector tiles rendered by MapLibre GL through [mapcn](https://www.mapcn.dev).
- **[country-coder](https://github.com/rapideditor/country-coder)** — offline, server-side country lookup of run
  start points.

## Architecture

A single Next.js 16 application (App Router) serves the UI and the server logic.

```text
src/app/            pages (/login, /globe), Server Actions, Auth.js and Strava webhook route handlers
src/auth.ts         Auth.js configuration: Strava provider, JWT session holding the internal user id
src/server/         server-only code
  services.ts       composition root wiring every implementation
  services/         account linking, run sync, token refresh, webhook reconciliation, city import, coverage
  repositories/     Drizzle data access (users, activities, street coverage)
  strava/           typed Strava API client
  osm/              Overpass API client fetching city boundaries and streets
  coverage/         street coverage matching rules (segment length, match distance, covered share)
  db/               Drizzle schema and client
src/lib/            pure client-safe logic (polyline → GeoJSON, stats, street coverage shares, formatting)
src/components/     UI: shadcn/ui, mapcn globe layers, login and dashboard, Motion animations
drizzle/            SQL migrations
tests/              fakes, fixtures, integration and E2E suites
```

Flow: sign-in with Strava → the account is linked and tokens are stored AES-256-GCM encrypted → the globe page
triggers the first sync → runs are upserted and rendered. Webhook events are re-verified against the Strava API
before any data change.

Design decisions are recorded in [`docs/adr/`](docs/adr).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.9 (developed with 24)
- [pnpm](https://pnpm.io/) 9 (`corepack enable` picks the version from `package.json`)
- [Docker](https://www.docker.com/) with Compose v2
- A Strava API application created at <https://www.strava.com/settings/api> with **Authorization Callback Domain**
  set to `localhost` (`localhost` stays allowed when the domain is later set to the production host)
- An **active Strava subscription** on the account owning that application: without it, Strava marks the application
  inactive and every data request fails with `403 Application Status Inactive`. The Standard tier allows up to 10
  connected athletes without review.

### Installation

```bash
pnpm install
cp .env.example .env.local   # then fill in the values, see below
pnpm db:up                   # starts Postgres + PostGIS on localhost:5433
pnpm db:migrate
```

### Run

```bash
pnpm dev                     # http://localhost:3000
```

### Environment variables

Defined in [`.env.example`](.env.example), loaded from `.env.local`.

| Variable                      | Description                                                     | Example / how to get it                                      |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`                | Postgres connection string                                      | `postgres://planet_run:planet_run@localhost:5433/planet_run` |
| `AUTH_SECRET`                 | Signs and encrypts the Auth.js session cookie                   | `openssl rand -base64 33`                                    |
| `AUTH_URL`                    | Public origin of the app, production only                       | `https://planet-run.example`                                 |
| `STRAVA_CLIENT_ID`            | Strava API application client ID                                | From the Strava API settings page                            |
| `STRAVA_CLIENT_SECRET`        | Strava API application client secret                            | From the Strava API settings page                            |
| `TOKEN_ENCRYPTION_KEY`        | 32-byte base64 key encrypting Strava tokens at rest             | `openssl rand -base64 32`                                    |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Shared secret echoed by Strava when validating the subscription | `openssl rand -hex 24`                                       |

### Strava webhooks (optional locally)

Webhooks need a public HTTPS URL. Expose the dev server (for example with `cloudflared tunnel --url
http://localhost:3000`), then register the subscription once:

```bash
pnpm strava:webhook:subscribe https://<public-host>/api/webhooks/strava
```

### Street coverage

Coverage is computed against imported cities only. Import (or re-import, after a rule change) with:

```bash
pnpm osm:import-city 91738 91775   # Colombes, La Garenne-Colombes (OSM relation ids)
```

This replaces the city's street segments and re-matches every runner's activities against it, so it is safe to
re-run. See [ADR 0008](docs/adr/0008-street-coverage-from-osm-with-postgis.md) for the matching rules and the OSM
relation ids of the pilot cities.

## Tests

| Type        | Command                 | Notes                                                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit        | `pnpm test`             | Vitest + Testing Library (jsdom); services run against in-memory fakes                                 |
| Integration | `pnpm test:integration` | Repositories against the `planet_run_test` database (PostGIS); requires `pnpm db:up`                   |
| E2E         | `pnpm test:e2e`         | Playwright on a production build served on port 3100; run `pnpm exec playwright install chromium` once |

Run a single unit test file with `pnpm test src/lib/format.test.ts` (add `-t "<name>"` to filter).

The signed-in globe flow requires a real Strava OAuth round trip and is not covered by E2E tests.

## Development

| Command                        | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `pnpm lint`                    | ESLint (Next.js core-web-vitals + TypeScript rules)          |
| `pnpm typecheck`               | TypeScript without emitting                                  |
| `pnpm format` / `format:check` | Prettier (width 120, Tailwind class sorting)                 |
| `pnpm build` / `pnpm start`    | Production build and server                                  |
| `pnpm db:generate --name <x>`  | Generate a migration after editing `src/server/db/schema.ts` |

Conventions:

- Services receive all dependencies as arguments; only `src/server/services.ts` instantiates implementations.
- Components are presentational and take props; data access happens in pages, Server Actions and hooks.
- `src/components/ui/map.tsx` is vendored from mapcn: do not edit it, refresh it with
  `pnpm dlx shadcn@latest add @mapcn/map --overwrite`. It is excluded from ESLint.
- Code, UI copy, commits and docs are written in English.

## Deployment

Production runs on Vercel: <https://planet-run.vercel.app>, with a Neon Postgres database. Pushes to `main` deploy to
production; other branches get preview deployments.

[GitHub Actions](.github/workflows/ci.yml) runs lint, type-check, format, unit, integration (PostGIS service
container) and E2E tests on every push and pull request. Vercel deploys independently of the CI result.

The maintainer's `.env.local` points at the production Neon database (see
[ADR 0007](docs/adr/0007-host-on-vercel-with-a-managed-postgres-database.md)): `pnpm dev` and `pnpm db:migrate` then
act on real data, and `TOKEN_ENCRYPTION_KEY` must match the Vercel value. Automated tests never use it.

First-time setup of an environment:

1. Create a PostgreSQL database with PostGIS support (Neon) and use its pooled (`-pooler`) connection string as
   `DATABASE_URL`.
2. Set the variables from [Environment variables](#environment-variables) for Production and Preview. Generate
   **new** values for `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` and `STRAVA_WEBHOOK_VERIFY_TOKEN`; never rotate
   `TOKEN_ENCRYPTION_KEY` afterwards or stored Strava tokens become unreadable. `AUTH_URL` is not needed on Vercel.
3. Redeploy so the variables are picked up, then apply migrations against the production database:

   ```bash
   DATABASE_URL="<direct, non-pooled connection string>" pnpm exec tsx scripts/migrate.ts
   ```

4. Set the Strava application's **Authorization Callback Domain** to the production host (`planet-run.vercel.app`).
5. Register the webhook once: `pnpm strava:webhook:subscribe https://planet-run.vercel.app/api/webhooks/strava`
   (run with the production `STRAVA_WEBHOOK_VERIFY_TOKEN`).
6. Import the pilot cities against the production database: `pnpm osm:import-city 91738 91775`.

Invalid or missing server variables fail fast with an error listing the variable names in the Vercel runtime logs.

## Related documentation

- [Architecture Decision Records](docs/adr)
- [Strava API reference](https://developers.strava.com/docs/reference/) and [webhooks](https://developers.strava.com/docs/webhooks/)
- [mapcn documentation](https://www.mapcn.dev/docs)
- [Auth.js Strava provider](https://authjs.dev/getting-started/providers/strava)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) and [PostGIS](https://postgis.net/docs/)
