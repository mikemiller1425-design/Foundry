# Specification 003 — V1 Event Dictionary

**Purpose:** Define the immutable event vocabulary connecting backend truth to frontend representation.

## Event envelope

Every event includes:

- `id`
- `type`
- `occurredAt`
- `actorType`
- `actorId`
- `entityType`
- `entityId`
- `correlationId`
- optional `causationId`
- `severity`
- `schemaVersion`
- `payload`

Duplicate IDs must be idempotently ignored.

## System events

### `system.started`
Backend initialized and can serve authoritative state.

Frontend: connection indicator becomes healthy; event feed records startup.

### `system.health_changed`
Payload: previous health, new health, reasons.

Frontend: Lighthouse and header status update.

### `system.connection_lost`
Frontend cannot confirm live backend state.

Frontend: Lighthouse dark, controls requiring mutation disabled, stale-state banner shown.

### `system.connection_restored`
Frontend reconciles from snapshot and resumes event stream.

## Operator events

### `operator.command_submitted`
A bounded operator command was requested.

### `operator.command_accepted`
Backend validated and accepted command.

### `operator.command_rejected`
Command failed policy or state validation. Payload includes reason and corrective action.

## Agent events

### `agent.registered`
Persistent Agent becomes available.

### `agent.assigned`
Payload: taskId, stageId, destinationBuildingId.

Frontend: residence shows vacant/assigned; planned route appears.

### `agent.departed`
Payload: sourceBuildingId, destinationBuildingId.

Frontend: travel animation may start.

### `agent.arrived`
Payload: destinationBuildingId.

Frontend: agent location reconciles; workplace occupancy updates.

### `agent.work_started`
Payload: taskId, stageId, runtimeType.

Frontend: workplace active; detail panel displays active run.

### `agent.paused` / `agent.resumed`
Frontend updates resident/workplace state and controls.

### `agent.failed`
Payload: taskId, failureCode, message, evidenceIds, retryEligible.

Frontend: red state, event feed entry, evidence link.

### `agent.work_completed`
Payload: taskId, outputArtifactIds.

Frontend: work animation stops; artifact package updates.

### `agent.returned_home`
Frontend places resident at home only after event.

## Build events

### `build.created`
Payload: projectId, buildId, objective.

Frontend: Construction Site appears/activates; build panel populates.

### `build.planned`
Payload: stageIds, requirementCount, planArtifactId.

Frontend: blueprint/progression becomes visible.

### `build.started`
Frontend: build clock starts and overall status becomes active.

### `build.paused` / `build.resumed`
Frontend: global pause state shown; no false progress animations.

### `build.blocked`
Payload: blockerType, blockerIds, summary.

Frontend: prominent blocker card and route/cargo waiting state.

### `build.revision_required`
Payload: stageId, reason, evidenceIds.

Frontend: return path to Construction Office highlighted.

### `build.completed`
Payload: finalArtifactIds, completedAt.

Frontend: Construction Site becomes completed structure after reconciliation.

### `build.failed`
Payload: failureCode, evidenceIds, recoverable.

Frontend: Lighthouse degraded/critical based on severity.

### `build.cancelled`
Frontend: active motion stops and cancellation remains in history.

## Stage events

### `stage.created`
Stage becomes part of the build plan.

### `stage.ready`
All dependencies are satisfied and assignment may occur.

### `stage.started`
Payload: assignedAgentIds, sourceBuildingId.

### `stage.blocked`
Payload: requirementIds or approvalId and readable reason.

### `stage.validation_started`
QA Building enters validating state.

### `stage.validation_passed`
Payload: evidenceIds, passedRequirementIds.

### `stage.validation_failed`
Payload: failedRequirementIds, evidenceIds, retryEligible.

Frontend: QA red; cargo remains unsealed; vehicle remains parked.

### `stage.approval_requested`
Payload: approvalId.

Frontend: Lighthouse yellow; approval gate closes.

