# AC-107 — Operator Contract Approval

**Status:** ✅ **APPROVED BY THE OPERATOR**
**Rung:** `AC-107` — Bounded-objective contract **[FEAT]**
**Approved by:** mikemiller1425-design (human operator)
**Date:** 2026-08-03
**Approved against:** commit `29dbcbc` — `fix: AC-107 corrections from the operator contract review`
**Prior review:** approved with required corrections against `1a184f1`; all three corrections applied in `29dbcbc` before this approval.

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## The approved contract decisions

Recorded verbatim in substance, as the operator stated them. These are now the settled V1.1 build boundary.

| # | Decision |
| --- | --- |
| 1 | **Objectives are 12–500 printable single-line characters.** |
| 2 | **Workspace remains Foundry-managed only.** |
| 3 | **Risk classes remain R0–R2 only.** |
| 4 | **The seven-stage plan vocabulary and order are fixed.** |
| 5 | **Plain-text acceptance criteria are appropriate for V1.1.** |
| 6 | **Plan review and execution authorization remain separate decisions.** |
| 7 | **Every issued `ExecutionAuthorization` requires a positive finite `maxBudgetUsd` capped at $25.** |
| 8 | **`planRevision` is a non-security change indicator only.** |
| 9 | **`AC-110` must implement the backend-generated SHA-256 canonical plan-content hash, persist it, require it on authorization, and compare it server-side.** |
| 10 | **Claude Code may appear only once and only for `backend_implementation`.** |
| 11 | **No execution is authorized by this approval.** |

### Where each is enforced

| Decision | Enforced by |
| --- | --- |
| 1 | `ObjectiveTextSchema` — trim, 12–500, control characters refused |
| 2 | `ObjectiveWorkspaceSchema` — single-member enum; any other value is unrepresentable |
| 3 | `V1RiskClassSchema` — R0–R2; re-stated and re-validated on the plan and the authorization, so no later step can widen an earlier one |
| 4 | `BUILD_STAGE_SEQUENCE` + `BuildPlanSchema.superRefine` — exactly seven, once each, in order |
| 5 | `AcceptanceCriterionSchema` — bounded plain text, deliberately not executable |
| 6 | `operator.plan_reviewed` and `operator.execution_authorized` are distinct events; `decision: "proceed"` confers no execution permission |
| 7 | `BudgetUsdSchema` — required, positive, finite, `max(25)` |
| 8 | `planRevision()` documentation and `authorizesPlan()` doc note; not represented as a binding anywhere |
| 9 | **Not implemented here.** Recorded as a requirement in the ladder § AC-110 and as `F-113a` in `v1.1-acceptance.md` |
| 10 | `CLAUDE_CODE_STAGE` + `BuildPlanSchema.superRefine` — named stage, and at most one |
| 11 | Nothing in this rung produces, persists, reviews, authorizes, or runs anything |

## Standing and scope of this approval

Stated precisely, as with every prior rung record:

- This is an **operator contract approval**. The operator read the contract package and approved it; the assistant did not observe anything on their behalf.
- **It authorizes no execution.** Decision 11 is explicit, and the rung produced no producer, no consumer, no orchestrator, and no runtime invocation.
- It closes `AC-107` and nothing else. `AC-108` and `AC-110` each require their own explicit operator authorization.
- Decision 9 is a **forward obligation on `AC-110`**, not a claim about anything implemented today. `AC-110` may not close until that binding exists, is persisted, is required on the authorization, and is compared server-side.

## Stop condition — satisfied

> *"Contracts and amendments merged with tests green. Hard stop before any consumer is written."*

| Clause | Evidence |
| --- | --- |
| Contracts merged | `objective.ts`, `plan.ts`, `authorization.ts`, `commands.ts` (`COMMAND_PARAM_SCHEMAS`), `entities/buildStage.ts` (`BUILD_STAGE_SEQUENCE`), and the declared operator decision events |
| Amendments merged | Four, recorded at the rung that owns them — `domain-model.md` Build, `domain-model.md` per-command parameters, `event-model.md` operator decision events, `principles.md` 3a status statement — plus `F-113a` and the ladder's `AC-110` amendment added at the review |
| Tests green | `pnpm -r run test` → **1121 passed / 91 files / 0 failures** |
| Hard stop before any consumer | No Architect step, no plan production or persistence, no plan review UI, no authorization gate, no orchestration, no execution |

## Verification at approval

Measured at `29dbcbc` on a tree with no uncommitted tracked changes.

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1121 passed / 91 files / 0 failures** (contracts 151, ui 18, world-model 7, event-types 14, runtime-adapters 128, persistence 169, agent-city 577, api 57).

Live at the API boundary, verified during the rung: a too-short objective, an over-long objective, a disallowed workspace, `R3`, `R5`, an unknown field, and a multi-line objective were each refused with the offending field named; a valid submission was accepted; and **seven rejections produced zero events**.

## Corrections applied before approval

The operator's first review returned **approved with required corrections**. All three were applied in `29dbcbc`:

1. **Budget.** `maxBudgetUsd` was `.optional()` while the contract's own comment claimed an absent budget was unrepresentable — the schema permitted omission, so the claim was false. Now required, positive, finite, capped at **$25** (was $100). An incomplete pre-authorization uses the distinct, non-authorizing `ExecutionAuthorizationDraftSchema`; a test asserts **no object satisfies both schemas**.
2. **Plan binding.** `fingerprintPlan` renamed `planRevision` and documented as a change indicator only. The authoritative binding is amended into `AC-110` as a backend-generated SHA-256 over canonical persisted plan content, compared server-side.
3. **Claude Code allocation.** Inspection of the authoritative scope found the rule is **narrower** than "at most one" — `domain-model.md` → AgentRun invariants names the stage. Enforced exactly: only `backend_implementation`, and at most one stage.

## AC-103P residue

**Cleared by this rung:** the plan and authorization contracts now exist; all four specification amendments `AC-107` owned are made and recorded; the `currentStageId` amendment introduced at `AC-103P` is formally confirmed in `domain-model.md`.

**Still owed:**

| Item | Owner |
| --- | --- |
| Architect planning step; plan persisted as backend truth; plan review panel; plan in world and timeline | `AC-108` |
| Wiring `parseCommandParams` into command handling | `AC-108` |
| `operator.plan_reviewed` into the runtime event vocabulary, with reducer disposition and projection-map entry | `AC-108` |
| PV1-052's *empty world* half | `AC-108` |
| Execution authorization gate; single-use enforcement against persisted state | `AC-110` |
| **Backend-generated SHA-256 plan binding — persisted, required, compared server-side (Decision 9 / `F-113a`)** | `AC-110` |
| Making `planContentHash` required on `operator.execution_authorized` | `AC-110` |
| `operator.execution_authorized` into the runtime event vocabulary | `AC-110` |

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | Open, undiagnosed | `AC-103` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (N-06) | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails, pre-existing | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded | `AC-119` |
| Authorization guards answering `200` rather than `403` | Recorded candidate | A later rung owning the API surface |

`AC-108` is **not started** and requires its own explicit operator authorization.
