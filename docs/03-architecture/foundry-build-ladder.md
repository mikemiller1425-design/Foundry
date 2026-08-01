# Foundry Build Ladder — Agent City V1

**Foundation:** 1.0
**Authority:** Sequential implementation program derived from `docs/03-architecture/implementation-plan.md` and all active specification documents
**Status:** **Agent City V1 is COMPLETE.** `FBL-001`–`FBL-035`, including the `FBL-021A` amendment rung, are **complete**, and FBL-035 — the terminal rung — was approved by the operator on 2026-08-01 (`docs/evidence/fbl-035/operator-final-approval.md`). `FBL-028`'s controlled Claude Code run was executed, its evidence captured, and that evidence **reviewed and approved by the operator on 2026-08-01** — narrowly, and explicitly not as an OS-level security sandbox classification (`docs/evidence/fbl-028/operator-approval.md`). Foundry Foundation is **approved (1.0)**. `FBL-022` (complete simulated V1 workflow) was completed under its own separate operator authorization. `FBL-023` (persistence foundation), `FBL-024` (backend API), `FBL-025` (state machines and prerequisite enforcement), and `FBL-026` (realtime event delivery) were completed under an operator-authorized bounded sequence covering `FBL-023`–`FBL-026`, which is **now exhausted**. `FBL-027` (runtime adapter boundary) and `FBL-028` (controlled Claude Code execution) are complete under a subsequent operator-authorized bounded sequence covering `FBL-027`–`FBL-028`, which is now **exhausted**. `FBL-029` (Inspector validation), `FBL-030` (human approval workflow), `FBL-031` (Warehouse upgrade), `FBL-032` (restart and recovery), `FBL-033` (accessibility and reduced motion), and `FBL-034` (ultrawide performance validation) were each subsequently completed and accepted by the operator, with the acceptance recorded in that rung's own evidence file under `docs/evidence/`. `FBL-035` was authorized, executed, and approved; it surfaced two blocking findings that were remediated under separate authorization as `FBL-021A` (implementing the previously-missing `jump to world object`) and a reopening of `FBL-034` (a camera-settling test race). Any further work requires a new mission baseline (Future Registry promotion) and is out of this ladder's scope.
**Method:** Contract-first vertical slices (ADR-003)

## How to read this document

