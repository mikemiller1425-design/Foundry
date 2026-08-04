# AC-108 — Persisted BuildPlan and Operator Plan Review

**Type:** Rung deliverable record
**Rung:** `AC-108` — Objective submission and plan review **[FEAT]**
**Date:** 2026-08-03
**Status:** Implemented; **awaiting operator observation**. The rung is not closed.

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What this rung does, and what it refuses to do

The Architect creates one schema-valid `BuildPlan` for the active Build, it is persisted as backend truth, the frontend displays it, and the operator records a review of it.

**"Proceed" records a review. It authorizes nothing.** No execution, no invocation, no scheduling, no queueing. That separation was an approved `AC-107` contract decision and it is enforced here in four places: the command handler creates no scheduling entities, the reducer creates none, the panel says so in words, and a test asserts that after a `proceed` decision there are still zero `BuildStage`, `Task`, `AgentRun`, `Artifact`, and `Approval` records.

## 1. Backend truth

| Piece | Where |
| --- | --- |
| `parseCommandParams` wired into the handler | `commandHandler.ts` — runs after authorization (so it is not a schema oracle) and before every state guard |
| `Build.Plan` persists the plan | `build.planned` gains an **optional** `plan` field; reducer stores a `plans` record |
| `Plan.Review` records the decision | New command; `operator.plan_reviewed` joins the runtime vocabulary |
| Projection | `WorldState.currentPlan` — optional, so every V1 fixture stays valid |

**One event per command** — asserted. **Replay-deterministic and idempotent** — the plan and the review both survive a process restart against the same database, and a replayed `build.planned` will not reset a recorded review.

**Refusals are specific.** A plan for a different build, a plan whose objective is not the build's, an invented stage, `claude_code` on the wrong stage, a missing build, a second plan, a stale revision, an unauthenticated caller, and a conflicting second decision each produce their own reason, with zero mutation.

## 2. The Architect path

`apps/api/src/architect/planBuild.ts` — **deterministic and template-driven**, transcribed from `v1-scope.md` § "V1 Build Stages".

That is the design, not a placeholder: `interface-model.md` prohibits "unrestricted natural-language autonomous planning", and the seven stages, their locations, and their runtimes are already fixed by specification. What varies with the objective is the objective, carried through verbatim.

It invents no requirements, no acceptance evidence, no budget, and no runtime state. A test asserts the serialised plan contains no `maxBudgetUsd`, `authorization`, `status`, `startedAt`, or `agentRun` field.

`claude_code` is allocated to `backend_implementation` and nowhere else — the `AC-107` rule, satisfied by construction and asserted.

## 3. Frontend

`PlanReviewPanel` shows the objective, workspace, risk class, plan revision, all seven ordered stages with their runtime allocation, plain-text acceptance criteria, the budget boundary, and the review status.

Five distinct states, each with its own `data-plan-state` and its own explanation: **unreachable**, **empty** (no build), **no-plan** (a build exists but no plan does), **awaiting-review**, **reviewed**. A test asserts they are four distinguishable values, so none is silent.

*Proceed* is labelled "Records that you read this plan. **Authorizes no execution.**" A recorded proceed decision reads "Review recorded. No execution was authorized by this decision."

Selection remains UI-only and separate from persisted decisions — unchanged from `AC-106`.

## 4. PV1-052 — the assigned half

**Resolved.** Backend mode previously presented an empty world with nothing to look at. Once a plan exists it is visibly represented — objective, stages, runtimes, criteria — **without pretending work has begun**: no stage appears in the Stages list, the world shows no activity, and the timeline row for `build.planned` reads "proposal only, nothing scheduled".

The remaining half of PV1-052 — a world that shows *running* work — is `AC-109`'s, by definition.

## 5. Specification amendments

| Document | Amendment |
| --- | --- |
| `domain-model.md` | `Plan.Review` added to the command vocabulary; `Plan` recorded as a persisted record with its invariants |
| `event-model.md` | `operator.plan_reviewed` joins the runtime vocabulary with its reducer and projection disposition; `build.planned` gains an optional `plan` field, and why it is optional |

The closed vocabulary grew by exactly one command, at the rung that needed it, as `AC-107` said it would.

## 6. Two defects found by live verification

Both were caught by running the real thing, not by the suite, and both are now covered by regression tests.

1. **The reported `planId` was the build id.** `Build.Plan` is addressed to the *build*, so returning the command's `entityId` handed the caller a build id labelled as a plan id.
2. **The authorization refusal for `Plan.Review` said "Resolving an approval requires an authenticated operator."** A plan reviewer would have gone looking for an approval that does not exist. The guard now names the actual act.

## 7. Verification

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1170 passed / 94 files / 0 failures** (up from 1121).

**Live, against a running backend:** objective submitted → three events; plan persisted with seven stages, `foundry_managed`, R2, `claude_code` on `backend_implementation` only; a stale revision refused; an unauthenticated review refused; a review recorded; a conflicting second decision refused; the review readable as backend truth; the timeline showing all four events; **every scheduling entity table empty**; and the plan and its review surviving an API restart against the same database.

## 8. Still open

`AC-109` (orchestration), `AC-110` (the authorization gate and the SHA-256 plan binding required by `F-113a`), Finding 6 (`AC-103`), D-8, N-03, N-05, N-06.

`AC-109` is **not started** and requires its own explicit operator authorization.
