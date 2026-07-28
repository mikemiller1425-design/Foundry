# Event Model — Agent City V1

**Foundation:** 1.0-rc1  
**Authority:** Immutable event vocabulary  
**Package target:** `packages/event-types`

## Envelope

Every event includes: `id`, `type`, `occurredAt`, `actorType`, `actorId`, `entityType`, `entityId`, `correlationId`, optional `causationId`, `severity`, `schemaVersion`, `payload`.

**Idempotency (global):** Duplicate `id` values are ignored; reducers must not duplicate cargo, timeline rows, agents, or transfers.

**Audit (global):** Append-only retention; corrections are new events.

---

## System

### `system.started`
| | |
| --- | --- |
| Meaning | Backend initialized and can serve authoritative state |
| Producer | Backend |
| Trigger | Process start / ready |
| Payload | `serviceVersion`, `neighborhoodId` |
| Preconditions | None |
| Backend effect | Health becomes servable |
| Frontend effect | Connection healthy; feed records startup |
| Audit | Required |
| Idempotency | Safe to ignore duplicates |

### `system.health_changed`
| | |
| --- | --- |
| Meaning | System health transition |
| Producer | Backend |
| Trigger | Health evaluation |
| Payload | `previousHealth`, `newHealth`, `reasons[]` |
| Preconditions | System started |
| Backend effect | Persist health |
| Frontend effect | Lighthouse + header update |
| Audit | Required |
| Idempotency | Apply by id once |

---

## Operator

### `operator.objective_submitted`
| | |
| --- | --- |
| Meaning | Operator submitted the build objective |
| Producer | Backend (after accept) |
| Trigger | Objective command accepted |
| Payload | `objective`, `projectId?` |
| Preconditions | No conflicting active build policy violation |
| Backend effect | May create/activate Project |
| Frontend effect | Objective visible; site/project panels populate |
| Audit | Required |
| Idempotency | Same id ignored |

### `operator.command_submitted`
| | |
| --- | --- |
| Meaning | Bounded operator command requested |
| Producer | Frontend → Backend API |
| Trigger | Command bar / control |
| Payload | `commandType`, `params` |
| Preconditions | Session authorized |
| Backend effect | Validate |
| Frontend effect | Pending indicator |
| Audit | Required |
| Idempotency | By command request id |

### `operator.command_accepted`
| | |
| --- | --- |
| Meaning | Command validated and accepted |
| Producer | Backend |
| Trigger | Policy + state OK |
| Payload | `commandType`, `params`, `resultRef?` |
| Preconditions | Submitted command exists |
| Backend effect | Apply command side effects |
| Frontend effect | Controls update |
| Audit | Required |
| Idempotency | By id |

### `operator.command_rejected`
| | |
| --- | --- |
| Meaning | Command failed policy or state validation |
| Producer | Backend |
| Trigger | Validation failure |
| Payload | `commandType`, `reason`, `correctiveAction?` |
| Preconditions | Submitted command exists |
| Backend effect | No protected mutation |
| Frontend effect | Show rejection; keep prior state |
| Audit | Required |
| Idempotency | By id |

---

## Agent

### `agent.registered`
Persistent agent available. Producer: backend. Payload: `role`, `homeBuildingId`. Frontend: residence occupied/idle.

### `agent.assigned`
Payload: `taskId`, `stageId`, `destinationBuildingId`. Frontend: residence vacant/assigned; planned route.

### `agent.departed`
Payload: `sourceBuildingId`, `destinationBuildingId`. Frontend: travel may start. **Does not** complete arrival.

### `agent.arrived`
Payload: `destinationBuildingId`. Backend: `currentBuildingId` updates. Frontend: location reconciles.

### `agent.started_work`
Payload: `taskId`, `stageId`, `runtimeType`. Frontend: workplace active.

### `agent.paused` / `agent.resumed`
Payload: `reason?`. Frontend: resident/workplace controls update.

### `agent.failed`
Payload: `taskId`, `failureCode`, `message`, `evidenceIds`, `retryEligible`. Frontend: red state + evidence link. Failure remains inspectable.

### `agent.completed_work`
Payload: `taskId`, `outputArtifactIds`. Frontend: work animation stops; artifacts update. **Does not** alone complete stage.

For all agent events: Producer backend (or adapter via backend); Audit required; Idempotency by event id; Frontend never authorizes location alone.

---

## Build

### `build.created`
Payload: `projectId`, `buildId`, `objective`. Frontend: construction site activates.

### `build.planned`
Payload: `stageIds`, `requirementCount`, `planArtifactId`. Frontend: blueprint/progression visible.

### `build.started`
Backend: status running. Frontend: active status; no false progress without stage events.

### `build.paused`
Frontend: global pause; stop progress animations.

