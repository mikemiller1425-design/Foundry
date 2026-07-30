# Foundation V1 — FBL-001 Closure Matrix

**Source audit:** `docs/audits/foundry-foundation-v1-audit.md` (dated 2026-07-28)
**Build ladder rung:** `FBL-001` — Foundation audit resolution (`docs/03-architecture/foundry-build-ladder.md`)
**Scope:** All 4 BLOCKER findings (B-01–B-04) and all 6 MAJOR findings (M-01–M-06)
**Status of this document:** FBL-001 deliverable only. It does **not** constitute the fresh consistency audit or the operator approval required by FBL-002 — those remain unexecuted.

**Revision note:** B-01 and M-06 below were corrected after an internal review found (1) a circular dependency in the original B-01 resolution — `transfer.ready` required its stage completed, while `deployment_package` (a stage whose own work *is* a transfer) completed only after `transfer.completed` — and (2) an over-counting risk in the original M-06 resolution, which did not make explicit that a single package moved across three transfer legs is still exactly one successful package, not three. Both are corrected below; this document reflects the corrected, final state, not the intermediate draft.

Every finding below is closed by resolution (none were reclassified — the option described in FBL-001 was not needed).

---

## BLOCKER findings

### B-01 — Primary workflow order: transfer vs approval vs QA is ambiguous

| Field | Content |
| --- | --- |
| Original problem | Mission scope, acceptance journey, and world-model text left it unclear whether approval gates every transfer, only the final one, or occurs before any vehicle motion. An earlier draft resolution introduced a **circular dependency**: `transfer.ready` required its stage completed (Required Invariant 3), while `deployment_package` — a stage whose own work *is* the QA → Dock transfer — completed only after that transfer's `transfer.completed`. |
| Resolution | Canonicalized the sequence **work → validate → approve → transfer → dock**, and defined three explicit transfer legs whose preconditions never reference their own destination/containing stage: **Construction Office → Warehouse** (ready when `integration` completed + artifact ready); **Warehouse → QA** (ready when `integration` completed + artifact ready + `qa_validation` merely `ready`, not completed; this leg's `transfer.completed` is the precondition that permits `qa_validation`'s `stage.started`, so Inspector validation begins only after physical arrival); **QA → Deployment Dock** (ready when `qa_validation` `completed` + artifact ready + Approval `approved` — the only approval-gated leg, occurring during `deployment_package`, whose own `stage.completed` fires only after this transfer's `transfer.completed` + receipt, with `build.completed` immediately after). Required Invariant 3 was reworded to state it refers to the stage that *produced* the artifact, never the transfer's own containing stage — removing the cycle structurally, not just by example. |
| Authoritative file changed | `docs/01-mission/v1-scope.md`; `docs/02-specification/v1-acceptance.md`; `docs/02-specification/domain-model.md`; `docs/02-specification/event-model.md`; `docs/02-specification/world-model.md` |
| Exact section changed | `v1-scope.md` § "Required workflow", § "Transfer and approval scope" (rewritten with three explicit legs), and § "V1 Build Stages" (rows 5–7 notes updated); `v1-acceptance.md` § "Primary user journey" (steps 9–13) and new "Transfer detail" note; `domain-model.md` → Required Invariant 3, `Transfer` → Invariants (rewritten per-leg); `event-model.md` → `transfer.ready` (rewritten per-leg), `stage.started`, `stage.completed`; `world-model.md` → "QA building" → Relationships |
| Evidence the ambiguity is closed | Tracing the dependency graph for `deployment_package`: its `stage.completed` depends on `transfer.completed` (QA→Dock), whose `transfer.ready` depends on `qa_validation.completed` — a *different, earlier* stage — never on `deployment_package` itself. No cycle exists. Every leg's precondition list names a stage other than its own containing stage (or, for the Warehouse → QA leg, the destination stage's `ready` state, which is satisfiable independently of that same leg completing). `stage.started` for `qa_validation` is explicitly gated on the Warehouse → QA transfer's receipt, closing the "Inspector validates before arrival" gap. |
| Status | **Resolved (corrected)** |

### B-02 — Named V1 BuildStage list is missing

| Field | Content |
| --- | --- |
| Original problem | `domain-model.md` claimed V1 stages were "listed in mission scope," but no such enumerated list existed; the intentional-failure stage and the Claude Code stage were unnamed. |
| Resolution | Added an explicit, ordered, 7-row table of named `BuildStage`s: `planning`, `scaffold`, `frontend_implementation`, `backend_implementation`, `integration`, `qa_validation`, `deployment_package`. Identified `frontend_implementation` as the stage carrying the one intentional required-item failure (a "Delete task — error-state handling" requirement) and `backend_implementation` as the one stage using the `claude_code` runtime. |
| Authoritative file changed | `docs/01-mission/v1-scope.md`; `docs/02-specification/domain-model.md` |
| Exact section changed | `v1-scope.md` new § "V1 Build Stages"; `domain-model.md` → `BuildStage` → V1 limits |
| Evidence the ambiguity is closed | `domain-model.md`'s `BuildStage` "V1 limits" field now names the exact seven stages by string identifier instead of pointing to a narrative that didn't enumerate them. The intentional failure and the Claude Code stage are each named exactly once, with no ambiguity about which stage carries which. |
| Status | **Resolved** |

