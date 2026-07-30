# Foundry Build Ladder — Agent City V1

**Foundation:** 1.0
**Authority:** Sequential implementation program derived from `docs/03-architecture/implementation-plan.md` and all active specification documents
**Status:** `FBL-001`–`FBL-003` are **complete**. Foundry Foundation is **approved (1.0)**. The operator has explicitly authorized a bounded execution sequence covering `FBL-003`–`FBL-006`; `FBL-004` is in progress under that authorization. No rung beyond `FBL-006` has been authorized to start, and `FBL-007` remains explicitly out of scope until separately authorized, per this document's own rules below.
**Method:** Contract-first vertical slices (ADR-003)

## How to read this document

- Every rung has a **stable identifier** (`FBL-001`, `FBL-002`, …). Identifiers are never reused and completed rungs are never renumbered. New work discovered after a rung is closed is inserted as a lettered sub-rung of the nearest preceding rung (e.g. `FBL-006A`), never by shifting later numbers.
- A rung may not **begin** until (a) every item in its **Prerequisites** field is true and (b) the **Stop condition** of the immediately preceding rung on its dependency path has been reached.
- A rung may not **end** by sliding into the next rung's work. Reaching a rung's **Stop condition** halts work until a human or the designated gate explicitly authorizes the next rung.
- `FBL-001` resolved all **4 BLOCKER** and all **6 MAJOR** findings from `docs/audits/foundry-foundation-v1-audit.md` (dated 2026-07-28); finding-by-finding detail in `docs/audits/foundation-v1-fbl-001-closure-matrix.md`. `FBL-002` independently re-audited the amended baseline (`docs/audits/foundry-foundation-v1-post-fbl-001-audit.md`, dated 2026-07-30, result **PASS**, 0 open BLOCKER, 0 open MAJOR, no inaccurate closure-matrix claim found) and recorded explicit operator approval promoting Foundation from `1.0-rc1` to `1.0` (see `FOUNDATION_VERSION.md`). Both rungs are closed. `FBL-003` is next; like every rung on this ladder, it requires its own separate, explicit operator authorization before it may begin — Foundation approval is not blanket authorization to proceed past it.
- `docs/archive/foundation-v0/` and `docs/04-future/registry.md` are **non-authoritative** for every rung below. No rung's deliverables, tests, or acceptance criteria may cite them as a requirements source.

---

## 1. Ladder overview table

| ID | Name | Depends on | Parallel group | One-line objective |
| --- | --- | --- | --- | --- |
| FBL-001 | Foundation audit resolution | — | — | Resolve (or formally reclassify) every BLOCKER/MAJOR audit finding by amending active docs |
| FBL-002 | Foundation 1.0 approval and freeze | FBL-001 | — | Closure matrix + fresh zero-finding audit + explicit approval promote baseline to approved `1.0` |
| FBL-003 | Monorepo and tooling foundation | FBL-002 | A | Scaffold workspace, package manager, lint/test tooling |
| FBL-004 | Frontend application scaffold | FBL-003 | A | Boot empty `apps/agent-city` Next.js app |
| FBL-005 | Ultrawide application shell | FBL-004 | — | Full-viewport region layout (bar, nav, world, intel, timeline, command) |
| FBL-006 | Panel framework | FBL-005 | — | Resizable/collapsible, keyboard-operable panel system |
| FBL-007 | Shared contracts | FBL-002 | A | Encode domain/event/world types in `packages/*` |
| FBL-008 | Deterministic mock runtime | FBL-007 | — | Replayable event engine incl. intentional failure and demo controls |
| FBL-009 | Event timeline | FBL-006, FBL-008 | B | Bottom chronological feed with filter/pause/inspect |
| FBL-010 | 2D operational controls | FBL-006, FBL-007, FBL-008 | B | Detail panels, approval card, command handling UI |
| FBL-011 | Empty React Three Fiber world | FBL-005 | — | Bootstrapped R3F canvas hosted in world region |
| FBL-012 | Camera and navigation | FBL-011 | C | Pan/zoom/orbit/focus/reset camera rig |
| FBL-013 | Lighting and environment | FBL-011 | C | Base environment, lighting, ground plane |
| FBL-014 | Lighthouse | FBL-011, FBL-007, FBL-008 | C | Governance institution object with state→visual mapping |
| FBL-015 | Object selection | FBL-011, FBL-014 | — | Pointer + keyboard selection framework, navigator sync |
| FBL-016 | Three residences | FBL-011, FBL-015 | D | Architect/Builder/Inspector residence objects |
| FBL-017 | Operational buildings | FBL-011, FBL-015 | D | Construction office, warehouse, QA, deployment dock, construction site |
| FBL-018 | Roads | FBL-011 | D | Permitted-route network between locations |
| FBL-019 | Utility vehicle | FBL-011, FBL-015, FBL-007 | D | Single transfer-visualization vehicle |
| FBL-020 | Agent representations | FBL-011, FBL-015, FBL-007 | D | Three agent objects with allowed-state visuals |
| FBL-021 | Event-to-world mapping | FBL-008, FBL-009, FBL-010, FBL-014, FBL-016, FBL-017, FBL-018, FBL-019, FBL-020 | — | Reducers binding mock events to visuals without false progress |
| FBL-022 | Complete simulated V1 workflow | FBL-021 | — | Full acceptance journey, including upgrade eligibility/approval/completion, runs end-to-end on mock runtime only |
| FBL-023 | Persistence foundation | FBL-007, FBL-022 | — | Thin authoritative store for entities/events |
| FBL-024 | Backend API | FBL-023 | — | Query/snapshot/health surface; command endpoints deny-by-default until FBL-025 |
| FBL-025 | State machines and prerequisite enforcement | FBL-024 | — | Server-side transition validators for all invariants |
| FBL-026 | Realtime event delivery | FBL-025 | — | SSE/WebSocket stream with reconnect/stale handling |
| FBL-027 | Runtime adapter boundary | FBL-025, FBL-026 | — | `packages/runtime-adapters` policy boundary; mock adapter behind it |
| FBL-028 | Controlled Claude Code execution | FBL-027 | — | One Builder stage runs via Claude Code behind the adapter |
| FBL-029 | Independent Inspector validation | FBL-025, FBL-026, FBL-010, FBL-028 | — | Wire Inspector-only `stage.validation_passed` path end-to-end |
| FBL-030 | Human approval workflow | FBL-025, FBL-026, FBL-010, FBL-029 | — | Request→resolve approval gate with Lighthouse signaling |
| FBL-031 | Capability-based upgrade | FBL-025, FBL-026, FBL-030, FBL-017 | — | Warehouse Level 1→2 from real metrics + approval |
| FBL-032 | Restart and recovery | FBL-023, FBL-026, FBL-031 | — | Reload/backend-restart reconstruction; disconnect/stale handling |
| FBL-033 | Accessibility and reduced motion | FBL-032 | E | Keyboard path, focus, color-independent status, reduced motion |
| FBL-034 | Ultrawide performance validation | FBL-032 | E | FPS, latency, virtualized feed at three target viewports |
| FBL-035 | Complete V1 acceptance verification | FBL-033, FBL-034 | — | Full `v1-acceptance.md` suite passes; V1 declared done |

Parallel groups are defined precisely in §4.

---

## 2. Rungs

### Phase A — Governance and foundation

#### FBL-001 — Foundation audit resolution — ✅ Complete

| Field | Content |
| --- | --- |
| 1. Rung | FBL-001 — Foundation audit resolution |
| 2. Objective | Resolve every BLOCKER finding, and either resolve or formally reclassify (with written, reviewed rationale) every MAJOR finding, in `docs/audits/foundry-foundation-v1-audit.md`, by amending active documents only. Silent deferral of a MAJOR is not a valid closure. |
| 3. Why this rung exists | The audit found 4 BLOCKER findings (B-01 workflow-order ambiguity, B-02 missing named BuildStage list, B-03 undefined `Revision` entity, B-04 undefined `Vehicle`/`AgentRun` entities) and 6 MAJOR findings that leave core workflow semantics unspecified. Building on an unresolved spec forces implementers to invent behavior, violating contract-first discipline (ADR-003) and backend-authority discipline (ADR-002). |
| 4. Prerequisites | Audit file exists at `docs/audits/foundry-foundation-v1-audit.md` (satisfied). No other precondition. |
| 5. Authoritative source documents | `docs/audits/foundry-foundation-v1-audit.md`; `docs/02-specification/domain-model.md`; `docs/02-specification/event-model.md`; `docs/02-specification/world-model.md`; `docs/02-specification/v1-acceptance.md`; `docs/01-mission/v1-scope.md`; `docs/01-mission/active-mission.md` |
| 6. Allowed work | Editing active documents under `docs/00-foundry/`, `docs/01-mission/`, `docs/02-specification/`, `docs/03-architecture/` to: (a) publish one canonical work→validate→approve→transfer→dock sequence (B-01); (b) enumerate named V1 `BuildStage`s, the stage carrying the intentional required failure, and the stage using `claude_code` (B-02); (c) define `Revision` as a domain entity with fields/lifecycle/events (B-03); (d) define `Vehicle` and `AgentRun` as domain entities (B-04); (e) resolve M-01 through M-06 per the audit's "Recommended next actions"; (f) where a MAJOR cannot be substantively resolved, draft a written reclassification rationale (e.g. downgrading it to MINOR/OPTIONAL) for review at FBL-002 — this is the only path by which a MAJOR may cease to block, never simple deferral. |
| 7. Explicitly prohibited work | Application code; dependency installation; scope expansion via `docs/04-future/registry.md`; resurrecting `docs/archive/foundation-v0/` as authority; introducing any excluded feature from `docs/01-mission/exclusions.md`. |
| 8. Expected files and deliverables | Amended: `docs/02-specification/domain-model.md`, `docs/02-specification/event-model.md`, `docs/02-specification/world-model.md`, `docs/01-mission/v1-scope.md` (or `active-mission.md`), `CHANGELOG.md`. If any MAJOR is reclassified rather than resolved, a written rationale recorded alongside the audit (e.g. an addendum under `docs/audits/`) is also required — this feeds FBL-002's closure matrix. |
| 9. Required automated tests | N/A — documentation-only rung. |
| 10. Required visual or operator validation | Operator (or designated reviewer) re-reads each amended section against its cited BLOCKER/MAJOR finding and confirms the ambiguity is gone. |
| 11. Acceptance criteria | All 4 BLOCKER findings and all 6 MAJOR findings (M-01–M-06) closed with a citable resolution in an active document, OR — for a MAJOR only — a written, reviewed reclassification rationale recorded as an audit addendum; no MAJOR is left silently deferred; no new contradictions introduced. |
| 12. Failure and rollback conditions | If a proposed resolution requires expanding V1 scope (adds a excluded feature) or contradicts a Principle in `docs/00-foundry/principles.md`, the resolution is rejected and rewritten. If a MAJOR is left open with no resolution and no written, reviewed reclassification rationale, this rung has not closed — it does not proceed to FBL-002 either way. |
| 13. Stop condition | Amendments committed; zero BLOCKER findings remain open and zero MAJOR findings remain open without either a resolution or a written, reviewed reclassification. Hard stop — do not proceed to freeze review in the same action. |
| 14. Dependency on next rung | FBL-002 cannot begin until this rung's stop condition is independently reviewed. |