- Every rung has a **stable identifier** (`FBL-001`, `FBL-002`, …). Identifiers are never reused and completed rungs are never renumbered. New work discovered after a rung is closed is inserted as a lettered sub-rung of the nearest preceding rung (e.g. `FBL-006A`), never by shifting later numbers.
- A rung may not **begin** until (a) every item in its **Prerequisites** field is true and (b) the **Stop condition** of the immediately preceding rung on its dependency path has been reached.
- A rung may not **end** by sliding into the next rung's work. Reaching a rung's **Stop condition** halts work until a human or the designated gate explicitly authorizes the next rung.
- `FBL-001` resolved all **4 BLOCKER** and all **6 MAJOR** findings from `docs/audits/foundry-foundation-v1-audit.md` (dated 2026-07-28); finding-by-finding detail in `docs/audits/foundation-v1-fbl-001-closure-matrix.md`. `FBL-002` independently re-audited the amended baseline (`docs/audits/foundry-foundation-v1-post-fbl-001-audit.md`, dated 2026-07-30, result **PASS**, 0 open BLOCKER, 0 open MAJOR, no inaccurate closure-matrix claim found) and recorded explicit operator approval promoting Foundation from `1.0-rc1` to `1.0` (see `FOUNDATION_VERSION.md`). `FBL-003` (monorepo/tooling), `FBL-004` (frontend scaffold), `FBL-005` (ultrawide shell), and `FBL-006` (panel framework) are also complete, under a prior operator-authorized bounded sequence. `FBL-007` (shared contracts), `FBL-008` (deterministic mock runtime), `FBL-009` (event timeline), `FBL-010` (2D operational controls), and `FBL-011` (empty React Three Fiber world) are also complete, under a second, since-exhausted operator-authorized bounded sequence (`FBL-007`–`FBL-011`). `FBL-012` (camera and navigation), `FBL-013` (lighting and environment), `FBL-014` (Lighthouse), and `FBL-015` (object selection) are also complete, under a third, since-exhausted operator-authorized bounded sequence (`FBL-012`–`FBL-015`). `FBL-016` (three residences), `FBL-017` (operational buildings), `FBL-018` (roads), `FBL-019` (utility vehicle), and `FBL-020` (agent representations) are also complete, under a fourth, since-exhausted operator-authorized bounded sequence (`FBL-016`–`FBL-020`). `FBL-021` (event-to-world mapping) and `FBL-022` (complete simulated V1 workflow) are complete under separate, single-rung operator authorizations. `FBL-023` (persistence foundation), `FBL-024` (backend API), `FBL-025` (state machines and prerequisite enforcement), and `FBL-026` (realtime event delivery) are complete, under a fifth, since-exhausted operator-authorized bounded sequence (`FBL-023`–`FBL-026`). `FBL-027` (runtime adapter boundary) and `FBL-028` (controlled Claude Code execution) are complete under a sixth, since-exhausted operator-authorized bounded sequence (`FBL-027`–`FBL-028`); `FBL-028` additionally required operator review of its captured evidence to satisfy its stop condition, which was recorded on 2026-08-01 (`docs/evidence/fbl-028/operator-approval.md`). `FBL-001`–`FBL-028` are all closed. Like every rung on this ladder, `FBL-029` and beyond still require their own separate, explicit operator authorization before they may begin — no authorization currently extends past `FBL-028`.
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
| FBL-021A | Timeline-to-world-object navigation closure | FBL-009, FBL-021 | — | `jump to world object`; amendment rung, no renumbering |
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

#### FBL-004 — Frontend application scaffold — ✅ Complete

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

#### FBL-005 — Ultrawide application shell — ✅ Complete

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

#### FBL-006 — Panel framework — ✅ Complete (final rung of authorized bounded sequence FBL-003–FBL-006)

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

#### FBL-007 — Shared contracts — ✅ Complete

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

#### FBL-008 — Deterministic mock runtime — ✅ Complete

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

#### FBL-009 — Event timeline — ✅ Complete

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

#### FBL-010 — 2D operational controls — ✅ Complete

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

#### FBL-011 — Empty React Three Fiber world — ✅ Complete (final rung of authorized bounded sequence FBL-007–FBL-011)

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

#### FBL-012 — Camera and navigation — ✅ Complete

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

#### FBL-013 — Lighting and environment — ✅ Complete

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

#### FBL-014 — Lighthouse — ✅ Complete

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

#### FBL-015 — Object selection — ✅ Complete (final rung of authorized bounded sequence FBL-012–FBL-015)

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

#### FBL-016 — Three residences — ✅ Complete

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

#### FBL-017 — Operational buildings — ✅ Complete

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

#### FBL-018 — Roads — ✅ Complete

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

#### FBL-019 — Utility vehicle — ✅ Complete

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

#### FBL-020 — Agent representations — ✅ Complete (final rung of authorized bounded sequence FBL-016–FBL-020)

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

#### FBL-021 — Event-to-world mapping — ✅ Complete

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

#### FBL-021A — Timeline-to-world-object navigation closure — ✅ Complete

*Amendment rung. Inserted under the Build Ladder amendment rule and suffixed rather than renumbered, so every existing rung identifier keeps its meaning. It carries the `A` suffix because the capability spans two closed rungs — FBL-009's timeline and FBL-021's event-aware world — and belongs cleanly to neither.*