### B-03 — `Revision` is required by invariants but undefined as an entity

| Field | Content |
| --- | --- |
| Original problem | `BuildStage` invariants required a `Revision` to reopen a completed stage, and `approval.revision_requested` implied a revision path, but no `Revision` entity existed anywhere in the domain model. |
| Resolution | Defined `Revision` as a full domain entity (purpose, fields, relationships, lifecycle `requested → in_progress → completed/cancelled`, invariants, commands, emitted events) and added its three events (`revision.requested`, `revision.started`, `revision.completed`) to the event model. Updated `BuildStage`'s invariant text and `stage.failed`'s description to point at the new entity, and updated `approval.revision_requested` to state it creates a `Revision` record. |
| Authoritative file changed | `docs/02-specification/domain-model.md`; `docs/02-specification/event-model.md`; `docs/00-foundry/glossary.md` |
| Exact section changed | `domain-model.md` new § "Revision" (inserted after `BuildStage`); `event-model.md` new § "Revision" (inserted after `Stage`) and updated `approval.revision_requested`; `glossary.md` new "Revision" entry |
| Evidence the ambiguity is closed | Every place that previously said "requires Revision" or "revision path" now links to a fully specified entity with fields, states, and events — an implementer no longer has to invent schema or event shapes. |
| Status | **Resolved** |

### B-04 — `Vehicle` and `AgentRun` are referenced but not defined

| Field | Content |
| --- | --- |
| Original problem | `Transfer.vehicleId` and the world model's "Utility vehicle" implied a `Vehicle` entity that didn't exist; `Agent`'s relationships mentioned "AgentRun/Event records" and F-12 needed evidence of a Claude Code run, but `AgentRun` was never defined. |
| Resolution | Defined `Vehicle` (fields, lifecycle `parked→waiting→loading→in_transit→unloading→completed/failed`, invariants, no independent events — state derives entirely from `transfer.*`) and `AgentRun` (fields including `riskClass`, `outputArtifactIds` (added to match the `agentrun.completed` event payload and the "produces Artifacts" relationship exactly, correcting an initial omission), and the forward-compatible optional `costUsd` hook already referenced by `docs/04-future/registry.md`, lifecycle `queued→running→completed/failed/timed_out`, four `agentrun.*` events) as full domain entities. |
| Authoritative file changed | `docs/02-specification/domain-model.md`; `docs/02-specification/event-model.md`; `docs/00-foundry/glossary.md`; `docs/02-specification/world-model.md` |
| Exact section changed | `domain-model.md` new §§ "Vehicle" (after `Transfer`) and "AgentRun" (after `Task`, optional fields corrected to include `outputArtifactIds`); `event-model.md` new § "AgentRun" (after `Agent`) and a note on `transfer.started`; `glossary.md` new "Vehicle" and "AgentRun" entries; `world-model.md` → "Utility vehicle" → V1 limits cross-reference |
| Evidence the ambiguity is closed | `packages/contracts` and a future runtime adapter now have an authoritative shape to implement against for both entities; `AgentRun`'s optional fields now match its own completion event's payload exactly (`outputArtifactIds` present on both); `AgentRun.costUsd` matches the Future Registry's own V1 hook note without implementing Treasury (no leakage). |
| Status | **Resolved (corrected)** |

---

## MAJOR findings

### M-01 — Demo control semantics lack event/command contracts

| Field | Content |
| --- | --- |
| Original problem | Start/pause/resume/speed/reset/replay were acceptance-required (F-01) but had no enumerated `commandType` values or payload shapes. |
| Resolution | Added an exhaustive six-row table of `commandType` values (`demo.start`, `demo.pause`, `demo.resume`, `demo.set_speed`, `demo.reset`, `demo.replay`) with `params` shapes, riding on the existing `operator.command_*` envelope, plus explicit rules on which commands may alter event history (`reset`, `replay`) versus only emission timing. |
| Authoritative file changed | `docs/02-specification/event-model.md`; `docs/02-specification/interface-model.md` |
| Exact section changed | `event-model.md` new § "Demo control commands" (under Operator); `interface-model.md` → "Persistent command input" |
| Evidence the ambiguity is closed | The mock scheduler (and later the backend) has a closed, named set of commands to implement; no `commandType` outside the table is valid, closing the "no enumerated values" gap. |
| Status | **Resolved** |

