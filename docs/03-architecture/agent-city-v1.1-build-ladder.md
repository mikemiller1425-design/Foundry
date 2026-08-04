# Agent City V1.1 Build Ladder

**Foundation:** 1.0
**Status:** **Ratified** — 2026-08-03, at `AC-102`, by operator approval
**Mission:** `docs/01-mission/agent-city-v1.1-mission.md`
**Acceptance:** `docs/02-specification/v1.1-acceptance.md`
**Derived from:** `docs/proposals/agent-city-v1.1-build-ladder-proposal.md` (now historical)

---

## 0. Standing and authority

This is the **authoritative V1.1 Build Ladder**. Before this document existed, the V1.1 mission record cited it by path and it was absent; that gap is closed here.

- Foundry Foundation 1.0 is **frozen**.
- Agent City V1 is **complete**. `FBL-001`–`FBL-035` and `FBL-021A` are historical completed authority: never renumbered, never reopened, never re-graded by this ladder. Their evidence under `docs/evidence/` is not altered.
- `docs/proposals/agent-city-v1.1-build-ladder-proposal.md` is **historical** as of this ratification. Its per-rung *Authoritative sources*, *Allowed work*, *Deliverables*, *Tests*, and *Acceptance criteria* fields are **adopted unchanged** and remain readable there. **Where the proposal and this ladder differ, this ladder governs.** Future changes to a rung are made here, never in the proposal.
- `docs/04-future/registry.md` and `docs/archive/` are **non-authoritative** for every rung. No rung may cite them as a requirements source.
- **This ladder grants no standing authorization.** Each rung requires its own explicit operator authorization before it may begin.

## 1. How to read this ladder

- Identifiers are `AC-101` onward — a namespace disjoint from `FBL-*`. **Identifiers are never reused.** Work discovered after a rung closes is inserted as a lettered sub-rung (`AC-104A`), never by shifting later numbers.
- A rung may not **begin** until every prerequisite is true **and** the preceding rung's stop condition is reached.
- A rung may not **end** by sliding into the next rung's work.
- Each rung is one **contract-first vertical slice** (ADR-003).
- Rungs are typed: **[DOC]** documentation correction, **[FIX]** defect repair, **[HARD]** hardening, **[FEAT]** new capability. A `[DOC]` rung may not change behaviour; a `[FEAT]` rung may not quietly correct documentation.

## 2. Ladder overview

| ID | Type | Name | Depends on | Operator gate | State |
| --- | --- | --- | --- | --- | --- |
| AC-101 | DOC | Post-V1 truth reconciliation | — | Review | ✅ **Closed** (`c717fc6`, `ebedc9e`) |
| AC-102 | DOC | V1.1 mission baseline ratification | AC-101 | **Ratify** | ✅ **Closed** — this ratification |
| **AC-103P** | — | **Pre-ladder proof — objective submission** | — | Verified | ⚠️ **Preserved, not a rung.** See §3 |
| AC-103 | FIX | Finding 6 resolution | AC-102 | **Accept closure** | ⬜ Not started |
| AC-104 | HARD | One-command local operation | AC-102 | **Launch it** | ✅ **Closed** (`4e7d0f6`) |
| AC-105 | FIX | Runtime-mode and credential handoff at runtime | AC-104 | Observe | ✅ **Closed** (`573b1d1`, `3e76c70`) |
| AC-106 | FIX | Backend-mode command honesty | AC-105 | Observe | ✅ **Closed** (`ceca998`) |
| AC-107 | FEAT | Bounded-objective contract | AC-106 | Review contract | ✅ **Closed** (`1a184f1`, `29dbcbc`) |
| AC-108 | FEAT | Objective submission and plan review | AC-107 | **Submit + review plan** | ✅ **Closed** (`2843b53`) |
| AC-109 | FEAT | Backend orchestration of a build (mock executor) | AC-108 | Observe | ✅ **Closed** (`ae0b762`) |
| AC-110 | FEAT | Execution authorization gate | AC-109 | **Authorize** | ⬜ Not started |
| AC-111 | FEAT | Real controlled Builder execution | AC-110 | **Authorize the run** | ⬜ Not started |
| AC-112 | FEAT | Independent Inspector validation of real output | AC-111 | Observe rejection + pass | ⬜ Not started |
| AC-113 | FEAT | Approval, transfer, and completion on the real path | AC-112 | **Approve and reject** | ⬜ Not started |
| AC-114 | HARD | Restart, recovery, and idempotency on the real path | AC-113 | Observe | ⬜ Not started |
| AC-115 | HARD | Retire seed-dependent demonstrations | AC-114 | Observe | ⬜ Not started |
| AC-116 | HARD | Security and containment hardening | AC-113 | Review | ⬜ Not started |
| AC-117 | HARD | Accessibility, browser, and performance debt closure | AC-114 | Observe | ⬜ Not started |
| AC-118 | FEAT | Cohesive low-poly neighborhood pass | AC-113, AC-117 | **Observe** | ⬜ Not started |
| AC-119 | HARD | Repository, evidence, and CI hygiene | AC-102 | Review | ⬜ Not started |
| AC-120 | — | Complete V1.1 acceptance verification | all | **Sign off** | ⬜ Not started |

