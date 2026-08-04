# Domain Model — Agent City V1

**Foundation:** 1.0  
**Authority:** Backend language for entities, lifecycles, invariants, commands, and events  
**Note:** No SQL or database implementation in this document.

## Global conventions

- IDs are stable opaque strings.
- Timestamps: ISO 8601 UTC storage, local display.
- Status transitions validated server-side.
- Soft deletion preferred; event history never deleted via UI.
- Every mutation records actor, correlation ID, and resulting event.
- Duplicate event IDs are idempotently ignored and must not duplicate state changes.

## Required invariants

1. One agent cannot occupy two locations.
2. A mandatory requirement must pass before stage completion.
3. A stage must complete before transfer readiness — specifically, the stage that **produced** the artifact being moved, never the transfer's own destination or containing stage (this avoids a circular reading for a stage whose own work *is* a transfer, e.g. `deployment_package`; see `v1-scope.md` § "Transfer and approval scope").
4. Required approvals must resolve before protected progression.
5. Transfers cannot be initiated by frontend animation.
6. Duplicate events cannot create duplicate state changes.
7. Failures remain inspectable.
8. Completed stages cannot silently return to running.
9. Upgrades require evidence and satisfied prerequisites.
10. Frontend-only state cannot mutate backend operational truth.

---

## Agent

| Section | Content |
| --- | --- |
| Purpose | Persistent autonomous software worker identity |
| Required fields | `id`, `name`, `role`, `status`, `homeBuildingId`, `currentBuildingId`, `authorityLevel`, `runtimeType`, `createdAt`, `updatedAt`, `lastHeartbeatAt` |
| Optional fields | `currentTaskId`, `currentStageId`, `pausedReason`, `failureReason`, `performanceSummary`, `runtimeSessionId` |
| Relationships | One residence; ≤ one active task; one current building; emits AgentRun/Event records |
| Lifecycle | Registered → assignable → assigned/traveling/working/waiting/paused/failed → idle/offline |
| Allowed states | `idle`, `assigned`, `traveling`, `working`, `waiting`, `paused`, `failed`, `offline` |
| Invariants | One location; one active task max; Inspector cannot be Builder for same validation; authority ≤ policy |
| Commands | Assign, depart, arrive, startWork, pause, resume, fail, completeWork, returnHome |
| Emitted events | `agent.registered`, `agent.assigned`, `agent.departed`, `agent.arrived`, `agent.started_work`, `agent.paused`, `agent.resumed`, `agent.failed`, `agent.completed_work`, `agent.returned_home` |
| V1 limits | Roles: Architect, Builder, Inspector only |

## Building

| Section | Content |
| --- | --- |
| Purpose | Persistent representation of capability, residence, workplace, or institution |
| Required fields | `id`, `name`, `buildingType`, `level`, `status`, `position`, `capabilities`, `createdAt`, `updatedAt` |
| Optional fields | `upgradeId`, `inventorySummary` |
| Relationships | May host agents; source/destination of transfers; subject of upgrades |
| Lifecycle | Created at world init; status changes; level changes only via Upgrade |
| Allowed states | `idle`, `active`, `waiting`, `blocked`, `degraded`, `failed`, `disconnected`, `upgrading` |
| Invariants | `buildingType` immutable in V1; level only via completed Upgrade |
| Commands | ChangeState (system), Select (UI), StartUpgrade (gated) |
| Emitted events | `building.selected`, `building.state_changed`, upgrade events on capability buildings |
| V1 limits | Types: `lighthouse`, `home`, `construction_office`, `warehouse`, `qa`, `deployment_dock`, `construction_site` |

## Project

| Section | Content |
| --- | --- |
| Purpose | Long-lived container for objective, builds, artifacts, history |
| Required fields | `id`, `name`, `objective`, `status`, `createdAt`, `updatedAt` |
| Optional fields | `archivedAt` |
| Relationships | Has many Builds |
| Lifecycle | `draft` → `active` → `completed` / `archived` / `cancelled` |
| Allowed states | `draft`, `active`, `completed`, `archived`, `cancelled` |
| Invariants | One active Project in V1 |
| Commands | Create, Activate, Archive, Cancel |
| Emitted events | Indirect via build/objective operator events |
| V1 limits | One active project |