### M-02 — Disconnect/reconnect required without connection events

| Field | Content |
| --- | --- |
| Original problem | F-10 and the Lighthouse's `disconnected` state required disconnect/restore behavior, but `system.health_changed` had no defined `newHealth` or `reasons[]` vocabulary to carry it. |
| Resolution | Defined the exhaustive `newHealth` vocabulary (`healthy`/`degraded`/`critical`/`disconnected`) and `reasons[]` vocabulary (`nominal`/`connection_lost`/`connection_restored`/`agent_unreachable`/`runtime_unavailable`), per the audit's own suggested alternative (reason codes on the existing event rather than new event types). |
| Authoritative file changed | `docs/02-specification/event-model.md`; `docs/02-specification/interface-model.md` |
| Exact section changed | `event-model.md` → `system.health_changed` (two new vocabulary blocks); `interface-model.md` → "Connection / stale state" |
| Evidence the ambiguity is closed | `system.health_changed` now has a closed reason-code set that fully and exhaustively covers connection loss and restoration; no separate undefined event type is implied anywhere else. |
| Status | **Resolved** |

### M-03 — Domain states without corresponding events

| Field | Content |
| --- | --- |
| Original problem | `Build.ready`/`paused`+Resume, `BuildStage.ready`, `Transfer.blocked`, and `Agent.returnHome` were allowed states/commands with no matching event type, risking reducer/test divergence. |
| Resolution | Added all five missing events with full definitions: `build.ready`, `build.resumed`, `stage.ready`, `transfer.blocked`, `agent.returned_home`. Added each to the corresponding entity's "Emitted events" list in the domain model. |
| Authoritative file changed | `docs/02-specification/event-model.md`; `docs/02-specification/domain-model.md` |
| Exact section changed | `event-model.md` → Build, Stage, Transfer, Agent sections (new subsections); `domain-model.md` → `Agent`, `Build`, `BuildStage`, `Transfer` → Emitted events |
| Evidence the ambiguity is closed | Every allowed state/command previously missing an event now has one defined with Payload/Backend effect/Frontend effect, closing all five state→event gaps the audit identified. |
| Status | **Resolved** |

### M-04 — Requirement status vs event naming mismatch

| Field | Content |
| --- | --- |
| Original problem | Entity status `passed` (domain model) vs. event type `requirement.completed` (event model) risked inconsistent UI copy and contract enums. |
| Resolution | Picked the `passed` pair per the audit's first suggested option: renamed the event to `requirement.passed`. Removed the "(Canonical name for pass.)" disambiguation note, since the names now match directly. |
| Authoritative file changed | `docs/02-specification/event-model.md`; `docs/02-specification/domain-model.md` |
| Exact section changed | `event-model.md` → Requirement → `requirement.passed` (renamed); `domain-model.md` → `Requirement` → Emitted events |
| Evidence the ambiguity is closed | Status and event name are now identical (`passed` / `requirement.passed`) in both documents; a grep for `requirement.completed` across active docs returns only the rename annotation itself, not a live reference. |
| Status | **Resolved** |

### M-05 — Early mock-runtime phase vs "backend owns truth"

| Field | Content |
| --- | --- |
| Original problem | Handoff 002 forbids a real backend pre-frontend-validation, but principles state backend owns truth, with no explicit rule reconciling the two — risking either an overbuilt early backend or a conceptual F-03 violation. |
| Resolution | Added principle 3a: until a persisted backend exists, the deterministic mock engine (ADR-001) is the stand-in operational authority behind the same contracts; frontend logic must still never locally forge completion, transfer, approval, or upgrade outcomes — it waits on the mock engine's events exactly as it will later wait on the backend's. |
| Authoritative file changed | `docs/00-foundry/principles.md` |
| Exact section changed | § "Operational truth" (new principle 3a, inserted after principle 3) |
| Evidence the ambiguity is closed | The reconciling rule the audit asked for now exists verbatim in the principles document, with the non-negotiable "frontend cannot forge outcomes" constraint preserved explicitly rather than left implicit. |
| Status | **Resolved** |

### M-06 — Approval placement relative to Warehouse upgrade metrics

