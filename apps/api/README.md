# `@foundry/api`

The Foundry backend service. Owns operational truth (ADR-002) via `packages/persistence`.

## Status

**Agent City V1 is complete.** `FBL-024` (Backend API), `FBL-025` (state machines and prerequisite enforcement), `FBL-026` (realtime event delivery), `FBL-029` (independent Inspector validation with credentialed identity), `FBL-030` (human approval workflow), and `FBL-031` (capability-based upgrade) are all closed. Query, snapshot, and health endpoints are live. Commands are enforced backend-side: a command is applied only when it passes shape validation, its entity's transition graph, and every named invariant guard — otherwise it is rejected with a structured reason and zero mutation. 44 tests here, over 135 in `packages/persistence`.

**What this service does not do:** nothing decides what happens next. There is no orchestrator, scheduler, planner, or stage driver — every state transition in a real run must be submitted as an individual command. The `fbl-028`, `fbl-029:seed`, and `fbl-031:seed` scripts are standalone one-off entrypoints, unreachable from the HTTP surface. See `docs/audits/agent-city-post-v1-truth-audit.md` PV1-025.

## Security posture

**Identity is credentialed, not caller-asserted** (since `FBL-029`). `main.ts` mints one bearer credential per V1 agent plus one operator credential at every boot, held in memory and never persisted. `app.ts` resolves the caller from the `Authorization` bearer token, never from the request body; a body `actor` that contradicts the credential is refused with `403 actor_mismatch` rather than silently overridden. An anonymous caller cannot pass F-05's Inspector-only validation guard, and the browser never holds an agent credential — which is what makes a frontend self-certification attempt a denial rather than a naming coincidence.

**This service is intended for local, single-operator, trusted-network operation only.** The following limitations are real and deliberate for V1, and must not be generalized:

- **Reads are unauthenticated.** `GET /health`, `/world-state`, `/entities/*`, `/events`, and `/events/stream` require no credential. Anyone who can reach the port reads the entire operational history and live event stream.
- **The origin policy is permissive.** `Access-Control-Allow-Origin: *`. This is safe *specifically* because agent credentials are bearer tokens the browser never holds, so a permissive origin cannot replay an authority it does not possess — but it must be revisited before any networked deployment.
- **Credentials are per-boot, printed to stdout, and non-expiring.** There is no expiry, refresh, or logout. Tokens land in terminal scrollback; the operator's browser copy sits in `localStorage`. Every restart silently invalidates a previously pasted token.
- **No transport security, rate limiting, or read auditing.** Plain HTTP; `MAX_BODY_BYTES = 1_000_000` is the only request-side limit. There is no loopback-only bind enforcement.
- **Authentication as a *system* is out of scope** per `v1-scope.md` exclusions. What exists is the minimum that makes the Inspector and operator guards real.

Recorded in full as PV1-035, PV1-036, and PV1-037 of the Post-V1 truth audit.

## Endpoints

- `GET /health` — liveness check
- `GET /world-state` — the current `WorldState` snapshot (`@foundry/contracts`)
- `GET /entities/:entityType` — list all entities of a type (see `ENTITY_TYPES` in `@foundry/persistence`)
- `GET /entities/:entityType/:id` — a single entity, or 404
- `POST /commands` — body `{ commandType, entityId?, params?, actor? }` validated against `@foundry/contracts`' `CommandRequestSchema`, then enforced by `CommandHandler`. Responds `200` with `{ accepted: true, event }` when the command is legal and applied, or `{ accepted: false, reason, correctiveAction }` when it is rejected (no mutation); `400` for a malformed body or unknown `commandType`.
- `GET /events[?since=<eventId>]` — the durable event log, or only what follows `since`
- `GET /events/stream` — Server-Sent Events. Honors `Last-Event-ID` (or `?lastEventId=`) to replay exactly the events missed during a disconnect, then streams live. SSE is sufficient because delivery is one-directional — commands already travel over `POST /commands` — and it gets browser reconnect plus `Last-Event-ID` replay for free.

## Run locally

**Normally you do not start this service on its own.** From the repository root:

```sh
pnpm install
pnpm dev
```

That builds this service, starts it, waits until `/health` answers, and only then starts the frontend — see [`docs/operations/quickstart.md`](../../docs/operations/quickstart.md). It is the documented way to run Foundry (`AC-104`).

To run only the API — useful when driving it with `curl`, or when the frontend is not wanted:

```sh
pnpm --filter @foundry/api build
pnpm --filter @foundry/api start
# or, for one-shot rebuild+run:
pnpm --filter @foundry/api dev
```

**Configuration:** every variable, its default, and its effect is enumerated in [`.env.example`](../../.env.example) — the single place. This service reads `PORT` (default `4000`), `FOUNDRY_DB_PATH` (default `apps/api/data/foundry.sqlite`), and `FOUNDRY_OPERATOR_ID` (default `operator-1`). The database file is local runtime state and is git-ignored. Note that `.env` is loaded by the root `pnpm dev` launcher only; starting this service directly reads the real environment.
