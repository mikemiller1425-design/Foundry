# AC-107 — Contract Boundary Record

**Type:** Rung deliverable record
**Rung:** `AC-107` — Bounded-objective contract **[FEAT]**
**Date:** 2026-08-03
**Status:** Implemented; **awaiting operator contract review**. The rung is not closed.

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What this rung did and did not do

`AC-107` makes the V1.1 build boundary **explicit, typed, and fail-closed before any Architect planning or execution exists**. It is a contract-only rung: nothing produces a plan, nothing reviews one, nothing authorizes execution, and nothing runs.

The stop condition is *"contracts and amendments merged with tests green — hard stop before any consumer is written."*

## 1. The typed boundary

| Contract | File | What it makes impossible |
| --- | --- | --- |
| `ObjectiveSubmissionSchema` | `packages/contracts/src/objective.ts` | An unbounded objective, an operator-nominated workspace, an R3+ risk class, an unknown field |
| `BuildPlanSchema` | `packages/contracts/src/plan.ts` | A plan with an invented stage, a missing stage, a duplicate, a reordering, a runtime the platform lacks, or a widened workspace/risk |
| `ExecutionAuthorizationSchema` | `packages/contracts/src/authorization.ts` | A multi-use authorization, a build-wide authorization, an unbounded budget, an authorization that outlives the plan it was granted against |
| `COMMAND_PARAM_SCHEMAS` | `packages/contracts/src/commands.ts` | Malformed parameters for the three commands whose fields V1.1 defines |

### The three properties the mission depends on

1. **Workspace.** `OBJECTIVE_WORKSPACES` has exactly one member, `foundry_managed`. An operator-nominated directory is not "rejected" — it is **unrepresentable**. Decision 2 requires this because write confinement for a real run is post-hoc detection, not prevention, so the only defensible workspace is one Foundry creates and destroys.
2. **Risk.** `V1RiskClassSchema` admits R0–R2 only; R3–R5 remain unrepresentable (principle 19). The plan and the authorization each **re-state and re-validate** the class rather than inheriting it, so no later step can widen what an earlier one bounded.
3. **Stages.** `BUILD_STAGE_SEQUENCE` is transcribed from `v1-scope.md` § "V1 Build Stages". A plan must contain exactly those seven, once each, in that order. Dynamic or generated stage sets are prohibited work for this mission.

### Plan-binding

`fingerprintPlan()` is what makes `F-113`'s "a modified plan invalidates it" checkable rather than aspirational: a content hash over everything an operator would have reviewed. `authorizesPlan()` compares an authorization against a plan and returns **every** mismatch, so a reviewer sees all of them at once.

It is a **change detector, not a security primitive** — dependency-free and synchronous because `packages/contracts` is imported by the browser bundle. Nothing here defends against a chosen-collision attacker, and nothing asks it to.

## 2. No frontend-only value can widen authority

The objective form previously held its own `["R0", "R1", "R2"]` literal and its own `"foundry_managed"` string. Two lists that must agree and are maintained apart eventually disagree, and the direction that matters is a frontend quietly offering something the contract forbids.

`V1_RISK_CLASSES` and `DEFAULT_OBJECTIVE_WORKSPACE` are now exported from the contract and read by the form, which is tested three ways: the offered options equal the contract's list exactly, every offered option is accepted by the schema, and the submission the form produces parses against `ObjectiveSubmissionSchema`.

## 3. Specification amendments made

All recorded at the rung that owns them, per the V1.1 mission's rule that a specification change is "made as a recorded amendment at the rung that owns it, never silently".

| Document | Amendment |
| --- | --- |
| `docs/02-specification/domain-model.md` → Build | "demo objective fixed" superseded: the objective is operator-submitted within the bounded envelope. "One active build" unchanged. `currentStageId` nullable **confirmed** (originally made at `AC-103P`) — still a required field, `null` expressing a Build before any stage |
| `docs/02-specification/domain-model.md` (new section) | Per-command parameter schemas for `Project.Create`, `Build.Create`, `Build.Plan` — three commands specifically. Vocabulary unchanged; every other command stays envelope-only |
| `docs/02-specification/event-model.md` (new section) | `operator.plan_reviewed` and `operator.execution_authorized` declared, with their status: typed now, joining the runtime vocabulary at the rung that produces each |
| `docs/00-foundry/principles.md` 3a | Status statement only — the condition "until a persisted backend exists" has lapsed; the mock is retained as a selectable mode and principle 2 is not relaxed. **No meaning change** |

**Not amended, deliberately:** `v1-scope.md` § "V1 Build Stages" (the seven stay fixed), `exclusions.md` (every V1 exclusion carries forward), `v1-acceptance.md` (frozen V1 record).

## 4. Two deliberate restraints

Both are places where doing more would have been easy and wrong.

**The new events are declared but not in the runtime vocabulary.** `ALL_EVENT_SCHEMAS` feeds `EVENT_TYPES`, which is asserted against the mock runtime's event→world projection map. Joining the union now would force changes to the mock runtime, whose canonical fixture is the frozen V1 regression baseline. More fundamentally: nothing produces them, and an event type the system cannot emit is a claim it does not honour. They join at `AC-108` and `AC-110` respectively.

**The parameter schemas are declared but not wired into `CommandRequestSchema`.** Moving them there would convert handler-level refusals (HTTP 200 with a stated reason) into transport-level rejections (HTTP 400) — a behaviour change, in a rung whose stop condition is "hard stop before any consumer is written". `parseCommandParams` is the seam `AC-108` wires in.

## 5. AC-103P residue

### Cleared by this rung

| Item | How |
| --- | --- |
| The **objective envelope** existed but was undocumented as a specification change | Confirmed, and the `currentStageId` amendment it introduced is now formally recorded in `domain-model.md` |
| **Plan and authorization contracts did not exist** | Both now defined, with negative tests |
| The **specification amendments `AC-107` owns were unmade** | All four made and recorded (§3) |

### Still owed, and by whom

| Item | Owner |
| --- | --- |
| Architect planning step; a plan persisted as backend truth; plan review panel; plan rendered in world and timeline | `AC-108` |
| Wiring `parseCommandParams` into command handling | `AC-108` |
| `operator.plan_reviewed` into the runtime event vocabulary, with reducer disposition and projection-map entry | `AC-108` |
| Execution authorization gate; single-use enforcement against persisted state; a command type to carry it if one is wanted | `AC-110` |
| `operator.execution_authorized` into the runtime event vocabulary | `AC-110` |
| PV1-052's *empty world* half — backend mode has nothing to look at until a build has stages | `AC-108` |

## 6. Verification

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1098 passed / 91 files / 0 failures** (up from 1033).

Contract package alone: **128 tests**, covering every positive and negative case `F-107` names — too-short and over-long objective, disallowed workspace, R3+ risk, unknown stage name, malformed plan, malformed authorization.

## 7. Still open, unchanged by this rung

Finding 6 (`AC-103`), D-8 (`AC-117`), N-03 and N-05 (`AC-119`), N-06 — the six stale screenshot baselines (`AC-117`/`AC-119`), and the recorded candidate of having authorization guards answer `403` rather than `200` (a later rung owning the API surface).