| Field | Content |
| --- | --- |
| Original problem | "10 successful artifact packages processed" was undefined in terms of counting start point, and a single V1 demonstration build could not plausibly produce 10 packages on its own — risking permanent `locked` upgrade eligibility. An earlier draft resolution risked **over-counting**: it did not make explicit that the one package moving through three transfer legs is still one success, not three. |
| Resolution | Adopted the audit's "seeded historical metrics" option, corrected for the one-package-per-build rule: a single V1 build produces **exactly one** successful artifact package — moving it across its three transfer legs does not create additional successes. The Warehouse begins the demonstration with a deterministic seeded history of **9** previously successful packages (established at `system.started`); the current build's package counts exactly once, at `deployment_package.completed` (coinciding with `build.completed`), bringing the total to **9 + 1 = 10**. |
| Authoritative file changed | `docs/02-specification/domain-model.md` |
| Exact section changed | `Upgrade` → § "Counting rule (resolves audit finding M-06)", directly under "Warehouse Level 2 prerequisites" |
| Evidence the ambiguity is closed | The counting rule is now fully specified and arithmetically exact: seed count (9), single-count-per-build rule stated explicitly (transfers relocate, they do not create successes), the exact moment of the one count (`deployment_package.completed`), and the resulting total (10) — closing both the "unreachable in one run" risk and the over-counting risk. |
| Status | **Resolved (corrected)** |

---

## Validation summary

Performed against every amended document plus all documents they cross-reference (`v1-scope.md`, `v1-acceptance.md`, `domain-model.md`, `event-model.md`, `world-model.md`, `interface-model.md`, `principles.md`, `glossary.md`).

| Dimension | Result |
| --- | --- |
| **Terminology consistency** | `Revision`, `Vehicle`, `AgentRun` now each have one definition (domain model), one glossary entry, and consistent usage everywhere they're referenced (world model, event model). `requirement.passed` now matches the `passed` status exactly. No term is defined two different ways across documents. |
| **Lifecycle consistency** | Every new/changed entity's lifecycle states map to defined events using the same convention already established by existing entities (an `X.started` event corresponds to the entity's active/in-progress state, not necessarily a literally-named "started" status — e.g. `Revision`'s `revision.started` → `in_progress`, matching how `build.started` already maps to `running`). No entity has an allowed state or command left without a corresponding event after this pass, except where the original document already tolerated that (e.g., `queued` states generally, consistent with pre-existing convention). |
| **Event producers and consumers** | Every new event follows the existing envelope and lists Producer/Payload/Backend effect/Frontend effect (or the equivalent compact inline form used elsewhere in the same section). `agentrun.*` events are produced by the Runtime Adapter via the backend, consistent with ADR-006; `revision.*` and the five M-03 events are backend-produced, consistent with ADR-002. |
| **Acceptance-test support** | F-01 (demo controls), F-05 (Inspector-only validation), F-06 (approval/revision paths), F-11 (Warehouse upgrade), F-12 (Claude Code stage), F-10 (disconnect) now each have a concrete, named contract to test against where they previously did not (M-01, M-02, M-06, B-03, B-04). No acceptance requirement lost support as a result of these changes. |
| **Future Registry leakage** | None introduced. `AgentRun.costUsd` is added exactly as the Future Registry's own "V1 hooks" note anticipated (`docs/04-future/registry.md` line "Optional `costUsd` on AgentRun"), as an unused, undisplayed optional field — not an implementation of Treasury or any other Registry concept. No other Registry concept was referenced or implemented. |
| **Dependency-cycle check** | Traced the full precondition graph for all three transfer legs and all seven `BuildStage`s by hand: `integration.completed` → {CO→WH transfer; `qa_validation.ready`} → {WH→QA transfer (gated by `integration.completed` + `qa_validation.ready`) → `qa_validation.started`} → Inspector validates → `qa_validation.completed` → Approval requested/approved → `deployment_package.ready`/`started` (= QA→Dock `transfer.started`) → `transfer.completed` → `deployment_package.completed` → `build.completed`. No node's precondition depends, directly or transitively, on itself. This replaces the circular reading found and corrected in B-01. |
| **One-package-per-build check** | The corrected M-06 rule and the B-01 per-leg preconditions agree: exactly one artifact package exists per V1 build; its three transfer legs relocate it but do not multiply it; it is counted toward Warehouse upgrade eligibility exactly once, at `deployment_package.completed`. |
| **Lint hygiene** | `git diff --check` run after all edits reports zero trailing-whitespace errors across the full amendment set. |
| **No new BLOCKER or MAJOR introduced** | All edits are additive definitions, reorderings, or precondition corrections; the dependency-cycle and one-package-per-build checks above found no remaining contradiction, undefined term, or impossible lifecycle. This is a documentation-only pass and does not itself constitute the independent, fresh audit required by FBL-002 — that re-review still needs to happen before promotion. |

---

## Unresolved issues

None. All 4 BLOCKER and all 6 MAJOR findings are closed by resolution above. MINOR and OPTIONAL findings (m-01 through m-08, O-01 through O-04) from the original audit were **out of scope for FBL-001** per its instructions and remain open for a future pass — they do not block FBL-002.
