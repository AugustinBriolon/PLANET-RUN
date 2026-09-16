# 6. Test with Vitest unit and integration projects and Playwright

Date: 2026-09-16

## Status

Accepted

## Context

Every change must ship with tests (unit always, integration for shared interfaces, E2E for user flows). The
project mixes pure functions, services with injected dependencies, React client components, Postgres
repositories with constraints that carry business rules (1:1 athlete binding, cascade deletes, owner-preserving
upserts), and pages protected by authentication. Strava cannot be called from tests.

## Decision

We will use three test levels:

- **Unit** — Vitest project `unit` (`pnpm test`), files `src/**/*.test.{ts,tsx}` next to the code, jsdom
  environment, Testing Library for components and hooks. Services are tested against in-memory repositories and a
  fake Strava client from `tests/fakes/`; `server-only` is aliased to a stub.
- **Integration** — Vitest project `integration` (`pnpm test:integration`), files `tests/integration/`, running
  against the real `planet_run_test` Postgres database migrated in a global setup and truncated before each test.
- **E2E** — Playwright (`pnpm test:e2e`), files `tests/e2e/`, against a production build started with
  `next start` on port 3100.

## Options considered

### Option A — Vitest projects + Playwright on a production build (chosen)

- Pros: one runner and config for unit and integration; fast ESM/TypeScript support; real SQL constraints are
  verified; production build E2E catches build-only issues and does not conflict with a running `next dev`.
- Cons: integration tests need Docker running; E2E runs a full build (about 30 seconds).

### Option B — Jest + mocked database

- Pros: widespread.
- Cons: slower TypeScript/ESM setup; mocks cannot verify unique constraints, transactions or cascade deletes.

### Option C — Testcontainers for integration tests

- Pros: fully isolated database per run, no shared Docker Compose service.
- Cons: slower start-up and an extra dependency, while the Compose database is already required for development.

### Option D — Playwright against `next dev`

- Pros: no build step.
- Cons: Next.js 16 refuses a second dev server in the same directory, and dev mode hides production behaviors
  (e.g. Auth.js trusted host checks).

## Consequences

### Positive

- Business rules are covered at the cheapest level that can prove them (82 unit, 7 integration, 4 E2E tests at
  the time of writing).
- In-memory fakes mirror repository interfaces, so service tests stay fast and deterministic.

### Negative

- In-memory fakes can drift from Postgres behavior; the integration suite is the safety net for that drift.
- The signed-in globe flow is not covered end-to-end because it requires a real Strava OAuth round trip.

### Neutral

- E2E sets `AUTH_TRUST_HOST=true` for the local production server only.

## References

- https://vitest.dev/guide/projects
- https://playwright.dev/docs/test-webserver
