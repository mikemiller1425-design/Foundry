# World Model — Agent City V1

**Foundation:** 1.0-rc1  
**Authority:** Visual objects in the V1 operational neighborhood

Global rules:

- Operational visuals are event-driven.
- Ambient visuals may loop but cannot imply work completion.
- Every selectable object exposes an accessible textual name and state.
- Color is never the only status signal.
- Readable at 5120×1440, 3840×1080, and 2560×1440.
- Critical controls are not hidden inside 3D interiors.

---

## Lighthouse

| Field | Content |
| --- | --- |
| Category | Institution (governance) |
| Operational meaning | Global observation, approval, escalation, command, intervention |
| Persistent / temporary | Persistent |
| Inputs | Health, heartbeats, build state, approvals, failures, stage, event stream |
| Outputs | Operator commands, approvals, rejections, revision requests, pause/resume, evidence navigation |
| Allowed states | `healthy`, `active`, `attention_required`, `degraded`, `critical`, `disconnected` |
| State→visual | Steady white / rotating blue / yellow attention / orange pulse / red rotating / beam dark |
| Interactions | Click opens Command Deck; hover status; keyboard equivalent |
| Relationships | Observes all V1 buildings and agents; hosts approval attention |
| Required events | `system.*`, `approval.*`, `building.state_changed` |
| Never represents | Worker, repository, model runtime, artifact store, autonomous strategist |
| V1 limits | No project implementation work; no permanent policy authoring from the approval card |

## Architect / Builder / Inspector residences

| Field | Content |
| --- | --- |
| Category | Residence |
| Operational meaning | Persistent identity and status for each agent |
| Persistent / temporary | Persistent |
| Inputs | Agent status, assignment, heartbeat, pause/fail reasons |
| Outputs | Profile, permissions, history, safe-stop controls (Builder), validation policy (Inspector) |
| Allowed states | Occupied/idle, vacant-assigned, unavailable, paused, degraded |
| State→visual | Lights/occupancy markers; vacant when agent assigned elsewhere |
| Interactions | Open agent profile and recent events |
| Relationships | One-to-one with its agent; not a workplace |
| Required events | `agent.*` location and status events |
| Never represents | Active architecture, build, or validation work |
| V1 limits | Three residences only; no interiors |

## Architect / Builder / Inspector agents

| Field | Content |
| --- | --- |
| Category | Worker (agent residents) |
| Operational meaning | Persistent autonomous software workers |
| Persistent / temporary | Persistent identity; temporary assignments |
| Inputs | Assignments, tasks, runtime results, operator pause/resume |
| Outputs | Plans, code, validations, evidence, failures |
| Allowed states | `idle`, `assigned`, `traveling`, `working`, `waiting`, `paused`, `failed`, `offline` |
| State→visual | At residence, traveling, working at workplace, waiting, paused, failed, returning |
| Interactions | Select; open profile; pause/resume when permitted |
| Relationships | One residence; one current building; ≤ one active task in V1 |
| Required events | `agent.registered` through `agent.completed_work` / location events |
| Never represents | Decorative citizens or NPCs |
| V1 limits | Exactly three agents; simple low-poly/icon representation acceptable |

## Construction office

| Field | Content |
| --- | --- |
| Category | Workplace |
| Operational meaning | Planning and implementation execution environment |
| Persistent / temporary | Persistent |
| Inputs | Assigned agents, stage, requirements, logs, in-progress artifacts |
| Outputs | Stage artifacts, logs, completion claims, revision work |
| Allowed states | `idle`, `active`, `waiting`, `blocked`, `failed`, `completed` (pulse then idle) |
| State→visual | Dim / lit work / yellow wait / flashing blocked / red fail / short green pulse |
| Interactions | Open stage, checklist, agents, logs, artifacts, retries, controls |
| Relationships | Linked to construction site and warehouse via roads |
| Required events | `stage.*`, `agent.started_work`, `requirement.*`, `artifact.created` |
| Never represents | Final deployment or independent QA authority |
| V1 limits | One office; no interior navigation required for controls |

## Warehouse

| Field | Content |
| --- | --- |
| Category | Building (storage / queue capability) |
| Operational meaning | Inventory for packages, stage bundles, transfer-ready items |
| Persistent / temporary | Persistent; inventory items temporary |
| Inputs | Artifacts, validation results, transfer readiness |
| Outputs | Inventory views, blocked reasons, upgrade progress |
| Allowed states | Building: idle/active/waiting/blocked/degraded/upgrading; packages per cargo states |
| State→visual | Shelf occupancy reflects counts; unsealed until gates pass; Level 2 model after upgrade |
| Interactions | Inventory, capacity, oldest waiter, transfer readiness, upgrade |
| Relationships | Between construction office, QA, dock via transfers |
| Required events | `artifact.*`, `transfer.*`, `upgrade.*`, `building.state_changed` |
| Never represents | Agent identity or fake decorative stock |
| V1 limits | Level 1 capacity 25; one active transfer-ready package; only Level 1→2 upgrade |

## QA building

| Field | Content |
| --- | --- |
| Category | Workplace (validation) |
| Operational meaning | Independent inspection, verification, evidence packaging |
| Persistent / temporary | Persistent |
| Inputs | Artifact package, requirements, tests, prior failures |
| Outputs | Pass/fail, revision request, approval request, evidence |
| Allowed states | Idle, validating, passed, failed, waiting for human approval |
| State→visual | Matching markers; red on fail; no self-certify by Builder |
| Interactions | Evidence, failed requirements, retry eligibility |
| Relationships | Receives the Warehouse → QA transfer; validation (`stage.started` for `qa_validation`) begins only after that transfer's `transfer.completed` — the artifact must physically arrive before Inspector validation starts (resolves audit finding B-01); feeds approval gate |
| Required events | `stage.validation_*`, `requirement.*`, `artifact.validated`, `approval.requested` |
| Never represents | Builder self-approval |
| V1 limits | Inspector path required for `stage.validation_passed`; the transfer QA sends onward to the Deployment Dock is the only approval-gated transfer in V1 (resolves audit finding B-01 — see `domain-model.md` Transfer invariants) |