**Critical path:** `AC-101 → AC-102 → AC-104 → AC-105 → AC-106 → AC-107 → AC-108 → AC-109 → AC-110 → AC-111 → AC-112 → AC-113 → AC-114 → AC-117 → AC-118 → AC-120`.

`AC-103`, `AC-116`, and `AC-119` sit off the critical path. **`AC-103` must close before `AC-111`** — a real run may not be introduced over an unexplained browser failure.

**Safe parallel groups:** {AC-103, AC-104}, {AC-116, AC-117}, {AC-119, any}.

## 3. `AC-103P` — pre-ladder proof

**`AC-103P` is not a rung. It is a preserved record of authorized work that landed before this ladder existed.** It closes nothing, satisfies no acceptance criterion, and confers no permission.

| Field | Content |
| --- | --- |
| **What it is** | One operator-authorized vertical slice: the operator submits a bounded software objective; Foundry validates it, creates the `Project` and `Build` as backend truth, emits the declared events, and updates the world and timeline |
| **Commits** | `9a6f7ee`, `e1fa301`, `9345a04`, `7b536a9` |
| **Authorization** | Direct operator instruction on 2026-08-03 ("Authorize the first implementation slice"), given before `AC-102` was ratified and therefore outside any ladder |
| **Why the `P`** | The commit messages label this work "AC-103". Under this ladder `AC-103` is **Finding 6 resolution**, which this work did not touch. The identifier rule forbids reuse, and pushed history is append-only (principle 18), so the label is corrected by record rather than rewrite |
| **Evidence** | `docs/evidence/ac-103p/operator-verification.md` — operator-reported manual verification in backend mode |
| **Formal status** | **Awaiting validation** under `AC-105`–`AC-108`. Those rungs must still run, and each must judge this code against its own acceptance criteria |
| **What it does not do** | It does not close `AC-105`, `AC-106`, `AC-107`, or `AC-108`. It does not begin `AC-103`. It grants no authorization for any later rung |

Full commit-by-commit mapping and residue: `docs/audits/agent-city-v1.1-rung-label-reconciliation.md`.

**Ordering note.** `AC-103P` landed before `AC-104` and `AC-105` because the operator explicitly deferred one-command startup for the first slice and directed the work to proceed against the existing two-terminal startup. That deferral is recorded, not retroactive permission: `AC-104` and `AC-105` remain **required and un-started**, and the critical path is unchanged.

## 4. Rungs

Per-rung *Authoritative sources*, *Allowed work*, *Deliverables*, *Tests*, and *Acceptance criteria* are adopted unchanged from `docs/proposals/agent-city-v1.1-build-ladder-proposal.md` § 3. The fields that gate whether work may start, continue, or stop are restated here and **govern**.

### AC-101 — Post-V1 truth reconciliation — [DOC] — ✅ Closed

Corrected twelve entry-point and specification documents that were materially false about project status. Documentation only. Closed by `c717fc6` and `ebedc9e`.

### AC-102 — V1.1 mission baseline ratification — [DOC] — ✅ Closed

Established the V1.1 mission, scope, exclusions, decision record, acceptance specification, and this ladder as tracked authority; corrected both priority-1 documents; recorded `AC-103P`. Documentation only. Closed by this ratification.