| Field | Content |
| --- | --- |
| 1. Rung | FBL-021A — Timeline-to-world-object navigation closure |
| 2. Objective | Implement `jump to world object`, the one capability of `interface-model.md` § "Bottom event timeline" that was never built. |
| 3. Why this rung exists | FBL-035 found it missing. FBL-009 named it in its objective but hard-stopped before the 3D mapping existed; FBL-021 — the only point at which it becomes implementable — never claimed it; no other rung mentions it. It fell between the two, and two tests pinned its absence as expected behaviour, which is why every gate had passed. |
| 4. Prerequisites | FBL-009, FBL-021 complete. |
| 5. Authoritative source documents | `docs/02-specification/interface-model.md` ("Bottom event timeline"); `docs/02-specification/event-model.md` (declared payload relationships); `docs/02-specification/world-model.md` |
| 6. Allowed work | Event→world-object resolution, the timeline control, and camera focus for objects that lacked it. No new operational behaviour. |
| 7. Explicitly prohibited work | Resolving targets by display name or guesswork; emitting operational events for navigation; weakening the specification instead of implementing it. |
| 8. Expected files and deliverables | `src/lib/world/worldTargetForEvent.ts` + tests; timeline control; shell wiring; replacement of the two tests that pinned "not yet available". |
| 9. Required automated tests | Resolvable/unresolvable resolution across every V1 object category; correct target per declared relationship; click and keyboard activation; world/navigator/detail synchronization; reduced motion; WebGL-unavailable; no operational mutation; duplicate activation; all three viewports. |
| 10. Required visual or operator validation | Covered by FBL-035's final operator journey; no separate gate. |
| 11. Acceptance criteria | The capability works for every declared relationship, stays unavailable with a stated reason otherwise, and mutates no operational truth. |
| 12. Failure and rollback conditions | Any jump to an object the event did not declare is a failure. |
| 13. Stop condition | Capability implemented and tested; FBL-035 re-runs. |
| 14. Dependency on next rung | FBL-035 depends on this rung. |
| **Implementation record** | `worldTargetForEvent.ts` resolves **by declared identifier only** — `entityId` where the entity *is* a world object (agents), or a named `IdSchema` payload field where the contract declares the relationship (`buildingId`, `sourceBuildingId`, `vehicleId`). Nothing matches on display names or substrings, and a test asserts that passing the display name `"Architect"` instead of the declared id resolves to **nothing**: a jump that guesses is worse than one that is unavailable, because it moves the operator somewhere confidently wrong. Deliberately unresolvable: `transfer.completed` (carries only a receipt artifact id), `upgrade.completed` (its contract has no `buildingId` — it is **not** assumed to be the Warehouse), and every project-level event. `approval.requested` → Lighthouse is included because `EVENT_PROJECTION_MAP` already declares that mapping explicitly. Disabled state renders its reason as **text with `aria-describedby`**, not a `title` tooltip, which keyboard and screen-reader users cannot read. Agents gained camera focus, which they never had: they are absent from the static `SELECTABLE_WORLD_OBJECTS` registry because they move, so focus resolves their live position through `computeAgentPosition` rather than a frozen coordinate that would point at the wrong building the moment the agent walked away. Navigation emits no operational event. The two tests that pinned "not yet available" were replaced with tests of the real capability; 22 new tests (17 resolver + 5 control), 432 unit total. |

#### FBL-022 — Complete simulated V1 workflow — ✅ Complete

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

#### FBL-023 — Persistence foundation — ✅ Complete (part of operator-authorized bounded sequence FBL-023–FBL-026)

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

#### FBL-024 — Backend API — ✅ Complete (part of operator-authorized bounded sequence FBL-023–FBL-026)

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

#### FBL-025 — State machines and prerequisite enforcement — ✅ Complete (part of operator-authorized bounded sequence FBL-023–FBL-026)

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

#### FBL-026 — Realtime event delivery — ✅ Complete (final rung of operator-authorized bounded sequence FBL-023–FBL-026)

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

