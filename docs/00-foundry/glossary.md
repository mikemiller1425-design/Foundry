# Foundry Glossary

**Foundation:** 1.0  
**Authority:** Canonical terminology for active documents and packages

For each term: **Definition**, **Correct usage**, and **Incorrect alternatives** where relevant.

---

### Foundry

- **Definition:** Spatial operating platform for autonomous organizations; enables humans to supervise, govern, train, and evolve real autonomous work through persistent virtual environments where meaningful visuals correspond to operational entities, capabilities, states, transfers, and events.
- **Correct usage:** “Foundry is the platform; Agent City is an application on Foundry.”
- **Incorrect:** Treating Foundry as synonymous with Agent City; calling Foundry a game, dashboard, chat UI, or OS (unless a future ADR adopts “OS”).

### Agent City

- **Definition:** First spatial application built on Foundry.
- **Correct usage:** “Agent City hosts operational neighborhoods.”
- **Incorrect:** “Agent City is the Foundry platform.”

### Operational World

- **Definition:** Persistent spatial representation of real operational state.
- **Correct usage:** “The operational world renders backend truth.”
- **Incorrect:** “Virtual world,” “game world,” or “simulation” when implying fictional progress.

### Operator

- **Definition:** Human who governs the system: inspects, approves, rejects, pauses, and authorizes upgrades within policy.
- **Correct usage:** “The operator resolves the approval gate.”
- **Incorrect:** “User” when governance role matters; “admin” as a vague substitute.

### Worker

- **Definition:** Broad concept for any laboring actor in the operational world (human or autonomous).
- **Correct usage:** “Workers include agents and, later, other labor types.”
- **Incorrect:** Using “worker” only as a UI label for one agent role.

### Agent

- **Definition:** Autonomous software worker with persistent identity, authority, and assignment.
- **Correct usage:** “The Builder agent executes the stage.”
- **Incorrect:** “Bot,” “NPC,” or “character” when referring to operational identity.

### Residence

- **Definition:** Persistent location representing a worker’s identity, history, permissions, and status—not active project execution.
- **Correct usage:** “The Architect returns to its residence when idle.”
- **Incorrect:** “Home” as a workplace; treating residence as where implementation happens.

### Workplace

- **Definition:** Execution environment where operational capability is exercised (for example Construction Office, QA).
- **Correct usage:** “Active work occurs at a workplace.”
- **Incorrect:** Using “office” generically for governance institutions.

### Institution

- **Definition:** Persistent governance or policy organization (for example Lighthouse; later City Hall, Treasury).
- **Correct usage:** “The Lighthouse is a governance institution.”
- **Incorrect:** Calling every building an institution; calling residences institutions.

### Building

- **Definition:** Persistent world representation of a capability, residence, workplace, or institution.
- **Correct usage:** “Building type is immutable in V1; level changes only via Upgrade.”
- **Incorrect:** “Prop” or decorative structure without operational meaning.

### Capability

- **Definition:** Real, measurable ability a building or worker may exercise; unlocked by evidence-backed upgrades or policy.
- **Correct usage:** “Warehouse Level 2 adds capacity and batch intake.”
- **Incorrect:** Cosmetic “skill points,” XP, or levels without operational effect.

### Objective

- **Definition:** Operator-stated goal that initiates a project/build (for example the V1 task-management app).
- **Correct usage:** “The operator submits an objective.”
- **Incorrect:** Equating objective with a single task or stage.

### Project

- **Definition:** Long-lived container for objective, builds, artifacts, and history.
- **Correct usage:** “V1 allows one active project.”
- **Incorrect:** Using “project” and “build” interchangeably.

### Build

- **Definition:** One bounded attempt to produce a project objective.
- **Correct usage:** “Build #1 is waiting for approval.”
- **Incorrect:** “Deploy” when only a local package handoff occurred.

### Stage / BuildStage

- **Definition:** Gated phase of a build.
- **Correct usage:** “Frontend implementation is a build stage.”
- **Incorrect:** “Step” without gate/requirement semantics.

### Revision

