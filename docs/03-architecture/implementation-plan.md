# Implementation Plan — Agent City V1

**Foundation:** 1.0-rc1  
**Method:** Contract-first vertical slices  
**Status:** Planning only — implementation blocked pending audit

For each stage: objective, dependencies, deliverables, required tests, prohibited scope, completion gate.

---

### 1. Foundation audit
- **Objective:** Identify contradictions, gaps, and unsafe assumptions in 1.0-rc1 docs.
- **Dependencies:** Complete documentation package.
- **Deliverables:** `docs/audits/foundry-foundation-v1-audit.md`
- **Required tests:** N/A (document review).
- **Prohibited:** Application code, dependency installs, spec edits by the auditor.
- **Gate:** Audit file exists with classified findings.

### 2. Foundation freeze
- **Objective:** Resolve blockers; promote or amend baseline.
- **Dependencies:** Stage 1.
- **Deliverables:** Reviewed amendments; status decision (`1.0` or revised rc).
- **Required tests:** Checklist against audit.
- **Prohibited:** Scope expansion via Future Registry.
- **Gate:** Explicit approval to proceed; `FOUNDATION_VERSION.md` updated.

### 3. Repository and frontend foundation
- **Objective:** Scaffold `apps/agent-city` and package wiring.
- **Dependencies:** Stage 2; handoff 002 unblocked.
- **Deliverables:** App skeleton, lint/test tooling, package stubs.
- **Required tests:** Typecheck/lint smoke.
- **Prohibited:** Backend, real AI, DB, Future Registry features.
- **Gate:** App boots empty shell locally.

### 4. Ultrawide application shell
- **Objective:** Full-viewport regions per interface model.
- **Dependencies:** Stage 3.
- **Deliverables:** System bar, nav, world host, intelligence, timeline, command bar, resizable/collapsible panels.
- **Required tests:** Layout at three viewports; no max-width trap.
- **Prohibited:** Interior building UIs as sole control path.
- **Gate:** Shell acceptance (ultrawide tests) green.

### 5. Shared contracts
- **Objective:** Encode domain/event types in `packages/*`.
- **Dependencies:** Stage 2 specs stable.
- **Deliverables:** Contracts, event-types, world-model packages.
- **Required tests:** Schema unit tests.
- **Prohibited:** Ad hoc UI-only types that diverge.
- **Gate:** Packages publishable within monorepo; imported by app.

### 6. Deterministic mock runtime
- **Objective:** Replayable demo event engine.
- **Dependencies:** Stage 5.
- **Deliverables:** Mock runtime producing V1 event sequence including intentional failure.
- **Required tests:** Deterministic ordering; idempotent duplicates.
- **Prohibited:** Treating mock as override of backend authority when backend exists.
- **Gate:** Demo script completes headlessly.

### 7. 2D operational interface
- **Objective:** Precision panels, approvals, evidence, feed, commands.
- **Dependencies:** Stages 4–6.
- **Deliverables:** Detail panels, approval card, filters, command handling UI.
- **Required tests:** Keyboard path; approval actions emit commands.
- **Prohibited:** Unrestricted NL shell.
- **Gate:** Operator can inspect blockers/approvals without 3D.

### 8. 3D neighborhood shell
- **Objective:** Placeholder geometry for all V1 world objects (R3F).
- **Dependencies:** Stage 4; ADR-004.
- **Deliverables:** Neighborhood composition; labels; selection targets.
- **Required tests:** Object presence; selection hit targets.
- **Prohibited:** Photoreal assets; interiors.
- **Gate:** All required world elements visible/selectable.

### 9. Event-to-world mapping
- **Objective:** Map events to visuals without false progress.
- **Dependencies:** Stages 6–8.
- **Deliverables:** Reducers, visual state maps, feed templates.
- **Required tests:** V-02–V-07 style tests; reduced motion.
- **Prohibited:** Animation-authorized transfers.
- **Gate:** Intentional failure keeps cargo/vehicle gated.

### 10. Backend persistence
- **Objective:** Thin authoritative store for entities/events.
- **Dependencies:** Stages 2, 5.
- **Deliverables:** Persistence + snapshot API.
- **Required tests:** Reload reconstruction.
- **Prohibited:** Frontend-writable operational tables.
- **Gate:** F-08 persistence tests pass.

### 11. State machine and prerequisites
- **Objective:** Enforce domain invariants server-side.
- **Dependencies:** Stage 10.
- **Deliverables:** Transition validators for stage/requirement/transfer/approval/upgrade.
- **Required tests:** F-03–F-06, invariant suite.
- **Prohibited:** Waiving mandatory requirements.
- **Gate:** Invalid transitions rejected structurally.

### 12. Realtime event stream
- **Objective:** SSE or WebSocket delivery + reconnect.
- **Dependencies:** Stages 10–11.
- **Deliverables:** Stream, disconnect/restore behavior.
- **Required tests:** F-10; update latency budget.
- **Prohibited:** Client inventing events as truth.
- **Gate:** Stale/disconnect UX verified.

### 13. Runtime adapter
- **Objective:** `packages/runtime-adapters` boundary.
- **Dependencies:** Stages 11–12; ADR-006.
- **Deliverables:** Adapter interface; mock adapter behind same API.
- **Required tests:** Policy allow/deny; timeout; log capture shapes.
- **Prohibited:** Frontend direct runtime invocation; OpenClaw full integration.
- **Gate:** Adapter contract tests pass.

### 14. One controlled Claude Code stage
- **Objective:** Replace one Builder stage with Claude Code via adapter.
- **Dependencies:** Stage 13.
- **Deliverables:** Controlled repo profile; evidence artifacts.
- **Required tests:** F-12; containment tests.
- **Prohibited:** Destructive FS; secrets in payloads; unrestricted commands.
- **Gate:** One successful controlled stage run.

### 15. Approval workflow
- **Objective:** End-to-end human gate with Lighthouse signaling.
- **Dependencies:** Stages 7, 11–12.
- **Deliverables:** Request → resolve paths.
- **Required tests:** F-06; journey steps 11–12.
- **Prohibited:** Silent auto-approve.
- **Gate:** Pending approval blocks protected progression.

### 16. Upgrade workflow
- **Objective:** Warehouse Level 2 from real metrics.
- **Dependencies:** Stages 11–12, 15.
- **Deliverables:** Eligibility evaluation; approve; capability+visual change.
- **Required tests:** F-11; V-07.
- **Prohibited:** Cosmetic-only upgrade.
- **Gate:** Level and capacity change only after `upgrade.completed`.

### 17. V1 hardening
- **Objective:** Performance, a11y, failure recovery, docs sync.
- **Dependencies:** Stages 1–16.
- **Deliverables:** Fixes; doc alignment.
- **Required tests:** Performance, a11y, recovery suites.
- **Prohibited:** Excluded features as substitutes.
- **Gate:** No open mandatory defects.

### 18. Acceptance verification
- **Objective:** Prove definition of done.
- **Dependencies:** Stage 17.
- **Deliverables:** Test report; sign-off.
- **Required tests:** Full `v1-acceptance.md`.
- **Prohibited:** Waiving mandatory tests.
- **Gate:** All mandatory tests pass; V1 complete.
