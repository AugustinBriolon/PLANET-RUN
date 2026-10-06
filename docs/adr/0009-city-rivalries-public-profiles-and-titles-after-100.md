# 9. City rivalries, public profiles and titles after 100%

Date: 2026-10-06

## Status

Accepted

## Context

Coverage was a single-player percentage. At 100% everyone is tied, so finishing a city that others already
finished had no remaining prize, and there was no way to invite a colleague onto the same city. Marketing the
product as "conquer a city" needs a comparison that survives completion.

## Decision

We will keep coverage private by default and add a city-scoped social layer:

- `users.profile_visibility` is `private` or `public`. Public names appear on a city's hall of fame; private
  names are visible only to invited rivals on that city.
- An invite link (`/invite/:token`, 14 days) creates a rivalry between two users on one city.
- Reaching 100% writes a `city_conquests` row once. Titles are derived, not stored:
  - **Founder** — earliest `completed_at` on that city (permanent).
  - **Conqueror** — fewest GPS kilometres among finishers (the runs that touched the city).
  - **Keeper** — finisher who matched the most unique street metres during the current UTC month; vacant if none.

The mobile API exposes `PATCH /api/mobile/me`, invite create/accept, and `GET /api/mobile/cities/:areaId/board`.
Conquests are stamped from the city pipeline when a runner's share first crosses 100%. We do not reconstruct
historical Founder from old runs; the stamp is the first time the pipeline observes a finished city.

## Options considered

### Option A — City rivalry + three titles (chosen)
- Pros: 100% stays meaningful; invite is enough to start without a global friend graph; privacy is explicit.
- Cons: Founder among people who already had 100% before this ships is whoever is processed first.

### Option B — Coverage decay if you stop running
- Pros: forces return visits.
- Cons: steals the 100% the product promised.

### Option C — Global leaderboard of %
- Pros: simple.
- Cons: collapses to a tie at 100%; no reason to finish a popular city.

## Consequences

### Positive
- Two runners can compare the same city; 100% opens a second game instead of a ceiling.

### Negative
- Invite accept needs the app (or the landing page to open it). A web-only visitor cannot become a rival yet.
  The inviter opening their own link is not an error: they are sent to that city.

### Neutral
- Invite share previews are Open Graph images on the invite URL (see [ADR 0010](0010-per-invite-open-graph-share-cards.md)).

## References
- `src/lib/conquest/`, `src/server/services/conquest-service.ts`, `drizzle/0004_city_rivalry.sql`