#### FBL-002 — Foundation 1.0 approval and freeze — ✅ Complete

| Field | Content |
| --- | --- |
| 1. Rung | FBL-002 — Foundation 1.0 approval and freeze |
| 2. Objective | Formally promote the baseline from `1.0-rc1` to approved `1.0` (or a revised, re-audited rc) and unblock `docs/handoffs/002-frontend-foundation.md`. |
| 3. Why this rung exists | `FOUNDATION_VERSION.md` states promotion "requires reviewed audit and explicit approval." Without an explicit, recorded approval step, later rungs would implement against a baseline that was never certified stable. |
| 4. Prerequisites | FBL-001 stop condition reached: zero open BLOCKER findings and zero open MAJOR findings without a written, reviewed reclassification. |
| 5. Authoritative source documents | `FOUNDATION_VERSION.md`; `docs/handoffs/002-frontend-foundation.md`; `docs/handoffs/001-foundation-audit.md` (method reused for the fresh pass); `docs/audits/foundry-foundation-v1-audit.md`; `docs/03-architecture/implementation-plan.md` (Stage 2) |
| 6. Allowed work | (a) Building a closure matrix cross-referencing every BLOCKER (B-01–B-04) and MAJOR (M-01–M-06) to its citable resolution or reviewed reclassification from FBL-001; (b) performing a fresh consistency audit pass (reusing the `docs/handoffs/001-foundation-audit.md` method) against the FBL-001 amendments, recorded as a new dated revision or addendum under `docs/audits/`; (c) confirming that fresh revision shows zero open BLOCKER and zero open MAJOR findings; (d) updating `FOUNDATION_VERSION.md` status field to `1.0` only after (a)–(c); (e) recording explicit operator approval citing the fresh audit revision's date; (f) updating `CHANGELOG.md`; (g) removing the "BLOCKED" banner from `docs/handoffs/002-frontend-foundation.md`. |
| 7. Explicitly prohibited work | Any specification content change (that belongs to FBL-001); application code; dependency installs; promoting to `1.0` without a fresh post-amendment audit revision; approving based on the original 2026-07-28 audit alone. |
| 8. Expected files and deliverables | Closure matrix (B-01–B-04, M-01–M-06); a fresh audit revision/addendum under `docs/audits/` showing zero open BLOCKER/MAJOR findings; `FOUNDATION_VERSION.md` (status → `1.0`); `CHANGELOG.md` entry; `docs/handoffs/002-frontend-foundation.md` unblock notice. |
| 9. Required automated tests | N/A. |
| 10. Required visual or operator validation | Operator reviews the closure matrix against the fresh audit revision and records explicit sign-off (who approved, when, against which specific dated audit revision — not the original 2026-07-28 audit). |
| 11. Acceptance criteria | Closure matrix complete for B-01–B-04 and M-01–M-06; fresh audit revision recorded with zero open BLOCKER and zero open MAJOR findings; `FOUNDATION_VERSION.md` reads "Approved for implementation" or equivalent; implementation status is no longer "Blocked"; operator approval explicitly recorded against the fresh audit revision. |
| 12. Failure and rollback conditions | If the fresh audit surfaces any BLOCKER, any still-open MAJOR, or a new contradiction, freeze is rejected, baseline reverts to (or remains) `1.0-rc1`, and control returns to FBL-001 to address the specific finding(s); the closure matrix is updated on the next pass. |
| 13. Stop condition | Closure matrix complete, fresh zero-open-BLOCKER/MAJOR audit revision recorded, and `FOUNDATION_VERSION.md` updated and committed. Hard stop — no application code may be written in this action even though the gate is now open. |
| 14. Dependency on next rung | FBL-003 (and, in parallel, FBL-007) cannot begin until this rung's stop condition is reached. |

---

### Phase B — Repository, contracts, and 2D interface

#### FBL-003 — Monorepo and tooling foundation — ✅ Complete

| Field | Content |
| --- | --- |
| 1. Rung | FBL-003 — Monorepo and tooling foundation |
| 2. Objective | Establish workspace tooling (package manager, lint, typecheck, test runner wiring) across `apps/` and `packages/` without application logic. |
| 3. Why this rung exists | Every later rung depends on a working build/lint/test pipeline; establishing it once avoids divergent per-package tooling. |
| 4. Prerequisites | FBL-002 complete; Foundation status is `1.0`. |
| 5. Authoritative source documents | `docs/handoffs/002-frontend-foundation.md` (approved stack); `docs/03-architecture/implementation-plan.md` (Stage 3) |
| 6. Allowed work | Workspace config (package manager workspaces), shared TypeScript/ESLint/Prettier config, CI-equivalent scripts, empty package stubs retained. |
| 7. Explicitly prohibited work | Backend code; real AI/runtime integration; database; any `docs/04-future/registry.md` feature. |
| 8. Expected files and deliverables | Root package manifest and workspace config; shared `tsconfig`/lint config; `scripts/` entries for typecheck/lint/test. |
| 9. Required automated tests | Typecheck and lint smoke run clean on empty workspace. |
| 10. Required visual or operator validation | None (no UI yet). |
| 11. Acceptance criteria | `pnpm`/equivalent install succeeds; typecheck/lint scripts exit 0 on the empty tree. |
| 12. Failure and rollback conditions | If tooling choice conflicts with the approved stack in handoff 002, revert and re-select from the approved list only. |
| 13. Stop condition | Tooling scripts pass on an empty tree. Hard stop before any app code is scaffolded. |
| 14. Dependency on next rung | FBL-004 cannot begin until tooling is green. |

#### FBL-004 — Frontend application scaffold — 🔄 In progress (authorized, bounded sequence FBL-003–FBL-006)

| Field | Content |
| --- | --- |
| 1. Rung | FBL-004 — Frontend application scaffold |
| 2. Objective | Boot an empty `apps/agent-city` Next.js/TypeScript app with no meaningful UI. |
| 3. Why this rung exists | Separates "the app can run" from "the app has the ultrawide shell," so shell failures are diagnosable against a known-good boot. |
| 4. Prerequisites | FBL-003 complete. |
| 5. Authoritative source documents | `docs/handoffs/002-frontend-foundation.md`; `apps/agent-city/README.md` |
| 6. Allowed work | Next.js app initialization, base routing, Tailwind wiring, empty root page. |
| 7. Explicitly prohibited work | Backend; Claude Code/OpenClaw integration; database; external integrations; production 3D assets. |
| 8. Expected files and deliverables | `apps/agent-city/` app skeleton booting locally. |
| 9. Required automated tests | Build succeeds; typecheck/lint clean. |
| 10. Required visual or operator validation | Operator loads the app locally and confirms a blank page renders without console errors. |
| 11. Acceptance criteria | App boots empty shell locally (implementation-plan Stage 3 gate). |
| 12. Failure and rollback conditions | Boot failure blocks all downstream frontend rungs; fix scaffold before proceeding. |
| 13. Stop condition | Local boot confirmed. Hard stop before shell layout work. |
| 14. Dependency on next rung | FBL-005 and FBL-011 both depend on this rung. |

#### FBL-005 — Ultrawide application shell

| Field | Content |
| --- | --- |
| 1. Rung | FBL-005 — Ultrawide application shell |
| 2. Objective | Implement the full-viewport region layout: top system bar, left navigation, central world host, right live-intelligence, bottom timeline host, persistent command input strip. |
| 3. Why this rung exists | V-08 and ADR-005 require the ultrawide shell to use the full viewport with no app-wide max-width; this is foundational to every later visual rung. |
| 4. Prerequisites | FBL-004 complete. |
| 5. Authoritative source documents | `docs/02-specification/interface-model.md`; `docs/03-architecture/decisions/ADR-005-ultrawide-primary-interface.md`; `docs/03-architecture/implementation-plan.md` (Stage 4) |
| 6. Allowed work | Static region layout and responsive breakpoints for 5120×1440, 3840×1080, 2560×1440; region placeholders (no real data). |
| 7. Explicitly prohibited work | Interior building UIs as the sole control path; any app-wide `max-width` constraint on the primary shell. |
| 8. Expected files and deliverables | Shell layout components; responsive layout tests. |
| 9. Required automated tests | Layout snapshot/assertion tests at all three target viewports; assertion that no max-width wrapper exists on the primary shell. |
| 10. Required visual or operator validation | Operator visually confirms full-viewport usage and correct region proportions at all three resolutions (or emulated equivalents). |
| 11. Acceptance criteria | Shell acceptance tests green (implementation-plan Stage 4 gate); matches region proportions in `interface-model.md`. |
| 12. Failure and rollback conditions | Any mandatory region collapsing entirely at a supported viewport is a failure; revise breakpoints before proceeding. |
| 13. Stop condition | Shell layout tests green at all three viewports. Hard stop before panel behavior is added. |
| 14. Dependency on next rung | FBL-006 and FBL-011 depend on this rung. |

#### FBL-006 — Panel framework

| Field | Content |
| --- | --- |
| 1. Rung | FBL-006 — Panel framework |
| 2. Objective | Add collapse/resize/keyboard-operable behavior to the shell regions established in FBL-005. |
| 3. Why this rung exists | `interface-model.md` requires panels to be "collapsible and resizable" and all critical interactions to be keyboard-reachable; this behavior is shared infrastructure for every panel built afterward. |
| 4. Prerequisites | FBL-005 complete. |
| 5. Authoritative source documents | `docs/02-specification/interface-model.md`; `docs/02-specification/v1-acceptance.md` (keyboard/accessibility requirements) |
| 6. Allowed work | Generic collapse/resize/dock primitives in `packages/ui`; keyboard focus management; ARIA roles for panel regions. |
| 7. Explicitly prohibited work | Domain-specific panel content (belongs to FBL-009/FBL-010). |
| 8. Expected files and deliverables | `packages/ui` panel primitives; keyboard-navigation tests. |
| 9. Required automated tests | Keyboard-only navigation test reaching every panel; resize/collapse unit tests. |
| 10. Required visual or operator validation | Operator drives the shell with keyboard only and confirms visible focus and reachability. |
| 11. Acceptance criteria | Every mandatory region is collapsible/resizable (where applicable) and reachable without a pointer. |
| 12. Failure and rollback conditions | Any mandatory control unreachable by keyboard blocks progression; fix before proceeding. |
| 13. Stop condition | Keyboard-path test green. Hard stop before wiring real content. |
| 14. Dependency on next rung | FBL-009 and FBL-010 depend on this rung. |

