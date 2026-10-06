# 10. Per-invite Open Graph share cards

Date: 2026-10-06

## Status

Accepted

## Context

City rivalry invites were a 14-day HTTPS URL. Messaging apps showed the generic Cityfil home card, so a
colleague on Slack or iMessage could not see which city, how far the inviter had got, or which titles were still
open. Generating a PNG inside the mobile app would add native modules and a second source of truth.

## Decision

We will render a dynamic Open Graph (and Twitter) image at `/invite/:token/opengraph-image` with Next.js
`ImageResponse`, using the same `previewInvite` payload as the landing page: inviter display name, city, coverage
share, and whether Founder / Conqueror / Keeper are vacant. Title *holders* stay off the card so a private
Founder is not named in a public unfurl. The mobile share sheet keeps sending that HTTPS URL (plus a short
message) so iMessage, WhatsApp and Slack unfurl the card. Invite pages stay `noindex`.

## Options considered

### Option A — Server OG image from invite preview (chosen)
- Pros: one generator, works for any client that unfurls URLs, no extra native dependency.
- Cons: Instagram Stories still needs a pasted link; it does not unfurl Open Graph.

### Option B — Client-drawn PNG shared as a file
- Pros: Stories can attach the bitmap.
- Cons: two layouts to keep in sync; `expo-file-system` / sharing plugins; iOS `Share` often drops the URL when
  a file is the `url` field.

## Consequences

### Positive
- A pasted invite link previews as a city challenge instead of the generic globe card.

### Negative
- Apps that ignore Open Graph still see only the text URL.

### Neutral
- The root `/opengraph-image` stays the generic Cityfil mark for other pages.

## References
- `src/app/invite/[token]/opengraph-image.tsx`, `src/lib/conquest/invite-share-card.ts`