### `build.completed`
Payload: `finalArtifactIds`, `completedAt`. Frontend: site completed structure after reconcile.

### `build.failed`
Payload: `failureCode`, `evidenceIds`, `recoverable`. Frontend: Lighthouse degraded/critical by severity.

### `build.cancelled`
Frontend: motion stops; history retained.

Preconditions for start: plan exists. Completion requires mandatory stages + required approvals. Audit + idempotency for all.

---

## Stage

### `stage.created`
Stage enters plan.

### `stage.started`
Payload: `assignedAgentIds`, `sourceBuildingId`.

### `stage.blocked`
Payload: `requirementIds` / `approvalId`, `reason`. Frontend: blocker card; cargo unsealed if relevant.

### `stage.validation_started`
QA validating.

### `stage.validation_passed`
Payload: `evidenceIds`, `passedRequirementIds`. **Invariant:** cannot be produced from Builder self-certify.

### `stage.validation_failed`
Payload: `failedRequirementIds`, `evidenceIds`, `retryEligible`. Frontend: QA red; vehicle parked.

### `stage.completed`
Payload: `artifactIds`, `completedAt`. Backend: may permit transfer creation only if invariants pass. Completed stages cannot silently return to running.

### `stage.failed`
Terminal unless Revision path created via approval/revision flow.

---

## Requirement

### `requirement.started`
Checklist item running.

### `requirement.completed`
Payload: `evidenceIds`, `validatorType`. (Canonical name for pass.)

### `requirement.failed`
Payload: `evidenceIds`, `message`, `retryEligible`. Frontend: exact failed requirement visible; transfer blocked.

### `requirement.retried`
Links to prior failure via `causationId`. Payload: `priorEventId`.

Mandatory requirements cannot be waived in V1.

---

## Artifact

### `artifact.created`
Payload: `artifactId`, `artifactType`, `name`, `checksumStatus`.

### `artifact.validated`
Payload: `checksum`, `evidenceIds`.

### `artifact.ready`
All artifact gates passed. Seal visuals only with associated transfer readiness rules.

---

## Transfer

### `transfer.created`
May still be blocked.

### `transfer.ready`
**Preconditions:** stage completed, artifacts ready, approvals resolved if required, destination available.  
**Backend:** status ready; vehicle may assign.  
**Frontend:** cargo seals; vehicle loading-ready; route highlights.  
**Never** triggered by animation completion alone.

### `transfer.started`
Payload: `vehicleId`, `sourceBuildingId`, `destinationBuildingId`, `artifactIds`. Frontend: load/travel animation may begin.

### `transfer.arrived`
Operational/visual arrival; not complete until receipt.

### `transfer.completed`
Payload: `receiptArtifactId`. Frontend: unload; destination inventory updates.

### `transfer.failed`
Payload: `reason`, `artifactSafetyState`, `recoveryAction`.

---

## Approval

### `approval.requested`
Payload: `approvalId`, `title`, `reason`, `riskClass`, `evidenceIds`, `recommendedAction`. Frontend: Lighthouse attention; gate closes.

### `approval.approved`
Payload: `resolvedBy`, `resolutionNote`. Backend: gated transition may resume.

### `approval.rejected`
No transfer on rejected protected path.

### `approval.revision_requested`
Backend: revision path; return work to Builder.

All approval events: audit required with actor + timestamps.

---

## Building

### `building.selected`
| | |
| --- | --- |
| Meaning | Operator selected a building in UI |
| Producer | Frontend (recorded) / backend optional ack |
| Trigger | Pointer/keyboard selection |
| Payload | `buildingId` |
| Preconditions | Building exists |
| Backend effect | None on operational truth (selection is UI) |
| Frontend effect | Detail panel + navigator sync |
| Audit | Optional/info |
| Idempotency | UI-safe |

### `building.state_changed`
Payload: `buildingId`, `priorState`, `newState`, `reasonEventId`. Frontend visual update must link to reason event.

---

## Upgrade

### `upgrade.eligible`
Payload: `buildingId`, `upgradeId`, `requirementEvidence`. Badge only; no level change.

### `upgrade.requested`
Operator requested upgrade.

### `upgrade.approved`
Operator approved.

### `upgrade.started`
Restrained upgrading visual; capability remains old until completed.

### `upgrade.completed`
Payload: `fromLevel`, `toLevel`, `capabilitiesAdded`. Visual + capability change atomically from authority.

### `upgrade.failed`
Retain prior level; show evidence.

---

## Traceability requirement

Every V1 event that mutates visible operational state must have:

1. reducer/projection handler  
2. readable event-feed template  
3. visual mapping or explicit “no visual change”  
4. at least one automated test  
5. idempotent duplicate handling  