#### FBL-007 — Shared contracts

| Field | Content |
| --- | --- |
| 1. Rung | FBL-007 — Shared contracts |
| 2. Objective | Encode the (now-amended) domain, event, and world models as shared TypeScript types/schemas in `packages/contracts`, `packages/event-types`, `packages/world-model`. |
| 3. Why this rung exists | ADR-003 requires frontend and backend to share contracts before either evolves features; encoding the specification as types is what makes "contract-first" enforceable rather than aspirational. |
| 4. Prerequisites | FBL-002 complete (specs frozen, including FBL-001's amendments — `Revision`, `Vehicle`, `AgentRun`, canonical workflow order, named BuildStages). |
| 5. Authoritative source documents | `docs/02-specification/domain-model.md`; `docs/02-specification/event-model.md`; `docs/02-specification/world-model.md`; `docs/03-architecture/decisions/ADR-003-contract-first-vertical-slices.md` |
| 6. Allowed work | Type/schema authoring in the three packages; schema unit tests; no runtime behavior. |
| 7. Explicitly prohibited work | Ad hoc UI-only types that diverge from the packages; any type modeling an excluded/Future-Registry concept. |
| 8. Expected files and deliverables | Populated `packages/contracts`, `packages/event-types`, `packages/world-model` (replacing the current placeholder READMEs). |
| 9. Required automated tests | Schema unit tests for every entity and event type, including the newly defined `Revision`, `Vehicle`, `AgentRun`. |
| 10. Required visual or operator validation | None (no UI). |
| 11. Acceptance criteria | Packages import cleanly into `apps/agent-city`; schema tests green (implementation-plan Stage 5 gate). |
| 12. Failure and rollback conditions | A contract that cannot express an acceptance requirement (e.g. idempotency key, correlation ID) is a failure; revise before proceeding. |
| 13. Stop condition | Packages published within the monorepo and imported successfully once. Hard stop before building the mock runtime on top of them. |
| 14. Dependency on next rung | FBL-008 depends on this rung; FBL-014/019/020 depend transitively. |

#### FBL-008 — Deterministic mock runtime

| Field | Content |
| --- | --- |
| 1. Rung | FBL-008 — Deterministic mock runtime |
| 2. Objective | Build a replayable, deterministic event engine that produces the full V1 event sequence — including the one intentional required-item failure and demo controls (start/pause/resume/speed/reset/replay) — using the contracts from FBL-007. |
| 3. Why this rung exists | ADR-001 requires frontend validation against a deterministic mock before a real runtime exists; F-01 requires demo controls that do not corrupt event order. |
| 4. Prerequisites | FBL-007 complete, including resolved M-01 (demo command/event contract) from FBL-001. |
| 5. Authoritative source documents | `docs/03-architecture/decisions/ADR-001-frontend-first-mock-runtime.md`; `docs/02-specification/event-model.md`; `docs/02-specification/v1-acceptance.md` (F-01, F-09) |
| 6. Allowed work | In-memory deterministic scheduler emitting typed events per contracts; command handlers for the bounded demo command set. |
| 7. Explicitly prohibited work | Treating mock outcomes as overriding backend authority once a backend exists (forward-looking constraint recorded here, enforced at FBL-023+); any command outside the bounded V1 command set. |
| 8. Expected files and deliverables | Mock runtime module (location TBD by FBL-003 tooling conventions, e.g. `packages/runtime-adapters` mock implementation or app-local mock service); deterministic fixture/script for the full demo sequence. |
| 9. Required automated tests | Deterministic ordering test (same seed → same sequence); idempotent-duplicate test (replaying an event ID does not duplicate state). |
| 10. Required visual or operator validation | None yet (no UI consumes it until FBL-009/010/021). |
| 11. Acceptance criteria | Demo script completes headlessly (implementation-plan Stage 6 gate); F-01 and F-09 satisfied at the engine level. |
| 12. Failure and rollback conditions | Nondeterministic ordering on repeated runs is a failure; fix before proceeding. |
| 13. Stop condition | Headless demo script completes reliably. Hard stop before wiring any UI to it. |
| 14. Dependency on next rung | FBL-009, FBL-010, FBL-014, FBL-019, FBL-020, FBL-021 depend on this rung. |

#### FBL-009 — Event timeline

| Field | Content |
| --- | --- |
| 1. Rung | FBL-009 — Event timeline |
| 2. Objective | Implement the bottom chronological event feed: filter by severity/entity/type, pause autoscroll, payload inspection, jump-to-world-object, history after reload. |
| 3. Why this rung exists | Principle 24 requires every meaningful animation to have a textual equivalent in the event feed; the timeline is the primary such surface. |
| 4. Prerequisites | FBL-006 and FBL-008 complete. |
| 5. Authoritative source documents | `docs/02-specification/interface-model.md` ("Bottom event timeline"); `docs/02-specification/event-model.md` |
| 6. Allowed work | Feed component bound to the mock runtime's event stream; filtering/pausing/inspection UI. |
| 7. Explicitly prohibited work | Backend-only data assumptions (must work against the mock stream identically to how it will work against real events later). |
| 8. Expected files and deliverables | Timeline panel component and tests. |
| 9. Required automated tests | Rendering test for a fixed event fixture; filter/pause interaction tests; virtualization test with a large synthetic event count. |
| 10. Required visual or operator validation | Operator confirms events appear in order, are filterable, and payloads are inspectable. |
| 11. Acceptance criteria | Timeline renders the full mock demo sequence correctly ordered and filterable. |
| 12. Failure and rollback conditions | Any dropped or reordered event in the feed relative to the source stream is a failure. |
| 13. Stop condition | Timeline passes its tests against the mock stream. Hard stop before mapping events onto the 3D world (FBL-021). |
| 14. Dependency on next rung | FBL-021 depends on this rung. |

#### FBL-010 — 2D operational controls

| Field | Content |
| --- | --- |
| 1. Rung | FBL-010 — 2D operational controls |
| 2. Objective | Implement selected-object detail panels, the approval card, blocker/requirement views, and command-bar handling so an operator can inspect and act without the 3D world. |
| 3. Why this rung exists | Principle 23 requires critical controls and facts to remain available outside the 3D world; F-02/F-06/F-07 depend on this surface. |
| 4. Prerequisites | FBL-006, FBL-007, FBL-008 complete. |
| 5. Authoritative source documents | `docs/02-specification/interface-model.md` ("Selected-object details", "Approval interaction", "Persistent command input"); `docs/02-specification/v1-acceptance.md` (F-02, F-06, F-07) |
| 6. Allowed work | Detail panel, approval card (Approve/Reject/Request revision), command-bar handlers for the bounded V1 command set. |
| 7. Explicitly prohibited work | Unrestricted natural-language shell execution from the command bar; any command outside the bounded set. |
| 8. Expected files and deliverables | Detail panel, approval card, command bar components and tests. |
| 9. Required automated tests | Keyboard-path test for approval actions; command handling emits correctly typed commands; rejected-command display test. |
| 10. Required visual or operator validation | Operator can inspect blockers/approvals and issue bounded commands entirely without the 3D world. |
| 11. Acceptance criteria | Operator can inspect blockers/approvals without 3D (implementation-plan Stage 7 gate). |
| 12. Failure and rollback conditions | Any critical control reachable only through the 3D world is a failure per Principle 23. |
| 13. Stop condition | 2D controls pass keyboard-path and command-emission tests against the mock runtime. Hard stop before event-to-world mapping. |
| 14. Dependency on next rung | FBL-021 depends on this rung. |

---

### Phase C — 3D neighborhood

#### FBL-011 — Empty React Three Fiber world

| Field | Content |
| --- | --- |
| 1. Rung | FBL-011 — Empty React Three Fiber world |
| 2. Objective | Bootstrap an R3F canvas hosted in the shell's world region with no scene content. |
| 3. Why this rung exists | ADR-004 selects R3F as the initial renderer; validating the canvas mounts and coexists with the React shell before populating it isolates rendering-pipeline problems from content problems. |
| 4. Prerequisites | FBL-005 complete. |
| 5. Authoritative source documents | `docs/03-architecture/decisions/ADR-004-react-three-fiber.md`; `docs/02-specification/interface-model.md` ("Central 3D world") |
| 6. Allowed work | R3F/Three.js/Drei wiring; empty `<Canvas>` mounted in the world host region; resize handling. |
| 7. Explicitly prohibited work | Any placeholder geometry (belongs to later rungs); photorealistic/production assets. |
| 8. Expected files and deliverables | Empty canvas component mounted in the shell. |
| 9. Required automated tests | Canvas mounts without console/WebGL errors; resize test across the three target viewports. |
| 10. Required visual or operator validation | Operator confirms a blank 3D viewport renders inside the correct shell region at all three viewports. |
| 11. Acceptance criteria | Canvas boots cleanly and resizes correctly. |
| 12. Failure and rollback conditions | WebGL context failures on any target browser (current Chrome/Safari) block progression. |
| 13. Stop condition | Empty canvas confirmed stable. Hard stop before adding any object. |
| 14. Dependency on next rung | FBL-012, FBL-013, FBL-014, FBL-018 depend on this rung. |

#### FBL-012 — Camera and navigation

| Field | Content |
| --- | --- |
| 1. Rung | FBL-012 — Camera and navigation |
| 2. Objective | Implement pan, zoom, controlled orbit, focus-on-selection, reset, and optional saved viewpoints. |
| 3. Why this rung exists | `world-model.md` requires the camera to never become lost and to respect reduced motion; this is shared infrastructure every world object rung depends on for "focus selection" behavior. |
| 4. Prerequisites | FBL-011 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("World camera"); `docs/02-specification/interface-model.md` ("Central 3D world") |
| 6. Allowed work | Camera rig and controls against the empty scene (a test/reference object may be used transiently and removed). |
| 7. Explicitly prohibited work | Binding camera behavior to real object selection (belongs to FBL-015). |
| 8. Expected files and deliverables | Camera control module and tests. |
| 9. Required automated tests | Camera cannot exceed defined bounds test; reset returns to canonical viewpoint. |
| 10. Required visual or operator validation | Operator confirms pan/zoom/orbit/reset feel correct and the camera cannot go "lost" off-scene. |
| 11. Acceptance criteria | Camera behavior matches `world-model.md` "World camera" section. |
| 12. Failure and rollback conditions | Camera able to leave the neighborhood bounds or clip through the ground plane is a failure. |
| 13. Stop condition | Camera rig passes bounds/reset tests. Hard stop. |
| 14. Dependency on next rung | FBL-015 depends on this rung (via FBL-011). |

#### FBL-013 — Lighting and environment

| Field | Content |
| --- | --- |
| 1. Rung | FBL-013 — Lighting and environment |
| 2. Objective | Establish base lighting, sky/environment, and ground plane for the neighborhood. |
| 3. Why this rung exists | World objects added in later rungs need a coherent, readable environment; establishing it once avoids per-object lighting rework. |
| 4. Prerequisites | FBL-011 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` (global rules: "Readable at 5120×1440, 3840×1080, and 2560×1440") |
| 6. Allowed work | Ambient/directional lighting, environment map or sky, ground plane geometry. |
| 7. Explicitly prohibited work | Photorealistic assets; weather (excluded feature). |
| 8. Expected files and deliverables | Environment/lighting module. |
| 9. Required automated tests | Render smoke test (scene renders without errors) at target viewports. |
| 10. Required visual or operator validation | Operator confirms objects will be readable (contrast/legibility check) once placed. |
| 11. Acceptance criteria | Environment renders consistently across target viewports. |
| 12. Failure and rollback conditions | Lighting that makes state colors indistinguishable is a failure (conflicts with "color never sole status signal" once objects are added). |
| 13. Stop condition | Environment confirmed stable. Hard stop. |
| 14. Dependency on next rung | None directly (supports all Phase C object rungs). |

#### FBL-014 — Lighthouse

| Field | Content |
| --- | --- |
| 1. Rung | FBL-014 — Lighthouse |
| 2. Objective | Add the Lighthouse governance institution object with its full allowed-state visual mapping. |
| 3. Why this rung exists | The Lighthouse is the global observation/approval/escalation surface; V-06 requires its states to be distinct and labeled, and later approval/upgrade rungs depend on it existing. |
| 4. Prerequisites | FBL-011, FBL-007, FBL-008 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Lighthouse"); `docs/02-specification/event-model.md` (`system.*`, `approval.*`, `building.state_changed`) |
| 6. Allowed work | Placeholder geometry for the Lighthouse; state→visual mapping for `healthy`/`active`/`attention_required`/`degraded`/`critical`/`disconnected`; accessible name/state. |
| 7. Explicitly prohibited work | Any implication that the Lighthouse performs project implementation work (Principle 22); building interiors. |
| 8. Expected files and deliverables | Lighthouse world component; state-mapping tests. |
| 9. Required automated tests | Unit test mapping each allowed state to a distinct visual signal (not color-only). |
| 10. Required visual or operator validation | Operator confirms all six states are visually and textually distinguishable. |
| 11. Acceptance criteria | V-06 satisfied at the object level (states distinct and labeled). |
| 12. Failure and rollback conditions | Any two states sharing an identical signal (color-only difference) is a failure. |
| 13. Stop condition | State-mapping tests green. Hard stop. |
| 14. Dependency on next rung | FBL-015 depends on this rung. |

#### FBL-015 — Object selection

| Field | Content |
| --- | --- |
| 1. Rung | FBL-015 — Object selection |
| 2. Objective | Build the pointer + keyboard selection framework and its sync with the left-navigation navigator, generalized so every subsequent world object plugs into it. |
| 3. Why this rung exists | F-02 requires every building/agent to be selectable by pointer and keyboard with navigator sync; building this once (against the Lighthouse as the first real object) avoids re-deriving it per object. |
| 4. Prerequisites | FBL-011, FBL-014 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Object selection"); `docs/02-specification/event-model.md` (`building.selected`); `docs/02-specification/v1-acceptance.md` (F-02) |
| 6. Allowed work | Selection hit-testing, keyboard focus traversal across world objects, navigator↔canvas sync, `building.selected` UI-facing emission (non-operational). |
| 7. Explicitly prohibited work | Treating selection as an operational-truth mutation; a selection event that affects backend state. |
| 8. Expected files and deliverables | Selection framework module and tests, applied first to the Lighthouse. |
| 9. Required automated tests | Selection hit-target test; keyboard traversal test; navigator-sync test. |
| 10. Required visual or operator validation | Operator selects the Lighthouse via pointer and via keyboard and confirms the detail panel and navigator both sync. |
| 11. Acceptance criteria | F-02 satisfied for the Lighthouse; framework is generic enough to extend to remaining objects without rework. |
| 12. Failure and rollback conditions | Selection that silently fails on keyboard-only input is a failure. |
| 13. Stop condition | Selection framework tests green against the Lighthouse. Hard stop. |
| 14. Dependency on next rung | FBL-016, FBL-017, FBL-019, FBL-020 depend on this rung. |

#### FBL-016 — Three residences

| Field | Content |
| --- | --- |
| 1. Rung | FBL-016 — Three residences |
| 2. Objective | Add Architect, Builder, and Inspector residence objects with occupancy/vacant/paused/degraded visual states. |
| 3. Why this rung exists | Residences represent persistent worker identity (Principle 7) and are required world elements in `v1-scope.md`. |
| 4. Prerequisites | FBL-011, FBL-015 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Architect / Builder / Inspector residences"); `docs/01-mission/v1-scope.md` |
| 6. Allowed work | Placeholder geometry for three residences; occupancy/vacant/unavailable/paused/degraded visual states; selection wiring via FBL-015. |
| 7. Explicitly prohibited work | Building interiors; representing active work at a residence (never a workplace). |
| 8. Expected files and deliverables | Three residence world components; selection and state-mapping tests. |
| 9. Required automated tests | Selection hit-target tests for all three; state-mapping unit tests. |
| 10. Required visual or operator validation | Operator confirms all three residences are visually distinct, selectable, and never show "active work." |
| 11. Acceptance criteria | Required world elements checklist (residences) satisfied per `v1-scope.md`. |
| 12. Failure and rollback conditions | A residence showing implementation/validation activity is a failure (violates its "never represents" rule). |
| 13. Stop condition | All three residences selectable and state-correct. Hard stop. |
| 14. Dependency on next rung | FBL-021 depends on this rung (transitively via "all world objects present"). |

#### FBL-017 — Operational buildings

| Field | Content |
| --- | --- |
| 1. Rung | FBL-017 — Operational buildings |
| 2. Objective | Add Construction Office, Warehouse, QA building, Deployment Dock, and Construction Site with their full allowed-state visual mappings. |
| 3. Why this rung exists | These are the required workplace/institution/project-representation elements of the V1 neighborhood; every backend workflow rung later needs a visual target to reconcile against. |
| 4. Prerequisites | FBL-011, FBL-015 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Construction office", "Warehouse", "QA building", "Deployment dock", "Construction site"); `docs/01-mission/v1-scope.md` |
| 6. Allowed work | Placeholder geometry and state-mapping for all five buildings; selection wiring via FBL-015; Warehouse Level 1 and Level 2 geometry variants, with the Level 2 variant rendered only in direct response to an `upgrade.completed` event (mock-authorized at FBL-022, backend-authorized at FBL-031). |
| 7. Explicitly prohibited work | Building interiors as a required control path; rendering the Warehouse Level 2 visual in the absence of an `upgrade.completed` event, regardless of whether the event's authority is mock or backend. |
| 8. Expected files and deliverables | Five building world components; selection and state-mapping tests. |
| 9. Required automated tests | Selection hit-target tests for all five; state-mapping unit tests per building's allowed states. |
| 10. Required visual or operator validation | Operator confirms all five buildings are visually distinct, selectable, and legible at target viewports. |
| 11. Acceptance criteria | Required world elements checklist (buildings) satisfied per `v1-scope.md`. |
| 12. Failure and rollback conditions | Any building implying capability it does not have (e.g. Warehouse showing Level 2 geometry) is a failure. |
| 13. Stop condition | All five buildings selectable and state-correct. Hard stop. |
| 14. Dependency on next rung | FBL-021, FBL-031 depend on this rung. |

#### FBL-018 — Roads

| Field | Content |
| --- | --- |
| 1. Rung | FBL-018 — Roads |
| 2. Objective | Add the small permitted-route road network connecting homes↔office, office↔warehouse, warehouse↔QA, QA↔dock, with visibility to the Lighthouse. |
| 3. Why this rung exists | Principle 12 requires roads to show permitted routes without ever authorizing a transfer; this is required scaffolding for the utility vehicle (FBL-019). |
| 4. Prerequisites | FBL-011 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Road network") |
| 6. Allowed work | Static road geometry; available/highlighted/inactive visual states responsive to `transfer.*` (wired functionally in FBL-021; geometry only here). |
| 7. Explicitly prohibited work | Complex traffic (excluded feature); using road highlighting as proof a transfer exists. |
| 8. Expected files and deliverables | Road network world component. |
| 9. Required automated tests | Render/geometry smoke test connecting the required location pairs. |
| 10. Required visual or operator validation | Operator confirms the road graph visually connects the correct buildings. |
| 11. Acceptance criteria | Required world elements checklist (road network) satisfied. |
| 12. Failure and rollback conditions | A road implying a route that does not exist in `world-model.md`'s relationship list is a failure. |
| 13. Stop condition | Road geometry confirmed. Hard stop. |
| 14. Dependency on next rung | FBL-019, FBL-021 depend on this rung. |

#### FBL-019 — Utility vehicle

| Field | Content |
| --- | --- |
| 1. Rung | FBL-019 — Utility vehicle |
| 2. Objective | Add the single utility vehicle object with its allowed states (parked, waiting, loading, in transit, unloading, completed, failed), grounded in the `Vehicle` entity defined in FBL-001. |
| 3. Why this rung exists | Principle 12: vehicles visualize transfers and never authorize them; V-05 requires the vehicle cannot depart before `transfer.started`. |
| 4. Prerequisites | FBL-011, FBL-015, FBL-007 complete (the last for the `Vehicle` contract type). |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Utility vehicle"); `docs/02-specification/domain-model.md` (`Vehicle`, post-FBL-001 amendment); `docs/02-specification/v1-acceptance.md` (V-05) |
| 6. Allowed work | Placeholder vehicle geometry and state visuals; selection wiring; motion logic stubbed but inert (no motion trigger until FBL-021). |
| 7. Explicitly prohibited work | Any motion not gated by `transfer.started` once event mapping exists; treating vehicle state as transfer authorization. |
| 8. Expected files and deliverables | Vehicle world component and state-mapping tests. |
| 9. Required automated tests | State-mapping unit test; a test asserting no motion occurs absent a `transfer.started` event (meaningful once FBL-021 wires it — stub assertion here). |
| 10. Required visual or operator validation | Operator confirms the vehicle is selectable and shows the "parked" state by default. |
| 11. Acceptance criteria | Required world elements checklist (utility vehicle) satisfied. |
| 12. Failure and rollback conditions | Vehicle rendered "in transit" without a triggering event is a failure. |
| 13. Stop condition | Vehicle selectable and defaults to parked. Hard stop. |
| 14. Dependency on next rung | FBL-021 depends on this rung. |

#### FBL-020 — Agent representations

| Field | Content |
| --- | --- |
| 1. Rung | FBL-020 — Agent representations |
| 2. Objective | Add the three agent objects (Architect, Builder, Inspector) with their full allowed-state visuals (idle, assigned, traveling, working, waiting, paused, failed, offline). |
| 3. Why this rung exists | Agents are required workers per `v1-scope.md`; every subsequent workflow rung needs a visual agent to reconcile against. |
| 4. Prerequisites | FBL-011, FBL-015, FBL-007 complete. |
| 5. Authoritative source documents | `docs/02-specification/world-model.md` ("Architect / Builder / Inspector agents"); `docs/02-specification/domain-model.md` (`Agent`) |
| 6. Allowed work | Simple low-poly/icon agent geometry; state-mapping for all eight allowed states; selection wiring. |
| 7. Explicitly prohibited work | Decorative citizens/NPCs (excluded feature); more than three agents; any role beyond Architect/Builder/Inspector. |
| 8. Expected files and deliverables | Three agent world components; state-mapping tests. |
| 9. Required automated tests | Selection hit-target tests for all three; state-mapping unit tests for all eight allowed states. |
| 10. Required visual or operator validation | Operator confirms all three agents are visually distinct, selectable, and distinguishable across all eight states. |
| 11. Acceptance criteria | Required workers checklist satisfied per `v1-scope.md`. |
| 12. Failure and rollback conditions | An agent occupying two locations simultaneously (even visually) is a failure — this invariant is enforced for real starting at FBL-025, but the visual layer must not imply it here either. |
| 13. Stop condition | All three agents selectable and state-correct. Hard stop. |
| 14. Dependency on next rung | FBL-021 depends on this rung. |

---

### Phase D — Simulated integration

#### FBL-021 — Event-to-world mapping

| Field | Content |
| --- | --- |
| 1. Rung | FBL-021 — Event-to-world mapping |
| 2. Objective | Wire the mock runtime's event stream (FBL-008) to every 2D surface (FBL-009/010) and every 3D object (FBL-014/016–020) via reducers, so meaningful animation only ever follows a declared event. |
| 3. Why this rung exists | Principles 4–5: meaningful animations require declared events; ambient animation cannot imply false activity. This is the rung where "representation vs. simulation" (`vision.md`) becomes real. |
| 4. Prerequisites | FBL-008, FBL-009, FBL-010, FBL-014, FBL-016, FBL-017, FBL-018, FBL-019, FBL-020 complete. |
| 5. Authoritative source documents | `docs/02-specification/event-model.md` ("Traceability requirement"); `docs/02-specification/world-model.md`; `docs/02-specification/v1-acceptance.md` (V-02–V-05) |
| 6. Allowed work | Reducers/projections per event type; visual-state maps; feed templates; reduced-motion cross-fade alternative to travel/work animation. |
| 7. Explicitly prohibited work | Any animation-authorized state change (e.g. a transfer "completing" because a loading animation finished); any event without a reducer, feed template, and visual mapping (or explicit "no visual change"). |
| 8. Expected files and deliverables | Reducer/projection layer; per-event test matrix satisfying the event-model "Traceability requirement." |
| 9. Required automated tests | Per-event: reducer test, idempotent-duplicate test, and (per Traceability requirement) at least one automated test per mutating event type. Reduced-motion variant test. |
| 10. Required visual or operator validation | Operator runs the mock demo and confirms: cargo stays unsealed while the intentional requirement failure is active (V-04); the vehicle does not move before `transfer.started` (V-05); every animation has a feed/detail text equivalent (V-03). |
| 11. Acceptance criteria | V-02 through V-05 satisfied on the mock runtime; intentional failure keeps cargo/vehicle gated (implementation-plan Stage 9 gate). |
| 12. Failure and rollback conditions | Any observed false-progress animation (motion/completion without a backing event) is a failure and blocks FBL-022. |
| 13. Stop condition | All mock-driven visuals pass their event-traceability tests. Hard stop before attempting the full workflow run. |
| 14. Dependency on next rung | FBL-022 depends on this rung. |

#### FBL-022 — Complete simulated V1 workflow

| Field | Content |
| --- | --- |
| 1. Rung | FBL-022 — Complete simulated V1 workflow |
| 2. Objective | Run the entire `v1-acceptance.md` "Primary user journey" end-to-end on the mock runtime only, with no backend — including Warehouse upgrade eligibility, operator approval, upgrade completion, and the synchronized visual + capability change — and confirm it matches the specification exactly. |
| 3. Why this rung exists | ADR-001's revisit condition is "after the complete V1 demo works and contracts stabilize" — this rung is that checkpoint. Per M-05, the mock engine is the stand-in authority pre-backend, so "complete" means the full journey including the upgrade (mission steps 16–19, journey step 14), not just the portions reachable without persistence. It de-risks backend investment by proving the frontend/contract/world layers are correct — including the upgrade path — before they become expensive to change. |
| 4. Prerequisites | FBL-021 complete. |
| 5. Authoritative source documents | `docs/02-specification/v1-acceptance.md` ("Primary user journey", all F-/V- items reachable without a backend, F-11/V-07); `docs/01-mission/v1-scope.md` ("Required workflow", steps 16–19); `docs/02-specification/domain-model.md` ("Warehouse Level 2 prerequisites") |
| 6. Allowed work | End-to-end fixture/script driving the mock runtime through objective submission → planning → assignment → incremental requirements → intentional failure → retry/repair → independent validation → transfer-ready → approval → completion → upgrade eligibility → operator approval of the upgrade → mock-authorized `upgrade.started`/`upgrade.completed` with atomic capacity (25→100) and visual-level change. |
| 7. Explicitly prohibited work | Standing up any backend service, database, or persistence (that is FBL-023); starting Claude Code integration; treating this mock-authorized upgrade as satisfying F-11/V-07 against real backend authority — FBL-031 must still re-prove the same behavior under real persistence and a real operator approval. |
| 8. Expected files and deliverables | End-to-end demo test/script covering the full journey through upgrade completion; a recorded run artifact (for later comparison once the backend exists, including at FBL-031). |
| 9. Required automated tests | One full end-to-end scripted run reproducing every "Primary user journey" step, including a test asserting Warehouse capacity and visual level change together only after the mock's `upgrade.completed` (V-07 proved on the mock engine). |
| 10. Required visual or operator validation | Operator watches the full demo live and confirms ten-second comprehension (V-01) at each major transition: what is running, who is working, what is blocked, what failed, what needs approval, what completed, what should happen next — and confirms the Warehouse Level 2 model and capacity appear together only after the mock upgrade is approved and completed. |
| 11. Acceptance criteria | Full journey — including upgrade eligibility, approval, completion, and synchronized visual/capability change — completes with correct sequencing, no false progress, and V-01/V-07 satisfied on the mock runtime. |
| 12. Failure and rollback conditions | Any journey step producing a result inconsistent with `v1-acceptance.md` returns work to the relevant Phase B/C/D rung — this rung does not patch symptoms locally. |
| 13. Stop condition | Full mock-only journey passes and is operator-observed. Hard stop — no backend work begins in the same action. |
| 14. Dependency on next rung | FBL-023 depends on this rung. |

---

### Phase E — Backend operational authority

#### FBL-023 — Persistence foundation

| Field | Content |
| --- | --- |
| 1. Rung | FBL-023 — Persistence foundation |
| 2. Objective | Build a thin authoritative store for all domain entities and the append-only event log, with a snapshot/reconciliation API. |
| 3. Why this rung exists | ADR-002: backend state must own operational truth durably across refresh/disconnect; this is the first rung where truth becomes persisted rather than in-memory mock state. |
| 4. Prerequisites | FBL-007 complete; FBL-022 complete (frontend/contracts proven before backend investment, per ADR-001 revisit condition). |
| 5. Authoritative source documents | `docs/03-architecture/decisions/ADR-002-backend-operational-authority.md`; `docs/02-specification/domain-model.md`; `docs/02-specification/event-model.md` |
| 6. Allowed work | Entity and event storage; snapshot construction; `ReconcileFromSnapshot`/`ApplyEvent` per `WorldState`. |
| 7. Explicitly prohibited work | Any frontend-writable operational table; exposing mutation without going through FBL-024/025. |
| 8. Expected files and deliverables | Backend persistence module/service; snapshot API. |
| 9. Required automated tests | Reload-reconstruction tests (F-08): entities and events survive process restart and reconstruct an identical `WorldState`. |
| 10. Required visual or operator validation | None yet (no UI wired to it). |
| 11. Acceptance criteria | F-08 persistence tests pass (implementation-plan Stage 10 gate). |
| 12. Failure and rollback conditions | Any data loss across a simulated restart is a failure. |
| 13. Stop condition | Persistence/reload tests green. Hard stop before exposing an API. |
| 14. Dependency on next rung | FBL-024 depends on this rung. |

#### FBL-024 — Backend API

| Field | Content |
| --- | --- |
| 1. Rung | FBL-024 — Backend API |
| 2. Objective | Expose a query/snapshot/health surface over the persistence layer, plus contract-shaped command endpoints that are deny-by-default: every command is accepted for shape validation only and structurally cannot mutate persisted state until FBL-025 supplies real invariant enforcement. |
| 3. Why this rung exists | Separating "an API exists" from "the API enforces the rules" makes each rung's tests attributable to one concern — but that separation must never create a window where a mutation reaches persisted state without invariant checking. Deny-by-default closes that window. |
| 4. Prerequisites | FBL-023 complete. |
| 5. Authoritative source documents | `docs/02-specification/domain-model.md` (Commands per entity, `WorldState`); `docs/02-specification/event-model.md` (`operator.command_submitted`/`_accepted`/`_rejected`) |
| 6. Allowed work | Query endpoints (snapshot/`WorldState` reads); a health endpoint; command endpoints that validate request shape against `packages/contracts` and then respond with a structured "enforcement not yet available" rejection (reusing the `operator.command_rejected` shape) — no command endpoint writes to persistence at this rung. |
| 7. Explicitly prohibited work | Bypassing contracts with ad hoc payload shapes; any command handler that writes to or mutates persisted state; enabling any mutation path by default; implementing invariant enforcement here (that is FBL-025's job, not a pass-through). |
| 8. Expected files and deliverables | Backend API module (query/snapshot/health + deny-by-default command stubs) and integration tests. |
| 9. Required automated tests | Contract-conformance tests for query/snapshot/health responses; a deny-by-default test suite proving every command endpoint leaves persisted state byte-for-byte unchanged regardless of payload. |
| 10. Required visual or operator validation | None (verified by the deny-by-default automated test suite; see §6 for the corresponding security gate). |
| 11. Acceptance criteria | Query/snapshot/health endpoints callable end-to-end against persistence with correct contract shapes; every command endpoint exists, validates shape, and structurally cannot mutate persisted state. |
| 12. Failure and rollback conditions | A response shape diverging from `packages/contracts` is a failure; any command endpoint that succeeds in mutating persisted state at this rung is a critical failure and blocks FBL-025. |
| 13. Stop condition | Contract-conformance tests green and deny-by-default suite proves zero mutation is possible through the API. Hard stop before invariant enforcement. |
| 14. Dependency on next rung | FBL-025 depends on this rung. |

#### FBL-025 — State machines and prerequisite enforcement

| Field | Content |
| --- | --- |
| 1. Rung | FBL-025 — State machines and prerequisite enforcement |
| 2. Objective | Implement server-side transition validators for Agent, Building, Project, Build, BuildStage, Requirement, Task, Artifact, Transfer, Approval, and Upgrade — including the `Revision` path defined in FBL-001 — enforcing every invariant in `domain-model.md`. |
| 3. Why this rung exists | This is where "backend state owns operational truth" (Principle 1) becomes enforceable rather than assumed; F-03/F-04/F-07 are meaningless without it. |
| 4. Prerequisites | FBL-024 complete. |
| 5. Authoritative source documents | `docs/02-specification/domain-model.md` ("Required invariants" and every entity's Invariants/Commands); `docs/02-specification/v1-acceptance.md` (F-03, F-04, F-07, F-09) |
| 6. Allowed work | Transition validators rejecting illegal state changes with structured errors; idempotent duplicate-event handling; mandatory-requirement gating; Revision reopening path for completed→running. |
| 7. Explicitly prohibited work | Waiving mandatory requirements; allowing frontend commands to force completion/transfer/approval/upgrade directly. |
| 8. Expected files and deliverables | State-machine/validator modules per entity; invariant test suite. |
| 9. Required automated tests | F-03, F-04, F-09 test suites; one invalid-transition test per entity proving structured rejection with no mutation. |
| 10. Required visual or operator validation | None yet (validated via API-level tests; UI wiring happens as later rungs consume it). |
| 11. Acceptance criteria | Invalid transitions rejected structurally for every entity (implementation-plan Stage 11 gate). |
| 12. Failure and rollback conditions | Any illegal transition that succeeds is a failure and blocks every downstream rung. |
| 13. Stop condition | Full invariant suite green. Hard stop before realtime delivery. |
| 14. Dependency on next rung | FBL-026 depends on this rung. |

#### FBL-026 — Realtime event delivery

| Field | Content |
| --- | --- |
| 1. Rung | FBL-026 — Realtime event delivery |
| 2. Objective | Stream backend events to the frontend over SSE or WebSockets with reconnect and stale/disconnected labeling. |
| 3. Why this rung exists | F-10 requires disconnect to disable mutation controls and show a stale banner, then reconcile on restore; this rung is the transport that makes the frontend a live projection of backend truth rather than a poll-based approximation. |
| 4. Prerequisites | FBL-025 complete. |
| 5. Authoritative source documents | `docs/02-specification/interface-model.md` ("Connection / stale state"); `docs/02-specification/v1-acceptance.md` (F-10, performance latency budget) |
| 6. Allowed work | Streaming transport; client reconnect/backoff; snapshot reconciliation on reconnect; connection-state UI wiring (Lighthouse `disconnected`, stale banner). |
| 7. Explicitly prohibited work | Client inventing events as truth during disconnect; silently discarding missed events instead of reconciling from snapshot. |
| 8. Expected files and deliverables | Streaming server module; client subscription hook; reconnect/reconciliation tests. |
| 9. Required automated tests | F-10 disconnect/restore test; update-latency test against the <500 ms local-network budget. |
| 10. Required visual or operator validation | Operator disconnects network, confirms Lighthouse shows `disconnected` and mutation controls disable, then restores and confirms reconciliation. |
| 11. Acceptance criteria | Stale/disconnect UX verified (implementation-plan Stage 12 gate). |
| 12. Failure and rollback conditions | Any mutation control remaining enabled while disconnected is a failure. |
| 13. Stop condition | F-10 test suite green and operator-observed. Hard stop before the runtime adapter boundary. |
| 14. Dependency on next rung | FBL-027, FBL-029, FBL-030, FBL-031, FBL-032 depend on this rung. |

---

### Phase F — Runtime execution and governance workflows

#### FBL-027 — Runtime adapter boundary

| Field | Content |
| --- | --- |
| 1. Rung | FBL-027 — Runtime adapter boundary |
| 2. Objective | Implement the `packages/runtime-adapters` policy boundary (controlled repository paths, command allowlist, timeouts, structured log/evidence capture) with a `mock` adapter running behind it. |
| 3. Why this rung exists | ADR-006: external runtimes must never couple directly to the frontend or bypass policy; this boundary is a prerequisite for safely introducing Claude Code in FBL-028. |
| 4. Prerequisites | FBL-025, FBL-026 complete. |
| 5. Authoritative source documents | `docs/03-architecture/decisions/ADR-006-runtime-adapter-boundary.md`; `docs/02-specification/domain-model.md` (`AgentRun`, per FBL-001 amendment) |
| 6. Allowed work | Adapter interface; policy types (allowlist/denylist, timeout); structured result/log/evidence capture; `mock` adapter implementation reusing FBL-008's engine behind the same interface. |
| 7. Explicitly prohibited work | Frontend direct runtime invocation; any OpenClaw integration beyond what ADR-006 and exclusions permit (none in V1). |
| 8. Expected files and deliverables | `packages/runtime-adapters` implementation; adapter contract tests. |
| 9. Required automated tests | Policy allow/deny tests; timeout test; log/evidence capture shape tests. |
| 10. Required visual or operator validation | None yet (no real external runtime attached). |
| 11. Acceptance criteria | Adapter contract tests pass (implementation-plan Stage 13 gate). |
| 12. Failure and rollback conditions | Any path allowing a command outside the declared allowlist is a failure. |
| 13. Stop condition | Adapter contract tests green with the mock adapter. Hard stop before attaching Claude Code. |
| 14. Dependency on next rung | FBL-028 depends on this rung. |

#### FBL-028 — Controlled Claude Code execution

| Field | Content |
| --- | --- |
| 1. Rung | FBL-028 — Controlled Claude Code execution |
| 2. Objective | Replace one Builder stage's execution with a real Claude Code run behind the FBL-027 adapter, within a controlled repository and R0–R2 risk classes only. |
| 3. Why this rung exists | F-12 requires one real controlled Claude Code stage; this is the only rung in the ladder that invokes a real external runtime, and it must do so only through the boundary established in FBL-027. |
| 4. Prerequisites | FBL-027 complete; the specific Builder stage and its risk class fixed by FBL-001's resolution of B-02. |
| 5. Authoritative source documents | `docs/03-architecture/decisions/ADR-006-runtime-adapter-boundary.md`; `docs/00-foundry/principles.md` (risk classes R0–R2); `docs/02-specification/v1-acceptance.md` (F-12) |
| 6. Allowed work | `claude_code` adapter implementation; controlled repository profile; evidence artifact capture (logs, exit code, outputs). |
| 7. Explicitly prohibited work | Destructive filesystem actions; R3–R5 risk-class actions; secrets in payloads; unrestricted command execution; full OpenClaw integration. |
| 8. Expected files and deliverables | `claude_code` adapter implementation; controlled-repo configuration; captured evidence artifacts from one real run. |
| 9. Required automated tests | Containment tests (adapter refuses out-of-policy commands/paths); F-12 integration test asserting logs/exit/outputs/evidence are captured. |
| 10. Required visual or operator validation | Operator reviews the captured evidence (logs, diff, exit status) from the real run and confirms it matches the stage's declared requirements. |
| 11. Acceptance criteria | One successful controlled stage run (implementation-plan Stage 14 gate); F-12 satisfied. |
| 12. Failure and rollback conditions | A timeout must terminate safely and store logs (per acceptance "Failure and recovery"); any policy violation halts the rung and is treated as a failed run, not silently retried. |
| 13. Stop condition | One successful controlled run with evidence captured and reviewed. Hard stop. |
| 14. Dependency on next rung | FBL-029 depends directly on FBL-028 (in addition to FBL-025/026/010): Inspector validation, approval, upgrade, recovery, hardening, and final acceptance cannot proceed until controlled Claude Code execution has completed. FBL-028 is on the terminal dependency path to FBL-035. |

#### FBL-029 — Independent Inspector validation

| Field | Content |
| --- | --- |
| 1. Rung | FBL-029 — Independent Inspector validation |
| 2. Objective | Wire the Inspector agent's independent validation path end-to-end on the real backend, guaranteeing `stage.validation_passed` can only be produced by the Inspector path, never by Builder self-certification. |
| 3. Why this rung exists | F-05 and Principle "Inspector cannot be Builder for same validation" are load-bearing for the entire trust model; this rung proves it holds against the real backend and real (or adapter-driven) agents, not just the mock. Depending directly on FBL-028 ensures the one real Claude Code stage has already executed before Inspector validation, approval, upgrade, recovery, and final acceptance are attempted — controlled Claude Code execution cannot be bypassed or deferred past this point. |
| 4. Prerequisites | FBL-025, FBL-026, FBL-010, FBL-028 complete. |
| 5. Authoritative source documents | `docs/02-specification/domain-model.md` (Agent invariant: "Inspector cannot be Builder for same validation"); `docs/02-specification/event-model.md` (`stage.validation_passed` invariant); `docs/02-specification/v1-acceptance.md` (F-05) |
| 6. Allowed work | Backend enforcement that only an Inspector-role agent can emit `stage.validation_passed`; QA building state wiring to real validation results; evidence packaging. |
| 7. Explicitly prohibited work | Any code path letting a Builder-role agent or frontend command directly set `stage.validation_passed`. |
| 8. Expected files and deliverables | Validation-path enforcement in the state machine (extends FBL-025); QA workplace real-data wiring. |
| 9. Required automated tests | F-05 test: attempted Builder self-certification is rejected; Inspector path succeeds. |
| 10. Required visual or operator validation | Operator observes QA building turn red on `stage.validation_failed` and confirms only the Inspector agent's actions produce a pass. |
| 11. Acceptance criteria | F-05 passes against the real backend. |
| 12. Failure and rollback conditions | Any successful Builder self-certification is a critical failure blocking FBL-030. |
| 13. Stop condition | F-05 real-backend test green and operator-observed. Hard stop. |
| 14. Dependency on next rung | FBL-030 depends on this rung — and, transitively through it, on FBL-028 having already completed. |

#### FBL-030 — Human approval workflow

| Field | Content |
| --- | --- |
| 1. Rung | FBL-030 — Human approval workflow |
| 2. Objective | Implement the full request→resolve approval gate end-to-end on the real backend, with Lighthouse attention signaling and auditable resolution. |
| 3. Why this rung exists | Principle 14 ("Humans govern") and F-06 require a real, auditable human decision gate that pauses protected progression — this is the rung where that becomes true against persisted, real state rather than mock state. |
| 4. Prerequisites | FBL-025, FBL-026, FBL-010, FBL-029 complete. |
| 5. Authoritative source documents | `docs/02-specification/domain-model.md` (`Approval`); `docs/02-specification/event-model.md` (`approval.*`); `docs/02-specification/v1-acceptance.md` (F-06, journey steps 11–12) |
| 6. Allowed work | `approval.requested`/`approved`/`rejected`/`revision_requested` real backend paths; Lighthouse attention wiring; approval card wiring to real commands. |
| 7. Explicitly prohibited work | Silent auto-approve; any permanent policy authoring from the approval card. |
| 8. Expected files and deliverables | Approval workflow backend logic; end-to-end approval test. |
| 9. Required automated tests | F-06 test suite: pending approval pauses gated transition; approve/reject/revision paths each produce correct downstream state. |
| 10. Required visual or operator validation | Operator resolves a real pending approval (approve, then separately reject in a test run) and confirms Lighthouse attention and gate state behave correctly both times. |
| 11. Acceptance criteria | F-06 passes against the real backend; journey steps 11–12 reproducible. |
| 12. Failure and rollback conditions | Any protected transition proceeding despite a pending approval is a critical failure. |
| 13. Stop condition | F-06 real-backend test green and operator-observed. Hard stop. |
| 14. Dependency on next rung | FBL-031 depends on this rung. |

#### FBL-031 — Capability-based upgrade

| Field | Content |
| --- | --- |
| 1. Rung | FBL-031 — Capability-based upgrade |
| 2. Objective | Implement Warehouse Level 1→2 upgrade eligibility from real metrics, operator approval, and atomic visual+capability change on `upgrade.completed`. |
| 3. Why this rung exists | F-11/V-07 require an upgrade driven by real operational metrics, not cosmetic change; this proves Principle 20 ("Upgrades require evidence and real capability changes") against the real backend. |
| 4. Prerequisites | FBL-025, FBL-026, FBL-030 complete; FBL-017 (Warehouse object) complete; M-06 (upgrade-counting rule) resolved by FBL-001. |
| 5. Authoritative source documents | `docs/02-specification/domain-model.md` ("Warehouse Level 2 prerequisites"); `docs/02-specification/event-model.md` (`upgrade.*`); `docs/02-specification/v1-acceptance.md` (F-11, V-07) |
| 6. Allowed work | Eligibility evaluation against the resolved counting rule; approval-gated `upgrade.started`/`completed`; atomic capacity (25→100) and visual-level change; failed-upgrade retains prior state. |
| 7. Explicitly prohibited work | Cosmetic-only upgrade (level change without capacity change); any upgrade path skipping operator approval. |
| 8. Expected files and deliverables | Upgrade evaluation/execution backend logic; Warehouse Level 2 placeholder geometry variant. |
| 9. Required automated tests | F-11 test: capacity changes 25→100 only after `upgrade.completed`; V-07 test: visual level unchanged before completion; failed-upgrade retention test. |
| 10. Required visual or operator validation | Operator observes the Warehouse remain at Level 1 appearance throughout `upgrading`, then confirms the Level 2 model and capacity appear together only after approval and completion. |
| 11. Acceptance criteria | F-11 and V-07 pass against the real backend; journey step 14 reproducible. |
| 12. Failure and rollback conditions | Any visual level change before `upgrade.completed` is a critical failure per V-07. |
| 13. Stop condition | F-11/V-07 tests green and operator-observed. Hard stop. |
| 14. Dependency on next rung | FBL-032 depends on this rung. |

#### FBL-032 — Restart and recovery

| Field | Content |
| --- | --- |
| 1. Rung | FBL-032 — Restart and recovery |
| 2. Objective | Prove that reload, backend restart, and disconnect/reconnect all correctly restore or reconcile the complete real system state — world, build, events, inventory, agent locations, and upgrade level — across every state the workflow can reach (idle, blocked, pending approval, completed, post-upgrade). |
| 3. Why this rung exists | This is the acceptance-critical closing loop for ADR-002: truth that cannot survive a restart is not truth. It is deliberately placed after the full workflow (through upgrade) so recovery is tested against every state the system can actually be in, not just early states. |
| 4. Prerequisites | FBL-023, FBL-026, FBL-031 complete. |
| 5. Authoritative source documents | `docs/02-specification/v1-acceptance.md` ("Persistence", "Failure and recovery"); journey step 15 |
| 6. Allowed work | Reload/restart reconstruction tests across all reachable states; disconnect/reconnect tests layered on top of FBL-026's transport; failure-injection tests (agent runtime failure, invalid transition, Claude Code timeout per FBL-028). |
| 7. Explicitly prohibited work | Any new feature work — this rung tests existing behavior, it does not add capability. |
| 8. Expected files and deliverables | Recovery/persistence test suite covering all reachable states. |
| 9. Required automated tests | Reload-at-each-state tests; backend-restart-rebuilds-projection test; disconnect-preserves-stale-label test; failed-upgrade-retains-capability test; Claude Code timeout terminates safely and stores logs test. |
| 10. Required visual or operator validation | Operator reloads mid-build, mid-block, mid-pending-approval, and post-completion, confirming each restores the exact expected state. |
| 11. Acceptance criteria | "Persistence" and "Failure and recovery" sections of `v1-acceptance.md` fully pass. |
| 12. Failure and rollback conditions | Any reachable state that fails to restore correctly is a failure; the corresponding earlier rung (FBL-023/025/026/030/031) is reopened, not patched here. |
| 13. Stop condition | Full recovery suite green across all reachable states, operator-observed for at least the four states listed above. Hard stop. |
| 14. Dependency on next rung | FBL-033 and FBL-034 depend on this rung. |

---

### Phase G — Hardening and acceptance

#### FBL-033 — Accessibility and reduced motion

| Field | Content |
| --- | --- |
| 1. Rung | FBL-033 — Accessibility and reduced motion |
| 2. Objective | Verify and close gaps in keyboard-critical-path coverage, visible focus, color-independent status signaling, reduced-motion behavior, and semantic panel structure across the now-complete application. |
| 3. Why this rung exists | Principle 23/24 and the acceptance "Accessibility"/"Reduced motion" sections are cross-cutting; a dedicated hardening pass after the full workflow exists (FBL-032) catches regressions introduced by later rungs that earlier per-rung checks could not. |
| 4. Prerequisites | FBL-032 complete. |
| 5. Authoritative source documents | `docs/02-specification/v1-acceptance.md` ("Accessibility", "Reduced motion"); `docs/02-specification/interface-model.md` ("Keyboard operation", "Reduced-motion mode") |
| 6. Allowed work | Fixes to focus order, ARIA labeling, color-redundant status indicators, reduced-motion cross-fade behavior; no new features. |
| 7. Explicitly prohibited work | Introducing new UI surfaces to fix an accessibility gap instead of correcting the existing one. |
| 8. Expected files and deliverables | Accessibility fixes across affected components; a11y test suite. |
| 9. Required automated tests | Full keyboard-critical-path test across the entire app; automated color-contrast/redundancy checks where feasible; reduced-motion end-to-end test reproducing the full demo journey. |
| 10. Required visual or operator validation | Operator completes the entire primary journey (FBL-022/032 scope) using keyboard only, and separately with `prefers-reduced-motion` enabled, confirming operational meaning is preserved both times. |
| 11. Acceptance criteria | "Accessibility" and "Reduced motion" acceptance sections pass in full. |
| 12. Failure and rollback conditions | Any critical control unreachable by keyboard, or any state distinguishable only by color, is a failure. |
| 13. Stop condition | A11y and reduced-motion suites green, operator-observed. Hard stop. |
| 14. Dependency on next rung | FBL-035 depends on this rung (jointly with FBL-034). |

#### FBL-034 — Ultrawide performance validation

| Field | Content |
| --- | --- |
| 1. Rung | FBL-034 — Ultrawide performance validation |
| 2. Objective | Measure and, where necessary, optimize to meet the performance budget: <3 s warm start, 45+ FPS target / 30 FPS minimum under full panels, 10,000-event feed virtualization, <100 ms selection feedback, <500 ms realtime update latency — at all three target viewports. |
| 3. Why this rung exists | ADR-005's ultrawide commitment is only real if the full-density configuration performs acceptably; performance regressions from any prior rung (especially FBL-017/020/021 3D content and FBL-009 feed virtualization) must be caught before declaring V1 done. |
| 4. Prerequisites | FBL-032 complete. |
| 5. Authoritative source documents | `docs/02-specification/v1-acceptance.md` ("Performance"); `docs/03-architecture/decisions/ADR-005-ultrawide-primary-interface.md` |
| 6. Allowed work | Performance profiling and optimization (asset/geometry simplification, feed virtualization tuning, network payload tuning) without changing operational behavior. |
| 7. Explicitly prohibited work | Removing or degrading a mandatory feature to hit a performance number. |
| 8. Expected files and deliverables | Performance test harness and results; any optimization patches with before/after measurements. |
| 9. Required automated tests | Warm-start timing test; FPS sampling test under full-panel load; 10,000-synthetic-event feed test; selection-feedback latency test; realtime update latency test. |
| 10. Required visual or operator validation | Operator runs the full journey on the target Mac at 5120×1440 and confirms it feels responsive at desk distance. |
| 11. Acceptance criteria | All "Performance" budget lines in `v1-acceptance.md` met at all three viewports. |
| 12. Failure and rollback conditions | Any budget line unmet after optimization is a failure; do not lower the budget to pass — escalate to the operator instead. |
| 13. Stop condition | Performance suite green at all three viewports, operator-observed at the primary resolution. Hard stop. |
| 14. Dependency on next rung | FBL-035 depends on this rung (jointly with FBL-033). |

#### FBL-035 — Complete V1 acceptance verification

| Field | Content |
| --- | --- |
| 1. Rung | FBL-035 — Complete V1 acceptance verification |
| 2. Objective | Execute the entirety of `docs/02-specification/v1-acceptance.md` against the finished system and produce a signed-off test report declaring V1 complete. |
| 3. Why this rung exists | This is the mission's completion gate: `docs/01-mission/active-mission.md` defines V1 as complete only when every mandatory acceptance test passes, excluded features remain unimplemented, and documentation matches behavior. |
| 4. Prerequisites | FBL-033, FBL-034 complete. |
| 5. Authoritative source documents | `docs/02-specification/v1-acceptance.md` (entire document); `docs/01-mission/active-mission.md` ("Completion gate"); `docs/01-mission/exclusions.md` |
| 6. Allowed work | Test execution and reporting only; no feature changes except fixes for defects the suite itself surfaces (each such fix reopens the owning rung, is fixed there, then this rung re-runs). |
| 7. Explicitly prohibited work | Waiving any mandatory test; substituting an excluded feature for a failing required one; declaring done with any open mandatory defect. |
| 8. Expected files and deliverables | Full acceptance test report; sign-off record. |
| 9. Required automated tests | Every automated test named across FBL-001–FBL-034, run together as one suite; full `v1-acceptance.md` Functional (F-01–F-12) and Visual (V-01–V-08) tables. |
| 10. Required visual or operator validation | Operator performs the complete primary user journey personally, end-to-end, unassisted, confirming ten-second comprehension and every acceptance behavior live — not merely reading automated test output. |
| 11. Acceptance criteria | All mandatory tests pass; no TypeScript/lint/build errors; deterministic demo completes reliably; one real Claude Code stage completes in the controlled adapter; documentation matches implementation; excluded features remain unimplemented. |
| 12. Failure and rollback conditions | Any failing mandatory test reopens the owning rung; this rung does not close until a full clean run passes with zero reopened items outstanding. |
| 13. Stop condition | Full acceptance report signed off. **This is the terminal stop of the ladder.** No further rung exists in V1 scope. |
| 14. Dependency on next rung | None — V1 is complete. Any further work requires a new mission baseline (Future Registry promotion), which is out of this ladder's scope. |

---

## 3. Critical dependency path

This section is derived directly from the Prerequisites field of every rung above; it does not introduce any edge not stated there.

**Fan-out (FBL-002 through FBL-021).** After FBL-002, work fans out into a 2D branch and a 3D branch, both of which must fully complete before FBL-021 can begin:

- *2D branch:* FBL-002 → FBL-007 → FBL-008 → {FBL-009 (also needs FBL-006), FBL-010 (also needs FBL-006, FBL-007)}.
- *3D branch:* FBL-002 → FBL-003 → FBL-004 → FBL-005 → {FBL-006, FBL-011}. FBL-011 → {FBL-012, FBL-013, FBL-018, FBL-014 (also needs FBL-007, FBL-008)}. FBL-014 → FBL-015. FBL-015 → {FBL-016, FBL-017, FBL-019 (also needs FBL-007), FBL-020 (also needs FBL-007)}.
- *Fan-in:* FBL-021 requires all of FBL-008, FBL-009, FBL-010, FBL-014, FBL-016, FBL-017, FBL-018, FBL-019, FBL-020 complete.

**Terminal chain (FBL-021 through FBL-035).** From FBL-021 there is exactly one path, with no further branching until the final hardening pair:

```text
FBL-021 → FBL-022 → FBL-023 → FBL-024 → FBL-025 → FBL-026 → FBL-027 → FBL-028
        → FBL-029 → FBL-030 → FBL-031 → FBL-032 → (FBL-033 and FBL-034) → FBL-035
```

**Longest chain overall (23 rungs, computed by longest-path length over every Prerequisites edge in §2):**

`FBL-001 → FBL-002 → FBL-003 → FBL-004 → FBL-005 → FBL-011 → FBL-014 → FBL-015 → FBL-016 → FBL-021 → FBL-022 → FBL-023 → FBL-024 → FBL-025 → FBL-026 → FBL-027 → FBL-028 → FBL-029 → FBL-030 → FBL-031 → FBL-032 → FBL-033 → FBL-035`

FBL-017, FBL-018, FBL-019, FBL-020, FBL-009, and FBL-010 also gate FBL-021 but sit on shorter branches and do not extend the critical path; FBL-034 ties FBL-033 in length and gates FBL-035 equally (either may be cited as the last hardening rung).

Every rung on this chain gates the next; none may be skipped or reordered. Because FBL-029 now depends directly on FBL-028 (Correction 1), **FBL-028 sits on the critical path**: FBL-029 through FBL-035 — Inspector validation, human approval, capability upgrade, restart/recovery, hardening, and final acceptance verification — are all unreachable until controlled Claude Code execution has completed.

## 4. Rungs that may safely run in parallel

| Group | Rungs | Shared prerequisite | Why parallel is safe |
| --- | --- | --- | --- |
| A | FBL-003/004 and FBL-007 | FBL-002 | Tooling/app scaffold and shared contracts touch disjoint parts of the repository; contracts need only frozen specs, not a booted app. |
| B | FBL-009 and FBL-010 | FBL-006, FBL-008 | Event timeline and other 2D controls are independent panels consuming the same mock stream. |
| C | FBL-012 and FBL-013 | FBL-011 | Camera rig and environment/lighting do not depend on each other. |
| D | FBL-016, FBL-017, FBL-018, FBL-019, FBL-020 | FBL-011 (FBL-016/017/019/020 additionally need FBL-015; FBL-019/020 additionally need FBL-007; FBL-018 needs only FBL-011 and may start earliest) | Each world object is visually and logically independent placeholder geometry; only FBL-021 needs all of them together. |
| E | FBL-033 and FBL-034 | FBL-032 | Accessibility and performance hardening touch different concerns and can be worked simultaneously, but both must close before FBL-035. |

No rung outside these groups may run in parallel with another; every other pair has a direct or transitive dependency.

## 5. Human visual-review gates

A human operator (not an automated check) must explicitly observe and confirm the following before the rung closes:

| Rung | What the operator must see |
| --- | --- |
| FBL-001 | Each amended section resolves its cited BLOCKER/MAJOR finding, or (for a MAJOR only) carries a written, reviewed reclassification rationale, with no new contradiction. |
| FBL-002 | Closure matrix reviewed against a fresh, post-amendment audit revision showing zero open BLOCKER/MAJOR findings; explicit approval recorded against that specific revision, not the original 2026-07-28 audit. |
| FBL-005 | Full-viewport region layout at all three target viewports. |
| FBL-006 | Keyboard-only reachability of every panel. |
| FBL-011 | Blank 3D viewport renders correctly in the shell. |
| FBL-014 | All six Lighthouse states are visually and textually distinct. |
| FBL-015 | Pointer and keyboard selection both sync navigator and detail panel. |
| FBL-021 | No false-progress animation; V-03/V-04/V-05 hold during a live mock run. |
| FBL-022 | Full mock-only journey satisfies ten-second comprehension (V-01). |
| FBL-026 | Disconnect/restore behavior live. |
| FBL-028 | Reviewed evidence (logs, diff, exit status) from the one real Claude Code run. |
| FBL-029 | Builder self-certification attempt is rejected; Inspector path succeeds. |
| FBL-030 | A real pending approval resolved both by approve and by reject in separate runs. |
| FBL-031 | Warehouse visual level changes only after `upgrade.completed`. |
| FBL-032 | Reload mid-build, mid-block, mid-pending-approval, and post-completion each restore correctly. |
| FBL-033 | Full journey completed keyboard-only and separately with reduced motion enabled. |
| FBL-034 | Full journey feels responsive on the target Mac at 5120×1440. |
| FBL-035 | Operator personally completes the entire journey, unassisted, end-to-end. |

## 6. Security and authority gates

| Gate | Rung | Enforced rule |
| --- | --- | --- |
| Baseline approval | FBL-002 | No implementation begins on an un-reviewed, BLOCKER- or MAJOR-carrying specification; promotion requires a fresh audit revision and explicit operator approval against it. |
| No unvalidated mutation | FBL-024 | The backend API is deny-by-default: query/snapshot/health endpoints work, but every command endpoint structurally cannot mutate persisted state until FBL-025 supplies real invariant enforcement — there is never a window of unvalidated mutation. |
| Operational-truth authority | FBL-025 | Backend rejects every illegal transition; frontend cannot force completion, transfer, approval, or upgrade (F-03). |
| Independent validation | FBL-029 | `stage.validation_passed` is unreachable via the Builder or frontend; only the Inspector path can produce it (F-05). |
| Human approval | FBL-030 | Protected progression remains paused until a real, auditable operator decision resolves the gate (F-06). |
| Runtime containment | FBL-027 | All external runtime invocation passes through the adapter's allowlist, timeout, and evidence-capture policy; nothing bypasses it. |
| Risk-class limit | FBL-028 | Only R0–R2 actions are permitted; R3–R5 remain structurally unreachable in V1. |
| Upgrade authority | FBL-031 | Capability/visual change occurs only atomically at `upgrade.completed`, gated by real metrics and operator approval. |

## 7. Definition of V1 completion

V1 is complete only when all of the following hold simultaneously, verified at FBL-035:

1. Every mandatory test in `docs/02-specification/v1-acceptance.md` passes (Functional F-01–F-12, Visual V-01–V-08, Persistence, Failure and recovery, Idempotency, Accessibility, Performance, Reduced motion).
2. No TypeScript, lint, or production build errors remain anywhere in the monorepo.
3. The deterministic demo (mock runtime) completes reliably.
4. One real Claude Code stage completes successfully behind the controlled adapter (F-12).
5. Documentation matches implemented behavior (no active document describes unimplemented behavior as if it exists, and no implemented behavior contradicts an active document).
6. Every feature in `docs/01-mission/exclusions.md` remains unimplemented.
7. No Future Registry (`docs/04-future/registry.md`) concept has entered the implementation.
8. All rungs FBL-001 through FBL-035 have reached their individual stop conditions with no rung left open or silently skipped.

## 8. Rules for amending the ladder

1. **Never renumber a completed rung.** Once a rung's stop condition has been reached and recorded, its identifier and position are permanent history.
2. **New intermediate work uses lettered suffixes.** If work is discovered after a rung closes that belongs between two existing rungs, insert it as `FBL-<preceding>A`, `FBL-<preceding>B`, etc. (e.g. `FBL-021A` for a gap found after FBL-021 closes but before FBL-022 begins).
3. **A rung may be reopened**, but reopening must be explicit and recorded (what failed, which downstream rungs are consequently paused) — it is never silent.
4. **Scope changes require a mission amendment first.** No rung may be added, removed, or altered to implement anything not already in `docs/01-mission/v1-scope.md` or the active mission. A Future Registry concept never justifies a ladder amendment on its own.
5. **Dependency edges are load-bearing.** Changing a rung's Prerequisites field requires re-checking every rung that transitively depends on it via §3/§4.
6. **This document does not self-amend.** Changes to the ladder follow the same active-document change control as any other Foundation document (see `FOUNDATION_VERSION.md` → "Change control").
7. **Archived and Future Registry content never justifies an amendment.** Consistent with Principle 30, `docs/archive/foundation-v0/` and `docs/04-future/registry.md` cannot be cited as the reason to change any rung.
