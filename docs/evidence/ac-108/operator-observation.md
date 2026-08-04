# AC-108 — Operator Observation Record

**Status:** ✅ **OBSERVED AND APPROVED BY THE OPERATOR**
**Rung:** `AC-108` — Objective submission and plan review **[FEAT]**
**Observed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-03
**Observed against:** commit `2843b53` — `feat: persisted BuildPlan and operator plan review (AC-108)`

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What the operator reported

> AC-108 observed and approved.

The operator ran the observation environment — a clean database, backend mode, credential handed over automatically — against the checklist supplied at hand-off, and approved the rung.

## Standing and scope — stated precisely

- This is an **operator-reported observation**, not an assistant-witnessed one. Same standing as `docs/evidence/ac-104`, `ac-105`, and `ac-106`.
- **The operator did not enumerate individual checklist items.** They reported the rung as observed and approved as a whole. This record therefore does not claim which specific steps were performed. Each checklist item is independently carried by automated tests and by the live verification recorded below — that evidence is not a substitute for the human observation, and the human observation is not a substitute for it. Both are on the record, separately.
- It closes `AC-108` and nothing else. `AC-109` requires its own explicit operator authorization.

## Stop condition — satisfied

> *"Operator has submitted an objective **and reviewed a plan**."*

The operator's approval, given after running the environment prepared for exactly that journey, is the gate. `AC-107`'s record noted that this rung's stop condition was unmet precisely because no Architect step, no `BuildPlan`, and no plan review panel existed; all three now exist and were exercised.

## What was delivered

| Requirement | Delivered |
| --- | --- |
| **Backend truth** | `parseCommandParams` wired through the handler; `Build.Plan` persists a schema-valid plan; `Plan.Review` records a decision; `operator.plan_reviewed` joined the runtime vocabulary; one event per command; replay-deterministic and idempotent |
| **Architect path** | Deterministic, template-driven, transcribed from `v1-scope.md`. Seven fixed stages, Foundry-managed workspace, R0–R2, `claude_code` only on `backend_implementation`. Invents no requirements, acceptance evidence, budget, or runtime state |
| **Frontend** | Plan review surface with objective, seven ordered stages, runtime allocation, plain-text acceptance criteria, plan revision, budget boundary, and review status — in five distinct, individually explained states |
| **PV1-052 (assigned half)** | A plan is visibly represented **without pretending work has begun** |

**"Proceed" authorizes nothing.** Enforced in four places: the handler creates no scheduling entities, the reducer creates none, the panel says so in words, and a test asserts that after a `proceed` decision there are still **zero** `BuildStage`, `Task`, `AgentRun`, `Artifact`, and `Approval` records.

## Acceptance requirements

| ID | Requirement | Evidence |
| --- | --- | --- |
| **F-108** | An operator submits a bounded objective and the system produces exactly the declared events, a `Project`, and a `Build`; an out-of-envelope objective is rejected with a structured reason and zero mutation | Operator observation; live run; `objectiveIntake` tests |
| **F-109** | A structured plan is produced by an Architect step, persisted as backend truth, survives reload, and is rendered in both the world and the timeline. **Nothing executes** | Operator observation; `planReview.test.ts` replay test; timeline row and panel; zero scheduling entities asserted |
| **V-101** (plan portion) | The plan has a readable timeline equivalent (principle 24) | `build.planned` reads "proposal only, nothing scheduled"; `operator.plan_reviewed` reads "review recorded, no execution authorized" |

## Verification at closure

Measured at `2843b53`.

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm -r run test` → **1170 passed / 94 files / 0 failures**.

`pnpm build` was verified clean at this exact commit immediately before it was pushed, and was **not** re-run at closure: the operator's observation session was still running, and a production build writes into the same `.next` directory the live dev server is using. Stated rather than glossed.

**Live backend-mode verification** (recorded during the rung): objective submitted → three events; plan persisted with seven stages, `foundry_managed`, R2, `claude_code` on `backend_implementation` only; a stale revision refused; an unauthenticated review refused; a review recorded; a conflicting second decision refused; the review readable as backend truth; the timeline showing all four events; **every scheduling entity table empty**; and the plan and its review surviving an API restart against the same database.

## Two defects found during the rung

Both were caught by live verification rather than by the suite, both were fixed before the commit, and both now have regression tests:

1. **The reported `planId` was the build id.** `Build.Plan` is addressed to the *build*, so returning the command's `entityId` handed the caller a build id labelled as a plan id.
2. **The authorization refusal for `Plan.Review` said "Resolving an approval requires an authenticated operator."** A plan reviewer would have gone looking for an approval that does not exist. The guard now names the actual act.

## Specification amendments made

| Document | Amendment |
| --- | --- |
| `domain-model.md` | `Plan.Review` added to the closed command vocabulary; `Plan` recorded as a persisted record with its invariants |
| `event-model.md` | `operator.plan_reviewed` joined the runtime vocabulary with its reducer and projection disposition; `build.planned` gained an optional `plan` field, and why it is optional |

The vocabulary grew by exactly one command, at the rung that needed it, as `AC-107` said it would.

## Operator data preserved

The operator's pre-`AC-108` database was **renamed, not deleted**, so the observation could start from a clean state:

```
apps/api/data/foundry.sqlite.pre-ac108-20260803-231037
```

Restoring it: stop Foundry, rename back to `foundry.sqlite`, restart.

## AC-103P residue

**Cleared:** the Architect step, the `BuildPlan`, and the plan review panel — the three things `AC-107`'s record listed as owed to this rung — now exist. `parseCommandParams` is wired. `operator.plan_reviewed` is in the runtime vocabulary. PV1-052's *empty world* half is resolved.

**Still owed:** `AC-110` — the execution authorization gate, single-use enforcement against persisted state, the backend-generated SHA-256 plan binding required by `F-113a`, `planContentHash` made required, and `operator.execution_authorized`'s entry into the runtime vocabulary.

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | Open, undiagnosed | `AC-103` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (N-06) | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails, pre-existing | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded; drifted again during this observation | `AC-119` |
| Authorization guards answering `200` rather than `403` | Recorded candidate | A later rung owning the API surface |

`AC-109` is **not started** and requires its own explicit operator authorization.
