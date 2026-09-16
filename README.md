# Planet Run

Planet Run connects to a runner's Strava account, imports every outdoor run and draws them on an interactive 3D
globe, so you can see every place in the world you have ever run. Next up: street-by-street coverage percentages
per city, department, region and country, with badges.

## Scope and responsibilities

**What it does:**

- Signs runners in with Strava only (no account to create) and binds each Strava athlete to one internal user.
- Imports `Run` and `TrailRun` activities with a GPS trace from the Strava API, on first sign-in and on demand.
- Keeps runs up to date through Strava push webhooks (create, update, delete, deauthorization).
- Renders traces on a globe with totals (runs, distance, time, elevation).

**What it does not do (yet):**

- Import full GPS streams or export GPX files — only Strava's simplified `summary_polyline` is stored.
- Compute street coverage, award badges, sell re-link tokens, or connect Garmin (shown as "coming soon").
- Show a runner's data to anyone else.

**Main dependencies:**

- **Strava API** — OAuth sign-in, activity list and details, push webhooks.
- **PostgreSQL 17 + PostGIS 3.5** — users, encrypted Strava tokens, activities.
- **CARTO basemaps** — free dark vector tiles rendered by MapLibre GL through [mapcn](https://www.mapcn.dev).

## Architecture

A single Next.js 16 application (App Router) serves the UI and the server logic.

```text
src/app/            pages (/login, /globe), Server Actions, Auth.js and Strava webhook route handlers
src/auth.ts         Auth.js configuration: Strava provider, JWT session holding the internal user id
src/server/         server-only code
  services.ts       composition root wiring every implementation
  services/         account linking, run sync, token refresh, webhook reconciliation
  repositories/     Drizzle data access
  strava/           typed Strava API client
  db/               Drizzle schema and client
src/lib/            pure client-safe logic (polyline → GeoJSON, stats, formatting)
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
  set to `localhost`

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

## Tests

| Type        | Command                 | Notes                                                                                                  |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Unit        | `pnpm test`             | Vitest + Testing Library (jsdom); services run against in-memory fakes                                 |
| Integration | `pnpm test:integration` | Repositories against the `planet_run_test` database; requires `pnpm db:up`                             |
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

<!-- TODO: no hosting or CI/CD pipeline is set up yet. Document the target platform, environments and pipeline once chosen. -->

Production requires `AUTH_URL`, a managed Postgres with PostGIS, a Strava application whose callback domain
matches the production host, and a webhook subscription registered against the production URL.

## Related documentation

- [Architecture Decision Records](docs/adr)
- [Strava API reference](https://developers.strava.com/docs/reference/) and [webhooks](https://developers.strava.com/docs/webhooks/)
- [mapcn documentation](https://www.mapcn.dev/docs)
- [Auth.js Strava provider](https://authjs.dev/getting-started/providers/strava)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
