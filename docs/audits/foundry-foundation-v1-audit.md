# Foundry Foundation v1.0-rc1 — Specification Audit

**Audit date:** 2026-07-28  
**Auditor:** Cursor Agent (Claude Code CLI not installed in this environment; audit performed against active documents only)  
**Scope:** Active Foundry documents under `FOUNDATION_VERSION.md`, `README.md`, `docs/00-foundry/`, `docs/01-mission/`, `docs/02-specification/`, `docs/03-architecture/`, `docs/04-future/registry.md`  
**Excluded from authority:** `docs/archive/foundation-v0/` (historical only; consulted solely to detect naming drift, not as requirements)

---

## 1. Executive assessment

Foundation **1.0-rc1** is coherent at the platform/mission level: Foundry vs Agent City hierarchy is clear, principles are strong, exclusions are explicit, and ADRs align with the implementation plan.

It is **not yet safe to mark “Approved for implementation”** without resolving a small set of **BLOCKER** gaps that would force implementers to invent core workflow semantics:

1. The primary build/transfer/approval sequence is ordered inconsistently.
2. Named V1 `BuildStage` inventory is missing.
3. `Revision`, `Vehicle`, and `AgentRun` are referenced as if they exist but are not defined as domain entities.

There is also important **MAJOR** vocabulary and event-coverage drift (demo controls, disconnect, `ready`/`blocked` states without events, requirement `passed` vs `completed`).

**Recommendation:** Resolve BLOCKERS + selected MAJORs, amend active docs, then promote to **Foundry Foundation 1.0 — Approved for implementation**. Do **not** run Handoff 002 until that promotion.

---

## 2. BLOCKER findings

### B-01 — Primary workflow order: transfer vs approval vs QA is ambiguous

**Classification:** BLOCKER  
**Sources:**
- `docs/01-mission/v1-scope.md` → “Required workflow” steps 9–15  
- `docs/02-specification/v1-acceptance.md` → “Primary user journey” steps 9–12  
- `docs/02-specification/world-model.md` → “QA building” (receives transfers; feeds approval gate); “Deployment dock”; “Approval gate”

**Issue:** Scope/acceptance order is roughly: validate → artifact transfer-ready → vehicle moves → **then** human approval. World model implies QA receives packages and **then** feeds the approval gate, with the dock as final handoff after approval. Implementers cannot know whether:

- approval gates the final dock transfer only,
- approval gates every transfer,
- or approval occurs before any vehicle motion.

**Impact:** Acceptance journey, transfer preconditions (`event-model.md` → `transfer.ready`), and Lighthouse attention timing cannot be implemented consistently.

**Resolution needed:** One canonical sequence in mission + acceptance + event preconditions (recommended: work → optional intermediate transfers → Inspector validation → approval → final transfer to Deployment Dock → `build.completed`).

---

### B-02 — Named V1 BuildStage list is missing

**Classification:** BLOCKER  
**Sources:**
- `docs/01-mission/v1-scope.md` → “Required workflow” / “Demonstration objective”  
- `docs/01-mission/active-mission.md` → Mission statement  
- `docs/02-specification/domain-model.md` → “BuildStage” → “V1 limits: Workflow stages listed in mission scope”  
- `docs/02-specification/world-model.md` → “Construction site” state→visual (“Foundation → frame → … map to stages”)

**Issue:** Domain model claims stages are “listed in mission scope,” but active mission/scope only provide a 20-step narrative and a demo product description. They do **not** enumerate the ordered `BuildStage` names (e.g. objective intake, architecture, scaffold, frontend, backend, integration, QA, approval, deployment package).

**Impact:** Construction-site phase mapping, Architect planning outputs, and “one intentional required failure” cannot be pinned to a named stage/requirement without invention.

**Resolution needed:** Add an explicit ordered V1 stage list (and which stage contains the intentional failure) to `v1-scope.md` or `active-mission.md`, and reference it from `domain-model.md`.

---

### B-03 — `Revision` is required by invariants but undefined as an entity

**Classification:** BLOCKER  
**Sources:**
- `docs/02-specification/domain-model.md` → “BuildStage” → Invariants (“requires Revision”); Commands `RequestRevision`  
- `docs/02-specification/event-model.md` → “Stage” → `stage.failed` (“unless Revision path…”); “Approval” → `approval.revision_requested`  
- `docs/02-specification/v1-acceptance.md` → F-06 (revision path)

