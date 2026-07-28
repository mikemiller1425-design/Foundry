# Specification 001 — V1 World Bible

**Purpose:** Define the meaning, states, behavior, interactions, and boundaries of every visible V1 object.

## 1. World-wide visual rules

- Operational visuals are event-driven.
- Ambient visuals may loop but cannot imply work completion.
- Every selectable object exposes an accessible textual name and state.
- Every warning color also has a label or icon; color is never the only signal.
- The world must remain readable at 5120×1440, 3840×1080, and 2560×1440.
- World interactions open 2D precision panels; critical controls are not hidden inside 3D interiors.

## 2. Lighthouse

### Category
Governance building

### Real operational meaning
Global observation, approval, escalation, command, and intervention layer.

### Inputs
System health, agent heartbeats, build state, approvals, failures, costs, current stage, and event stream.

### Outputs
Operator commands, approvals, rejections, revision requests, pause/resume commands, and navigation to evidence.

### States and visuals

- `healthy`: steady white beam; no unresolved high-severity events.
- `active`: rotating blue beam; workflow progressing normally.
- `attention_required`: yellow beam; approval or operator decision pending.
- `degraded`: orange pulse; noncritical repeated failures or stale heartbeat.
- `critical`: red rotating beam; unrecoverable or safety-blocking event.
- `disconnected`: beam dark; frontend cannot confirm backend state.

### Interactions
Click opens Command Deck. Hover displays overall status. Keyboard focus and Enter provide equivalent access.

### Never represents
A worker, project repository, model runtime, artifact store, or autonomous strategist.

## 3. Architect Home

### Category
Residence

### Meaning
Persistent identity and status location for the Architect agent.

### Visible states
Occupied/idle, vacant because assigned, unavailable, paused, degraded.

### Interactions
Open Architect profile, current assignment, permissions, work history, performance, and recent events.

### Never represents
Architecture work itself. Active work occurs at a workplace.

## 4. Builder Home

Same residence contract as Architect Home, specialized for Builder identity.

Profile includes controlled runtime, repository permissions, current branch/worktree, task history, tests, failures, and safe-stop controls.

## 5. Inspector Home

Same residence contract as Architect Home, specialized for Inspector identity.

Profile includes validation rules, independence policy, recent pass/fail decisions, evidence links, and authority limitations.

## 6. Construction Office

### Category
Operational workplace

### Meaning
The environment where planning and implementation stages are actively executed.

### Inputs
Assigned agents, active stage, requirements, execution logs, and artifacts in progress.

### Outputs
Stage artifacts, logs, test commands, completion claims, and revision work.

### Visual states

- `idle`: dim interior lights.
- `active`: lit windows and controlled work animation.
- `waiting`: yellow marker and visible wait reason.
- `blocked`: flashing yellow marker; no progress animation.
- `failed`: red marker with failure badge.
- `completed`: short green confirmation pulse, then returns to idle.

### Interactions
Click opens active stage, requirement checklist, assigned agents, logs, artifacts, retry status, and controls.

## 7. Warehouse

### Category
Storage and queue building

### Meaning
Persistent inventory for requirements packages, artifacts, completed stage bundles, and queued transfer items.

### Inventory zones

- Incoming
- In processing
- Ready for transfer
- Completed
- Rejected/quarantined

### V1 capacity
Level 1 capacity is 25 packages and one active transfer-ready package at a time.

### Visual language
Each package has a readable label. Shelf occupancy reflects real inventory count. A package remains unsealed until all required gates pass.

### Interactions
Click opens inventory counts, exact items, oldest waiting item, capacity, blocked reasons, transfer readiness, and upgrade progress.

### Upgrade
Level 1 to Level 2 is the only V1 upgrade.

### Never represents
The active agent identity, arbitrary database rows, or fake decorative stock.

## 8. QA Building

### Category
Validation workplace

### Meaning
Independent inspection, testing, requirement verification, and evidence packaging.

### Inputs
Artifact package, requirements, test commands, acceptance criteria, and prior failures.

### Outputs
Validation result, failure evidence, revision request, approval request, or passed package.

### Visual states
Idle, validating, passed, failed, waiting for human approval.

### Rule
The Builder cannot self-certify a stage as passed. Inspector evidence drives validation state.

