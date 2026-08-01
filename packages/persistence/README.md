# `@foundry/persistence`

Backend-authoritative entity and event storage for Foundry (ADR-002).

## Status

Implemented at build ladder rung FBL-023 (Persistence foundation).

## Contents

- `PersistenceService` — the public repository/service interface: transactional, idempotent event append; per-entity get/list; `WorldState` snapshot construction; snapshot-plus-later-events reconciliation.
- `reducer.ts` — the backend-authoritative entity projection (`reduceEntities`), folding `@foundry/event-types` events into full per-entity records for every `domain-model.md` entity.
- `worldStateProjection.ts` — derives the `WorldState` read-projection from the full entity store.
- SQLite storage (Node's built-in `node:sqlite`, no external dependency) — one append-only `events` table and one generic `entities` table (`entity_type`, `entity_id`, JSON `data` validated against `@foundry/contracts` schemas). Requires Node ≥ 22.13 (where `node:sqlite` no longer needs a flag); this repo develops on Node 26, where it is fully stable.

## Explicitly out of scope here

No HTTP is exposed by this package — that is FBL-024. No transition/invariant enforcement lives here — that is FBL-025 (this package accepts whatever already-valid events it is given; it does not decide whether a transition was legal).
