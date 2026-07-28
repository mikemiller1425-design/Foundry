# Specification 002 — V1 Entity Model

**Purpose:** Define the backend language, required fields, relationships, lifecycle, invariants, commands, and events for V1.

## Global conventions

- IDs are stable opaque strings.
- Timestamps use ISO 8601 UTC storage and local display.
- Status transitions are validated server-side.
- Soft deletion is preferred for V1 records; event history is never deleted through the UI.
- Every mutation records actor, correlation ID, and resulting event.

## Entity: Agent

### Purpose
Persistent autonomous worker identity.

### Required fields
`id`, `name`, `role`, `status`, `homeBuildingId`, `currentBuildingId`, `authorityLevel`, `runtimeType`, `createdAt`, `updatedAt`, `lastHeartbeatAt`.

### Optional fields
`currentTaskId`, `currentStageId`, `pausedReason`, `failureReason`, `performanceSummary`, `runtimeSessionId`.

### Relationships
Lives at one Home. May be assigned to one active Task in V1. May occupy one current Building. Generates AgentRun and Event records.

### Status values
`idle`, `assigned`, `traveling`, `working`, `waiting`, `paused`, `failed`, `offline`.

### Invariants

- One active location only.
- One active task maximum in V1.
- Inspector cannot be the Builder for the same validation decision.
- Authority level cannot exceed mission policy.

### Commands
Assign, depart, arrive, startWork, pause, resume, fail, completeWork, returnHome.

### Events
`agent.assigned`, `agent.departed`, `agent.arrived`, `agent.work_started`, `agent.paused`, `agent.resumed`, `agent.failed`, `agent.work_completed`, `agent.returned_home`.

## Entity: Building

### Purpose
Persistent world representation of a capability or governance function.

### Required fields
`id`, `name`, `buildingType`, `level`, `status`, `position`, `capabilities`, `createdAt`, `updatedAt`.

### Building types
`lighthouse`, `home`, `construction_office`, `warehouse`, `qa`, `deployment_dock`, `construction_site`.

### Status values
`idle`, `active`, `waiting`, `blocked`, `degraded`, `failed`, `disconnected`, `upgrading`.

### Invariants
Building type is immutable in V1. Level changes only through Upgrade completion.

## Entity: Project

### Purpose
Long-lived container for objective, builds, artifacts, and history.

### Fields
`id`, `name`, `objective`, `status`, `createdAt`, `updatedAt`.

### Status values
`draft`, `active`, `completed`, `archived`, `cancelled`.

### V1 limit
One active Project at a time.

## Entity: Build

### Purpose
One bounded attempt to produce the Project objective.

### Required fields
`id`, `projectId`, `sequenceNumber`, `status`, `objectiveSnapshot`, `currentStageId`, `createdAt`, `updatedAt`.

### Optional fields
`startedAt`, `completedAt`, `failedAt`, `cancelledAt`, `failureReason`.

### Lifecycle
`planned → ready → running → validating → waiting_for_approval → completed`.

Alternative terminal/intermediate states: `paused`, `blocked`, `revision_required`, `failed`, `cancelled`.

### Invariants
A Build completes only when all mandatory stages complete and final approval is resolved. One active Build in V1.

## Entity: Stage

### Purpose
Gated phase of a Build.

### Required fields
`id`, `buildId`, `name`, `sequence`, `status`, `required`, `sourceBuildingId`, `destinationBuildingId`, `createdAt`, `updatedAt`.

### Optional fields
`assignedAgentIds`, `startedAt`, `completedAt`, `failedAt`, `retryCount`, `approvalId`.

### Status values
`planned`, `ready`, `running`, `validating`, `waiting_for_approval`, `blocked`, `revision_required`, `completed`, `failed`, `cancelled`.

### Invariants

- Sequence dependencies must pass.
- Mandatory requirements must pass before completion.
- A transfer cannot become ready before completion.
- A completed Stage cannot reopen without a Revision record.

## Entity: Requirement

### Purpose
Machine-readable condition required for Stage completion.

### Fields
`id`, `stageId`, `name`, `description`, `status`, `required`, `validatorType`, `evidenceIds`, `createdAt`, `updatedAt`.

### Status values
`pending`, `running`, `passed`, `failed`, `waived`.

### Invariants
Required requirements cannot be waived in V1. A pass requires evidence.

## Entity: Task

### Purpose
Temporary unit of work assigned to an Agent.

