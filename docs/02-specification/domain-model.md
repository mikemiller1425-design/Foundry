# Domain Model — Agent City V1

**Foundation:** 1.0-rc1  
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
3. A stage must complete before transfer readiness.
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
| Emitted events | `agent.registered`, `agent.assigned`, `agent.departed`, `agent.arrived`, `agent.started_work`, `agent.paused`, `agent.resumed`, `agent.failed`, `agent.completed_work` |
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
| Emitted events | `build.created`, `build.planned`, `build.started`, `build.paused`, `build.completed`, `build.failed`, `build.cancelled` |
| V1 limits | One active build; demo objective fixed |

## BuildStage

| Section | Content |
| --- | --- |
| Purpose | Gated phase of a Build |
| Required fields | `id`, `buildId`, `name`, `sequence`, `status`, `required`, `sourceBuildingId`, `destinationBuildingId`, `createdAt`, `updatedAt` |
| Optional fields | `assignedAgentIds`, `startedAt`, `completedAt`, `failedAt`, `retryCount`, `approvalId` |
| Relationships | Has Requirements, Tasks, Artifacts; may gate Transfer/Approval |
| Lifecycle | `planned` → `ready` → `running` → `validating` → … → `completed` / `failed` / `cancelled`; blocked/revision paths allowed |
| Allowed states | `planned`, `ready`, `running`, `validating`, `waiting_for_approval`, `blocked`, `revision_required`, `completed`, `failed`, `cancelled` |
| Invariants | Sequence deps; mandatory requirements before completion; no transfer ready before completion; completed cannot silently return to running (requires Revision) |
| Commands | Create, Start, Block, Validate, Complete, Fail, Cancel, RequestRevision |
| Emitted events | `stage.created`, `stage.started`, `stage.blocked`, `stage.validation_started`, `stage.validation_passed`, `stage.validation_failed`, `stage.completed`, `stage.failed` |
| V1 limits | Workflow stages listed in mission scope |

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
| Emitted events | `requirement.started`, `requirement.completed`, `requirement.failed`, `requirement.retried` |
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
| Invariants | Source ≠ destination; artifacts ready; approvals resolved if required; one active transfer; frontend animation cannot mutate status |
| Commands | Create, MarkReady, Start, Arrive, Complete, Fail, Cancel |
| Emitted events | `transfer.created`, `transfer.ready`, `transfer.started`, `transfer.arrived`, `transfer.completed`, `transfer.failed` |
| V1 limits | One active transfer; one vehicle |

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