#### FBL-027 — Runtime adapter boundary — ✅ Complete

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
| **Completion record** | `packages/runtime-adapters` implemented: `PolicyBoundary` (the single path every runtime executes through), physical symlink-resolving path containment, deny-by-default executable/argument allowlist, constructed-not-inherited environment allowlist, policy-declared executable resolution (never `PATH`), shell-free bounded execution with process-group termination, secret redaction by value and by shape, and deep-frozen size-bounded evidence retained for all four terminal outcomes. `MockRuntimeAdapter` runs behind the *same* boundary, differing only in the `ExecutionBackend` that turns an approved command into an outcome. 103 tests, including the full required security suite. `src/frontendIsolation.test.ts` structurally asserts `apps/agent-city` neither imports nor depends on the package. **No real external runtime was attached** — stop condition respected. One documented limitation carried into FBL-028: `allowNetwork` is a declared and recorded posture, not kernel-level enforcement (see the package README). |

#### FBL-028 — Controlled Claude Code execution — ✅ Complete (final rung of operator-authorized bounded sequence FBL-027–FBL-028)

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
| **Completion record** | One real Claude Code run (v2.1.220, Sonnet 5) executed on 2026-08-01 through the FBL-027 boundary, in a freshly created disposable fixture repository under the OS temp directory — never the Foundry repo, home, `Documents`, another project, or any directory holding credentials. Stage: `backend_implementation`, risk class **R2**. Command line fixed to a single fully-literal argument vector; `--tools Read,Write,Edit,Glob,Grep` (**no `Bash`**, so the run could neither execute commands nor run its own tests), `--safe-mode`, `--strict-mcp-config`, no `--add-dir`, `--max-budget-usd 2`; environment limited to `HOME` and `USER` (no `PATH`); task specification delivered on stdin so the argument allowlist never had to accept prose. Result: exit 0 in 22.3 s, exactly one file changed (`src/taskStore.js`), zero policy denials, zero Claude Code permission denials. **Success was determined by independent validation** — a 12-assertion suite written into the fixture *before* the run, which the stage was forbidden to modify (test file hash unchanged) and had no shell to execute; Foundry ran it afterwards under a separate narrower R1 policy, 12 passed / 0 failed. Evidence package and operator-review report: `docs/evidence/fbl-028/`. Seven standing limitations are documented in §12 of the report, chiefly: the boundary governs invocation, not a running process; write confinement is post-hoc detection rather than prevention; `allowNetwork` is a declared posture, not kernel enforcement; and the environment allowlist cannot keep a process away from the OS Keychain. |
| **Operator approval** | ✅ **Approved 2026-08-01** by mikemiller1425-design, against `docs/evidence/fbl-028/operator-review-report.md`; append-only record at `docs/evidence/fbl-028/operator-approval.md`. The stop condition ("evidence captured **and reviewed**") is therefore met and this rung is **closed**. **The approval is narrow:** one controlled Claude Code Builder stage; disposable, non-sensitive fixture repositories only; R0–R2 only; invocation exclusively through the FBL-027 boundary; independent validation mandatory; Claude Code may not self-certify completion. **It explicitly does not classify the runtime adapter as an OS-level security sandbox** — write confinement is detected after execution rather than enforced by an OS sandbox, network posture is declared but not OS-enforced, the process may access the user-session macOS Keychain for Claude authentication, and secret-pattern redaction is defense in depth rather than guaranteed isolation. These are accepted for V1 and **must not be generalized into production security guarantees**. Execution must never target Foundry, the user's home directory, a broad `Documents` directory, or any repository containing sensitive or valuable data. The timing-sensitive browser-test flakiness (report §12.7) is accepted as **deferred hardening work assigned to FBL-034**; it does not block FBL-029. FBL-029 remains unauthorized. |

