# 15. Invite accept forms a city crew clique

Date: 2026-10-08

## Status

Accepted

## Context

A single invite token can be accepted by many runners, but `acceptInvite` only inserted a rivalry between the
inviter and the acceptor. Each invitee’s city board was a star: they saw the host, not each other. Seeding a
crew of ~10 on one beachhead city therefore felt empty for everyone except the person who sent the link.

## Decision

On accept, after linking inviter ↔ acceptor, also insert rivalries between the acceptor and every other runner
already rivalled with the inviter on that `areaId` (idempotent via ordered pairs). One shared link builds one
shared city board.

## Consequences

- Positive: crew chats can use one link; density matches the founder seeding playbook.
- Negative: someone who wanted a private 1:1 duel with the host will also see (and be seen by) the rest of the
  crew on that city. Acceptable for the conquest product; a future “private duel” invite type can opt out.
- Privacy: private profiles remain hidden from non-rivals; clique members become rivals of each other, so they
  can see each other’s names on that city by design.