## Build

| Section | Content |
| --- | --- |
| Purpose | One bounded attempt to produce the project objective |
| Required fields | `id`, `projectId`, `sequenceNumber`, `status`, `objectiveSnapshot`, `currentStageId`, `createdAt`, `updatedAt` |
| Optional fields | `startedAt`, `completedAt`, `failedAt`, `cancelledAt`, `failureReason` |
| Relationships | Has BuildStages, Artifacts, Transfers, Approvals |
| Lifecycle | `planned` → `ready` → `running` → `validating` → `waiting_for_approval` → `completed`; also `paused`, `blocked`, `revision_required`, `failed`, `cancelled` |
| Allowed states | As lifecycle |
| Invariants | Completes only when mandatory stages complete and final approval resolved; one active Build |
| Commands | Create, Plan, Start, Pause, Resume, Cancel, Fail, Complete |
| Emitted events | `build.created`, `build.planned`, `build.ready`, `build.started`, `build.paused`, `build.resumed`, `build.completed`, `build.failed`, `build.cancelled` |
| V1 limits | One active build; demo objective fixed |
| V1.1 amendment (`AC-107`, 2026-08-03) | **The demo objective is no longer fixed.** A Build's `objectiveSnapshot` now carries an operator-submitted objective, bounded by `ObjectiveSubmissionSchema` in `packages/contracts` (12–500 printable single-line characters, one permitted workspace, risk class R0–R2). "One active build" is **unchanged** and enforced. `currentStageId` is `IdSchema.nullable()`: it remains a required field — always present — and `null` expresses a Build created before any stage exists, a state that always occurred and was previously unrepresentable. Amendment confirmed at `AC-107`; originally made at `AC-103P`. |

## BuildStage

| Section | Content |
| --- | --- |
| Purpose | Gated phase of a Build |
| Required fields | `id`, `buildId`, `name`, `sequence`, `status`, `required`, `sourceBuildingId`, `destinationBuildingId`, `createdAt`, `updatedAt` |
| Optional fields | `assignedAgentIds`, `startedAt`, `completedAt`, `failedAt`, `retryCount`, `approvalId` |
| Relationships | Has Requirements, Tasks, Artifacts; may gate Transfer/Approval |
| Lifecycle | `planned` → `ready` → `running` → `validating` → … → `completed` / `failed` / `cancelled`; blocked/revision paths allowed |
| Allowed states | `planned`, `ready`, `running`, `validating`, `waiting_for_approval`, `blocked`, `revision_required`, `completed`, `failed`, `cancelled` |
| Invariants | Sequence deps; mandatory requirements before completion; no transfer ready before completion; completed cannot silently return to running (requires a `Revision` record — see Revision below) |
| Commands | Create, Start, Block, Validate, Complete, Fail, Cancel, RequestRevision |
| Emitted events | `stage.created`, `stage.ready`, `stage.started`, `stage.blocked`, `stage.validation_started`, `stage.validation_passed`, `stage.validation_failed`, `stage.completed`, `stage.failed` |
| V1 limits | Exactly the seven named stages in `docs/01-mission/v1-scope.md` § "V1 Build Stages" (`planning`, `scaffold`, `frontend_implementation`, `backend_implementation`, `integration`, `qa_validation`, `deployment_package`), in that sequence |

## Revision

| Section | Content |
| --- | --- |
| Purpose | Records why and how a completed `BuildStage` was authorized to reopen for additional work (resolves audit finding B-03) |
| Required fields | `id`, `buildId`, `stageId`, `reason`, `requestedBy` (`approval` \| `operator` \| `inspector`), `status`, `createdAt`, `updatedAt` |
| Optional fields | `sourceApprovalId`, `resolvedAt`, `resultingStageStatus` |
| Relationships | Belongs to one `BuildStage`; may be caused by an `Approval` resolved as `revision_requested`, or by a `stage.validation_failed` whose retries are exhausted |
| Lifecycle | `requested` → `in_progress` → `completed` / `cancelled` |
| Allowed states | `requested`, `in_progress`, `completed`, `cancelled` |
| Invariants | A completed `BuildStage` may return to `running` only when an open `Revision` authorizes it; a `Revision` does not itself complete the rework — it authorizes the stage to reopen; at most one open `Revision` per stage at a time |
| Commands | Request, Start, Complete, Cancel |
| Emitted events | `revision.requested`, `revision.started`, `revision.completed` |
| V1 limits | At most one open Revision per stage; Revision does not create a new `BuildStage` — it reopens the existing one |