## 9. Deployment Dock

### Category
Destination / handoff point

### Meaning
Final receipt of a completed V1 build package. It does not deploy to public production in V1.

### Inputs
Approved, validated final artifact package.

### Outputs
Completion receipt and build archive event.

### Visual states
Closed, ready, receiving, completed, rejected.

### V1 limitation
The dock represents a local deployment package or preview environment only.

## 10. Construction Site

### Category
Project representation

### Meaning
The current product being built.

### Visual progression
Foundation, frame, enclosed structure, inspected structure, completed structure. Each phase maps to completed build stages rather than elapsed time.

### Interaction
Click opens project objective, build plan, stage progress, requirements, current blockers, and artifacts.

## 11. Road Network

### Category
Dependency and transfer infrastructure

### Meaning
Allowed routes between V1 locations.

### Required routes
Homes to Construction Office; Construction Office to Warehouse; Warehouse to QA; QA to Deployment Dock; governance visibility to Lighthouse.

### Rule
Roads do not prove a transfer exists. They only show that a route is permitted.

## 12. Utility Vehicle

### Category
Transfer visualization

### Meaning
Movement of a validated package or responsibility between locations.

### States
Parked, waiting, loading, in transit, unloading, completed, failed.

### Rules

- It cannot load while `transfer.status != ready`.
- Animation starts only after `transfer.started`.
- Arrival animation cannot mark backend completion.
- If the browser misses animation, state must reconcile to backend truth.

### Interaction
Click opens transfer ID, cargo, source, destination, prerequisites, timeline, and failure status.

## 13. Agent Residents

### Shared visual states
At home/idle, traveling, working, waiting, paused, failed, returning.

### Movement rule
An agent changes operational location only when the backend records assignment and location transition events.

### V1 representation
Simple low-poly characters or icons are acceptable. Identity labels must remain readable.

## 14. Cargo Package

### Category
Artifact bundle

### Meaning
A defined set of outputs associated with one stage or final build.

### States
Open/incomplete, blocked, validating, sealed/ready, in transit, received, rejected.

### Rule
Sealing is a backend-authorized state. The frontend cannot seal cargo because an animation completed.

## 15. Approval Gate

### Category
Workflow control

### Meaning
A backend pause requiring operator decision.

### Visual representation
Closed barrier and yellow Lighthouse state while pending. Open route after approval. Red rejected marker after rejection.

### Operator actions
Approve once, reject, request revision, inspect evidence.

### V1 limitation
No permanent policy creation from the approval card.

## 16. World Camera

### Required behavior
Pan, zoom, controlled orbit, focus selected object, reset view, and optional saved viewpoints.

### Restrictions
No unrestricted camera that can become lost beneath terrain or far outside the neighborhood. Motion must respect reduced-motion preferences.

## 17. Left Navigator

### Purpose
Exact navigation across project, build stages, agents, buildings, artifacts, approvals, and history.

### Behavior
Resizable and collapsible. Selection synchronizes with the 3D world.

## 18. Right Live-Intelligence Panel

### Purpose
Persistent current facts: active stage, active agents, approvals, latest warning, event rate, and system connection state.

### Rule
It must not become a second complete dashboard; it surfaces current exceptions and links to detail.

## 19. Selected-Object Panel

### Purpose
Precise inspection and controls for the selected world object.

### Required sections
Summary, state reason, current work, dependencies, evidence, event history, and permitted controls.

## 20. Event Feed

### Purpose
Chronological textual equivalent for all meaningful animations and state changes.

### Features
Filter by severity/entity/type, pause autoscroll, inspect payload, jump to world object, and retain history after reload.

## 21. Command Bar

### Purpose
Operator navigation and bounded commands.

### V1 commands
Show blockers, open pending approval, pause/resume demonstration, focus agent/building, reset demo, and replay scenario.

### Limitation
No natural-language autonomous planning or unrestricted shell execution in V1.

## 22. Ultrawide layout

Default desktop composition:

- top system header: 5–7% height;
- left navigator: 13–16% width;
- center world: 58–64% width;
- right intelligence: 20–24% width;
- bottom timeline: 18–22% height, collapsible;
- command bar: persistent bottom strip.

No generic fixed-width content container may constrain the application.
