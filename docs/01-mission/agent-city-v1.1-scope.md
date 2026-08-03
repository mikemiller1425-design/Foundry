# Agent City V1.1 Scope

**Foundation:** 1.0
**Mission:** V1.1 — Operational Readiness and First Real Build
**Authority:** Positive scope for the active mission
**Ratified:** 2026-08-03 at `AC-102`

---

## 0. Reading this document

This is the **positive** scope: what V1.1 may build. Anything not named here or in `docs/01-mission/agent-city-v1.1-mission.md` is excluded until this baseline is formally amended — see `docs/01-mission/agent-city-v1.1-exclusions.md`.

Every V1 scope element in `docs/01-mission/v1-scope.md` **carries forward unchanged**. V1.1 adds to it; it removes nothing.

## 1. World elements

**Unchanged from V1.** No new world object, district, institution, or building may be added.

The nine existing objects (Lighthouse, three residences, Construction Office, Warehouse, QA building, Deployment Dock, Construction Site), the road network, the one utility vehicle, the one cargo representation, and the one approval gate are the complete set. `AC-118` may change how they **look**; it may not change how many there are.

## 2. Workers

**Unchanged from V1.** Architect Agent, Builder Agent, Inspector Agent. No hiring, no academy, no additional roles.

## 3. Build stages

**Unchanged from V1 — the seven fixed stage names remain.**

`planning`, `scaffold`, `frontend_implementation`, `backend_implementation`, `integration`, `qa_validation`, `deployment_package`, exactly as defined in `docs/01-mission/v1-scope.md` § "V1 Build Stages", with their locations, runtimes, and preconditions.

This is deliberate and follows the audit's own recommendation (§17): *a real build against a fixed stage shape is a smaller change than a real build with a dynamic plan.* No V1.1 build may use a stage name outside that table. A dynamic stage count requires a mission amendment.

## 4. Canonical sequence

**Unchanged from V1.** work → validate → approve → transfer → dock.

Inspector validation always precedes the approval request; the approval request always precedes the final transfer; the final transfer always precedes build completion. **No step may be reordered.** The three transfer legs and their exact preconditions carry forward verbatim from `docs/01-mission/v1-scope.md` § "Transfer and approval scope".

## 5. What V1.1 adds

This is the new work, and the whole of it.

### 5.1 Operational readiness

| Capability | Detail |
| --- | --- |
| **Single-command launch** | One documented command from a clean clone brings up both processes with deterministic ordering, health preflight, actionable failure messages, and clean shutdown. |
| **Configuration in one place** | `.env.example` enumerating every configuration variable with its default and effect. |
| **Runtime-mode selection at run time** | Mode resolved at request time, not inlined at build time. One built artifact serves both modes without a rebuild. |
| **Credential handoff without copy-paste** | A local handoff the launch path performs, on the same host. Manual entry remains available. **Not** a session system. |
| **Command honesty in backend mode** | Every control either works or states why it does not. Zero silent no-ops. Any non-2xx command response surfaces as a visible rejection. |

### 5.2 Operator intent

| Capability | Detail |
| --- | --- |
| **Bounded objective envelope** | A typed, validated contract for an operator objective (Decision 1). Bounded free text; out-of-template objectives rejected structurally, visibly, with zero mutation. |
| **Objective submission surface** | The first operator-performable implementation of required-workflow step 1. |
| **Structured plan** | An Architect planning step producing a plan persisted as backend truth: stages, requirements, acceptance criteria, workspace, risk class. |
| **Plan review** | A panel the operator reads before deciding to proceed, plus the plan's representation in the world and the timeline. |

### 5.3 Backend orchestration

| Capability | Detail |
| --- | --- |
| **Orchestrator** | A backend component that advances a build through the seven stages by **submitting declared commands through `CommandHandler`**. It is a client of the existing enforcement, never a second write path. |
| **Stage scheduling** | Start, agent assignment, travel, advance, block on failure, retry and repair. |
| **Requirement execution** | Pass/fail determination, including the one intentional required-item failure and its repair. |
| **Transfer driving** | The three legs, each with its exact existing precondition. |
| **Approval emission** | `approval.requested` emitted from real stage completion. |
| **Upgrade eligibility** | Evaluated from real metrics, not seeded history. |

### 5.4 Real controlled execution

| Capability | Detail |
| --- | --- |
| **Execution authorization gate** | An explicit, auditable, **single-use, plan-bound** operator authorization, distinct from artifact approval. A modified plan invalidates a prior authorization. |
| **Real Builder stage** | One real Claude Code stage executing **inside** the orchestrated build, dispatched by that authorization, rendered in the world, with its `AgentRun` linked to a real `BuildStage`. |
| **Foundry-created disposable workspace** | Provisioned from the operator's plan and destroyed after (Decision 2). |
| **Evidence** | Logs, exit status, write-scope diff, independent test output, written to a dedicated per-run directory outside `docs/evidence/fbl-*`. |
| **Independent validation** | Verdict derived from write-scope diff and independent tests only. The runtime's own stdout is never consulted as a verdict. |