## Requirement

| Section | Content |
| --- | --- |
| Purpose | Machine-readable condition for stage completion |
| Required fields | `id`, `stageId`, `name`, `description`, `status`, `required`, `validatorType`, `evidenceIds`, `createdAt`, `updatedAt` |
| Optional fields | `retryCount`, `lastFailureMessage` |
| Relationships | Belongs to BuildStage; links Evidence artifacts |
| Lifecycle | `pending` → `running` → `passed` / `failed`; retry returns to running |
| Allowed states | `pending`, `running`, `passed`, `failed`, `waived` |
| Invariants | Required cannot be waived in V1; pass requires evidence; mandatory must pass before stage completion |
| Commands | Start, Pass, Fail, Retry |
| Emitted events | `requirement.started`, `requirement.passed`, `requirement.failed`, `requirement.retried` |
| V1 limits | One intentional required failure in the demo path |

## Task

| Section | Content |
| --- | --- |
| Purpose | Temporary work unit assigned to an Agent |
| Required fields | `id`, `stageId`, `title`, `status`, `assignedAgentId`, `riskClass`, `inputArtifactIds`, `outputArtifactIds`, `createdAt`, `updatedAt` |
| Optional fields | `pausedReason`, `failureReason` |
| Relationships | One Agent; belongs to BuildStage; produces Artifacts |
| Lifecycle | `queued` → `assigned` → `running` → `completed` / `failed` / `cancelled`; waiting/paused allowed |
| Allowed states | `queued`, `assigned`, `running`, `waiting`, `paused`, `completed`, `failed`, `cancelled` |
| Invariants | One assigned Agent; task completion ≠ stage completion |
| Commands | Queue, Assign, Start, Pause, Resume, Complete, Fail, Cancel |
| Emitted events | Via `agent.*` and stage/requirement events |
| V1 limits | Risk class R0–R2 |

## AgentRun

| Section | Content |
| --- | --- |
| Purpose | Execution record for one Agent Task run through a Runtime Adapter, mock or `claude_code` (resolves audit finding B-04) |
| Required fields | `id`, `agentId`, `taskId`, `runtimeType` (`mock` \| `claude_code`), `status`, `riskClass`, `startedAt` |
| Optional fields | `completedAt`, `exitCode`, `logRef`, `outputArtifactIds`, `evidenceIds`, `failureCode`, `failureMessage`, `costUsd` (forward-compatible optional hook for a later mission; unused and not displayed in V1) |
| Relationships | Belongs to one Agent and one Task; produced by a Runtime Adapter invocation; `outputArtifactIds` (matching the `agentrun.completed` event payload) become Artifacts, also linked via the owning Task |
| Lifecycle | `queued` → `running` → `completed` / `failed` / `timed_out` |
| Allowed states | `queued`, `running`, `completed`, `failed`, `timed_out` |
| Invariants | `riskClass` must be R0–R2 in V1; a `timed_out` run terminates safely and retains its logs/evidence; exactly one `AgentRun` in V1 uses `runtimeType: claude_code` (the `backend_implementation` stage, per `v1-scope.md`) |
| Commands | Start, Complete, Fail, Timeout |
| Emitted events | `agentrun.started`, `agentrun.completed`, `agentrun.failed`, `agentrun.timed_out` |
| V1 limits | Runtimes: `mock` \| `claude_code` only; at most one `claude_code` AgentRun in V1 |

## Artifact

