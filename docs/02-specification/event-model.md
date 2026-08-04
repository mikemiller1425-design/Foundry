# Event Model — Agent City V1

**Foundation:** 1.0  
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

**`newHealth` vocabulary (resolves audit finding M-02):** `healthy` \| `degraded` \| `critical` \| `disconnected`. (Lighthouse's additional `active` / `attention_required` states derive from build and approval events, not from `system.health_changed`.)

**`reasons[]` vocabulary (resolves audit finding M-02):** `nominal`, `connection_lost`, `connection_restored`, `agent_unreachable`, `runtime_unavailable`. Connection loss and restoration are modeled as `reasons[]` entries on `system.health_changed` (`newHealth: disconnected` with reason `connection_lost`; the following `system.health_changed` back to a servable health with reason `connection_restored`) rather than as separate event types — this is the complete, exhaustive contract for F-10 disconnect/reconnect behavior.

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

### Demo control commands (resolves audit finding M-01)

`operator.command_submitted` / `_accepted` / `_rejected` carry one of exactly these `commandType` values when the command targets demo control. No other demo `commandType` is valid in V1.

| `commandType` | `params` | Effect |
| --- | --- | --- |
| `demo.start` | `{}` | Scheduler begins emitting the deterministic V1 event sequence from `system.started` |
| `demo.pause` | `{}` | Scheduler stops advancing; no new events emitted until resumed |
| `demo.resume` | `{}` | Scheduler continues from exactly where it paused; no event reordering or loss |
| `demo.set_speed` | `{ multiplier: number }` | Scheduler's playback rate changes; does not alter event order or content, only timing |
| `demo.reset` | `{}` | All state clears; the neighborhood re-initializes from `system.started` as if freshly booted |
| `demo.replay` | `{ seed?: string }` | Re-emits the identical seeded sequence deterministically from the start; omitting `seed` replays the default V1 seed |

The mock scheduler (and, once it exists, the backend) must apply all six without ever reordering or duplicating already-emitted events. `demo.reset` and `demo.replay` are the only commands that may clear or re-emit history; `demo.pause`/`demo.resume`/`demo.set_speed` never affect event content, only emission timing.

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

### `agent.returned_home` (resolves audit finding M-03)
Payload: `homeBuildingId`. Backend: `currentBuildingId` updates to the Agent's residence following `returnHome`. Frontend: residence occupancy marker returns to occupied/idle; workplace vacates.

For all agent events: Producer backend (or adapter via backend); Audit required; Idempotency by event id; Frontend never authorizes location alone.

---

## AgentRun (resolves audit finding B-04)

### `agentrun.started`
Payload: `agentId`, `taskId`, `runtimeType` (`mock` \| `claude_code`), `riskClass`. Preconditions: `riskClass` is R0–R2. Backend: creates the `AgentRun` record. Frontend: workplace shows active runtime indicator.

### `agentrun.completed`
Payload: `exitCode`, `outputArtifactIds`, `evidenceIds`. Backend: `AgentRun.status` → `completed`. Frontend: evidence becomes inspectable.

### `agentrun.failed`
Payload: `failureCode`, `failureMessage`, `evidenceIds`. Frontend: red state + evidence link; failure remains inspectable.

### `agentrun.timed_out`
Payload: `evidenceIds`, `logRef`. Backend: run terminates safely; logs and evidence retained. Frontend: timeout clearly distinguished from a policy-violation failure.

All `agentrun.*` events: Producer is the Runtime Adapter via the backend; Audit required; Idempotency by event id.

---

## Build

### `build.created`
Payload: `projectId`, `buildId`, `objective`. Frontend: construction site activates.

### `build.planned`
Payload: `stageIds`, `requirementCount`, `planArtifactId`. Frontend: blueprint/progression visible.

### `build.ready` (resolves audit finding M-03)
Backend: status `ready`; all prerequisites for `build.started` are satisfied (plan exists, first stage's prerequisites met). Frontend: construction site shows "ready to start" state, distinct from `planned`.

### `build.started`
Backend: status running. Frontend: active status; no false progress without stage events.

### `build.paused`
Frontend: global pause; stop progress animations.

### `build.resumed` (resolves audit finding M-03)
Backend: status returns to `running` from `paused`. Frontend: progress animations resume; no stage state is re-derived or replayed — resumption continues from exactly where the build paused.

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

### `stage.ready` (resolves audit finding M-03)
Backend: status `ready`; the stage's sequence dependency (the prior stage's completion) is satisfied. Frontend: workplace shows "queued to start," distinct from `planned`.

### `stage.started`
Payload: `assignedAgentIds`, `sourceBuildingId`. For `qa_validation` specifically: this event's precondition additionally requires the Warehouse → QA transfer's `transfer.completed` (receipt) — Inspector validation cannot start before the artifact physically arrives at QA (resolves audit finding B-01). For `deployment_package` specifically: this event coincides with the QA → Deployment Dock transfer's `transfer.started`, once that transfer is `ready` (see `transfer.ready` above).

### `stage.blocked`
Payload: `requirementIds` / `approvalId`, `reason`. Frontend: blocker card; cargo unsealed if relevant.

### `stage.validation_started`
QA validating.

### `stage.validation_passed`
Payload: `evidenceIds`, `passedRequirementIds`. **Invariant:** cannot be produced from Builder self-certify.

### `stage.validation_failed`
Payload: `failedRequirementIds`, `evidenceIds`, `retryEligible`. Frontend: QA red; vehicle parked.

### `stage.completed`
Payload: `artifactIds`, `completedAt`. Backend: may permit transfer creation only if invariants pass. Completed stages cannot silently return to running. For `deployment_package` specifically: this event fires only after the QA → Deployment Dock transfer's `transfer.completed` and receipt at the Dock — never before — and `build.completed` follows immediately (resolves audit finding B-01).

### `stage.failed`
Terminal unless a `Revision` record (see Revision below) is created via the approval/revision flow, which reopens the stage.

---

## Revision (resolves audit finding B-03)

### `revision.requested`
Payload: `revisionId`, `stageId`, `reason`, `requestedBy`, `sourceApprovalId?`. Preconditions: the stage is `completed` or `failed`, or its Approval resolved as `revision_requested`. Backend: creates the `Revision` record; stage status → `revision_required`. Frontend: revision badge on the stage; Builder notified.

### `revision.started`
Payload: `revisionId`. Backend: stage status → `running`, reopened for rework. Frontend: workplace becomes active again for this stage.

### `revision.completed`
Payload: `revisionId`, `resultingStageStatus`. Backend: closes the `Revision`; stage proceeds through its normal lifecycle from `running`. Frontend: revision badge clears.

All `revision.*` events: Producer backend; Audit required; Idempotency by event id.

---

## Requirement

### `requirement.started`
Checklist item running.

### `requirement.passed` (renamed from `requirement.completed` — resolves audit finding M-04)
Payload: `evidenceIds`, `validatorType`. Canonical event name matching the Requirement entity's `passed` status in `domain-model.md`.

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

### `transfer.blocked` (resolves audit finding M-03)
Payload: `blockerIds`, `reason`. Backend: status `blocked`; recorded blockers must clear before `transfer.ready`. Frontend: cargo shows blocked visual; road segment does not highlight.

### `transfer.ready`

Preconditions are per-leg and never reference the transfer's own destination or containing stage (resolves audit finding B-01 — this is what removes the circularity between `transfer.ready` and `deployment_package.completed`):

- **Construction Office → Warehouse:** `integration` stage `completed`; artifact ready. Not approval-gated.
- **Warehouse → QA:** `integration` stage `completed`; artifact ready; `qa_validation` stage `ready` (queued, not yet completed). Not approval-gated. This leg's `transfer.completed` is the precondition that permits `qa_validation`'s `stage.started` — Inspector validation begins only after the artifact physically arrives at QA.
- **QA → Deployment Dock:** `qa_validation` stage `completed`; artifact ready; the build's Approval resolved as `approved`. This is the only approval-gated leg, and occurs during `deployment_package` (see `stage.started`/`stage.completed` below).

Backend: status ready; destination available; vehicle (see `Vehicle` in `domain-model.md`) may assign. Frontend: cargo seals; vehicle loading-ready; route highlights. Never triggered by animation completion alone.

### `transfer.started`
Payload: `vehicleId`, `sourceBuildingId`, `destinationBuildingId`, `artifactIds`. Frontend: load/travel animation may begin. The Vehicle entity emits no independent events — its visual state derives entirely from this and the surrounding `transfer.*` events.

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

**V1.1 amendment (`AC-109`, 2026-08-04) — the Build enters `waiting_for_approval`, by derivation.**
Backend: when the **current Build is `running`**, this event also moves it to
`waiting_for_approval`. `domain-model.md` lists that state in the Build lifecycle,
but no `build.*` event produces it and none is added — the V1 post-`FBL-001` audit
already recorded that these Build states are *"plausibly derived compositionally
from Stage/Approval/Revision events rather than needing bespoke `build.*` events"*.
This is that derivation, made real; it is the state `F-110` requires an
orchestrated build to reach.

The `running` condition is the whole of the rule. An `approval.requested` raised
on the Warehouse upgrade path arrives after `build.completed`, so it cannot drag a
finished Build backwards.

The frontend mock reducer is deliberately **not** changed to match: the mock
runtime and `v1-canonical-run.json` are the frozen V1 regression baseline. The
divergence is intermediate-state only — `build.completed` still lands both
reducers on `completed`, which is what the canonical replay test compares.

### `approval.approved`
Payload: `resolvedBy`, `resolutionNote`. Backend: gated transition may resume.

### `approval.rejected`
No transfer on rejected protected path.

### `approval.revision_requested`
Backend: creates a `Revision` record (see Revision above) linking back to the stage via `sourceApprovalId`; the stage moves to `revision_required` until `revision.completed`; work returns to the Builder.

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

---

## V1.1 amendment — operator decision events (`AC-107`, 2026-08-03)

**Amendment, recorded at the rung that owns it. Foundation 1.0 meaning is otherwise unchanged; no existing event was altered, renamed, or removed.**

The Post-V1 truth audit §17 recorded that "no event exists for plan review, execution authorization, or an operator's decision to proceed after seeing a plan", and that the V1.1 outcome requires at least one new operator event family.

Plan **production** needs nothing new — `build.planned` already covers it. What was missing is the record of a **human deciding**, which is exactly what principle 14 ("Humans govern") requires to be evidence rather than assumption.

### `operator.plan_reviewed`

| | |
| --- | --- |
| Meaning | Operator read the structured plan and recorded a decision |
| Producer | Backend (after an authenticated operator act) |
| Trigger | Operator resolves plan review |
| Payload | `planId`, `buildId`, `planRevision`, `decision` (`proceed` \| `rejected` \| `revision_requested`), `reviewedBy`, optional `note` |
| Preconditions | A persisted plan exists for the build |
| Backend effect | Records the decision. **Reviewing is not authorizing** — `proceed` alone permits no execution |
| Frontend effect | Plan review panel state; timeline row |
| Audit | Required — this is a governance act |
| Idempotency | One decision per plan; a repeat of the same decision is a no-op, a conflicting one is refused |

### `operator.execution_authorized`

| | |
| --- | --- |
| Meaning | Operator authorized exactly one stage to execute, once |
| Producer | Backend (after an authenticated operator act) |
| Trigger | Operator authorizes execution, having read the plan |
| Payload | `authorizationId`, `planId`, `buildId`, `planRevision`, `planContentHash` (backend SHA-256; required from `AC-110`), `stageName`, `riskClass`, `workspace`, **required** `maxBudgetUsd` (positive, finite, ≤ $25), `authorizedBy` |
| Preconditions | The named plan exists; its **backend-generated SHA-256 over canonical persisted content** equals `planContentHash`, compared server-side; the stage is in the plan. `planRevision` is a change indicator only and is **not** the binding |
| Backend effect | Records a **single-use, plan-bound** authorization. A modified plan invalidates it; one authorization never covers a second run (`F-113`) |
| Frontend effect | Authorization state; timeline row |
| Audit | Required — this is the gate before anything real runs |
| Idempotency | Single-use. A second execution under the same authorization is refused |

### Status update (`AC-108`, 2026-08-03)

**`operator.plan_reviewed` is now a member of the runtime event vocabulary.** It joined `OPERATOR_EVENTS` at the rung that produces it, together with its reducer disposition (records the review on the persisted Plan; creates nothing) and its event→world projection-map entry (no visual change — a decision about a proposal is not work in the world).

### Status update (`AC-110`, 2026-08-04)

**`operator.execution_authorized` is now a member of the runtime event vocabulary.** It joined `OPERATOR_EVENTS` at the rung that produces it, together with its reducer disposition (records the single-use authorization on the persisted `Plan`; creates nothing else) and its event→world projection-map entry (no visual change — permission to run is not running).

**`planContentHash` is now required** on the payload, as this rung's amendment obligation required. It is generated by the backend from canonical persisted plan content, stored with the `Plan`, and compared server-side. A client may state which hash it read — and be refused if that disagrees — but the value written to the event is always the backend's own. The client-computable `planRevision` remains a change indicator and is **not** the binding (`F-113a`).

**Preconditions, as enforced:** the named plan exists; its review decision is `proceed`; the named stage is in the plan **and** is the stage the plan allocates to the `claude_code` runtime; the recomputed content hash equals the acknowledged one; and no authorization already exists for the plan.

**`build.planned` gained an optional `plan` field** carrying the structured plan itself. Optional deliberately: the frozen V1 canonical run emits `build.planned` without it and `v1-canonical-run.json` must stay byte-identical, so requiring it would invalidate the regression baseline. `planArtifactId` equals the plan's own id — V1.1 persists a plan as a first-class record rather than a separate `Artifact` row.

### Original status note (`AC-107`)

**Declared here and typed in `packages/event-types`, but deliberately not yet members of the runtime event vocabulary** (`ALL_EVENT_SCHEMAS` / `FoundryEventSchema` / `EVENT_TYPES`).

Two reasons, both deliberate:

1. **Nothing produces them yet.** `AC-107` is a contract-only rung. An event type in the runtime vocabulary that no code emits and no reducer handles is a claim the system does not honour.
2. **`EVENT_TYPES` is asserted against the mock runtime's event→world projection map**, which must cover every member. Joining the union now would force changes to the mock runtime, whose canonical fixture is the frozen V1 regression baseline and which this mission may not modify.

They join the union at the rung that produces each — **`AC-108`** for `operator.plan_reviewed`, **`AC-110`** for `operator.execution_authorized` — together with the reducer disposition and projection-map entries each requires.