#### FBL-029 — Independent Inspector validation — ✅ Complete

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
| **Implementation record** | **Root cause addressed:** before this rung the command actor was taken from the *request body*, so the F-05 Inspector check could be satisfied by typing `"agent-inspector"` into a payload. Identity is now established by a backend-issued bearer credential (`packages/persistence/src/principals.ts`); the authoritative role is re-read from persisted `Agent` state at decision time, so a credential can never assert a role its agent does not hold. A body `actor` contradicting the credential is refused with `403 actor_mismatch` rather than silently overridden. Authorization runs **before** the entity lookup, so an unauthorized caller cannot use the "no such BuildStage" reply as an existence oracle, and every refused caller receives an identical reason. Both validation outcomes (not only `passed`) require the Inspector — a Builder able to declare its own work failed would still control the retry/revision path. Additional guards: evidence-provenance self-certification (an agent may not validate an artifact it created), stage/evidence coherence, stale/out-of-order rejection, idempotent duplicate decisions, and rejection of conflicting reversals (which require the Revision path). Decisions are recorded in a new append-only `stageValidations` projection — a derived read model, **not** a new domain entity and **not** a payload change, since `domain-model.md` is frozen and `event-model.md` pins the `stage.validation_*` payloads exactly. A failure is never erased by a later pass (principle 17). QA now renders **red** on a validation failure rather than orange, per `event-model.md`; `BuildStageStatus` has no value for "an Inspector rejected this", so the decision is carried alongside the status and checked first. 48 new tests (667 total). Verified end-to-end against the running service over real HTTP: Builder credential rejected, no credential rejected with an identical reason, Inspector credential accepted, validation record persisted with `validatorRole: inspector`. **Operator observation recorded 2026-08-01** (`docs/evidence/fbl-029/operator-observation.md`): Inspector failure rendered QA red, the Builder credential could not produce a pass (with unauthenticated and spoofed-body variants refused identically), and an Inspector pass cleared the red state with the record showing `validatorRole: inspector` resolved from persisted state. The stop condition ("F-05 real-backend test green **and operator-observed**") is therefore met and this rung is **closed**. |

#### FBL-030 — Human approval workflow — ✅ Complete

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
| **Implementation record** | Resolution now requires an **authenticated operator** (principle 14). Authenticated *agents* are refused too: an agent resolving the gate that exists to constrain agents would make the gate ceremonial. Authorization runs before the entity lookup, so a refusal cannot be used to enumerate approval ids, and every refused caller gets an identical reason. **`resolvedBy` is written from the authenticated principal, never the payload** — `event-model.md` pins it as a payload field, so it must exist there, but a caller filling it in would be asserting who made a governance decision; a contradicting value is refused rather than silently overwritten, because quietly rewriting it would make the audit trail disagree with what was submitted. Duplicate resolutions are idempotent (the original decision, resolver, and timestamp stand); conflicting reversals are rejected — a resolved approval is immutable. `approval.revision_requested` now creates the linked `Revision` (`sourceApprovalId`, `requestedBy: approval`) and moves the stage to `revision_required`, as `event-model.md` requires; it is derived in the reducer from a deterministic id rather than emitted as a second event, so one command still produces exactly one event and a full replay reconstructs it identically. Frontend: the approval card no longer sends `actor` or `resolvedBy`; it presents an operator credential entered by the operator and stored locally, **not** a `NEXT_PUBLIC_*` build variable, which would bake a live credential into every build artifact and make rotation a rebuild. Missing-credential is a visible, explained disabled state kept distinct from the disconnected banner, so an operator can tell "not authorized" from "backend unreachable". 50 new tests (718 total). Verified end-to-end over real HTTP. **Operator observation recorded 2026-08-01** (`docs/evidence/fbl-030/operator-observation.md`): the approve run cleared the card, cleared Lighthouse attention, and recorded `resolvedBy: operator-1` (a value the browser never sent); the reject run cleared the card while leaving the gate shut, and a conflicting reversal was refused. The stop condition ("F-06 real-backend test green **and operator-observed**") is therefore met and this rung is **closed**. |