| Section | Content |
| --- | --- |
| Purpose | Inspectable retained output or evidence |
| Required fields | `id`, `buildId`, `stageId`, `artifactType`, `name`, `status`, `storageUri`, `checksum`, `createdByAgentId`, `createdAt`, `updatedAt` |
| Optional fields | `parentArtifactId`, `version` |
| Relationships | Produced by agents/stages; moved by Transfer |
| Lifecycle | `draft` → `created` → `validating` → `validated` / `rejected` → `ready` → `in_transfer` → `received` / `archived` |
| Allowed states | As lifecycle |
| Invariants | Checksum before transfer readiness; history immutable; revisions create new versions |
| Commands | Create, Validate, Reject, MarkReady, Archive |
| Emitted events | `artifact.created`, `artifact.validated`, `artifact.ready` |
| V1 limits | Types: requirements, plan, source_code, test_report, build_package, log_bundle, approval_evidence, deployment_package |

## Transfer

| Section | Content |
| --- | --- |
| Purpose | Controlled movement of artifacts between buildings |
| Required fields | `id`, `buildId`, `stageId`, `status`, `sourceBuildingId`, `destinationBuildingId`, `artifactIds`, `vehicleId`, `createdAt`, `updatedAt` |
| Optional fields | `blockerIds`, `failureReason`, `receiptArtifactId` |
| Relationships | Uses Vehicle; moves Artifacts |
| Lifecycle | `created` → `blocked` / `ready` → `loading` → `in_transit` → `unloading` → `completed` / `failed` / `cancelled` |
| Allowed states | As lifecycle |
| Invariants | Source ≠ destination; frontend animation cannot mutate status; one active transfer at a time; three explicit, non-circular legs (resolves audit finding B-01 — full detail in `v1-scope.md` § "Transfer and approval scope"): **Construction Office → Warehouse** ready when `integration` is `completed` + artifact ready; **Warehouse → QA** ready when `integration` is `completed` + artifact ready + `qa_validation` is `ready` (not completed), and its `transfer.completed` is the precondition that permits `qa_validation`'s `stage.started` (Inspector validation begins only after arrival); **QA → Deployment Dock** ready when `qa_validation` is `completed` + artifact ready + the build's Approval resolved `approved` — the only approval-gated leg. No leg's readiness ever depends on its own destination or containing stage's completion |
| Commands | Create, MarkReady, Start, Arrive, Complete, Fail, Cancel |
| Emitted events | `transfer.created`, `transfer.blocked`, `transfer.ready`, `transfer.started`, `transfer.arrived`, `transfer.completed`, `transfer.failed` |
| V1 limits | One active transfer; one vehicle |

## Vehicle

| Section | Content |
| --- | --- |
| Purpose | Persistent physical resource that visualizes a Transfer; never authorizes one (resolves audit finding B-04) |
| Required fields | `id`, `name`, `vehicleType` (fixed: `utility`), `status`, `homeBuildingId`, `position`, `createdAt`, `updatedAt` |
| Optional fields | `currentTransferId`, `lastArrivedBuildingId` |
| Relationships | Assigned to at most one Transfer at a time |
| Lifecycle | `parked` → `waiting` → `loading` → `in_transit` → `unloading` → `completed` (returns to `parked`) / `failed` |
| Allowed states | `parked`, `waiting`, `loading`, `in_transit`, `unloading`, `completed`, `failed` (mirrors `world-model.md` "Utility vehicle") |
| Invariants | Assigned to at most one active Transfer; state changes only in response to `transfer.*` events, never frontend animation completion |
| Commands | Assign, StartLoading, Depart, Arrive, Unload, Complete, Fail |
| Emitted events | None independently — visual/domain state derives entirely from the `transfer.*` events of its assigned Transfer |
| V1 limits | Exactly one Vehicle instance |

## Approval