**Issue:** Completed stages cannot silently return to running without a Revision record, and revision-request is an acceptance path, but **no `Revision` entity** appears in the domain model entity set (purpose, fields, lifecycle, events).

**Impact:** Impossible to implement revision without inventing schema and events.

**Resolution needed:** Define `Revision` in `domain-model.md` (and any emitted events), or remove Revision language and specify the exact reopen mechanism.

---

### B-04 — `Vehicle` and `AgentRun` are referenced but not defined

**Classification:** BLOCKER  
**Sources:**
- `docs/02-specification/domain-model.md` → “Transfer” (`vehicleId`, “Uses Vehicle”); “Agent” (“emits AgentRun/Event records”)  
- `docs/02-specification/world-model.md` → “Utility vehicle”  
- `docs/02-specification/v1-acceptance.md` → F-12; “Failure and recovery” (Claude Code timeout)  
- `docs/04-future/registry.md` → Treasury V1 hooks (`costUsd` on AgentRun) — note only; not V1 scope

**Issue:** Transfers require a vehicle identity; Claude Code evidence requires a run record. Neither `Vehicle` nor `AgentRun` is specified as a domain entity (fields, states, invariants, events).

**Impact:** Packages/contracts and adapter results have no authoritative shape; F-12 cannot be grounded.

**Resolution needed:** Add `Vehicle` and `AgentRun` sections to `domain-model.md` aligned with world/event models (V1 limits: one vehicle; runtimes `mock` | `claude_code`).

---

## 3. MAJOR findings

### M-01 — Demo control semantics lack event/command contracts

**Classification:** MAJOR  
**Sources:**
- `docs/02-specification/v1-acceptance.md` → F-01  
- `docs/02-specification/interface-model.md` → “Persistent command input”  
- `docs/02-specification/event-model.md` → Operator events only (`operator.command_*`)

**Issue:** Start/pause/resume/speed/reset/replay are required, but there is no demo event vocabulary and no enumerated `commandType` values/payloads.

**Resolution:** Define allowed command types and either `demo.*` events or explicit operator command payloads that the mock scheduler must honor without reordering outcomes.

---

### M-02 — Disconnect/reconnect required without connection events

**Classification:** MAJOR  
**Sources:**
- `docs/02-specification/interface-model.md` → “Connection / stale state”  
- `docs/02-specification/v1-acceptance.md` → F-10  
- `docs/02-specification/world-model.md` → Lighthouse state `disconnected`  
- `docs/02-specification/event-model.md` → System section (`system.started`, `system.health_changed` only)

**Issue:** Disconnect/restore behavior is acceptance-critical but not modeled as events (or explicitly mapped to `system.health_changed` reasons).

**Resolution:** Add `system.connection_lost` / `system.connection_restored`, or state that health payload reasons fully cover connection loss/restore and define those reason codes.

---

### M-03 — Domain states without corresponding events

**Classification:** MAJOR  
**Sources:**
- `docs/02-specification/domain-model.md` → Build (`ready`, `paused` + Resume command); BuildStage (`ready`); Transfer (`blocked`)  
- `docs/02-specification/event-model.md` → missing `build.ready`, `build.resumed`, `stage.ready`, `transfer.blocked`  
- `docs/02-specification/domain-model.md` → Agent command `returnHome` without `agent.returned_home`

**Issue:** Allowed states/commands imply transitions that the event vocabulary does not name. Reducers and tests will diverge.

**Resolution:** Add the missing events **or** remove those states/commands from the domain model for V1.

---

### M-04 — Requirement status vs event naming mismatch

**Classification:** MAJOR  
**Sources:**
- `docs/02-specification/domain-model.md` → Requirement lifecycle/states (`passed`)  
- `docs/02-specification/event-model.md` → `requirement.completed` (“Canonical name for pass”)

**Issue:** Entity status `passed` vs event type `completed` will produce inconsistent UI copy and contract enums unless explicitly mapped.

**Resolution:** Pick one canonical pair (prefer status `passed` + event `requirement.passed`, **or** status `completed` + event `requirement.completed`) and align both docs.

---

### M-05 — Early mock-runtime phase vs “backend owns truth”

**Classification:** MAJOR  
**Sources:**
- `docs/00-foundry/principles.md` → “Operational truth”  
- `docs/handoffs/002-frontend-foundation.md` → Prohibit database; mock/demo adapter  
- `docs/03-architecture/implementation-plan.md` → Stages 6–9 before Stage 10  
- `docs/03-architecture/decisions/ADR-001-frontend-first-mock-runtime.md`

