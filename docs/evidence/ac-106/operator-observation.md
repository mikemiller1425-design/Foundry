# AC-106 — Operator Observation Record

**Status:** ✅ **OBSERVED AND REPORTED BY THE OPERATOR**
**Rung:** `AC-106` — Backend-mode command honesty **[FIX]**
**Observed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-03
**Observed against:** commit `ceca998` — `fix: backend-mode command honesty (AC-106)`

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What the operator observed

Reported item by item:

| # | Observed | Result |
| --- | --- | --- |
| 1 | Backend-mode demo controls | **PASS** |
| 2 | Missing credential gives **Not authorized** | **PASS** |
| 3 | *Use this session's credential* restores access | **PASS** |
| 4 | Too-short objective gives field validation | **PASS** |
| 5 | Building selection is immediate and does not duplicate its timeline event | **PASS** |
| 6 | Mock mode has working demo controls and no credential panel | **PASS** |
| 7 | Backend-unreachable state | **Not manually repeated** — the operator recorded it as covered by the rung's live verification |

Item 2 is the one that matters most for this rung's correction: an operator command submitted without a credential returns HTTP `200` with `accepted: false`, and the first implementation classified that as *"Blocked by current state"*. The operator observing **"Not authorized"** confirms the corrected classification in the running application, not only in tests.

Item 5 confirms both halves of the `building.selected` disposition: selection stays immediate because it is local React state, and the dedup guard prevents a repeat click from appending a second event.

Item 6 confirms the mock runtime is unchanged — the regression baseline is intact and the disposition is genuinely mode-specific.

## Standing and scope — stated precisely

- This is an **operator-reported observation**, not an assistant-witnessed one. Same standing as `docs/evidence/ac-104/operator-observation.md` and `docs/evidence/ac-105/operator-observation.md`.
- **Two of the six failure kinds were not personally observed.** The operator recorded `unreachable` as covered by the rung's live verification rather than repeated by hand, and did not report exercising the `blocked` case (a second objective refused by the one-active-project rule). Both are carried by automated tests and by the live run recorded below — **not** by a human observation, and this record does not claim otherwise.
- It closes `AC-106` and nothing else. It authorizes no further rung.

## Stop condition — satisfied

> *"Zero silent no-ops; F-07 holds in both modes."*

| Clause | Evidence |
| --- | --- |
| **Zero silent no-ops** | The operator pressed the backend-mode controls and each produced a truthful, readable result (items 1–5). Demo controls are disabled with a stated reason and post nothing; `send()` refuses by construction. |
| **F-07 in backend mode** | Rejected commands are visible and classified — observed for `unauthorized` (item 2) and `validation` (item 4). |
| **F-07 in mock mode** | Item 6: demo controls work exactly as at V1; the canonical fixture is byte-identical and the mock suites are unchanged. |

## Automated and live evidence

Measured at `ceca998` on a tree with no uncommitted tracked changes.

**Gates:** `pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1033 passed / 85 files / 0 failures** (up from 988; 45 new tests).

**Live backend-mode verification** — every case classified as expected against a running API:

| Case | HTTP | Classified |
| --- | --- | --- |
| `demo.start` — not in the closed vocabulary | 400 | `unsupported` |
| `Approval.Approve` — no credential | 200 | `unauthorized` |
| `BuildStage.Validate` — frontend is not the Inspector | 200 | `unauthorized` |
| `Build.Start` — no such build | 200 | `blocked` |
| `Task.Queue` — declared, no backing event | 200 | `blocked` |
| `Building.Select` — the declared UI ack | 200 | accepted; `building.selected` present in `/events` |

`unreachable` is covered by unit tests over `unreachableBackend` and by the provider test that a disconnected stream reports unreachable rather than an invalid command.

## Acceptance requirements satisfied

| ID | Requirement | Evidence |
| --- | --- | --- |
| **F-105** | Zero silent no-ops in backend mode; a 400, a 403, and a network failure each render distinguishable text | Six classified kinds with distinct titles and actions; live run above; operator items 1–5 |
| **F-106** | V1's `F-07` holds in **both** runtime modes | Operator items 2, 4 (backend) and 6 (mock); `CommandBar` tests assert both modes |

## AC-103P residue assigned to this rung — cleared

| Item | Disposition |
| --- | --- |
| **PV1-012** — command bar silently no-ops | Closed. Addressed at `AC-103P`, completed here: every control now states its outcome, and the demo controls no longer pretend to be actionable. |
| **PV1-013** — `building.selected` is mock-only | Closed. Emitted backend-side via the declared `Building.Select` command. Operator-observed (item 5). |
| **Demo-control disposition** | Decided and implemented: disabled in backend mode with the reason stated. Recorded in `docs/evidence/ac-106/control-dispositions.md`. |
| **PV1-052** — backend mode presents an empty, inoperable world | The *inoperable* half is closed here. The *empty* half remains with `AC-108`, which is where a build becomes something to look at. |

## Correction made during the rung

The first implementation classified failures purely on HTTP status. Live verification proved that wrong: `CommandHandler`'s authorization guards answer `200` with `accepted: false`, so a status-only rule filed a missing credential under *"Blocked by current state"* — sending the operator to satisfy a prerequisite when the fix was to supply a credential.

Corrected before commit by recognising the guards' phrasing in one confined function, `isAuthorizationRefusal`, kept distinct from the narrower `isAuthFailure` that drives the credential panel so the Inspector-only guard (F-05) cannot falsely mark the operator's own credential rejected. Rationale and the structural alternative are in `docs/evidence/ac-106/control-dispositions.md` § Decision 3. The operator's item 2 confirms the corrected behaviour in the running application.

## Prohibited work — confirmed not done

No `demo.*` command type was added to the backend vocabulary. No free-text command input was introduced. No orchestration. **No backend file changed** — backend authority, `PrincipalRegistry`, and approval semantics are untouched. Runtime-mode and credential-handoff behaviour are unchanged except for the shared authorization predicate, which was extended rather than altered.

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | Open, undiagnosed | `AC-103` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (N-06) | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails, pre-existing | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded | `AC-119` |
| Authorization guards answering `200` rather than `403` | Recorded as a candidate structural fix | A later rung owning the API surface |
| `AC-103P` residue | `AC-107` and `AC-108` still owed | `AC-107`, `AC-108` |

`AC-107` is **not started** and requires its own explicit operator authorization.
