# AC-109 — Backend Orchestration of a Build (Mock Executor)

**Type:** Rung deliverable record
**Rung:** `AC-109` — Backend orchestration of a build (mock executor) **[FEAT]**
**Date:** 2026-08-04
**Status:** Implemented; **awaiting operator observation**. The rung is not closed.

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What this rung does, and what it refuses to do

A reviewed `BuildPlan` is advanced through the fixed stage sequence by the deterministic **mock executor**, and the run stops at the approval gate.

**Nothing executes.** No process is spawned, no shell is run, no network call is made, no model is invoked, no file is written outside the existing local test and runtime paths, and no money is spent. The `backend_implementation` stage — the one the plan allocates to the `claude_code` runtime — is advanced with `runtimeType: "mock"` like every other stage, and every event it produces says so.

**No execution authorization is created.** Starting a run permits the mock executor to advance a reviewed build. Authorizing a real model invocation is a separate, single-use act that does not exist yet (`F-113`, `AC-110`).

## 1. The orchestrator is a client of `CommandHandler` and nothing else

This is the rung's load-bearing property, and it is enforced by **what is reachable**, not by review.

`BuildOrchestrator`'s constructor takes a `CommandHandler` and a pacing option. It is never handed a `PersistenceService`. It therefore has no `appendEvent`, no reducer, no database handle, and no second write path — the shape `ObjectiveIntake` established at `AC-103`, kept at the rung where breaking it would have been faster and simpler.

The persisted plan is read at the **route** layer, which already owns database access, and handed to the orchestrator as data.

| Proof | Where |
| --- | --- |
| Runs correctly when given a `CommandHandler` and nothing else | `buildOrchestrator.test.ts` |
| Writes **nothing at all** when its handler refuses everything | `buildOrchestrator.test.ts` |
| Source names no write primitive (`F-111`, asserted literally, comments stripped) | `buildOrchestrator.test.ts` |

The literal source assertion strips comments first. That is not a loophole: the module comment *documents* that there is no `appendEvent` path, so a naive text search would pass or fail on how the file is described rather than on what it does.

## 2. Where the run stops, and why there

At the **approval gate**, between `qa_validation` and `deployment_package`.

`v1-scope.md` stage 7 is the "approval-gated transfer to the Deployment Dock", and `domain-model.md` Transfer invariant 4 gates the `qa_to_deployment_dock` leg on an approved `Approval`. So **six stages** are orchestrated to completion, an `Approval` is requested, and the run stops — deliberately leaving the seventh stage **uncreated**, because creating it would claim gated work had begun. This matches the canonical run's own ordering exactly (`stage.completed` on QA → `approval.requested` → the deployment stage).

No transfer is created and no vehicle moves: transfers are `AC-113`'s.

## 3. Fixed order, and how it is proven

`planOrchestration(plan)` is **pure** — same plan in, same ordered step list out, with no clock, no randomness, and no state read. Stage order is therefore a property of a list, provable without a database, rather than something observed once in a live run.

Stage entity ids come from `plannedStageId` in `@foundry/contracts`, the same function the Architect used to write `build.planned.stageIds`. One definition, so the plan the operator reviewed and the stages that ran are the **same list** rather than two lists that look alike.

## 4. Who acts

Actor attribution mirrors the canonical run, because the canonical run is the reference for what each event means.

| Acts as | For | Events in the live run |
| --- | --- | --- |
| the assigned **agent** | assignment, travel, work, starting its run | 37 |
| **runtime_adapter** `runtime-adapter-mock` | reporting a run's result | 6 |
| **backend** | stage lifecycle, artifacts, requirements, the approval | 55 |
| the **Inspector** agent | the independent validation decision | (within the 7 above) |
| the **operator** | objective, plan, review, start | 5 |

**Stated plainly:** the mock executor stands in for the agent runtimes, so it submits commands under agent identities supplied by the process that mints agent credentials. That is a real limitation of a simulated run. At `AC-111` a real agent runtime presents its own credential instead.

What is **not** relaxed is the independence the guard actually enforces. Two tests assert it survives: a validation submitted by the backend is refused, and an Inspector citing evidence the Inspector itself created is refused. In the live run the QA artifact's `createdByAgentId` is `backend` and the validator is `agent-inspector` — different parties, which is the whole point of `F-05`.

## 5. Every illegal start is refused, by name (`F-112`)

Six conditions, six reasons, six fixes. A single "cannot start" would leave the operator guessing.

| Condition | HTTP | Reason |
| --- | --- | --- |
| No operator credential | 403 | "Starting a build requires an authenticated operator…" |
| An agent credential | 403 | same |
| No plan for the build | 404 | "…nothing to orchestrate: the stages, their order, and their requirements all come from the plan." |
| Plan not reviewed | 409 | "…A build is not started from a plan nobody read." |
| Plan reviewed as `rejected` / `revision_requested` | 409 | names the recorded decision and its reviewer |
| Build already started | 409 | "Build … is running, not planned — a build is started once." |
| Plan changed after review | 409 | names both revisions |

The start guard runs **ahead of** the generic transition check. Left to the generic check, a second `Build.Start` answered *"Illegal transition for Build …: waiting_for_approval → running"* — true and useless. That was found in test and fixed before commit.

Duplicate starts cannot race: `Build.Start` is submitted synchronously and `CommandHandler.submit` is synchronous, so the second request finds the build already running before its first stage exists.

## 6. `waiting_for_approval`, by derivation (`F-110`)