### `stage.completed`
Payload: artifactIds, completedAt.

Backend effects: permits transfer creation only after all invariants pass.

### `stage.failed` / `stage.cancelled`
Terminal state unless a Revision is created.

## Requirement events

### `requirement.started`
Checklist item moves to running.

### `requirement.passed`
Payload: evidenceIds, validatorType.

Frontend: item marked passed; construction material may appear.

### `requirement.failed`
Payload: evidenceIds, message, retryEligible.

Frontend: exact missing/failed requirement visible.

### `requirement.retry_started`
Links retry to prior failed event through causation ID.

### `requirement.waived`
Reserved, not permitted for required V1 requirements.

## Artifact events

### `artifact.created`
Payload: artifactId, artifactType, name, checksumStatus.

Frontend: new unsealed package or warehouse item appears.

### `artifact.validation_started`
Artifact enters validating state.

### `artifact.validated`
Payload: checksum, evidenceIds.

### `artifact.rejected`
Payload: reason, evidenceIds.

### `artifact.ready`
All artifact-specific gates passed.

Frontend: package may visually seal only when associated transfer also becomes ready.

### `artifact.received`
Destination has durably recorded receipt.

### `artifact.archived`
Completed historical state.

## Transfer events

### `transfer.created`
Transfer record exists but may still be blocked.

### `transfer.blocked`
Payload: blockerIds, reason.

Frontend: vehicle waiting; route disabled.

### `transfer.ready`

#### Preconditions
Stage completed, artifacts ready, approval resolved if required, destination available.

#### Backend effects
Status becomes ready and vehicle may be assigned.

#### Frontend effects
Cargo seals, vehicle changes to loading-ready, route highlights.

### `transfer.started`
Payload: vehicleId, sourceBuildingId, destinationBuildingId, artifactIds.

Frontend: loading and travel animation begins.

### `transfer.arrived`
Vehicle reached destination visually/operationally, but transfer is not complete until receipt.

### `transfer.completed`
Payload: receiptArtifactId.

Frontend: unloading completes and destination inventory updates.

### `transfer.failed`
Payload: failure reason, artifact safety state, recovery action.

## Approval events

### `approval.requested`
Payload: approvalId, title, reason, riskClass, evidenceIds, recommendedAction.

Frontend: Lighthouse attention state and approval card.

### `approval.approved`
Payload: resolvedBy, resolutionNote.

Backend: gated transition may resume.

### `approval.rejected`
Backend: workflow follows rejection policy; no transfer.

### `approval.revision_requested`
Backend: creates Revision and returns work to Builder.

### `approval.expired`
Reserved for later timing policy; may be simulated but not required.

## Building events

### `building.state_changed`
Payload: buildingId, priorState, newState, reasonEventId.

Frontend: visual state updates. Reason must link to a real event.

### `building.upgrade_eligible`
Payload: buildingId, upgradeId, requirementEvidence.

Frontend: upgrade badge appears but no visual level change.

### `building.upgrade_started`
Frontend: restrained construction state; operational capability remains old level until completion.

### `building.upgraded`
Payload: fromLevel, toLevel, capabilitiesAdded.

Frontend: model swaps and capability panel updates atomically from authoritative state.

### `building.upgrade_failed`
Frontend: old level retained and evidence shown.

## Demo-control events

### `demo.started`
Deterministic scripted scenario begins.

### `demo.paused` / `demo.resumed`
Affects mock scheduler only; recorded for replay.

### `demo.reset`
Creates a new demo run; prior run remains historical.

### `demo.speed_changed`
UI-only timing configuration; must not change ordering or outcome.

## Required event-to-visual traceability

Every V1 event used to mutate visible operational state must have:

1. a reducer or projection handler;
2. a readable event-feed template;
3. a visual mapping or explicit “no visual change” declaration;
4. at least one automated test;
5. idempotency behavior.