#### FBL-031 — Capability-based upgrade — ✅ Complete

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
| **Implementation record** | **Capacity was specified but never implemented.** `domain-model.md` and `world-model.md` both require capacity 25→100, yet the frozen `Building` schema has no numeric capacity field and no code carried one. Capacity is now expressed as a **capability string**, which is the field the specification does provide for "what this building can do" and which `upgrade.completed.capabilitiesAdded` is the declared mechanism for changing. The `capacity_` prefix is not a new convention — the FBL-008 canonical mock script already emitted `capacity_100`; this names the Level 1 counterpart the mock never had to state, so both runtimes now speak the same vocabulary (proven by the canonical-replay test). A new capacity **replaces** the old rather than accumulating beside it, and level and capacity are written in the *same* reducer branch, so no observer can see one without the other (V-07). **Eligibility now enforces all four prerequisites** from persisted truth: the 10-package M-06 counting rule, no unresolved critical event, ≥90% validation pass rate after retries, and event-persistence verification. The pass-rate prerequisite was previously unenforceable for a real reason — there was no per-retry ledger — and FBL-029's append-only `stageValidations` history is that ledger; it counts each stage **once by its final decision**, so a stage that failed and was repaired counts as a pass, which is the very workflow V1 demonstrates. Requesting and approving an upgrade require an authenticated operator; `Start`/`Complete` deliberately do not, being the execution of a decision already made. Duplicate completion is an explicit idempotent no-op that cannot double-apply the capability change. Capacity is surfaced in the 2D detail panel because F-11 requires it to be *observable*. 26 new tests (744 total). **Operator observation recorded 2026-08-01** (`docs/evidence/fbl-031/operator-observation.md`): Level 1/capacity 25 held while eligible and pending; level and capacity both stayed unchanged throughout `upgrading`; Level 2/capacity 100 and the Level 2 geometry appeared together only on `upgrade.completed`, and a duplicate completion was refused as an idempotent no-op. The stop condition ("F-11/V-07 tests green **and operator-observed**") is therefore met and this rung is **closed**. |

#### FBL-032 — Restart and recovery — ✅ Complete

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
| **Implementation record** | `packages/persistence/src/recovery.test.ts` — 23 tests organised by **reachable state** rather than by mechanism, because the risk this rung addresses is not "does replay work" (FBL-023 established that) but "is there a state whose recovery nobody checked". Covers: WorldState byte-identical across restart (and from an empty log); mid-build, blocked, pending-approval, resolved-approval, failed-validation, in-progress `AgentRun`, and timed-out `AgentRun` (logs and evidence retained, per FBL-028); all four upgrade states — including **`upgrading` recovering at Level 1/capacity 25, so V-07 survives a restart** — and failed-upgrade retaining prior capability; replay idempotency (re-appending the entire log changes nothing); snapshot/cursor reconciliation including unknown and null cursors; stale-command rejection after recovery (a conflicting resubmission is refused, and authorization is not in-memory state either); and subscriber durability (never notified before commit, never for a duplicate). **No new capability was added — this rung tests existing behaviour, as its field 7 requires. No earlier-rung defect was revealed, so no earlier rung was reopened.** 23 new tests (767 total). **Operator observation recorded 2026-08-01** (`docs/evidence/fbl-032/operator-observation.md`): mid-build, blocked, pending-approval, and post-completion each restored correctly across both a browser reload and a full backend restart. The stop condition is therefore met and this rung is **closed**. |

---

### Phase G — Hardening and acceptance

#### FBL-033 — Accessibility and reduced motion — ✅ Complete

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
| **Implementation record** | Cross-cutting a11y pass over the completed application. `colorIndependence.test.ts` (20 tests) asserts "colour not sole signal" **structurally across the whole visual vocabulary** rather than spot-checking components, checking two distinct failures: a state with no label is invisible to anyone not perceiving colour, while two states sharing a label are worse than none — the text asserts they are the same when the colour says they differ. `shell-accessibility.spec.ts` (7 tests × 3 viewports, 21/21) covers the keyboard critical path with no trap, deterministic focus order, visible focus indicators, navigator equivalents for canvas objects, semantic landmarks, and the reduced-motion journey preserving textual meaning — **every wait on stable state, never elapsed time**. No production code changed: the audit found no colour-only state and no keyboard trap to repair. Two errors of the assistant's own were caught by the gates: `blur()` does not reset focus to the document start, so the focus-order comparison was reading different slices; and `test.use({ reducedMotion })` is a project-level option `typecheck` rejected inside a describe block. 20 new unit tests (787 total). |
| **Operator acceptance** | ✅ **Accepted 2026-08-01** by mikemiller1425-design (`docs/evidence/fbl-033/operator-observation.md`). Recorded as an operator **decision** rather than a narrated walkthrough: the assistant did not witness the keyboard-only and reduced-motion journeys and was not told their step-by-step results, so the record states what actually occurred rather than inventing observation detail. The record also names three honest gaps the automated pass did **not** close — no axe-style scanner run, no screen-reader verification, and no WebGL-unavailable fallback test. |