### AC-103 — Finding 6 resolution — [FIX] — ⬜ Not started

- **Objective:** Diagnose the three unclassified Playwright-WebKit failures and either repair them or classify them with a retained, reproducible artifact.
- **Depends on:** AC-102.
- **Prohibited work:** Closing by reclassification without diagnosis. Deleting, skipping, or retrying the failing tests to make them green. Raising timeouts as a substitute for root cause. Editing the `FBL-035` approval record. Reopening `FBL-034` or `FBL-021A`.
- **Operator gate:** **Accept closure** against the standard chosen in Decision 5.
- **Stop condition:** Finding 6 closed with diagnosis, or explicitly re-accepted with an artifact. **Must close before AC-111.**
- **Note:** Evidence belongs in `docs/evidence/ac-103/`, which is currently absent — the earlier directory of that name was renamed to `ac-103p` at ratification.

### AC-104 — One-command local operation — [HARD] — ✅ Closed

- **Objective:** One documented command, from a clean clone, brings up a working Foundry with both processes.
- **Depends on:** AC-102.
- **Prohibited work:** Docker, compose, cloud deployment, process supervisors, production packaging. Changing application behaviour. Weakening the loopback boundary.
- **Operator gate:** **Launch it** from a clean clone.
- **Stop condition:** Operator confirms single-command launch. **Hard stop** before any runtime-mode change.

**Closed 2026-08-03** against commit `4e7d0f6`, on the operator's confirmation that `pnpm dev` started both services, the app opened, and Ctrl-C stopped both cleanly.

- **Delivered:** `pnpm dev` (`scripts/dev.mjs`), the `pnpm verify:launch` scripted check (`scripts/verify-launch.mjs`), `.env.example`, `docs/operations/quickstart.md`, root `dev`/`start`/`verify:launch` scripts, corrected per-app run sections.
- **Evidence:** `docs/evidence/ac-104/operator-observation.md`. `F-101` and `F-102` satisfied; `pnpm verify:launch` 8/8, run once in the working tree and once in a genuine clean clone; typecheck 8/8, lint clean, build clean, 928 tests / 0 failures.
- **Prohibited work confirmed not done:** no application source changed — the commit touched no file under `apps/*/src/` or `packages/*/src/`.
- **Deliberately left to `AC-105`:** the operator still pastes the credential, and a production build remains mode-locked (PV1-028). Both are stated in the quickstart rather than left to be discovered.
- **Hard stop reached.** `AC-105` is not started and requires its own explicit operator authorization.

### AC-105 — Runtime-mode selection and credential handoff at runtime — [FIX] — ✅ Closed

- **Objective:** Runtime mode selectable at run time rather than build time; remove the copy-a-token-from-stdout step, without building a session system.
- **Depends on:** AC-104.
- **Prohibited work:** Sessions, expiry, refresh, logout, user accounts, or any authentication *system*. Embedding a credential in the client bundle. Removing manual credential entry. Weakening `403 actor_mismatch` or the `PrincipalRegistry` boundary.
- **Operator gate:** Observe mode switching without rebuild, and reach an approval-capable state without reading a token from a terminal.
- **Stop condition:** Both modes reachable from one artifact and the credential step is automatic. **Hard stop.**
- **AC-103P interaction:** `e1fa301` made the credential enterable outside a pending approval. Runtime-mode selection and the automatic handoff are **untouched** — both delivered here, so this residue is now cleared.

**Closed 2026-08-03** against `573b1d1`, with defect fix `3e76c70`.