### 5.5 Governance on the real path

| Capability | Detail |
| --- | --- |
| **Inspector validation of real output** | `qa_validation` beginning only after receipt at QA, performed under the Inspector credential, against the real artifact. A failing real artifact blocks progression and remains inspectable. |
| **Real approval workflow** | Approve, reject, and request-revision paths on real output, with Lighthouse attention and a closed gate. |
| **Operator-approved upgrade** | The Warehouse upgrade requires a genuine operator approval on the real path — closing the V1 behaviour where it auto-approved. |
| **Full audit trail** | Who, what, when, evidence, decision, on every governance act. |

### 5.6 Durability and debt closure

| Capability | Detail |
| --- | --- |
| **Recovery on the real path** | Reload, backend restart, disconnection, and duplicate delivery all preserve truth. Orchestrator resumes at the correct point. |
| **Cross-process integration coverage** | The first automated test of the frontend against a **live** `apps/api` — closing the highest-value coverage gap in the repository. |
| **Seed retirement** | The rung-named seed scripts removed once their states are reachable for real. |
| **Security hardening** | Loopback-only default bind, origin restriction, a decision on read authentication, and a written containment statement distinguishing what is *prevented* from what is *detected*. |
| **Accessibility, browser, performance** | Automated scanner, screen-reader smoke pass, WebGL-unavailable fallback, pinned Playwright workers, the Decision 7 Safari standard, and a fresh performance baseline including the 95th-percentile figure. |
| **Cohesive visual pass** | One coherent low-poly treatment of the **existing** neighborhood, gated on that baseline. |
| **CI and evidence durability** | Automated gates; an evidence retention policy verifiable from a fresh clone. |

## 6. Technical inclusions

Carried forward from V1, plus:

- A backend orchestrator in `apps/api`, strictly as a `CommandHandler` client.
- Per-command parameter schemas for the objective, plan, and authorization commands specifically — replacing envelope-only validation **for those commands only**.
- At least one new operator event family (plan produced, execution authorized), added by recorded amendment to `docs/02-specification/event-model.md`.
- A real-path test suite, separate from and not replacing the mock-mode suites.
- An `assets/` pipeline for the models `AC-118` introduces.
- CI configuration.

## 7. Risk ceiling

**R0–R2 only.** Unchanged. `V1RiskClassSchema` keeps R3–R5 unrepresentable, and no rung may widen it.

## 8. Interface

Unchanged from V1's interface inclusions, plus the objective submission surface, the plan review panel, and the execution authorization surface. The prohibition on an unrestricted natural-language shell in the command bar (`interface-model.md`) **carries forward and is not relaxed** — a bounded, validated objective field is not a shell.

## 9. Specification amendments this scope requires

Recorded, owned, and made only at the rung that owns them — never silently.

| Document | Amendment | Rung |
| --- | --- | --- |
| `docs/02-specification/domain-model.md` | `Build` § "V1 limits" — "demo objective fixed" must change for a real bounded objective | `AC-107` |
| `packages/contracts/src/commands.ts` + `domain-model.md` | Per-command parameter schemas for the objective/plan/authorization commands | `AC-107` |
| `docs/02-specification/event-model.md` | New operator event family for plan-produced and execution-authorized | `AC-107` |
| `packages/contracts/src/entities/build.ts` + `domain-model.md` → Build | **Already made, at `AC-103P`, and recorded here retrospectively.** `currentStageId` changed from `IdSchema` to `IdSchema.nullable()`; both reducers write `null` on `build.created`. `domain-model.md` lists the field among Build's *required fields* — meaning always present — and `nullable` keeps it present while making representable a state that always existed: a Build created before any stage. `""` was not a valid `IdSchema` value and made the projection unserialisable at the `/world-state` boundary. `AC-107` must confirm or supersede this. See `docs/audits/agent-city-v1.1-rung-label-reconciliation.md` § 5 | `AC-107` |
| `docs/00-foundry/principles.md` 3a | Status statement only — its condition has lapsed; no meaning change, mock retained as a selectable mode | `AC-107` |
| `docs/02-specification/v1-acceptance.md` | **No edit.** Superseded for V1.1 purposes by `v1.1-acceptance.md`; remains the frozen V1 record | — |
| `docs/01-mission/v1-scope.md` § "V1 Build Stages" | **No change.** Seven stages stay fixed | — |
| `docs/01-mission/exclusions.md` | **No change.** Every V1 exclusion carries forward | — |