#### FBL-034 — Ultrawide performance validation — ✅ Complete

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
| 9. Required automated tests | Warm-start timing test; FPS sampling test under full-panel load; 10,000-synthetic-event feed test; selection-feedback latency test; realtime update latency test. Plus the deferred item below: the browser suite must pass repeatably **under CPU contention**, not only on an idle machine. |
| 10. Required visual or operator validation | Operator runs the full journey on the target Mac at 5120×1440 and confirms it feels responsive at desk distance. |
| 11. Acceptance criteria | All "Performance" budget lines in `v1-acceptance.md` met at all three viewports. |
| 12. Failure and rollback conditions | Any budget line unmet after optimization is a failure; do not lower the budget to pass — escalate to the operator instead. |
| 13. Stop condition | Performance suite green at all three viewports, operator-observed at the primary resolution. Hard stop. |
| 14. Dependency on next rung | FBL-035 depends on this rung (jointly with FBL-033). |
| **Implementation record** | Every budget line in `v1-acceptance.md` § Performance is now an **asserting** test (`apps/agent-city/e2e-perf/`, plus `EventTimeline.scale.test.tsx` for the 10,000-event feed), measured serially against a production build with the real GPU. All budgets met at the three target viewports **and** at a supplementary HiDPI configuration (5120×1440 @2×): warm start 38–40 ms, FPS average 76.1–91.2, FPS sustained-low 36.8–59.9, selection feedback ≤27.2 ms, realtime-visible ≤24.1 ms. The measurement conditions are themselves asserted — the run **fails** if WebGL falls back to a software renderer or the window is not at the project's viewport, because a budget met under SwiftShader is a false pass recorded as evidence. **The deferred FBL-028 §12.7 flakiness is resolved at its root cause:** the browser suite was rasterizing WebGL in software (headless Chromium defaults to SwiftShader), so each browser burned a core and parallel workers starved each other — 41–42 s to reach the approval gate on 8 workers against a 30 s allowance, versus 9.7–10.6 s GPU-backed. Five further defects were fixed at their cause with **no timeout raised to absorb a race and no test retried**, including the named `shell-timeline.spec.ts:118` detachment race, and a focus descriptor that reported a **keyboard trap that did not exist**. Two tests were found to have been passing *because* CPU starvation stretched the transient states they observe. Result: **363 passed / 0 failed across three consecutive full runs, two under deliberate CPU contention** (before: 8 failed / 355 passed, all eight at 5120×1440). **No application code was changed** — no budget line was unmet, so no optimization patch was warranted; per-frame waste found while profiling is recorded for a future rung rather than rewritten speculatively. A wall-clock-anchored catch-up scheduler was tried and **rejected**: it compressed transient states so intermediate operational states never painted, which is the operational-behaviour change this rung prohibits. 4 new unit tests (791 total). Measurements: `docs/evidence/fbl-034/performance-measurements.md`. |
| **Operator acceptance** | ✅ **Accepted 2026-08-01** by mikemiller1425-design (`docs/evidence/fbl-034/operator-observation.md`). Recorded as an operator **decision** rather than a narrated walkthrough, following the FBL-033 precedent: the observation gate was genuinely presented — a production build served at `localhost:4500` with a seven-step journey specified — but the assistant did not witness the walkthrough and was not told its step-by-step results, so the record states what actually occurred rather than inventing observation detail. The record also names what the pass did **not** establish: no witnessed walkthrough, one machine only, the 10,000-event result being a jsdom DOM-boundedness measurement rather than a frame-rate one, realtime latency measured as the render half composed with FBL-026's transport half, and known per-frame allocation waste deliberately left in place because no budget was under pressure. |
| **Deferred work assigned here** | **Timing-sensitive browser-test flakiness under CPU contention**, deferred from FBL-028 by operator decision on 2026-08-01 (`docs/evidence/fbl-028/operator-approval.md`; detail in §12.7 of the FBL-028 review report). Across three full Playwright runs during FBL-028, a small number of specs failed — but *different ones each time*: `e2e/shell-timeline.spec.ts:118` (element detached from the DOM while clicking a row in the live-updating timeline), then `e2e/shell-selection.spec.ts:23` and `e2e/shell-residences.spec.ts:112`. All are timing-sensitive tests against the animated 3D world and the deterministic mock runtime; all pass in isolation, and a final isolated run was fully green (342 passed, 3 skipped, 0 failed). The two failing runs competed for CPU with the controlled Claude Code run and the unit suites. These are **not** regressions from FBL-027/FBL-028, both of which are backend-only and modified no file under `apps/agent-city`. This belongs here because it is a load-and-timing property of the ultrawide 3D interface, which is precisely what this rung measures. **It does not block FBL-029.** Fixing it means removing the race (deterministic waits on stable state rather than elapsed time), not merely re-running until green or raising timeouts. |