| Section | Content |
| --- | --- |
| Purpose | Human decision gate |
| Required fields | `id`, `buildId`, `stageId`, `status`, `riskClass`, `title`, `reason`, `recommendedAction`, `evidenceIds`, `requestedAt` |
| Optional fields | `resolvedAt`, `resolvedBy`, `resolutionNote` |
| Relationships | Gates Build/Stage progression; linked from Lighthouse UI |
| Lifecycle | `pending` → `approved` / `rejected` / `revision_requested` / `cancelled` (`expired` reserved) |
| Allowed states | As lifecycle |
| Invariants | Pending pauses protected progression; resolution requires actor + timestamp |
| Commands | Request, Approve, Reject, RequestRevision, Cancel |
| Emitted events | `approval.requested`, `approval.approved`, `approval.rejected`, `approval.revision_requested` |
| V1 limits | No permanent policy creation from approval card |

## Event

| Section | Content |
| --- | --- |
| Purpose | Immutable fact for meaningful transitions/command results |
| Required fields | `id`, `type`, `occurredAt`, `actorType`, `actorId`, `entityType`, `entityId`, `correlationId`, `severity`, `payload`, `schemaVersion` |
| Optional fields | `causationId` |
| Relationships | Append-only log; drives WorldState projection |
| Lifecycle | Appended once; never mutated |
| Allowed severities | `info`, `notice`, `warning`, `error`, `critical` |
| Invariants | Append-only; duplicate IDs ignored idempotently |
| Commands | Append (system) |
| Emitted events | N/A (is the event) |
| V1 limits | Vocabulary in `event-model.md` |

## Upgrade

| Section | Content |
| --- | --- |
| Purpose | Capability-based building progression |
| Required fields | `id`, `buildingId`, `fromLevel`, `toLevel`, `status`, `requirementIds`, `createdAt` |
| Optional fields | `approvalId`, `startedAt`, `completedAt`, `failureReason` |
| Relationships | Targets Building; may require Approval |
| Lifecycle | `locked` → `eligible` → `awaiting_approval` → `upgrading` → `completed` / `failed` |
| Allowed states | As lifecycle |
| Invariants | Evidence + prerequisites; visual level changes only after completion; failed upgrade retains prior capability |
| Commands | EvaluateEligibility, Request, Approve, Start, Complete, Fail |
| Emitted events | `upgrade.eligible`, `upgrade.requested`, `upgrade.approved`, `upgrade.started`, `upgrade.completed`, `upgrade.failed` |
| V1 limits | Warehouse 1→2 only; capacity 25→100; batch intake in mock engine |

### Warehouse Level 2 prerequisites

- 10 successful artifact packages processed
- No unresolved critical event
- ≥ 90% validation pass rate after retries
- Event persistence verified
- Operator approval

### Counting rule (resolves audit finding M-06)

A single V1 demonstration build produces **exactly one** successful artifact package — the one deployment package moved by the `integration` → `qa_validation` → `deployment_package` transfer chain. Moving that same package across its three transfer legs (Construction Office → Warehouse, Warehouse → QA, QA → Deployment Dock) does not create additional successful packages; a package is counted once, at the moment it is fully processed, regardless of how many transfer legs carried it.

The Warehouse begins the V1 demonstration with a deterministic **seeded history of 9** previously successful artifact packages, established at `system.started` / world initialization — representing packages the neighborhood processed before the operator's session begins. The current build's own package counts exactly once, at `deployment_package.completed` (which coincides with `build.completed`), bringing the running total to **9 + 1 = 10** by the time the build completes normally. "No unresolved critical event" and "≥ 90% validation pass rate after retries" are evaluated over this same seeded-plus-current-build history. This makes Level 2 eligibility reachable within a single demonstration run without multiple demo cycles or a mid-demo reset, and without over-counting a single package as multiple successes.

## WorldState

| Section | Content |
| --- | --- |
| Purpose | Read-optimized projection for the frontend |
| Required fields | Snapshot of buildings, agents, current build, active transfers, approvals, inventory counts, health summary, `lastProcessedEventId` |
| Optional fields | Demo control flags, connection status |
| Relationships | Derived from authoritative entities and events |
| Lifecycle | Rebuilt/reconciled from events; not independently mutable |
| Allowed states | Connected/healthy projections vs stale/disconnected labels |
| Invariants | Not a source of operational truth; frontend cannot write WorldState as authority |
| Commands | ReconcileFromSnapshot, ApplyEvent (idempotent) |
| Emitted events | None directly |
| V1 limits | Single-neighborhood projection |

