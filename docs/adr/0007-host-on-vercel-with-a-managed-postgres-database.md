# 7. Host on Vercel with a managed Postgres database

Date: 2026-09-16

## Status

Proposed

## Context

Planet Run must be reachable by a small group of testers (the Strava Standard tier caps the app at 10 connected
athletes) and, later, pass Strava's application review to grow further. The product owner already deployed the
Next.js app on Vercel. The first production deployment returned HTTP 500 on every authenticated route because the
environment variables were created with empty values and no hosted database was attached.

Constraints:

- The app is a Next.js 16 monolith (ADR 0002) whose server code runs in serverless functions on Vercel.
- The database must support PostGIS for the street-coverage roadmap.
- The Strava webhook endpoint must be publicly reachable over HTTPS and answer within 2 seconds.
- Solo developer: no infrastructure to operate.

## Decision

We will host the application on Vercel (production on `main`, previews on other branches) and use a managed
serverless Postgres with PostGIS, Neon attached through the Vercel Storage integration.

- Server environment variables are validated at first use (`parseServerEnv`) and fail with an error that lists
  invalid variable names without printing values.
- Migrations are applied manually with `scripts/migrate.ts` against the production connection string, not during the
  build, so preview deployments can never migrate the production database.
- Production and local environments use distinct secrets; `TOKEN_ENCRYPTION_KEY` is never rotated without a
  re-encryption script.

## Options considered

### Option A — Vercel + Neon (chosen)

- Pros: zero-config Next.js hosting with preview deployments; Neon supports PostGIS, has a free tier, connection
  pooling for serverless functions, and is provisioned from the Vercel dashboard with `DATABASE_URL` injected.
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

## Consequences

### Positive

- Deploying is a `git push`; previews make testing changes with friends possible before production.
- Misconfigured environments are diagnosable from runtime logs in seconds.

### Negative

- Applying migrations is a manual, easy-to-forget step until a CI pipeline runs it.
- Background processing for full GPS streams will require an additional worker platform or queue service.
- Map tiles (CARTO) and the MapLibre worker (unpkg) remain third-party runtime dependencies in production.

### Neutral

- `AUTH_URL` is not required on Vercel: Auth.js detects the deployment host.
- The Strava callback domain is set to the production host; `localhost` stays allowed for development.

## References

- https://vercel.com/docs/frameworks/nextjs
- https://neon.com/docs/extensions/postgis
- https://vercel.com/marketplace/neon
