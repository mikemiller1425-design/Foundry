# `@foundry/api`

The Foundry backend service. Owns operational truth (ADR-002) via `packages/persistence`.

## Status

`FBL-024` (Backend API), `FBL-025` (state machines and prerequisite enforcement), and `FBL-026` (realtime event delivery) complete, under the operator-authorized bounded sequence `FBL-023`–`FBL-026`. Query, snapshot, and health endpoints are live. Commands are enforced backend-side: a command is applied only when it passes shape validation, its entity's transition graph, and every named invariant guard — otherwise it is rejected with a structured reason and zero mutation.

**Security caveat:** V1 has no authentication system (out of scope per `v1-scope.md` exclusions). The optional `actor` on a command is a caller-asserted claim, not a verified identity, so actor-sensitive guards (notably F-05's Inspector-only validation) are only as trustworthy as the caller. This service is intended for local/trusted-network operation only.

## Endpoints

- `GET /health` — liveness check
- `GET /world-state` — the current `WorldState` snapshot (`@foundry/contracts`)
- `GET /entities/:entityType` — list all entities of a type (see `ENTITY_TYPES` in `@foundry/persistence`)
- `GET /entities/:entityType/:id` — a single entity, or 404
- `POST /commands` — body `{ commandType, entityId?, params?, actor? }` validated against `@foundry/contracts`' `CommandRequestSchema`, then enforced by `CommandHandler`. Responds `200` with `{ accepted: true, event }` when the command is legal and applied, or `{ accepted: false, reason, correctiveAction }` when it is rejected (no mutation); `400` for a malformed body or unknown `commandType`.
- `GET /events[?since=<eventId>]` — the durable event log, or only what follows `since`
- `GET /events/stream` — Server-Sent Events. Honors `Last-Event-ID` (or `?lastEventId=`) to replay exactly the events missed during a disconnect, then streams live. SSE is sufficient because delivery is one-directional — commands already travel over `POST /commands` — and it gets browser reconnect plus `Last-Event-ID` replay for free.

## Run locally

```sh
pnpm --filter @foundry/api build
pnpm --filter @foundry/api start
# or, for one-shot rebuild+run:
pnpm --filter @foundry/api dev
```

`FOUNDRY_DB_PATH` (default `apps/api/data/foundry.sqlite`) and `PORT` (default `4000`) are configurable via environment variables. The database file is local runtime state and is git-ignored.
