# Proposal — Agent City V1.1 Build Ladder

**Type:** Proposal. Not a ladder, not authority, not an authorization.
**Date:** 2026-08-03
**Proposed by:** Claude Code, under operator instruction
**Basis:** `docs/audits/agent-city-post-v1-truth-audit.md` · `docs/proposals/agent-city-v1.1-mission-proposal.md`
**Status:** **Awaiting operator review.** No rung below may begin.

---

## 0. Standing and preservation

- Foundry Foundation 1.0 is **frozen**.
- Agent City V1 is **complete**. `FBL-001`–`FBL-035` and `FBL-021A` are historical completed authority: never renumbered, never reopened, never re-graded by this ladder. Their evidence under `docs/evidence/` is not altered.
- Finding 6 is **open technical debt**, carried forward and addressed at `AC-103`.
- `docs/04-future/registry.md` and `docs/archive/` are **non-authoritative** for every rung below. No rung may cite them as a requirements source. Nothing is promoted from the Future Registry.

## 1. How to read this ladder

- Identifiers are `AC-101` onward — a **new namespace**, disjoint from `FBL-*`, so a V1.1 rung can never be mistaken for V1 history and no `FBL` number is reused. Identifiers are never reused; work discovered after a rung closes is inserted as a lettered sub-rung (`AC-104A`), never by shifting later numbers.
- A rung may not **begin** until every prerequisite is true **and** the preceding rung's stop condition is reached.
- A rung may not **end** by sliding into the next rung's work. Reaching a stop condition halts work until the operator explicitly authorizes the next rung. This ladder grants no standing authorization.
- Each rung is one **contract-first vertical slice** (ADR-003): the contract change lands first, then the backend, then the surface, then the test.
- Rungs are typed: **[DOC]** documentation correction, **[FIX]** defect repair, **[HARD]** hardening, **[FEAT]** new capability. A `[DOC]` rung may not change behavior; a `[FEAT]` rung may not quietly correct documentation as a side effect.

## 2. Ladder overview

| ID | Type | Name | Depends on | Operator gate |
| --- | --- | --- | --- | --- |
| AC-101 | DOC | Post-V1 truth reconciliation | — | Review |
| AC-102 | DOC | V1.1 mission baseline ratification | AC-101 | **Ratify** |
| AC-103 | FIX | Finding 6 resolution | AC-102 | **Accept closure** |
| AC-104 | HARD | One-command local operation | AC-102 | **Launch it** |
| AC-105 | FIX | Runtime-mode and credential handoff at runtime | AC-104 | Observe |
| AC-106 | FIX | Backend-mode command honesty | AC-105 | Observe |
| AC-107 | FEAT | Bounded-objective contract | AC-106 | Review contract |
| AC-108 | FEAT | Objective submission and plan review | AC-107 | **Submit + review plan** |
| AC-109 | FEAT | Backend orchestration of a build (mock executor) | AC-108 | Observe |
| AC-110 | FEAT | Execution authorization gate | AC-109 | **Authorize** |
| AC-111 | FEAT | Real controlled Builder execution | AC-110 | **Authorize the run** |
| AC-112 | FEAT | Independent Inspector validation of real output | AC-111 | Observe rejection + pass |
| AC-113 | FEAT | Approval, transfer, and completion on the real path | AC-112 | **Approve and reject** |
| AC-114 | HARD | Restart, recovery, and idempotency on the real path | AC-113 | Observe |
| AC-115 | HARD | Retire seed-dependent demonstrations | AC-114 | Observe |
| AC-116 | HARD | Security and containment hardening | AC-113 | Review |
| AC-117 | HARD | Accessibility, browser, and performance debt closure | AC-114 | Observe |
| AC-118 | FEAT | Cohesive low-poly neighborhood pass | AC-113, AC-117 | **Observe** |
| AC-119 | HARD | Repository, evidence, and CI hygiene | AC-102 | Review |
| AC-120 | — | Complete V1.1 acceptance verification | all | **Sign off** |

**Critical path:** `AC-101 → AC-102 → AC-104 → AC-105 → AC-106 → AC-107 → AC-108 → AC-109 → AC-110 → AC-111 → AC-112 → AC-113 → AC-114 → AC-117 → AC-118 → AC-120`.
`AC-103`, `AC-116`, and `AC-119` sit off the critical path and may run in parallel with it after their prerequisites — but `AC-103` must **close before AC-111**, since a real run should not be introduced over an unexplained browser failure.

**Safe parallel groups:** {AC-103, AC-104}, {AC-116, AC-117}, {AC-119, any}.

---

## 3. Rungs

### AC-101 — Post-V1 truth reconciliation — **[DOC]**

