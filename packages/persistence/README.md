# `@foundry/persistence`

Backend-authoritative entity and event storage for Foundry (ADR-002).

## Status

Implemented at build ladder rung FBL-023 (Persistence foundation); extended at FBL-025 with backend-authoritative transition enforcement and at FBL-026 with realtime subscriber fan-out.

## Contents

- `PersistenceService` — the public repository/service interface: transactional, idempotent event append; per-entity get/list; `WorldState` snapshot construction; snapshot-plus-later-events reconciliation; and `subscribe()` for realtime fan-out (FBL-026), which fires only after a successful commit and never for a duplicate append.
- `reducer.ts` — the backend-authoritative entity projection (`reduceEntities`), folding `@foundry/event-types` events into full per-entity records for every `domain-model.md` entity.
- `worldStateProjection.ts` — derives the `WorldState` read-projection from the full entity store.
- SQLite storage (Node's built-in `node:sqlite`, no external dependency) — one append-only `events` table and one generic `entities` table (`entity_type`, `entity_id`, JSON `data` validated against `@foundry/contracts` schemas). Requires Node ≥ 22.13 (where `node:sqlite` no longer needs a flag); this repo develops on Node 26, where it is fully stable.

### Enforcement (FBL-025)

- `CommandHandler` — validates a submitted command against the target entity's transition graph plus every named invariant guard, then applies it through the same `PersistenceService.appendEvent` path. A rejected command never reaches `appendEvent`, so rejection is zero-mutation by construction.
- `transitionGraphs.ts` — legal status transitions per entity, from each entity's documented Lifecycle.
- `commandDefinitions.ts` — every documented V1 command mapped to the one event it produces, or permanently denied with a reason where no V1 event backs it.

Note `PersistenceService.appendEvent` remains unguarded by design: it is the low-level durable-write primitive (and the replay path), so callers that must enforce invariants go through `CommandHandler`. Direct `appendEvent` use is for trusted internal/system paths and tests.

## Explicitly out of scope here

No HTTP is exposed by this package — that is `apps/api` (FBL-024).
