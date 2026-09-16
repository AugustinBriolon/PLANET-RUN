# 7. Host on Vercel with a managed Postgres database

Date: 2026-09-16

## Status

Accepted

## Context

Planet Run must be reachable by a small group of testers (the Strava Standard tier caps the app at 10 connected
athletes) and, later, pass Strava's application review to grow further. The product owner already deployed the
Next.js app on Vercel. The first production deployment returned HTTP 500 on every authenticated route because the
environment variables were created with empty values and no hosted database was attached.

Constraints:

- The app is a Next.js 16 monolith (ADR 0002) whose server code runs in serverless functions on Vercel.
- The database must support PostGIS for the street-coverage roadmap.
- The Strava webhook endpoint must be publicly reachable over HTTPS and answer within 2 seconds.
- Solo developer: no infrastructure to operate, and the product owner already uses Neon for other projects.

## Decision

We will host the application on Vercel (production on `main`, previews on other branches) and use one Neon
serverless Postgres database (region `eu-west-2`), created directly in the Neon console.

- The same Neon database backs production and local development (`.env.local`), so the product owner sees the same
  runs everywhere. Automated tests never use it: integration tests target `TEST_DATABASE_URL` (the Docker
  `planet_run_test` database by default, a service container in CI) and E2E tests only exercise signed-out flows.
- Because both environments read the same encrypted Strava tokens, `TOKEN_ENCRYPTION_KEY` has the same value in
  Vercel and `.env.local`, and is never rotated without a re-encryption script. `AUTH_SECRET` may differ.
- The application connects through Neon's pooled endpoint (`-pooler` host); migrations are applied manually with
  `scripts/migrate.ts` through the direct endpoint, never during the build, so preview deployments cannot migrate
  the database.
- Server environment variables are validated at first use (`parseServerEnv`) and fail with an error that lists
  invalid variable names without printing values.
- A GitHub Actions workflow runs lint, type-check, format, unit, integration and E2E tests on every push and pull
  request. Vercel deploys independently of it.

## Options considered

### Option A — Vercel + Neon (chosen)

- Pros: zero-config Next.js hosting with preview deployments; Neon supports PostGIS, has a free tier and connection
  pooling for serverless functions; already familiar to the product owner.
- Cons: two vendors; serverless cold starts; long-running jobs (future stream backfills) exceed function limits and
  will need a separate worker.

### Option B — Vercel + Supabase

- Pros: Postgres with PostGIS plus storage and auth features.
- Cons: auth and storage overlap with choices already made (ADR 0003); more surface than needed.

### Option C — Railway or Fly.io (app and Postgres together)

- Pros: long-running processes and workers are first-class; one vendor.
- Cons: more configuration for Next.js, no built-in preview deployments; the app is already on Vercel.

### Option D — Run migrations during `next build`

- Pros: no manual step.
- Cons: every preview build would run migrations against whichever database its variables point to, including
  production. Rejected.

### Option E — Separate databases for local development (Docker) and production

- Pros: local experiments and unreleased migrations cannot touch production data; secrets can differ per environment.
- Cons: the product owner has to sign in and re-import runs in each environment and cannot compare local changes
  against real production data. Rejected by the product owner for the beta phase; the Docker database stays
  available by pointing `DATABASE_URL` back to it.

## Consequences

### Positive

- Deploying is a `git push`; previews make testing changes with friends possible before production.
- Misconfigured environments are diagnosable from runtime logs in seconds.
- Regressions are visible on every push through the CI workflow.

### Negative

- `pnpm dev` and `pnpm db:migrate` with the default `.env.local` write to production data: a destructive local
  change or an unreleased migration directly affects testers.
- Applying migrations is a manual, easy-to-forget step, and a failing CI run does not block a Vercel deployment.
- Background processing for full GPS streams will require an additional worker platform or queue service.
- Map tiles (CARTO) and the MapLibre worker (unpkg) remain third-party runtime dependencies in production.

### Neutral

- `AUTH_URL` is not required on Vercel: Auth.js detects the deployment host.
- The Strava callback domain is set to the production host; `localhost` stays allowed for development.
- Strava allows one push subscription per application; it points to the production webhook endpoint.

## References

- https://vercel.com/docs/frameworks/nextjs
- https://neon.com/docs/extensions/postgis
- https://neon.com/docs/connect/connection-pooling