#### FBL-035 — Complete V1 acceptance verification — ✅ Complete (terminal rung)

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
| **Verification record** | ⚠️ **Open — not closed.** Authorized and executed 2026-08-01; report at `docs/evidence/fbl-035/v1-acceptance-report.md`. Final automated run at `7dc7a23`: typecheck 8/8, lint clean, production build, **813** unit/integration, **378 Chromium browser tests across three target viewports with zero failures**, **16/16 performance budgets** at three target viewports plus a supplementary HiDPI configuration. Every F-01–F-12 and V-01–V-08 requirement is mapped to the tests that prove it, verified by reading them rather than trusting ID annotations. Exclusions re-verified; documentation re-checked against implementation. **Findings 1–5 are closed:** F-10's browser test (skipped since FBL-026) executed and passing; F-12 re-executed live under a spent one-run authorization; the Safari coverage gap classified as non-defect against the operator's real-Safari observation; `jump to world object` implemented as **FBL-021A**; and the camera-settling race repaired deterministically with three consecutive clean full runs, two under CPU contention. **Finding 6 is open:** WebKit automation is 372 passed / 6 failed — three are the classified configuration-dependent Tab issue, and **three are newly surfaced and unclassified** (`shell-selection.spec.ts:150` ×2, `shell-event-to-world-mapping.spec.ts:119`). Notably the camera repair also fixed WebKit's findings 3b and 3c, confirming 3c was the same race rather than a `preserveDrawingBuffer` limitation. **This rung does not close** while finding 6 stands, and the operator's personal end-to-end journey (field 10) has not been signed off. **V1 is declared complete by operator approval — see the row below.** |
| **Operator final approval** | ✅ **APPROVED 2026-08-01** by mikemiller1425-design, with the required wording `I APPROVE AGENT CITY V1 FOR COMPLETION`, against commit `c659d0e` and a production build served at `localhost:4500` (`docs/evidence/fbl-035/operator-final-approval.md`). Recorded as an operator **decision** rather than a narrated walkthrough, following the FBL-033/034 precedent: the gate was properly presented with a nine-step unassisted journey checklist, but the assistant did not witness the journey and was not told its results. **Finding 6 was open at the time of approval and was accepted rather than resolved** — three unclassified Playwright-WebKit failures (`shell-selection.spec.ts:150` ×2, `shell-event-to-world-mapping.spec.ts:119`), which the operator was told were undiagnosed and explicitly offered the chance to investigate first. They remain **open and uninvestigated**, not accepted non-defects; real macOS Safari was separately observed to PASS. FBL-035's stop condition is met. **This is the terminal stop of the Build Ladder. Agent City V1 is complete.** |

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