- **Delivered:** per-request runtime-mode resolution from a server-side `FOUNDRY_API_URL` (`force-dynamic`); the local credential handoff (`0600` file, loopback-only route, removed on shutdown); five distinguishable credential states; an always-present credential panel with **Change**/**Clear**; loopback-only binding for both servers; `pnpm verify:runtime-mode`.
- **Evidence:** `docs/evidence/ac-105/operator-observation.md`. `F-103` and `F-104` satisfied. `verify:runtime-mode` 7/7; `typecheck` 8/8; lint clean; build clean; 988 tests / 0 failures.
- **Gate, stated precisely:** the operator observed the credential half (automatic handoff with no terminal token, Clear, adopt, invalid-recovery, and a clear occupied-port error). **They did not report observing mode switching without a rebuild**; that half is carried by `verify:runtime-mode` against a real build, not by a human observation.
- **Defect found during closure and fixed:** the handoff filename was a constant, so concurrent launcher instances clobbered each other's file. Now namespaced by API port, with regression cover in `verify-launch.mjs`.
- **Prohibited work confirmed not done:** no session system, no credential in the bundle, manual entry retained, `403 actor_mismatch` and `PrincipalRegistry` untouched — no backend file changed.
- **Hard stop reached.** `AC-106` is not started and requires its own explicit operator authorization.

### AC-106 — Backend-mode command honesty — [FIX] — ✅ Closed

- **Objective:** Eliminate every silent no-op in backend mode.
- **Depends on:** AC-105.
- **Prohibited work:** Adding a `demo.*` command type without a specification amendment. Introducing a free-text command input. Any orchestration behaviour.
- **Operator gate:** Press every backend-mode control and see a truthful result.
- **Stop condition:** Zero silent no-ops; F-07 holds in both modes. **Hard stop** before any objective work.
- **AC-103P interaction:** `9a6f7ee` and `9345a04` addressed PV1-012 and PV1-052. PV1-013 and the demo-control disposition were owed here and are now **delivered** — see below.

**Closed 2026-08-03** against commit `ceca998`.

- **Delivered:** six classified failure kinds (`unsupported`, `validation`, `unauthorized`, `blocked`, `unreachable`, `server_error`), each with a title, the backend's reason verbatim, and a corrective action rendered in the 2D strip; demo controls disabled in backend mode with a stated reason; `building.selected` emitted backend-side via the declared `Building.Select`; `runtimeMode` stated on the context rather than inferred.
- **Evidence:** `docs/evidence/ac-106/operator-observation.md` and `docs/evidence/ac-106/control-dispositions.md`. `F-105` and `F-106` satisfied. typecheck 8/8, lint clean, build clean, **1033 tests / 0 failures**; live verification classified all six backend cases as expected.
- **Gate, stated precisely:** the operator observed demo controls, unauthorized, credential restore, validation, selection, and mock mode — six of seven items PASS. They recorded **`unreachable` as not manually repeated** (covered by live verification) and did not report exercising **`blocked`**; both are carried by tests and the live run, not by a human observation.
- **Correction during the rung:** the first implementation classified purely on HTTP status, which mis-filed a missing credential as `blocked` because `CommandHandler`'s authorization guards answer `200`. Corrected before commit; rationale in the decision record.
- **Residue cleared:** PV1-012, PV1-013, and the demo-control disposition. PV1-052's *inoperable* half is closed here; its *empty* half remains with `AC-108`.
- **Prohibited work confirmed not done:** no `demo.*` command type added, no free-text command input, no orchestration, no backend file changed.
- **Hard stop reached.** `AC-107` is not started and requires its own explicit operator authorization.

### AC-107 — Bounded-objective contract — [FEAT] — ✅ Closed

- **Objective:** Define, in `packages/contracts` and `packages/event-types` first, the typed vocabulary for an operator objective, a structured plan, and an execution authorization. Contract only — no behaviour.
- **Depends on:** AC-106.
- **Prohibited work:** Any orchestrator, UI, or executor. Widening `V1RiskClassSchema` beyond R0–R2. Adding a stage name outside the seven. Loosening the closed command vocabulary.
- **Operator gate:** Review the objective envelope and confirm it bounds what was intended.
- **Stop condition:** Contracts and amendments merged with tests green. **Hard stop** before any consumer is written.
- **AC-103P interaction:** The objective envelope existed; the plan and authorization contracts did not, and the amendments this rung owns were unmade. **All now delivered** — see below.

**Closed 2026-08-03** against `1a184f1` with corrections in `29dbcbc`, on the operator's contract approval.

- **Approved contract decisions** (operator, verbatim in substance): objectives 12–500 printable single-line characters; workspace Foundry-managed only; risk R0–R2 only; the seven-stage vocabulary and order fixed; plain-text acceptance criteria appropriate for V1.1; plan review and execution authorization remain separate decisions; every issued `ExecutionAuthorization` requires a positive finite `maxBudgetUsd` capped at **$25**; `planRevision` is a **non-security change indicator only**; **`AC-110` must implement the backend-generated SHA-256 canonical plan-content hash, persist it, require it on authorization, and compare it server-side**; Claude Code may appear **only once and only for `backend_implementation`**; **no execution is authorized by this approval**.
- **Review history:** first review returned *approved with required corrections*; all three (budget, plan binding, Claude Code allocation) were applied before approval.
- **Evidence:** `docs/evidence/ac-107/operator-approval.md` and `docs/evidence/ac-107/contract-boundary.md`. `F-107` satisfied. typecheck 8/8, lint clean, build clean, **1121 tests / 0 failures**.
- **Amendments made:** `domain-model.md` Build ("demo objective fixed" superseded; `currentStageId` nullable confirmed), `domain-model.md` per-command parameter schemas, `event-model.md` operator decision events, `principles.md` 3a status statement, plus `F-113a` and the `AC-110` binding amendment added at review.
- **Prohibited work confirmed not done:** no orchestrator, UI, or executor; `V1RiskClassSchema` not widened; no stage added outside the seven; the closed command vocabulary unchanged.
- **Hard stop reached.** `AC-108` is not started and requires its own explicit operator authorization. `AC-110`'s amended binding requirement is recorded above and is **not** implemented.

### AC-108 — Objective submission and plan review — [FEAT] — ✅ Closed

- **Objective:** The operator submits one bounded objective **and reads back a structured plan**.
- **Depends on:** AC-107.
- **Prohibited work:** Executing anything. Free-text natural-language shell or autonomous planning input. Auto-advancing past plan review. Bypassing `CommandHandler`.
- **Operator gate:** **Submit** a real objective and **review** the plan unassisted.
- **Stop condition:** Operator has submitted an objective **and reviewed a plan**. **Hard stop.**
- **AC-103P interaction:** Submission was proven; the Architect step, the `BuildPlan`, and the plan review panel did not exist. **All three now delivered** — see below.

**Closed 2026-08-03** against commit `2843b53`, on the operator's observation and approval.

- **Delivered:** `parseCommandParams` wired through `CommandHandler`; `Build.Plan` persisting a schema-valid plan; the new `Plan.Review` command; `operator.plan_reviewed` in the runtime vocabulary; a deterministic template-driven Architect step; a plan review surface with five distinct states; `WorldState.currentPlan`.
- **"Proceed" authorizes nothing** — enforced in the handler, the reducer, the panel's wording, and a test asserting zero `BuildStage`/`Task`/`AgentRun`/`Artifact`/`Approval` records after a `proceed` decision.
- **Evidence:** `docs/evidence/ac-108/operator-observation.md` and `docs/evidence/ac-108/plan-review-record.md`. `F-108`, `F-109`, and the plan portion of `V-101` satisfied. typecheck 8/8, lint clean, **1170 tests / 0 failures**.
- **Gate, stated precisely:** the operator reported the rung "observed and approved" as a whole and **did not enumerate individual checklist items**; each item is separately carried by automated tests and the live run.
- **Two defects found by live verification** and fixed before commit: the reported `planId` was the build id, and the `Plan.Review` authorization refusal was worded for approvals.
- **Amendments:** `domain-model.md` (`Plan.Review` command, `Plan` record and invariants); `event-model.md` (`operator.plan_reviewed` vocabulary entry, `build.planned`'s optional `plan` field).
- **PV1-052:** the *empty world* half is resolved — a plan is visibly represented without pretending work has begun. A world showing *running* work is `AC-109`'s.
- **Hard stop reached.** `AC-109` is not started and requires its own explicit operator authorization. No execution authorization exists; no Claude Code was invoked.

### AC-109 — Backend orchestration of a build (mock executor) — [FEAT] — ✅ Closed

- **Prohibited work:** Any direct `appendEvent` from the orchestrator. Any second write path. Any real Claude Code invocation. Reordering the canonical sequence. Modifying the mock runtime or its canonical fixture.
- **Stop condition:** Orchestrated mock-executor build reaches the approval gate. **Hard stop** before any real execution.

**Closed 2026-08-04** against commit `ae0b762`, on the operator's observation and approval.

- **Delivered:** `BuildOrchestrator` — a client of `CommandHandler` and nothing else; `POST /builds/{id}/start`; the `Build.Start` guard (authenticated operator, plan reviewed `proceed` at the current revision, build still `planned`); `waiting_for_approval` derived from `approval.requested`; and the `BuildRunPanel`.
- **Six stages complete, the seventh is never created.** The run stops at the approval gate with one pending `Approval`, no transfer, no execution authorization, and no real invocation. Resolving that approval records a decision and advances nothing — said in the approval's own `recommendedAction` so it is not a silent no-op (`F-105`).
- **Nothing executed.** Every `AgentRun` is `runtimeType: "mock"`, including the stage the plan allocated to `claude_code`; `claude_code` runs: **0**. The mock is stated in five places in the interface, not one.
- **Evidence:** `docs/evidence/ac-109/operator-observation.md` and `docs/evidence/ac-109/orchestration-record.md`. `F-110`, `F-111`, `F-112`, and the orchestrated-build portions of `V-101`/`V-102` satisfied. typecheck 8/8, lint clean, **1239 tests / 0 failures**.
- **Gate, stated precisely:** the operator reported the rung "observed and approved" as a whole and **did not enumerate individual checklist items**; each item is separately carried by automated tests and the live run.
- **Two defects found by test** and fixed before commit: the duplicate-start refusal named a state machine rather than the operator's act, and the `F-111` source tripwire was defeated by the module's own prose.
- **Amendments:** `event-model.md` (`approval.requested` derives `waiting_for_approval`); `domain-model.md` (`Build.Start` preconditions and actor requirement, recorded as **not** an execution authorization). **No new event type and no new command type.**
- **Preserved, checked not assumed:** `v1-canonical-run.json` byte-identical to `HEAD`; the mock runtime's behaviour files untouched.
- **PV1-052 fully resolved** — the world now shows *running* work, every visual change driven by a declared backend event.
- **Hard stop reached.** `AC-110` is not started and requires its own explicit operator authorization. No execution authorization exists; no Claude Code was invoked.

### AC-110 — Execution authorization gate — [FEAT] — ⬜ Not started

- **Operator gate:** **Authorize** one controlled execution, having read exactly what will run.
- **Stop condition:** Authorization gate proven in both directions. **Hard stop** — the real run is a separate rung and a separate authorization.

**Amended requirement — plan binding (added 2026-08-03 at the operator's `AC-107` contract review):**

> The authoritative execution binding **must** be a **backend-generated SHA-256 hash of canonical persisted plan content**, stored with the `Plan` record and compared **server-side** against the authorization before any execution is dispatched.

- The client-computable `planRevision` (a non-cryptographic FNV hash, `packages/contracts/src/plan.ts`) is retained **only** as a revision/change indicator for review-time drift detection. It **may not** be represented as, or relied on as, a security boundary.
- The hash is computed by the backend over persisted content. A value supplied by a client is **never** accepted as the binding.
- `AC-110` may not close until this comparison is implemented server-side and proven in both directions.
- The declared `operator.execution_authorized` payload carries `planContentHash` as optional **only** because no producer exists yet; `AC-110` must make it required.

### AC-111 — Real controlled Builder execution — [FEAT] — ⬜ Not started

- **Depends on:** AC-110, **and AC-103 closed**.
- **Operator gate:** **Authorize the real run**, watch it, review its evidence.
- **Stop condition:** One successful real stage with reviewed evidence. **Hard stop** — the authorization is spent.

### AC-112 — Independent Inspector validation of real output — [FEAT] — ⬜ Not started

- **Stop condition:** Real artifact independently validated. **Hard stop.**

### AC-113 — Approval, transfer, and completion on the real path — [FEAT] — ⬜ Not started

- **Operator gate:** **Approve** one real artifact and separately **reject** one.
- **Stop condition:** One complete real build, operator-approved, with independently validated output. **Hard stop** — the mission's substantive completion.

### AC-114 — Restart, recovery, and idempotency on the real path — [HARD] — ⬜ Not started

- **Stop condition:** Real build survives every interruption. **Hard stop.**

### AC-115 — Retire seed-dependent demonstrations — [HARD] — ⬜ Not started

- **Stop condition:** Seed scripts retired. **Hard stop.**

### AC-116 — Security and containment hardening — [HARD] — ⬜ Not started

- **Prohibited work:** Claiming sandboxing that does not exist; using its absence to argue for widening the workspace (Decision 2).
- **Stop condition:** Posture hardened and documented.

### AC-117 — Accessibility, browser, and performance debt closure — [HARD] — ⬜ Not started

- **Required:** Performance measured against a tree that **includes `e5378aa`** (Decision D-8, reconciliation N-04).
- **Stop condition:** Debt closed and baseline recorded. **Hard stop — AC-118 may not begin without this baseline.**
- **Note:** The six Playwright screenshot baselines are stale as of ratification; regeneration is owned here or at `AC-119`, and requires explicit operator approval. See the rung-label reconciliation record.

### AC-118 — Cohesive low-poly neighborhood pass — [FEAT] — ⬜ Not started

- **Depends on:** AC-113, AC-117. **Resolves D-8.**
- **Operator gate:** **Observe** and confirm comprehension and responsiveness hold.
- **Stop condition:** Visual pass accepted with performance proven. **Hard stop.**

### AC-119 — Repository, evidence, and CI hygiene — [HARD] — ⬜ Not started

- **Owns:** N-03 (`pnpm format` fails on 28 files, pre-existing), N-05 (`next-env.d.ts` drift), PV1-024/PV1-044 (evidence retention).
- **Prohibited shortcut:** Running `prettier --write` across the tree inside an unrelated rung.
- **Stop condition:** CI green and evidence chain durable.

### AC-120 — Complete V1.1 acceptance verification — [terminal] — ⬜ Not started

- **Operator gate:** **Perform the entire mission outcome personally and sign off.**
- **Stop condition:** Full acceptance report signed off. **Terminal stop.** Further work requires a new reviewed mission baseline.

## 5. Operator gates — consolidated

| Rung | What the operator must do |
| --- | --- |
| AC-101 | Read the corrected entry-point documents ✅ |
| AC-102 | **Ratify or decline** the V1.1 baseline ✅ |
| AC-103 | **Accept** Finding 6's closure against the chosen standard |
| AC-104 | **Launch** Foundry from a clean clone with one command ✅ |
| AC-106 | Press every backend-mode control and see a truthful result ✅ |
| AC-107 | **Review** the objective envelope and confirm it bounds what was intended ✅ |
| AC-108 | **Submit** a real objective and **review** the plan unassisted ✅ |
| AC-109 | **Observe** an orchestrated build reach the approval gate, and that nothing real ran ✅ |
| AC-110 | **Authorize** one controlled execution |
| AC-111 | **Authorize the real run**, watch it, review its evidence |
| AC-113 | **Approve** one real artifact, and separately **reject** one |
| AC-118 | **Observe** the visual pass |
| AC-120 | **Perform the entire mission outcome** personally and sign off |

## 6. What this ladder preserves throughout

Checked at every rung's stop condition, not only at `AC-120`:

1. The deterministic mock runtime remains the default for automated tests and a selectable operating mode. `v1-canonical-run.json` stays **byte-identical**.
2. Backend authority is never bypassed. The orchestrator is a client of `CommandHandler`, with no direct write path.
3. `stage.validation_passed` remains unreachable via the Builder or the frontend.
4. R3–R5 remain unrepresentable.
5. The Builder can never write or execute its own validation.
6. Every V1 acceptance behaviour keeps passing.
7. V1 evidence and the V1 Build Ladder are never edited — only superseded by new dated records.
8. No Future Registry concept is promoted.

## 7. Shape

Twenty rungs plus one preserved pre-ladder proof. Two documentation, three defect, seven hardening, seven feature, one terminal. The mission outcome is demonstrable at **AC-113**; the seven rungs after it make that demonstration durable rather than a one-time success.

---

**Companion documents:**
`docs/01-mission/agent-city-v1.1-mission.md` · `docs/01-mission/agent-city-v1.1-decision-record.md` · `docs/02-specification/v1.1-acceptance.md` · `docs/audits/agent-city-v1.1-rung-label-reconciliation.md`
