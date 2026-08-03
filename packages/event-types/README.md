# `@foundry/event-types`

Immutable event vocabulary and envelope types for Foundry.

## Status

**Implemented at `FBL-007` (shared contracts).** 14 tests.

## Contents

- The immutable event envelope (id, type, timestamp, entity reference, payload, sequence).
- The full event-type union and per-family payload schemas for the 12 event families declared in `docs/02-specification/event-model.md`.
- Events are immutable facts; corrections occur through new events, never edits (principle 18).
