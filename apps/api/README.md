# `@foundry/api`

The Foundry backend service. Owns operational truth (ADR-002) via `packages/persistence`.

## Status

`FBL-024` (Backend API) complete, under the operator-authorized bounded sequence `FBL-023`–`FBL-026`. Query, snapshot, and health endpoints are live. Command endpoints exist and validate request shape but are **deny-by-default**: no command endpoint mutates persisted state yet — that is `FBL-025`.

## Endpoints

- `GET /health` — liveness check
- `GET /world-state` — the current `WorldState` snapshot (`@foundry/contracts`)
- `GET /entities/:entityType` — list all entities of a type (see `ENTITY_TYPES` in `@foundry/persistence`)
- `GET /entities/:entityType/:id` — a single entity, or 404
- `POST /commands` — body `{ commandType, entityId?, params? }` validated against `@foundry/contracts`' `CommandRequestSchema`; always responds `{ accepted: false, ... }` for a well-formed, known command, or `400` for anything else. Never mutates persisted state.

## Run locally

```sh
pnpm --filter @foundry/api build
pnpm --filter @foundry/api start
# or, for one-shot rebuild+run:
pnpm --filter @foundry/api dev
```

`FOUNDRY_DB_PATH` (default `apps/api/data/foundry.sqlite`) and `PORT` (default `4000`) are configurable via environment variables. The database file is local runtime state and is git-ignored.
