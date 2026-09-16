# 5. Import runs from summary polylines and verify webhooks against the API

Date: 2026-09-16

## Status

Accepted

## Context

Strava does not export GPX files through its API. A full trace requires one `/activities/{id}/streams` call per
activity, while the default rate limits are about 100 read requests per 15 minutes and 1,000 per day. A runner
with 1,000 activities would need several days to import. The list endpoint (`/athlete/activities`, up to 200
per page) already returns a simplified `summary_polyline` per activity.

Strava push webhooks notify activity creation, update, deletion and athlete deauthorization. Their payloads are
not signed: anyone who knows the callback URL can send a forged event.

## Decision

For the first milestone, we will import runs from `summary_polyline` only.

- `RunSyncService` pages through `/athlete/activities` (200 per page), keeps `Run` and `TrailRun` activities
  with a trace (`VirtualRun` has no real-world location), and upserts them by Strava activity id.
- Incremental syncs re-scan a 7-day window before `last_synced_at`, because watches often upload days later.
- The first sync starts automatically after the first sign-in; later syncs are manual or webhook-driven.

Webhook events are treated as hints, never as facts:

- Any activity event re-reads the activity from Strava with the owner's token: it is upserted if it is an owned,
  mappable run, deleted if Strava returns 404 or it is no longer a run, and ignored if it belongs to another
  athlete (public activities of others are readable).
- A deauthorization event deletes the user only if Strava rejects the stored refresh token.
- The upsert never changes the owner of an existing activity (`ON CONFLICT ... WHERE user_id = excluded.user_id`).

## Options considered

### Option A — Summary polylines + verified webhooks (chosen)

- Pros: a full history imports in a handful of requests; well within rate limits for many users; forged webhooks
  cannot delete or inject data.
- Cons: summary polylines are simplified (a few dozen points per run), not precise enough for street coverage.

### Option B — Full GPS streams for every activity

- Pros: precise traces, GPX export possible, ready for map matching.
- Cons: multi-day backfills under rate limits; needs a background queue and progress reporting that the first
  milestone does not require.

### Option C — Trust webhook payloads directly

- Pros: one fewer API call per event.
- Cons: a forged `authorized: false` event would delete any user's data; forged activity ids could import other
  athletes' public runs. Rejected.

## Consequences

### Positive

- First import for a typical runner completes in seconds with fewer than ten API calls.
- Webhook handling is idempotent and safe to replay.

### Negative

- The coverage milestone must add a stream-based import (with a job queue) on top of this one.
- Every webhook event costs one extra Strava API call (or one token refresh for deauthorizations).
- Webhooks require a public URL and a one-time `pnpm strava:webhook:subscribe <url>` registration per environment.

### Neutral

- Strava requires deleting a user's data on deauthorization; cascade deletes on `users` implement it.

## References

- https://developers.strava.com/docs/reference/#api-Activities-getLoggedInAthleteActivities
- https://developers.strava.com/docs/rate-limits/
- https://developers.strava.com/docs/webhooks/