`domain-model.md` lists `waiting_for_approval` in the Build lifecycle, but **no `build.*` event in `event-model.md` produces it** — and none was added. The V1 post-`FBL-001` audit already recorded that these Build states are "plausibly derived compositionally from Stage/Approval/Revision events". `approval.requested` now performs that derivation, **only when the current Build is `running`**, so an upgrade-path approval cannot drag a finished build backwards.

The frontend mock reducer is deliberately unchanged — the mock runtime and its fixture are the frozen regression baseline. The divergence is intermediate-state only; `build.completed` still lands both reducers on `completed`, which is what the canonical replay test compares.

## 7. The mock is never in small print

An operator watching stages tick past must not be able to conclude that Claude Code ran. So it is stated in five places, not one:

1. The panel heading — "Build run — **mock executor**".
2. A standing statement: "Simulated run… No Claude Code is invoked, no process is started, and no money is spent."
3. The allocation note, naming the stage the plan gave to `claude_code` and saying the mock executes it here.
4. **The stage row itself** — `backend_implementation` reads `mock (planned: claude_code)`, visible while that stage runs rather than only in a banner above.
5. The run control — "Run this plan with the **mock executor**… Nothing is executed."

And in backend truth: every `agentrun.started` carries `runtimeType: "mock"`, which the timeline already renders as "Run started (mock, risk R2)". The response body carries `simulated: true` and `executor: "mock"` on **every** answer, success or refusal — and the client reads those fields rather than hard-coding them, so it cannot keep claiming "simulated" if the backend one day stops being.

## 8. The approval gate is not a silent no-op

Resolving the approval records a decision and advances nothing — which is exactly what `AC-113` owns. Left unsaid, that would be the silent no-op `F-105` exists to remove, so it is said in the approval's own `recommendedAction`, carried in the event payload rather than living only in a panel:

> "Review the QA evidence, then record your decision. This run was performed by the mock executor and no code was executed. Resolving this approval records the decision only — orchestration past this gate is not implemented in this rung."

**Verified live:** approving it produced exactly one event, left the build at `waiting_for_approval`, created no transfer, and left the stage count at six.

## 9. Specification amendments

| Document | Amendment |
| --- | --- |
| `event-model.md` | `approval.requested` derives the Build's `waiting_for_approval` state, scoped to a running build, with the mock-reducer divergence recorded |
| `domain-model.md` | `Build.Start` gained an authenticated-operator requirement and the reviewed-plan preconditions; recorded as **not** an execution authorization |

**No new event type and no new command type.** The closed vocabulary is unchanged — every one of the ~99 steps a run submits is a command already in `COMMAND_TYPES`, asserted by test.

## 10. Verification

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1239 passed / 89 files / 0 failures** (up from 1170).

**Preservation, checked rather than assumed:** `v1-canonical-run.json` is **byte-identical to `HEAD`** (`7775b5ce8ca4125df4592951b9ce3034ab9b3ddddb4cff9b01ad28ce1a059811`). The mock runtime's behaviour files — `runtime.ts`, `script.ts`, `worldStateReducer.ts`, `eventFactory.ts` — are untouched. The only change under `mock-runtime/` is one **optional** field on the shared `RuntimeContextValue` interface, which the mock provider does not supply; the same shape `AC-108` added for `reviewPlan`.

### Live backend-mode verification

Run against an **isolated** API instance on port 4100 with its own temporary database, so the operator's still-running `AC-108` observation session on ports 3000/4000 was not disturbed. Confirmed still listening afterwards.

| Checked | Result |
| --- | --- |
| Start before review | 409 `not_startable`, names the unreviewed plan |
| Start with no credential / an agent credential | 403 `unauthorized`, both |
| Start for an unknown build | 404 `no_plan` |
| Start after review | **202**, `stepCount: 99`, `stopsAt: approval_gate`, `simulated: true`, `executor: mock` |
| Duplicate start, immediately | 409 — "is running, not planned — a build is started once" |
| Stages | six, in sequence, all `completed`; **no `deployment_package`** |
| AgentRuns | six, **all `runtimeType: mock`**; `claude_code` runs: **0** |
| Transfers / upgrades / revisions | **0 / 0 / 0** |
| Independent validation | validator `agent-inspector` (role `inspector`); evidence authored by `backend` |
| Build status | `waiting_for_approval` |
| Approval | one, `pending`, with the honest `recommendedAction` |
| Event log | 103 events; `approval.approved`, `transfer.started`, `build.completed`, `upgrade.eligible`, `stage.failed`, `agentrun.failed` all **0** |
| Restart against the same database | `/world-state` **identical**; 103 events; a further start still refused |

## 11. Two defects found before commit

Both were caught by the test suite rather than by review, and both now have regression coverage:

1. **The duplicate-start refusal named a state machine, not the operator's act.** The generic transition check ran first and answered "Illegal transition for Build …: waiting_for_approval → running". The named guard now runs ahead of it.
2. **The `F-111` source tripwire was defeated by the module's own prose.** The comment documenting that there is no `appendEvent` path tripped the literal search. The assertion now scans code with comments stripped, which is the difference between testing the code and testing its description.

## 12. Still open

`AC-110` (the execution authorization gate, single-use enforcement, and the backend-generated SHA-256 plan binding required by `F-113a`), `AC-111` (real controlled Builder execution), `AC-113` (carrying a build past the approval gate, transfers, and the upgrade), Finding 6 (`AC-103`), D-8, N-03, N-05, N-06.

`AC-110` is **not started** and requires its own explicit operator authorization.