## Deployment dock

| Field | Content |
| --- | --- |
| Category | Destination / handoff |
| Operational meaning | Final receipt of completed V1 build package |
| Persistent / temporary | Persistent |
| Inputs | Approved, validated final package |
| Outputs | Completion receipt, archive event |
| Allowed states | Closed, ready, receiving, completed, rejected |
| State→visual | Door/bay states matching status |
| Interactions | Receipt, final artifacts, completion evidence |
| Relationships | End of V1 transfer chain |
| Required events | `transfer.completed`, `build.completed`, `artifact.ready` |
| Never represents | Public production deploy in V1 |
| V1 limits | Local package / preview environment only |

## Construction site

| Field | Content |
| --- | --- |
| Category | Project representation |
| Operational meaning | Current product being built |
| Persistent / temporary | Persistent for active project; visual phases map to stages |
| Inputs | Build plan, stage completions |
| Outputs | Objective, progress, blockers, artifacts |
| Allowed states | Foundation → frame → enclosed → inspected → completed (stage-mapped) |
| State→visual | Structural progression by completed stages, not elapsed time |
| Interactions | Open project/build panels |
| Relationships | Tied to active Project/Build |
| Required events | `build.*`, `stage.completed` |
| Never represents | Arbitrary decoration unrelated to build progress |
| V1 limits | One active site |

## Road network

| Field | Content |
| --- | --- |
| Category | Dependency / transfer infrastructure |
| Operational meaning | Permitted routes between V1 locations |
| Persistent / temporary | Persistent |
| Inputs | World layout |
| Outputs | Route highlights when transfers authorize |
| Allowed states | Available / highlighted / inactive |
| State→visual | Path emphasis only when transfer ready/in progress |
| Interactions | Informational; selection optional |
| Relationships | Homes↔office; office↔warehouse; warehouse↔QA; QA↔dock; visibility to Lighthouse |
| Required events | None alone; responds to `transfer.*` |
| Never represents | Proof that a transfer exists |
| Note | Only the QA↔dock segment carries an approval-gated transfer in V1; the office↔warehouse and warehouse↔QA segments carry non-gated transfers (resolves audit finding B-01) |
| V1 limits | Small neighborhood graph only |

## Utility vehicle

| Field | Content |
| --- | --- |
| Category | Transfer visualization |
| Operational meaning | Visualizes movement of validated packages/responsibility |
| Persistent / temporary | Persistent resource; assignment temporary |
| Inputs | Transfer status, vehicle assignment |
| Outputs | Transfer detail panel |
| Allowed states | Parked, waiting, loading, in transit, unloading, completed, failed |
| State→visual | Motion only after `transfer.started`; cannot load unless transfer ready |
| Interactions | Transfer ID, cargo, source, destination, prerequisites, failures |
| Relationships | One active transfer max in V1 |
| Required events | `transfer.ready`, `transfer.started`, `transfer.arrived`, `transfer.completed`, `transfer.failed` |
| Never represents | Authorization of transfer |
| V1 limits | One vehicle (domain entity `Vehicle`, defined in `domain-model.md` — resolves audit finding B-04) |

## Cargo

| Field | Content |
| --- | --- |
| Category | Artifact bundle representation |
| Operational meaning | Defined outputs for a stage or final build |
| Persistent / temporary | Temporary relative to build; retained as artifacts |
| Inputs | Artifact statuses, transfer readiness |
| Outputs | Sealed/unsealed visual, labels |
| Allowed states | Open/incomplete, blocked, validating, sealed/ready, in transit, received, rejected |
| State→visual | Seal only when backend authorizes readiness (with transfer.ready as applicable) |
| Interactions | Contents, blockers, evidence |
| Relationships | Bound to artifacts and transfers |
| Required events | `artifact.*`, `transfer.*`, `requirement.failed` |
| Never represents | Frontend-sealed completion |
| V1 limits | One cargo representation type |

## Approval gate

| Field | Content |
| --- | --- |
| Category | Workflow control |
| Operational meaning | Backend pause requiring operator decision |
| Persistent / temporary | Temporary per approval instance |
| Inputs | Approval request, evidence, risk class |
| Outputs | Approve, reject, revision request |
| Allowed states | Closed/pending, open/approved path, rejected |
| State→visual | Barrier + yellow Lighthouse while pending; open after approve; red on reject |
| Interactions | Inspect evidence; resolve once per policy |
| Relationships | Tied to Approval entity and Lighthouse |
| Required events | `approval.*` |
| Never represents | Permanent policy editor in V1 |
| V1 limits | No permanent policy creation from the card |

## World camera

Pan, zoom, controlled orbit, focus selection, reset, optional saved viewpoints. Cannot become lost under terrain or far outside the neighborhood. Respects reduced motion.

## Object selection

Pointer and keyboard selection for every building and agent. Navigator selection synchronizes with the world. Selection emits UI-facing `building.selected` (and agent selection equivalent in interface) without mutating operational truth.

## Event feed / command bar / detail panel

Specified fully in `interface-model.md`. World model requires: every meaningful animation has a feed/detail textual equivalent; command bar exposes bounded V1 commands only; detail panel holds critical controls.