---

## V1.1 amendment — per-command parameter schemas (`AC-107`, 2026-08-03)

**Amendment, recorded at the rung that owns it. Foundation 1.0 meaning is otherwise unchanged.**

This document names each entity's commands but has never specified their parameter fields. `packages/contracts/src/commands.ts` therefore validated the command *envelope* only — a known `commandType`, an optional `entityId`, a `params` object — and recorded that per-command validation belonged to the rung where "there is real enforcement logic to consume those parameters".

V1.1 reaches that point. `COMMAND_PARAM_SCHEMAS` declares parameter shapes for **three commands specifically**:

| Command | Parameters | Produces |
| --- | --- | --- |
| `Project.Create` | `objective` (bounded envelope), `projectId` | `operator.objective_submitted` |
| `Build.Create` | `projectId`, `buildId`, `objective` | `build.created` |
| `Build.Plan` | `planId`, `planArtifactId`, `stageIds` (exactly seven), `requirementCount` | `build.planned` |

Every **other** command keeps envelope-only validation. This document still does not specify their fields, and inventing them would be undocumented policy rather than contract-first implementation.

**Scope of this amendment:**

- The **closed command vocabulary is unchanged.** No command type was added, removed, or renamed. `Build.Plan` was already declared, so plan production needs no new command.
- **Execution authorization has no command type.** Its contract (`ExecutionAuthorizationSchema`) is declared in `packages/contracts`, but introducing a command to carry it is an amendment owned by the rung that builds the gate (`AC-110`), not this one.
- The schemas are **declared, not yet enforced at the transport**. `CommandRequestSchema` is unchanged: moving them into it would convert handler-level refusals (HTTP 200 with a stated reason) into transport-level rejections (HTTP 400), which is a behaviour change. `AC-107` is contract-only. `parseCommandParams` is the seam the consuming rung wires in.


---

## V1.1 amendment — `Plan.Review` command and the `Plan` record (`AC-108`, 2026-08-03)

**Amendment, recorded at the rung that owns it. Foundation 1.0 meaning is otherwise unchanged; no existing command was altered, renamed, or removed.**

### `Plan.Review` added to the command vocabulary

`AC-107` declared the plan and authorization *shapes* and noted that introducing commands to carry them belongs to the rung that builds each. `AC-108` builds plan review, so it adds the one command that act needs.

| Command | Parameters | Produces | Authorization |
| --- | --- | --- | --- |
| `Plan.Review` | `planId`, `buildId`, `reviewedRevision`, `decision` (`proceed` \| `rejected` \| `revision_requested`), optional `note` | `operator.plan_reviewed` | Authenticated **operator** only (principle 14) |

`reviewedBy` is deliberately **not** a parameter: it is written from the authenticated principal server-side, exactly as `resolvedBy` is for approvals. A caller may not assert who decided.

**Execution authorization still has no command.** That remains owned by `AC-110`.

### `Plan` as a persisted record

V1.1 persists a plan as a first-class record keyed by `planId`, rather than as a separate `Artifact` row. `build.planned`'s declared `planArtifactId` field equals the `planId`.

| Section | Content |
| --- | --- |
| Purpose | One structured, reviewable proposal for how a Build would be carried out |
| Required fields | `plan` (a schema-valid `BuildPlan`), `revision`, `review` (nullable), `createdAt` |
| Relationships | Belongs to exactly one Build |
| Invariants | **One plan per Build in V1.1.** A recorded review is immutable — a repeat of the same decision is an idempotent no-op, a conflicting one is refused. A review may only be recorded against the revision the operator read |
| Commands | `Build.Plan` (create), `Plan.Review` (record a decision) |
| Emitted events | `build.planned`, `operator.plan_reviewed` |
| V1.1 limits | Seven fixed stages; Foundry-managed workspace; R0–R2; `claude_code` only on `backend_implementation`, at most once. **A plan schedules nothing** — no `BuildStage`, `Task`, `AgentRun`, `Artifact`, or `Approval` is created by planning or by reviewing |