### Fields
`id`, `stageId`, `title`, `status`, `assignedAgentId`, `riskClass`, `inputArtifactIds`, `outputArtifactIds`, `createdAt`, `updatedAt`.

### Status values
`queued`, `assigned`, `running`, `waiting`, `paused`, `completed`, `failed`, `cancelled`.

### Invariants
One assigned Agent. Completion does not automatically complete its Stage.

## Entity: Artifact

### Purpose
Retained output or evidence.

### Fields
`id`, `buildId`, `stageId`, `artifactType`, `name`, `status`, `storageUri`, `checksum`, `createdByAgentId`, `createdAt`, `updatedAt`.

### Artifact types
`requirements`, `plan`, `source_code`, `test_report`, `build_package`, `log_bundle`, `approval_evidence`, `deployment_package`.

### Status values
`draft`, `created`, `validating`, `validated`, `rejected`, `ready`, `in_transfer`, `received`, `archived`.

### Invariants
Checksum required before transfer readiness. Artifact history is immutable; revisions create new versions.

## Entity: Transfer

### Purpose
Controlled movement of artifacts between Buildings.

### Fields
`id`, `buildId`, `stageId`, `status`, `sourceBuildingId`, `destinationBuildingId`, `artifactIds`, `vehicleId`, `createdAt`, `updatedAt`.

### Status values
`created`, `blocked`, `ready`, `loading`, `in_transit`, `unloading`, `completed`, `failed`, `cancelled`.

### Invariants

- Source and destination differ.
- All artifacts must be ready.
- Required approvals must be resolved.
- Only one active transfer in V1.
- Frontend animation cannot mutate status.

## Entity: Approval

### Purpose
Human decision gate.

### Fields
`id`, `buildId`, `stageId`, `status`, `riskClass`, `title`, `reason`, `recommendedAction`, `evidenceIds`, `requestedAt`, `resolvedAt`, `resolvedBy`, `resolutionNote`.

### Status values
`pending`, `approved`, `rejected`, `revision_requested`, `expired`, `cancelled`.

### Invariants
Pending approval pauses the gated transition. Resolution requires actor and timestamp.

## Entity: Event

### Purpose
Immutable fact representing a meaningful state transition or command result.

### Fields
`id`, `type`, `occurredAt`, `actorType`, `actorId`, `entityType`, `entityId`, `correlationId`, `causationId`, `severity`, `payload`, `schemaVersion`.

### Severity
`info`, `notice`, `warning`, `error`, `critical`.

### Invariants
Events are append-only. Duplicate event IDs are idempotently ignored.

## Entity: AgentRun

### Purpose
One bounded runtime execution by an Agent.

### Fields
`id`, `agentId`, `taskId`, `runtimeType`, `status`, `startedAt`, `endedAt`, `exitCode`, `logArtifactId`, `costUsd`, `tokenUsage`.

### V1 runtime types
`mock`, `claude_code`.

### Invariants
Claude Code runs only in a configured controlled repository and permission profile.

## Entity: Vehicle

### Purpose
World resource assigned to a Transfer.

### Fields
`id`, `name`, `status`, `currentBuildingId`, `activeTransferId`, `updatedAt`.

### Status values
`parked`, `waiting`, `loading`, `in_transit`, `unloading`, `failed`.

### Invariants
One active Transfer maximum.

## Entity: Upgrade

### Purpose
Capability-based Building progression.

### Fields
`id`, `buildingId`, `fromLevel`, `toLevel`, `status`, `requirementIds`, `approvalId`, `startedAt`, `completedAt`.

### Status values
`locked`, `eligible`, `awaiting_approval`, `upgrading`, `completed`, `failed`.

### Warehouse Level 2 requirements

- 10 successful artifact packages processed;
- no unresolved critical event;
- at least 90% validation pass rate after retries;
- event persistence verified;
- operator approval.

### Warehouse Level 2 capability change

- capacity increases from 25 to 100;
- batch intake becomes available in the mock engine;
- visual model changes to Level 2.

## Entity: Revision

### Purpose
Record a controlled reopening or replacement after failed validation or operator revision request.

### Fields
`id`, `stageId`, `reason`, `requestedBy`, `createdAt`, `supersedesArtifactIds`, `newTaskIds`.

## Entity: WorldStateProjection

### Purpose
Read-optimized snapshot used by the frontend.

### Contains
Buildings, agents, current build, active transfers, approvals, inventory counts, health summary, and last processed event ID.

### Rule
It is derived from authoritative entities and events. It is not independently mutable.
