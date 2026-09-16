# 3. Sign in with Strava only and encrypt provider tokens

Date: 2026-09-16

## Status

Accepted

## Context

Planet Run has no use for its own credentials: all value comes from the runner's Strava history. The product
vision states that users should not create an account, and that one Strava account is bound to exactly one
internal identity (later, re-linking another Strava account will require purchasing a token).

To import activities in the background, the app must store Strava OAuth tokens: access tokens expire every six
hours and are renewed with a long-lived refresh token. A leaked refresh token grants read access to a user's full
activity history, including private activities and home locations.

## Decision

We will use Auth.js v5 (`next-auth@5 beta`) with the built-in Strava provider as the only sign-in method, with
stateless JWT sessions.

- Requested scope is `read,activity:read_all`. OAuth checks are `pkce` and `state`: Strava ignores PKCE, so
  `state` is what protects the callback from login CSRF.
- On sign-in, the `jwt` callback calls `AccountLinkingService`, which creates or reuses the internal user. The
  session cookie only carries the internal user id.
- The database enforces the 1:1 binding: `strava_accounts.athlete_id` is the primary key and
  `strava_accounts.user_id` is unique. User and account are created in one transaction.
- Access and refresh tokens are encrypted at rest with AES-256-GCM (random 12-byte IV, authentication tag)
  using `TOKEN_ENCRYPTION_KEY`. Tokens are refreshed five minutes before expiry.
- Every protected page resolves the user from the database (`getCurrentUser`), so a user deleted after a Strava
  deauthorization is treated as signed out even with a still-valid cookie.

## Options considered

### Option A — Auth.js with the Strava provider and JWT sessions (chosen)

- Pros: battle-tested OAuth flow, cookie encryption and CSRF protection; Strava provider already exists; no session
  table.
- Cons: v5 is still a beta and the project is in maintenance mode since joining Better Auth; JWT sessions cannot be
  revoked server-side (mitigated by the database lookup on every protected page).

### Option B — Hand-written OAuth flow with a signed session cookie (`jose`)

- Pros: no beta dependency; full control over the token exchange and the Strava-specific `athlete` payload.
- Cons: re-implements state/PKCE handling and cookie security that are easy to get subtly wrong.

### Option C — Better Auth with a generic OAuth provider

- Pros: actively developed successor to Auth.js.
- Cons: requires its own user/session/account tables that overlap with our Strava binding model; Strava must be
  configured as a generic provider.

### Option D — Store tokens in plain text

- Pros: simpler.
- Cons: a database dump or backup leak exposes every runner's location history. Rejected.

## Consequences

### Positive

- Sign-in is a single click; there is no password, email or account creation screen.
- A database leak without `TOKEN_ENCRYPTION_KEY` does not expose usable Strava tokens.
- The athlete ↔ user uniqueness required by the future paid re-link feature is guaranteed by constraints, not code.

### Negative

- Rotating `TOKEN_ENCRYPTION_KEY` requires a re-encryption script (not built yet).
- Moving off Auth.js later means re-implementing the OAuth callback, but services are unaffected.
- Production deployments must set `AUTH_URL` (or `AUTH_TRUST_HOST` behind a trusted proxy).

### Neutral

- Garmin sign-in will be added as a second provider bound to the same internal user model.

## References

- https://authjs.dev/getting-started/providers/strava
- https://developers.strava.com/docs/authentication/
- https://developers.strava.com/docs/getting-started/#oauth