| Field | Content |
| --- | --- |
| **Objective** | Make every entry-point and package document state what is actually true at `3cdd539`, with no behavior change of any kind. |
| **Prerequisites** | None. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` §1 and §14; `FOUNDATION_VERSION.md`; `docs/evidence/fbl-035/operator-final-approval.md` |
| **Allowed work** | Correcting `README.md` status table, repository map, and the "Implementation blocked" section; `CONTRIBUTING.md` status and rule 8; the four placeholder `packages/*/README.md` Status sections; `apps/agent-city/README.md` status and the build-time qualification on runtime selectability; `apps/api/README.md` status and security sections; the fourteen `Foundation: 1.0-rc1` headers; a superseded banner on `implementation-plan.md`; a historical banner on `docs/handoffs/002-frontend-foundation.md`; `CHANGELOG.md`. |
| **Prohibited work** | Any source change. Any specification content change. Editing V1 evidence. Editing the V1 Build Ladder's rung content. Grading, reopening, or re-closing any `FBL-*` rung. Anything from `docs/04-future/registry.md`. |
| **Deliverables** | The twelve documents in audit §14, corrected; `CHANGELOG.md` entry; a short note recording that `FBL-003`'s `scripts/` deliverable was never produced — as historical record only. |
| **Tests** | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all unchanged and green — proving nothing behavioral moved. |
| **Operator validation** | Operator reads the corrected `README.md`, `CONTRIBUTING.md`, and `active-mission.md` and confirms each now matches the repository. |
| **Acceptance criteria** | Every finding in audit §14 has a citable correction. No source file changed. No specification meaning changed. No V1 evidence file modified. |
| **Stop condition** | Corrections committed and reviewed. **Hard stop** — no mission baseline is declared in this action. |

---

### AC-102 — V1.1 mission baseline ratification — **[DOC]**

| Field | Content |
| --- | --- |
| **Objective** | Establish, or decline, an approved V1.1 mission baseline and resolve the six blocking operator decisions. |
| **Prerequisites** | AC-101 stop condition reached. |
| **Authoritative sources** | `docs/proposals/agent-city-v1.1-mission-proposal.md`; `docs/audits/agent-city-post-v1-truth-audit.md` §16–§17; `FOUNDATION_VERSION.md` § "Change control"; `docs/01-mission/exclusions.md` |
| **Allowed work** | Recording the operator's six decisions; creating `docs/01-mission/v1.1-mission.md`, `v1.1-scope.md`, `v1.1-exclusions.md`; updating `FOUNDATION_VERSION.md` operational metadata to name the new active mission; converting this proposal into `docs/03-architecture/agent-city-v1.1-build-ladder.md`; `CHANGELOG.md`. |
| **Prohibited work** | Any code. Any change to a Foundry principle, domain term, or ADR. Promoting any Future Registry concept. Weakening any V1 exclusion. Beginning any V1.1 rung in the same action. |
| **Deliverables** | V1.1 mission, scope, and exclusion documents; the ratified ladder; a decision record answering all six questions; `FOUNDATION_VERSION.md` and `CHANGELOG.md` updates. |
| **Tests** | N/A — documentation rung. |
| **Operator validation** | Operator explicitly ratifies or declines, in their own words, naming the six decisions. |
| **Acceptance criteria** | All six decisions recorded with rationale; scope and exclusions written; every V1 exclusion carried forward; the ladder's identifiers, gates, and stop conditions unchanged from what was reviewed. |
| **Stop condition** | Baseline ratified and committed, **or** declined and this proposal marked not-adopted. **Hard stop** — ratification authorizes no rung; each still needs its own authorization. |

---

### AC-103 — Finding 6 resolution — **[FIX]**

| Field | Content |
| --- | --- |
| **Objective** | Diagnose the three unclassified Playwright-WebKit failures and either repair them or classify them with a retained, reproducible artifact. |
| **Prerequisites** | AC-102 ratified. |
| **Authoritative sources** | `docs/evidence/fbl-035/operator-final-approval.md` § "Open at the time of approval"; `docs/evidence/fbl-035/real-safari-observation.md`; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-043; `apps/agent-city/e2e/shell-selection.spec.ts:150`; `apps/agent-city/e2e/shell-event-to-world-mapping.spec.ts:119` |
| **Allowed work** | Reproducing under WebKit at 5120×1440 and 3840×1080; capturing traces, videos, and console output as retained artifacts; repairing a genuine product defect or a genuine test defect; if neither, a written classification with the artifact that supports it. |
| **Prohibited work** | Closing by reclassification without diagnosis. Deleting, skipping, or retrying the failing tests to make them green. Raising timeouts as a substitute for root cause. Editing the FBL-035 approval record (a new dated record supersedes it, per principle 18). Reopening FBL-034 or FBL-021A. |
| **Deliverables** | `docs/evidence/ac-103/` containing traces and diagnosis; a fix or a classification with rationale; a new dated record superseding — never editing — the Finding 6 entry. |
| **Tests** | WebKit suite at all three target viewports; the two named specs must pass or carry a diagnosed, evidenced classification. Chromium suite unchanged and green. |
| **Operator validation** | Operator reviews the diagnosis and accepts the closure standard they chose at AC-102. |
| **Acceptance criteria** | Each of the three failures has a named root cause and a retained reproduction artifact. No test was weakened. `FOUNDATION_VERSION.md`'s carried-open item can be truthfully updated. |
| **Stop condition** | Finding 6 closed with diagnosis, or explicitly re-accepted with an artifact. **Must close before AC-111.** |

---

### AC-104 — One-command local operation — **[HARD]**

| Field | Content |
| --- | --- |
| **Objective** | One documented command, from a clean clone, brings up a working Foundry with both processes and prints exactly what the operator needs. |
| **Prerequisites** | AC-102 ratified. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` PV1-027, PV1-029, PV1-031; `apps/api/README.md` § "Run locally"; `apps/agent-city/README.md` § "Run locally" |
| **Allowed work** | A root `dev` (and `start`) script orchestrating API and frontend with correct ordering and health preflight; `scripts/` entries; `.env.example` enumerating all eleven configuration variables with defaults and effects; a single operator quickstart document; readiness checks with actionable failure messages. |
| **Prohibited work** | Docker, compose, cloud deployment, process supervisors, or any production packaging. Changing application behavior. Weakening the loopback boundary. Introducing a new configuration mechanism the quickstart does not document. |
| **Deliverables** | Root scripts; `scripts/` contents; `.env.example`; `docs/operations/quickstart.md`; corrected per-app run sections. |
| **Tests** | A scripted check from a clean checkout: install → single command → API `/health` returns 200 → frontend serves 200 → both shut down cleanly on SIGINT. |
| **Operator validation** | Operator runs the single command on a clean clone and reaches a working Foundry without consulting any other document. |
| **Acceptance criteria** | One command; both processes; deterministic ordering; clean shutdown; every configuration variable documented in one place. |
| **Stop condition** | Operator confirms single-command launch. **Hard stop** before any runtime-mode change. |

---

### AC-105 — Runtime-mode selection and credential handoff at runtime — **[FIX]**

| Field | Content |
| --- | --- |
| **Objective** | Make runtime mode selectable at run time rather than build time, and remove the copy-a-token-from-stdout step, without building a session system. |
| **Prerequisites** | AC-104 stop condition reached. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` PV1-028, PV1-036; `apps/agent-city/src/app/page.tsx:9`; `apps/agent-city/src/lib/backend/operatorCredential.ts`; `apps/api/src/main.ts` |
| **Allowed work** | Moving mode selection to request time (server-side config read or a client-fetched `/config`); a local credential handoff the launch script performs (e.g. a mode-restricted file the frontend server reads on the same host); a visible, explained state when the credential is absent or stale. |
| **Prohibited work** | Sessions, expiry, refresh, logout, user accounts, or any authentication *system* — excluded by `v1-scope.md` and carried forward. Embedding a credential in the client bundle. Removing the operator's ability to enter a credential manually. Weakening the `403 actor_mismatch` rule or the `PrincipalRegistry` boundary. |
| **Deliverables** | Runtime-mode resolution; credential handoff in the launch path; UI states for absent/stale/invalid credential; updated quickstart. |
| **Tests** | Built artifact starts in both modes without a rebuild; absent credential yields a labeled disabled state, never a silent failure; stale credential after an API restart produces a distinguishable message. |
| **Operator validation** | Operator switches modes without rebuilding, and reaches an approval-capable state without reading a token out of a terminal. |
| **Acceptance criteria** | Mode is a runtime input; no `NEXT_PUBLIC_*` credential exists; every credential failure is visible and explained. |
| **Stop condition** | Both modes reachable from one artifact and the credential step is automatic. **Hard stop.** |

---

### AC-106 — Backend-mode command honesty — **[FIX]**

| Field | Content |
| --- | --- |
| **Objective** | Eliminate every silent no-op in backend mode. A control either works or says why it does not. |
| **Prerequisites** | AC-105 stop condition reached. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` PV1-012, PV1-013, PV1-052; `docs/02-specification/v1-acceptance.md` F-07; `docs/02-specification/interface-model.md` § "Persistent command input"; `apps/agent-city/src/lib/backend/BackendRuntimeProvider.tsx:80–88` |
| **Allowed work** | Surfacing any non-2xx command response as a visible rejection, not only a shaped `accepted:false`; deciding and implementing whether demo controls exist in backend mode (disabled with a stated reason, or backed by a declared command); emitting or formally recording `building.selected` in backend mode. |
| **Prohibited work** | Adding a `demo.*` command type to the backend vocabulary without a specification amendment — `COMMAND_TYPES` is transcribed from `domain-model.md` and is closed by design. Introducing a free-text command input (prohibited by `interface-model.md`). Any orchestration behavior. |
| **Deliverables** | Rejection handling covering all failure shapes; backend-mode command bar behavior; a decision record on `building.selected`. |
| **Tests** | Every command-bar control in backend mode produces a visible outcome; a 400, a 403, and a network failure each render distinguishable text; F-07 asserted in **both** modes. |
| **Operator validation** | Operator presses every control in backend mode and sees a truthful result for each. |
| **Acceptance criteria** | Zero silent no-ops. F-07 holds in backend mode. Command vocabulary unchanged unless amended. |
| **Stop condition** | Backend mode is honest about every control. **Hard stop** before any objective work. |

---

### AC-107 — Bounded-objective contract — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | Define, in `packages/contracts` and `packages/event-types` first, the typed vocabulary for an operator objective, a structured plan, and an execution authorization. Contract only — no behavior. |
| **Prerequisites** | AC-106 stop condition reached. |
| **Authoritative sources** | Ratified V1.1 scope; `docs/02-specification/domain-model.md` (Project, Build, BuildStage, Requirement); `docs/02-specification/event-model.md`; `packages/contracts/src/commands.ts`; `docs/03-architecture/decisions/ADR-003-contract-first-vertical-slices.md`; `docs/audits/agent-city-post-v1-truth-audit.md` §17 |
| **Allowed work** | Parameter schemas for `Project.Create`, `Build.Create`, and the plan/authorization commands — replacing envelope-only validation for those commands specifically; a `BuildPlan` shape (stages, requirements, acceptance criteria, workspace, risk class); new operator event types for plan-produced and execution-authorized; the spec amendments §17 identifies, recorded as amendments. |
| **Prohibited work** | Any orchestrator, UI, or executor. Widening `V1RiskClassSchema` beyond R0–R2. Adding a stage name outside the seven in `v1-scope.md` § "V1 Build Stages" (V1.1 keeps the seven fixed). Modeling any excluded or Future Registry concept. Loosening the closed command vocabulary. |
| **Deliverables** | Contract and event-type additions; specification amendments; schema unit tests. |
| **Tests** | Schema tests for every new shape, including negative cases: over-long objective, disallowed workspace, R3+ risk class, unknown stage name — each must be unrepresentable or rejected. |
| **Operator validation** | Operator reviews the objective envelope and confirms it bounds what they intended to bound. |
| **Acceptance criteria** | Contracts compile and import cleanly across all eight projects; R3–R5 remain unrepresentable; nothing outside the contract packages changed. |
| **Stop condition** | Contracts and amendments merged with tests green. **Hard stop** before any consumer is written. |

---

### AC-108 — Objective submission and plan review — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | The operator submits one bounded objective and reads back a structured plan. First real vertical slice: contract → backend → UI → test. |
| **Prerequisites** | AC-107 stop condition reached. |
| **Authoritative sources** | AC-107 contracts; `docs/02-specification/interface-model.md`; `docs/01-mission/v1-scope.md` § "Required workflow" step 1; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-026, PV1-050 |
| **Allowed work** | A bounded objective-submission surface (form or curated selection, per the AC-102 decision); backend handling producing `operator.objective_submitted`, the Project and the Build; an Architect planning step producing a structured plan persisted as backend truth; a plan review panel showing stages, requirements, acceptance criteria, workspace, and risk class; the plan rendered in the world and the timeline. |
| **Prohibited work** | Executing anything. Free-text natural-language shell or autonomous planning input (`interface-model.md` "Prohibit"). Auto-advancing past plan review. Any real runtime invocation. Bypassing `CommandHandler`. |
| **Deliverables** | Submission surface; backend objective and plan handling; plan review panel; timeline and world representation. |
| **Tests** | Submission produces exactly the declared events; an out-of-envelope objective is rejected with a structured reason and zero mutation; the plan survives reload; no execution occurs; the mock runtime's canonical journey is unchanged. |
| **Operator validation** | **Gate.** Operator submits a real objective and reads the plan without assistance, then confirms it is comprehensible and describes what they asked for. |
| **Acceptance criteria** | Required-workflow step 1 is performable by a human for the first time. Plan is backend-owned. Nothing executes. |
| **Stop condition** | Operator has submitted an objective and reviewed a plan. **Hard stop** — execution is not authorized by this rung. |

---

### AC-109 — Backend orchestration of a build — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | Introduce the orchestrator: a backend component that advances a build through the seven stages by submitting declared commands, using a **mock executor** for every stage. No real runtime yet. |
| **Prerequisites** | AC-108 stop condition reached. |
| **Authoritative sources** | `docs/01-mission/v1-scope.md` § "V1 Build Stages" and § "Transfer and approval scope"; `docs/02-specification/event-model.md`; `packages/persistence/src/{commandHandler,transitionGraphs}.ts`; `docs/00-foundry/principles.md` 1, 2, 3a, 11, 21; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-025 |
| **Allowed work** | A stage scheduler; agent assignment and travel; requirement execution with the intentional-failure and repair path; the three transfer legs with their exact preconditions; approval request emission on real stage completion; upgrade eligibility evaluation from real metrics. All of it strictly as a **client** of `CommandHandler`. |
| **Prohibited work** | Any direct `appendEvent` call from the orchestrator. Any second write path. Any real Claude Code invocation. Reordering the canonical work→validate→approve→transfer→dock sequence. Skipping a mandatory prerequisite. Adding a stage name outside the seven. Modifying the mock runtime or the canonical fixture. |
| **Deliverables** | Orchestrator in `apps/api`; mock executor behind the same interface a real runtime will use; world and timeline reflecting orchestrated state. |
| **Tests** | A full orchestrated build reaches `waiting_for_approval` through the backend alone; a structural test asserts the orchestrator has no `appendEvent` path; every illegal ordering is rejected; frontend still cannot force any transition (F-03); duplicate command submission is idempotent (F-09); the mock runtime's canonical run is byte-identical to `v1-canonical-run.json`. |
| **Operator validation** | Operator watches an orchestrated build progress in backend mode with no seed script and no hand-submitted command. |
| **Acceptance criteria** | The world shows a real backend-driven build. Every transition passed the existing guards. No seed script was used. |
| **Stop condition** | Orchestrated mock-executor build reaches the approval gate. **Hard stop** before any real execution. |

---

### AC-110 — Execution authorization gate — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | Make controlled execution require an explicit, auditable operator authorization that is distinct from approving an artifact. |
| **Prerequisites** | AC-109 stop condition reached. |
| **Authoritative sources** | AC-107 authorization contract; `docs/00-foundry/principles.md` 14, 15, 16, 19; `docs/03-architecture/decisions/ADR-006-runtime-adapter-boundary.md`; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-053 |
| **Allowed work** | An authorization surface showing exactly what will run — workspace, risk class, tool restrictions, budget ceiling, timeout, allowed write paths; the authorization recorded as an auditable event with who, what, when, and against which plan; a hard block preventing any real invocation without it; single-use semantics so one authorization cannot cover a second run. |
| **Prohibited work** | Standing or implicit authorization. Defaulting to authorized. Authorizing anything above R2. Allowing an authorization to survive a plan change. Merging this gate with the artifact approval gate — they are different decisions. |
| **Deliverables** | Authorization surface, event, and enforcement; audit record. |
| **Tests** | A real invocation attempted without authorization is refused with zero side effects; authorization is single-use; a modified plan invalidates a prior authorization; the record shows who/what/when/plan. |
| **Operator validation** | **Gate.** Operator authorizes one execution, having read exactly what will run, and separately confirms an unauthorized attempt is refused. |
| **Acceptance criteria** | No real execution is reachable without an explicit, single-use, plan-bound operator authorization. |
| **Stop condition** | Authorization gate proven in both directions. **Hard stop** — the real run is a separate rung and a separate authorization. |

---

### AC-111 — Real controlled Builder execution — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | One real Claude Code stage executes **inside** the orchestrated build, in a Foundry-created disposable workspace, triggered by the AC-110 authorization, rendered in the world. |
| **Prerequisites** | AC-110 stop condition reached **and** AC-103 closed. Fresh, explicit operator authorization for this rung — the FBL-027/028 authorization is spent. |
| **Authoritative sources** | `packages/runtime-adapters/src/adapters/claudeCodeAdapter.ts`; `.../controlledStage/{runControlledStage,fixture,validation}.ts`; `docs/evidence/fbl-028/operator-approval.md` (narrow scope); `docs/00-foundry/principles.md` 19; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-019, PV1-022, PV1-033, PV1-034 |
| **Allowed work** | Replacing the mock executor for the `backend_implementation` stage with a real adapter dispatch; a Foundry-created disposable workspace generated from the operator's plan; the `AgentRun` linked to the real `BuildStage` and rendered; evidence written to a dedicated run directory; verdict derived from write-scope diff and independent tests only. |
| **Prohibited work** | Running against any pre-existing project directory, the Foundry repository, or the operator's home. Letting the runtime write or execute its validation. Granting Bash, subagents, MCP, or `--add-dir`. Removing `--safe-mode`, `--strict-mcp-config`, or the budget ceiling. Exceeding R2. Writing evidence into `docs/evidence/fbl-*`. Making a second run without a second authorization. Consulting the runtime's own stdout as a verdict. |
| **Deliverables** | Orchestrated real dispatch; workspace provisioning and teardown; evidence package under `docs/evidence/ac-111/`; world and timeline representation of the real `AgentRun`. |
| **Tests** | Offline: the whole mechanism covered with a substituted execution backend, as `controlledStage.test.ts` does today. Live: one authorized run producing evidence with `outcome: "succeeded"`, a write-scope diff confined to permitted paths, and passing independent tests. Duplicate-run guard refuses a resubmission. Timeout terminates the process tree and retains evidence. |
| **Operator validation** | **Gate.** Operator authorizes the run, watches it in the world, and reviews the evidence — logs, diff, exit status, and independent test output. |
| **Acceptance criteria** | A real Claude Code stage ran inside a real orchestrated build from an operator's own objective; success was decided by validation the runtime did not write and could not run; every write was inside permitted paths; risk stayed at R2. |
| **Stop condition** | One successful real stage with reviewed evidence. **Hard stop** — the authorization is spent. |

---

### AC-112 — Independent Inspector validation of real output — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | The Inspector validates the real artifact, and only the Inspector can. |
| **Prerequisites** | AC-111 stop condition reached. |
| **Authoritative sources** | `docs/02-specification/v1-acceptance.md` F-05; `docs/01-mission/v1-scope.md` § "V1 Build Stages" stage 6; `packages/persistence/src/inspectorValidation.test.ts`; `apps/api/src/inspectorValidation.test.ts`; `docs/00-foundry/principles.md` 17 |
| **Allowed work** | Orchestrated `qa_validation` beginning only after the Warehouse → QA transfer's `transfer.completed`; validation performed against the real artifact under the Inspector credential; `stage.validation_passed` / `stage.validation_failed` with retained evidence; a failing real artifact producing an inspectable failure and a repair path. |
| **Prohibited work** | Any path by which the Builder, the orchestrator, the frontend, or an unauthenticated caller reaches `stage.validation_passed`. Starting validation before receipt at QA. Reusing the Builder's own test output as the validation verdict. Silently retrying beyond policy. |
| **Deliverables** | Orchestrated Inspector stage; validation evidence; failure and repair path on real output. |
| **Tests** | Builder-credential self-certification is rejected (F-05) on the real path; frontend attempt rejected; validation before receipt rejected; a genuinely failing artifact blocks progression and remains inspectable (F-04). |
| **Operator validation** | Operator observes a rejected Builder self-certification attempt **and** a successful Inspector validation on real output. |
| **Acceptance criteria** | F-05 holds on the real path. Validation is independent in fact, not by convention. |
| **Stop condition** | Real artifact independently validated. **Hard stop.** |

---

### AC-113 — Approval, transfer, and completion on the real path — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | Close the loop: a real approval gate, the approval-gated transfer, and build completion, all on real output. |
| **Prerequisites** | AC-112 stop condition reached. |
| **Authoritative sources** | `docs/02-specification/v1-acceptance.md` F-06, V-05; `docs/01-mission/v1-scope.md` § "Transfer and approval scope"; `docs/00-foundry/principles.md` 11, 12, 14, 16 |
| **Allowed work** | Approval requested from real `qa_validation` completion with the real artifact as evidence; Lighthouse attention and closed gate; approve / reject / request-revision paths; QA → Deployment Dock transfer starting only after `approved`; vehicle motion only after `transfer.started`; `build.completed` only after receipt at the Dock; the Warehouse upgrade requiring a genuine operator approval (closing PV1-014 on the real path). |
| **Prohibited work** | Auto-approval of anything, including the upgrade. Any transfer before its precondition. Vehicle motion authorizing a transfer. Completing a build with an unresolved approval. Reordering the canonical sequence. |
| **Deliverables** | Real approval workflow end to end; transfer and completion; upgrade requiring operator approval on the real path. |
| **Tests** | Pending approval blocks the gated transition (F-06); reject and request-revision each produce their defined path; vehicle cannot depart before `transfer.started` (V-05); capability and visual level change only at `upgrade.completed` (V-07, F-11); full audit trail on every decision. |
| **Operator validation** | **Gate.** Operator resolves one real approval by approving and, in a separate run, by rejecting — and observes the difference in outcome. |
| **Acceptance criteria** | **The V1.1 mission outcome is demonstrated end to end**: launch → objective → plan → authorize → real stages → approval → validated output. |
| **Stop condition** | One complete real build, operator-approved, with independently validated output. **Hard stop** — this is the mission's substantive completion; the remaining rungs harden and finish it. |

---

### AC-114 — Restart, recovery, and idempotency on the real path — **[HARD]**

| Field | Content |
| --- | --- |
| **Objective** | The real build survives reload, backend restart, disconnection, and duplicate delivery. |
| **Prerequisites** | AC-113 stop condition reached. |
| **Authoritative sources** | `docs/02-specification/v1-acceptance.md` § "Persistence", § "Failure and recovery", § "Idempotency", F-08, F-09, F-10; `docs/evidence/fbl-032/operator-observation.md` |
| **Allowed work** | Reconstruction of a real orchestrated build from the event log; orchestrator resumption at the correct point after restart; SSE `Last-Event-ID` replay across a real disconnect; duplicate-event and duplicate-command idempotency on the real path; an interrupted real `AgentRun` reaching a defined terminal state. |
| **Prohibited work** | Restarting a spent real execution automatically. Replaying a real model invocation as a recovery step. Inventing state to fill a reconstruction gap. Weakening the duplicate guard. |
| **Deliverables** | Orchestrator resumption; recovery behavior; recovery evidence. |
| **Tests** | Reload mid-build, mid-block, mid-pending-approval, and post-completion each restore exactly (F-08); backend restart rebuilds the projection; duplicate events change no counts (F-09); **the first real cross-process integration test** — frontend against live `apps/api`, closing PV1-017; disconnect/restore verified against a real server, not `http://backend.test`. |
| **Operator validation** | Operator restarts both processes mid-build and confirms the world returns to the same truth. |
| **Acceptance criteria** | F-08, F-09, F-10 hold on the real path, proven across a real process boundary. |
| **Stop condition** | Real build survives every interruption. **Hard stop.** |

---

### AC-115 — Retire seed-dependent demonstrations — **[HARD]**

| Field | Content |
| --- | --- |
| **Objective** | Remove the seed scripts, now that the states they fabricated are reachable for real. |
| **Prerequisites** | AC-114 stop condition reached. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` PV1-018, PV1-023; `apps/api/package.json`; `apps/api/src/fbl029/seedStage.ts`; `apps/api/src/fbl031/seedUpgradeReady.ts`; `apps/api/src/fbl028/runControlledStage.ts` |
| **Allowed work** | Removing `fbl-029:seed` and `fbl-031:seed` and their sources; re-homing the FBL-028 entrypoint so its default evidence directory is outside `docs/` and it refuses to overwrite an existing evidence file (closing PV1-023); a note recording which V1 evidence those scripts supported and that the evidence is unaltered. |
| **Prohibited work** | Deleting, editing, or regenerating any V1 evidence file. Removing a script whose state is not yet reachable for real. Changing what a retained V1 record says. |
| **Deliverables** | Scripts removed; FBL-028 entrypoint made non-destructive; provenance note. |
| **Tests** | No product path depends on a removed script; the real orchestrated build reaches Inspector validation and upgrade eligibility unaided; the FBL-028 entrypoint refuses to overwrite existing evidence. |
| **Operator validation** | Operator confirms both previously seeded states are reachable without any script. |
| **Acceptance criteria** | Zero rung-named seed scripts remain in the shipped service. All V1 evidence byte-identical. |
| **Stop condition** | Seed scripts retired. **Hard stop.** |

---

### AC-116 — Security and containment hardening — **[HARD]**

| Field | Content |
| --- | --- |
| **Objective** | Bring the local security posture up to what a real build path warrants, and document it honestly. |
| **Prerequisites** | AC-113 stop condition reached. May run parallel to AC-114/115. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` PV1-033–PV1-037; `apps/api/src/app.ts:63–70`; `packages/runtime-adapters/src/adapters/claudeCodeAdapter.ts` security note; `docs/evidence/fbl-028/operator-approval.md` |
| **Allowed work** | Loopback-only binding by default with any other bind an explicit warned choice; origin restriction replacing `Access-Control-Allow-Origin: *`; a decision and implementation on read authentication; evaluating `ANTHROPIC_API_KEY` + `--bare` to close the Keychain path (PV1-034); a written containment statement covering what is prevented versus what is detected. |
| **Prohibited work** | Claiming OS-level sandboxing that does not exist. Building an authentication system. TLS termination, reverse proxies, or any networked-deployment work. Generalizing the boundary into a security guarantee. Weakening any existing containment control. |
| **Deliverables** | Loopback default; origin policy; containment statement in `packages/runtime-adapters/README.md` and `apps/api/README.md`; a superseding note on the FBL-028 approval's narrow scope if the posture changes. |
| **Tests** | Non-loopback bind requires explicit opt-in and warns; disallowed origin is refused; existing containment tests unchanged and green. |
| **Operator validation** | Operator reviews the containment statement and confirms it matches what they believe they authorized. |
| **Acceptance criteria** | No control weakened. Every limitation stated. Default posture is loopback-only. |
| **Stop condition** | Posture hardened and documented. |

---

### AC-117 — Accessibility, browser, and performance debt closure — **[HARD]**

| Field | Content |
| --- | --- |
| **Objective** | Close the three gaps FBL-033 disclosed, establish reproducible Safari coverage, and re-baseline performance before any visual work. |
| **Prerequisites** | AC-114 stop condition reached. May run parallel to AC-116. |
| **Authoritative sources** | `docs/evidence/fbl-033/operator-observation.md` § "What this rung did not establish"; `docs/evidence/fbl-034/performance-measurements.md` §3; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-038–PV1-041; `docs/02-specification/v1-acceptance.md` §§ Accessibility, Performance |
| **Allowed work** | An automated accessibility scanner (axe or equivalent) in the suite; a screen-reader smoke pass with a recorded method; a WebGL-unavailable fallback test proving the 2D interface remains an authoritative control surface; pinning Playwright `workers` in config; a Safari coverage standard per the AC-102 decision; a fresh performance baseline including the 95th-percentile frame figure and the new real-path surfaces. |
| **Prohibited work** | Raising or removing a performance budget to make a measurement pass. Skipping a failing accessibility assertion. Removing a target viewport. Treating an average FPS as the gating number. |
| **Deliverables** | Scanner integration; screen-reader record; WebGL-fallback test; pinned worker config; Safari standard; `docs/evidence/ac-117/` performance baseline. |
| **Tests** | Scanner passes at all three viewports; WebGL-unavailable path keeps every critical control reachable; performance budgets re-verified with the tail figure reported. |
| **Operator validation** | Operator completes the real journey keyboard-only, and again with reduced motion. |
| **Acceptance criteria** | All three FBL-033 gaps closed; Safari has a standing standard; a current performance baseline exists as the gate for AC-118. |
| **Stop condition** | Debt closed and baseline recorded. **Hard stop** — AC-118 may not begin without this baseline. |

---

### AC-118 — Cohesive low-poly neighborhood pass — **[FEAT]**

| Field | Content |
| --- | --- |
| **Objective** | One coherent low-poly visual treatment for the existing neighborhood — after, and only after, the real workflow succeeds. |
| **Prerequisites** | AC-113 **and** AC-117 stop conditions reached. |
| **Authoritative sources** | `docs/02-specification/world-model.md` (state→visual tables); `docs/01-mission/exclusions.md` (photorealistic custom assets excluded); `docs/00-foundry/principles.md` 4, 5, 24; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-042; AC-117's performance baseline |
| **Allowed work** | A shared material and palette system; low-poly geometry for the nine existing buildings, three agents, vehicle, cargo, roads, and Lighthouse; consistent silhouettes and grounding; an `assets/` pipeline for the models the pass introduces; every existing state→visual mapping preserved exactly. |
| **Prohibited work** | New world objects, districts, institutions, citizens, interiors, or decorative sprawl. Photorealistic assets. Any visual that implies activity without a declared event (principles 4, 5). Removing a textual equivalent (principle 24). Colour as a sole status signal. Regressing any performance budget or the 95th-percentile figure. Expanding beyond one neighborhood. |
| **Deliverables** | Material and palette system; low-poly assets under `assets/`; updated world components; before/after performance comparison. |
| **Tests** | Every state→visual assertion and colour-independence test unchanged and green; performance re-measured against AC-117's baseline at all four configurations; selection hit targets and navigator equivalents unchanged. |
| **Operator validation** | **Gate.** Operator confirms the neighborhood reads as one cohesive place, that ten-second comprehension (V-01) still holds, and that it feels no slower. |
| **Acceptance criteria** | Cohesive visual treatment; zero new world objects; every operational meaning preserved; no budget regressed. |
| **Stop condition** | Visual pass accepted with performance proven. **Hard stop.** |

---

### AC-119 — Repository, evidence, and CI hygiene — **[HARD]**

| Field | Content |
| --- | --- |
| **Objective** | Make the gates automatic and the evidence chain durable. |
| **Prerequisites** | AC-102 ratified. May run parallel to any rung. |
| **Authoritative sources** | `docs/audits/agent-city-post-v1-truth-audit.md` PV1-024, PV1-030, PV1-044–PV1-047; `.gitignore`; `docs/evidence/fbl-035/operator-final-approval.md` |
| **Allowed work** | CI running typecheck, lint, build, and the unit/integration suite on every change, plus the browser suite on a schedule; implementing the AC-102 evidence-retention decision (either a `!docs/evidence/**/*.sqlite` exception, or a superseding dated record citing only retained artifacts); an evidence retention policy; removing `docs/audits/.gitkeep`; a provenance note on `prompts/build-ladder.md`; documenting the platform pin on the Playwright baselines. |
| **Prohibited work** | Editing any existing V1 evidence file or approval record — supersede with a new dated record only (principle 18). Deleting evidence. Committing secrets, credentials, or local environment files. Making CI a gate that can be bypassed silently. |
| **Deliverables** | CI configuration; evidence retention policy and decision implementation; hygiene corrections. |
| **Tests** | CI reproduces every local gate result; the retention policy is verifiable from a fresh clone. |
| **Operator validation** | Operator confirms a fresh clone can verify every artifact the approval records cite. |
| **Acceptance criteria** | Gates run automatically; cited evidence is retrievable from a clean clone; no V1 record edited in place. |
| **Stop condition** | CI green and evidence chain durable. |

---

### AC-120 — Complete V1.1 acceptance verification — **[terminal]**

| Field | Content |
| --- | --- |
| **Objective** | Execute the whole V1.1 acceptance specification against the finished system and produce a signed-off report declaring V1.1 complete. |
| **Prerequisites** | AC-101 through AC-119 all at their stop conditions. |
| **Authoritative sources** | `docs/02-specification/v1.1-acceptance.md` (authored at AC-102, superseding nothing in `v1-acceptance.md`); ratified V1.1 mission, scope, and exclusions; `docs/02-specification/v1-acceptance.md` (V1 behaviors that must not regress) |
| **Allowed work** | Test execution and reporting only. A defect the suite surfaces reopens its owning V1.1 rung, is fixed there, and this rung re-runs. |
| **Prohibited work** | Waiving any mandatory test. Substituting an excluded feature for a failing required one. Declaring done with an open mandatory defect. Reopening any `FBL-*` rung. Closing Finding 6 by assertion. Accepting the mission outcome on automated output alone — the operator must perform it. |
| **Deliverables** | Full V1.1 acceptance report; operator sign-off record; updated `FOUNDATION_VERSION.md` operational metadata; `CHANGELOG.md`. |
| **Tests** | Every automated test across AC-101–AC-119 run as one suite; the full V1 F-01–F-12 / V-01–V-08 tables still green in mock mode; the real-path suite; the cross-process integration suite; accessibility, performance, and recovery suites; zero typecheck, lint, or build errors. |
| **Operator validation** | **Terminal gate.** Operator performs the entire mission outcome personally, unassisted, end to end, in one session: single command → objective → plan review → authorization → real stages → approval → validated output → restart. |
| **Acceptance criteria** | All mandatory tests pass; the mission outcome is performed by the operator; every V1.1 exclusion remains unimplemented; every V1 exclusion remains unimplemented; documentation matches implementation — including status metadata, the clause V1 satisfied only narrowly; Finding 6 closed or explicitly re-carried with a diagnosis. |
| **Stop condition** | Full acceptance report signed off. **Terminal stop of this ladder.** Any further work requires a new reviewed mission baseline. |

---

## 4. Operator gates — consolidated

Eleven points where work halts for a human, seven of them decisions rather than observations.

| Rung | What the operator must do |
| --- | --- |
| AC-101 | Read the corrected entry-point documents and confirm they match the repository |
| AC-102 | **Ratify or decline** the V1.1 baseline; answer all six blocking decisions |
| AC-103 | **Accept** Finding 6's closure against the standard they chose |
| AC-104 | **Launch** Foundry from a clean clone with one command |
| AC-106 | Press every backend-mode control and see a truthful result |
| AC-108 | **Submit** a real objective and **review** the plan unassisted |
| AC-110 | **Authorize** one controlled execution, having read exactly what will run |
| AC-111 | **Authorize the real run**, watch it, and review its evidence |
| AC-113 | **Approve** one real artifact, and separately **reject** one |
| AC-118 | **Observe** the visual pass and confirm comprehension and responsiveness hold |
| AC-120 | **Perform the entire mission outcome** personally and sign off |

## 5. Documentation correction versus feature work

Kept strictly separate so neither hides inside the other.

| Purely documentation | Purely feature | Mixed — prohibited |
| --- | --- | --- |
| AC-101, AC-102 | AC-107–AC-113, AC-118 | None permitted |

`[FIX]` rungs (AC-103, AC-105, AC-106) repair behavior that contradicted a document authoritative when it was written. `[HARD]` rungs (AC-104, AC-114–AC-117, AC-119) make correct behavior sufficient for real operation. A `[DOC]` rung that changes behavior, or a `[FEAT]` rung that quietly corrects documentation, has violated its own prohibited-work field.

## 6. What this ladder preserves throughout

Checked at every rung's stop condition, not only at AC-120:

1. The deterministic mock runtime remains the default for automated tests and a selectable operating mode. `v1-canonical-run.json` stays byte-identical.
2. Backend authority is never bypassed. The orchestrator is a client of `CommandHandler`, with no direct write path.
3. `stage.validation_passed` remains unreachable via the Builder or the frontend.
4. R3–R5 remain unrepresentable.
5. The Builder can never write or execute its own validation.
6. Every V1 acceptance behavior keeps passing.
7. V1 evidence and the V1 Build Ladder are never edited — only superseded by new dated records.
8. No Future Registry concept is promoted.

## 7. Estimated shape

Twenty rungs. Two documentation, three defect, seven hardening, seven feature, one terminal. The mission outcome is demonstrable at **AC-113**; the seven rungs after it exist to make that demonstration durable, safe, accessible, coherent, and reproducible rather than a one-time success.

---

**Companion documents:**
`docs/audits/agent-city-post-v1-truth-audit.md` · `docs/proposals/agent-city-v1.1-mission-proposal.md`