**Issue:** Handoff 002 correctly forbids a real backend, but principles state backend owns truth. Without an explicit “temporary mock authority” rule, implementers may either overbuild a backend early or violate F-03 conceptually.

**Resolution:** Add a short V1 rule: until Stage 10, the deterministic mock engine is the **stand-in authority** behind the same contracts; frontend still must not locally forge completion/transfer/approval/upgrade.

---

### M-06 — Approval placement relative to Warehouse upgrade metrics

**Classification:** MAJOR  
**Sources:**
- `docs/02-specification/domain-model.md` → Upgrade → Warehouse Level 2 prerequisites  
- `docs/01-mission/v1-scope.md` → steps 16–19  
- `docs/02-specification/v1-acceptance.md` → journey step 14; F-11

**Issue:** Upgrade eligibility depends on “10 successful artifact packages,” pass rate, etc., but V1 does not define what counts as a “successful package,” when counting starts, or whether the single demo build can satisfy “10” without multi-run/reset semantics.

**Resolution:** Define counting rules for the deterministic demo (e.g. seeded historical metrics, multiple demo cycles, or revised thresholds achievable in one run).

---

## 4. MINOR findings

### m-01 — “World Mode” / “Command Mode” used but not glossaried
**Sources:** `docs/00-foundry/principles.md` → Interface; `docs/00-foundry/vision.md`  
**Resolution:** Add glossary entries mirroring interface doctrine.

### m-02 — “Command Deck” undefined
**Sources:** `docs/02-specification/world-model.md` → Lighthouse → Interactions  
**Resolution:** Define as the operator control surface (or rename to existing panels).

### m-03 — Residence visual states ≠ Building status enums
**Sources:** `docs/02-specification/world-model.md` → Residences; `docs/02-specification/domain-model.md` → Building statuses  
**Resolution:** Provide an explicit mapping table.

### m-04 — Construction site phases are prose, not enums
**Sources:** `docs/02-specification/world-model.md` → Construction site  
**Resolution:** Map each phase to completed stage IDs once B-02 is fixed.

### m-05 — `building.selected` exists; agent selection event does not
**Sources:** `docs/02-specification/world-model.md` → Object selection; `docs/02-specification/event-model.md` → Building  
**Resolution:** Add `agent.selected` (UI) or state selection is non-event UI sync only for both.

### m-06 — Mission step 17 says “a building”; specs assume Warehouse
**Sources:** `docs/01-mission/v1-scope.md` step 17; world/domain/acceptance Warehouse L2  
**Resolution:** Say “Warehouse” explicitly in mission step 17.

### m-07 — Artifact `checksum` required field vs `checksumStatus` at creation
**Sources:** `docs/02-specification/domain-model.md` → Artifact; `docs/02-specification/event-model.md` → `artifact.created`  
**Resolution:** Clarify checksum may be null/pending until validated.

### m-08 — Principles list residences/workplaces/institutions; Building types use `home`
**Sources:** glossary “Residence”; domain `buildingType: home`  
**Resolution:** Note `home` is the type code for Residence buildings.

---

## 5. OPTIONAL findings

### O-01 — Handoff 002 stack omits TanStack Query / ESLint / Prettier
Not required for approval; decide when unblocking frontend.

### O-02 — Performance numeric targets may be aggressive for first placeholder world
Keep as targets; allow staged measurement after Stage 8–9.

### O-03 — Future Registry is dense but clearly non-active
No change required for V1 approval beyond ensuring no leakage (see §10).

### O-04 — `building.selected` as an “event” may pollute operational audit streams
Consider UI-only selection channel separate from operational event log.

---

## 6. Terminology gaps

| Term / concept | Where used | Gap |
| --- | --- | --- |
| World Mode / Command Mode | principles, vision | Not in glossary |
| Command Deck | world-model Lighthouse | Undefined |
| Revision | domain, events, F-06 | Entity missing (B-03) |
| Vehicle | transfer, world-model | Entity missing (B-04) |
| AgentRun | domain Agent; F-12 | Entity missing (B-04) |
| Neighborhood | FOUNDATION_VERSION, README | Implied; OK if defined as V1 world instance — optional glossary add |
| Demo / demonstration | interface, F-01 | Not glossaried; command contract missing (M-01) |
| Health values | `system.health_changed` | Enum of `previousHealth`/`newHealth` not specified |
| Evidence | many docs | Used widely; no standalone entity (may be Artifact subtype — clarify) |