- **Definition:** Record authorizing a completed or failed `BuildStage` to reopen for additional work; created by an `approval.revision_requested` resolution or by exhausted retries.
- **Correct usage:** “The stage returned to `running` under an open Revision.”
- **Incorrect:** Treating a completed stage as silently reopened without a Revision record; calling ad hoc rework a “revision” without the entity.

### Requirement

- **Definition:** Machine-readable condition required for stage completion.
- **Correct usage:** “A failed requirement blocks transfer readiness.”
- **Incorrect:** Soft checklist item that can be ignored when marked required.

### Task

- **Definition:** Temporary unit of work assigned to an agent.
- **Correct usage:** “The Builder’s task is running.”
- **Incorrect:** Treating task completion as automatic stage completion.

### Artifact

- **Definition:** Inspectable retained output or evidence (plan, code, test report, package, logs).
- **Correct usage:** “Artifacts require checksum before transfer readiness.”
- **Incorrect:** “File dump” without identity, status, or provenance.

### Transfer

- **Definition:** Controlled movement of artifacts or responsibility between buildings, authorized by backend state.
- **Correct usage:** “Transfer becomes ready only after prerequisites pass.”
- **Incorrect:** “Shipment,” “delivery quest,” or animation-driven movement as authority.

### Vehicle

- **Definition:** The single persistent physical resource that visualizes a Transfer; emits no independent events — its state derives entirely from the Transfer it is assigned to.
- **Correct usage:** “The vehicle departs only after `transfer.started`.”
- **Incorrect:** Treating vehicle motion as authorization for a transfer; giving the vehicle its own operational state independent of Transfer events.

### Approval

- **Definition:** Human decision gate with evidence, risk class, and auditable resolution.
- **Correct usage:** “Pending approval pauses protected progression.”
- **Incorrect:** Silent auto-approve; chat acknowledgement without an Approval record.

### Event

- **Definition:** Immutable fact representing a meaningful state transition or command result.
- **Correct usage:** “Events are append-only; corrections are new events.”
- **Incorrect:** Mutable log rows rewritten in place; UI-only toast without event identity.

### Upgrade

- **Definition:** Evidence-backed change that increases real capability and may change visual level.
- **Correct usage:** “Upgrade completes only after prerequisites and approval.”
- **Incorrect:** Cosmetic remodel without capability change.

### Mock Runtime

- **Definition:** Deterministic simulated executor used to validate interface and contracts before real adapters.
- **Correct usage:** “V1 starts on the mock runtime.”
- **Incorrect:** Treating mock outcomes as independently authoritative over backend policy.

### Runtime Adapter

- **Definition:** Backend-controlled boundary that invokes an external runtime under policy (repository, allowlist, timeout, evidence capture).
- **Correct usage:** “Claude Code runs behind a runtime adapter.”
- **Incorrect:** Frontend shelling to a terminal; unrestricted autonomous loops.

### AgentRun

- **Definition:** Execution record for one Agent Task run through a Runtime Adapter (`mock` or `claude_code`), including risk class, logs, exit status, and evidence.
- **Correct usage:** “The `backend_implementation` stage's AgentRun used the `claude_code` runtime.”
- **Incorrect:** Conflating AgentRun with Task (AgentRun is the adapter-side execution record; Task is the domain work unit it executes).

### Operational Truth

- **Definition:** Authoritative backend state for entities, transitions, approvals, transfers, and upgrades.
- **Correct usage:** “When projections disagree, operational truth wins.”
- **Incorrect:** “Whatever the animation last showed.”

### Frontend State

- **Definition:** Client projection: display, cache, interpolation, animation, and local UI preferences.
- **Correct usage:** “Frontend state may be stale and must be labeled when disconnected.”
- **Incorrect:** Using frontend state to force stage completion or transfer readiness.

### Backend State

- **Definition:** Persisted authoritative entities and events owned by the backend.
- **Correct usage:** “Backend state validates all protected transitions.”
- **Incorrect:** “Server cache of the UI.”

---

## Related V1 role labels

| Label | Meaning |
| --- | --- |
| Architect Agent | Plans stages, requirements, acceptance criteria, risks |
| Builder Agent | Implements within controlled repository / runtime |
| Inspector Agent | Validates independently and packages evidence |
| Lighthouse | Governance institution for observation, approval, escalation |
