# 11. First-login sync returns a page, then finishes in the background

Date: 2026-10-06

## Status

Accepted

## Context

A new runner waited for every Strava activity page and then for every city Overpass import, in order, before
the mobile home screen showed traces or a coverage percentage. Hundreds of runs made first open feel broken.

## Decision

- The first history import persists `strava_accounts.history_sync_page` and returns after **one** Strava page
  (200 activities). `after()` hops fetch the rest. Incremental weekly sync still walks every new page in one call.
- City street imports are queued with `priority =` that runner's start-point count. `claimNext` orders by
  priority, then `created_at`. Nominatim still chunks, but denser cells are geocoded first, and Overpass is no
  longer blocked while Nominatim continues.
- `users.analysis_notify_pending` is set on the first import. When history is marked synced **and** none of
  that user's cities remain in the import queue, the server sends one Expo push (`users.expo_push_token`) and
  clears the flag. `GET /api/mobile/me` exposes `sync.historyComplete` and `sync.analysisPending`.
  `PATCH /api/mobile/me` accepts `expoPushToken`.

## Options considered

### Option A — One page then `after()`, priority queue, Expo push (chosen)

- Pros: traces and known-city % appear after the first hop; the runner is pinged if they left the app.
- Cons: two background chains (history + cities) until `last_synced_at` is set; notify must wait for both.

### Option B — Keep one request for the whole history

- Pros: simpler bookkeeping.
- Cons: the mobile client stays empty until Strava and Overpass both finish.

## Consequences

### Positive

- First paint of runs is bounded by one Strava page plus coverage match, not the athlete's full archive.
- Cities the runner actually uses jump the shared Overpass queue.

### Negative

- Requires migration `0005_fast_first_sync`.
- Expo push needs a stored token and will no-op in Simulator without an EAS project id.
