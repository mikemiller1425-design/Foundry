# AC-104 — Operator Observation Record

**Status:** ✅ **OBSERVED AND REPORTED BY THE OPERATOR**
**Rung:** `AC-104` — One-command local operation **[HARD]**
**Observed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-03
**Observed against:** commit `4e7d0f6` — `feat: one-command local operation (AC-104)`

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What the operator observed

Reported verbatim in substance:

> `pnpm dev` started both services, the app opened, and Ctrl-C stopped both cleanly.

That is the rung's stop condition — *"Operator confirms single-command launch"* — and it is met.

## Standing and scope of this record

Stated precisely, because the distinction matters:

- This is an **operator-reported observation**, not an assistant-witnessed one. The assistant did not observe the operator's session. It carries exactly the weight the operator's own report carries — the same standing as `docs/evidence/fbl-035/real-safari-observation.md` and `docs/evidence/ac-103p/operator-verification.md`.
- The operator confirmed the **single-command launch, the app opening, and clean shutdown**. They did not state that they ran it from a freshly cloned directory, and this record does not claim they did. The **clean-clone** dimension of `F-101` was verified by the scripted check instead — see below — which is automated evidence, not a human observation.
- It closes `AC-104` and **nothing else**. It authorizes no further rung.

## Automated evidence at this commit

All measured at `4e7d0f6`, on a working tree with no uncommitted tracked changes.

**`pnpm verify:launch` — 8 passed, 0 failed.** Run twice: once in the working tree, and once inside a **genuine clean clone** (fresh `git clone`, with `node_modules`, `apps/api/dist`, `apps/agent-city/.next`, and `apps/api/data` all confirmed absent beforehand, then `pnpm install` and the single command).

| Check | Result |
| --- | --- |
| One command starts both processes and reports ready | PASS |
| Deterministic ordering — API healthy **before** the frontend starts | PASS |
| API `/health` returns 200 | PASS |
| Frontend serves 200 | PASS |
| SIGINT terminates the launcher | PASS (exit 0) |
| SIGINT exit status is clean | PASS (exit 0) |
| API port released after shutdown | PASS |
| Frontend port released after shutdown | PASS |

Additionally checked by hand: SIGINT delivered to the launcher **PID** rather than its process group — the real Ctrl-C path — also tears down the whole tree with exit 0 and releases both ports. `--help`, unknown-option, same-port, and busy-port cases each exit 1 with a stated problem and a stated action.

**Gates:** `pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **928 passed / 80 files / 0 failures** (contracts 68, ui 18, world-model 7, event-types 14, runtime-adapters 128, persistence 169, agent-city 467, api 57). Unchanged from before the rung, as expected: `AC-104` touched no application source.

## Acceptance requirements satisfied

| ID | Requirement | Evidence |
| --- | --- | --- |
| **F-101** | One documented command from a clean clone starts both processes with deterministic ordering; `/health` returns 200; the frontend serves 200; SIGINT shuts both down cleanly | `pnpm verify:launch` 8/8, including a real clean clone; operator observation of launch and shutdown |
| **F-102** | Every configuration variable is enumerated in one place with its default and effect | `.env.example` — every variable read by source, with default and effect |

## Prohibited work — confirmed not done

No Docker, compose, cloud deployment, process supervisor, or production packaging. **No application behaviour changed** — the commit touched no file under `apps/*/src/` or `packages/*/src/`. The loopback boundary is unchanged.

## What this rung deliberately did not fix

Both belong to `AC-105`, are stated in `docs/operations/quickstart.md` and `.env.example`, and remain open:

1. **The operator still pastes the credential.** The launcher surfaces the operator token in its banner because the API already prints it; the browser does not receive it automatically.
2. **A production build remains mode-locked.** Next inlines `NEXT_PUBLIC_*` at build time, so `pnpm start` bakes in the mode it was built for (PV1-028). `pnpm dev` is unaffected.

## Defect found and fixed during the rung

The first port probe bound `127.0.0.1` and reported a port free when an existing listener was bound to the IPv6 wildcard — how Node's own `server.listen(port)` binds. The launcher then started a second API, failed to bind, and health-checked a **different process's** API, reporting a healthy launch that was not its own. It now probes by connecting. Found by manual check, not by the test suite; the corrected behaviour is asserted by the busy-port case.

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | Open, undiagnosed | `AC-103` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (N-06) | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails on 28 files, pre-existing | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded; observed again during this rung and reverted | `AC-119` |
| `AC-103P` residue | Recorded | `AC-105`–`AC-108` |

`AC-105` is **not started** and requires its own explicit operator authorization.