---

## 7. Lifecycle / state-machine issues

1. **BuildStage reopen** depends on undefined Revision (B-03).  
2. **Transfer `blocked` ↔ ready** transition has domain status but no `transfer.blocked` event (M-03).  
3. **Build `paused` → running** lacks `build.resumed` (M-03).  
4. **BuildStage `ready`** status without `stage.ready` event (M-03).  
5. **Requirement** status `passed` vs event `completed` (M-04).  
6. **Agent `returnHome`** command without arrival-at-home event (M-03).  
7. **Construction site visual phases** unbound to stage IDs until B-02 fixed.  
8. **Upgrade eligibility “10 packages”** may be unreachable in one demo run (M-06) — state machine can become permanently `locked`.

---

## 8. Event-model issues

| Issue | Detail |
| --- | --- |
| Missing producers for implied transitions | See M-03 |
| Connection lifecycle | See M-02 |
| Demo lifecycle | See M-01 |
| Sparse tables for many events | Several agent/build/stage events lack full Meaning/Producer/Trigger/Payload/Preconditions matrices (documentation completeness, not always behavioral blockers) |
| `building.selected` | Non-operational; risk of audit noise (O-04) |
| Upgrade vs building.* naming | Active docs consistently use `upgrade.*` (good); ensure packages do not revive archived `building.upgrade_*` names |

No finding that Future Registry events are required in V1.

---

## 9. Acceptance gaps

| Acceptance item | Support gap |
| --- | --- |
| Primary journey steps 10–12 | Blocked by B-01 sequence ambiguity |
| Intentional failure | Stage/requirement identity unspecified (B-02) |
| F-01 demo controls | Command/event contract missing (M-01) |
| F-10 disconnect | Events/mapping missing (M-02) |
| F-11 upgrade metrics | Counting rules underspecified (M-06) |
| F-12 Claude Code stage | AgentRun undefined (B-04); which BuildStage uses `claude_code` unspecified |
| Ten-second comprehension | Supported conceptually by interface model; no measurable rubric beyond V-01 (acceptable as qualitative) |
| Persistence after restart | Supported once backend exists; OK for later stages |

---

## 10. Future Registry leakage

**No BLOCKER leakage found.** Registry concepts are marked non-active.

Watchouts (not leakage if left alone):

- Registry mentions Academy, campuses, Treasury, Opportunity Center, etc., already excluded in `docs/01-mission/exclusions.md`.  
- Registry V1 hooks reference `AgentRun.costUsd` — fine as a forward hook once AgentRun is defined; do not implement Treasury.  
- ADR-006 mentions OpenClaw behind adapters; exclusions forbid **full** OpenClaw integration — consistent if V1 only ships `mock` + controlled `claude_code`.

---

## 11. Recommended next actions

### Must resolve before Foundation 1.0 approval

1. Fix **B-01**: publish one canonical approval/transfer/QA sequence across mission, acceptance, and `transfer.ready` / `approval.*` preconditions.  
2. Fix **B-02**: enumerate V1 `BuildStage` names + intentional failure placement + which stage may use Claude Code.  
3. Fix **B-03**: define `Revision` (or remove Revision language).  
4. Fix **B-04**: define `Vehicle` and `AgentRun`.

### Should resolve with the freeze (MAJOR)

5. M-01 demo command/event contract  
6. M-02 connection lost/restored modeling  
7. M-03 align states↔events  
8. M-04 requirement passed/completed naming  
9. M-05 temporary mock-authority rule for pre-backend stages  
10. M-06 upgrade eligibility counting rules

### Can defer past approval (MINOR/OPTIONAL)

- Glossary polish (World/Command Mode, Command Deck, Neighborhood)  
- Selection event policy  
- Performance target staging  
- Handoff 002 tooling extras  

### Process

1. Amend **active** documents only (do not resurrect archive as authority).  
2. Update `FOUNDATION_VERSION.md` to approved **1.0**.  
3. Unblock `docs/handoffs/002-frontend-foundation.md`.  
4. Only then allow application code generation.

---

## Summary counts

| Severity | Count |
| --- | --- |
| BLOCKER | 4 |
| MAJOR | 6 |
| MINOR | 8 |
| OPTIONAL | 4 |

**Verdict:** Foundation documentation is directionally strong and ready for a short freeze pass. **Not approved for implementation** until BLOCKERS B-01–B-04 are closed.
