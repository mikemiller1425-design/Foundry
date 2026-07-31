# Changelog

All notable changes to the Foundry repository and Foundation baseline are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added — FBL-003 Monorepo and tooling foundation

Established workspace tooling (package manager, TypeScript, lint, format, test-runner wiring) across `apps/` and `packages/` with no application logic, per the operator-authorized bounded sequence FBL-003–FBL-006. `pnpm install`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format`, `pnpm run test`, and `pnpm run build` all exit 0 on the empty tree.

- `pnpm-workspace.yaml`: workspace globs for `apps/*` and `packages/*`
- `package.json` (root): private workspace root, pinned `packageManager`, root `lint`/`lint:fix`/`format`/`format:write`/`typecheck`/`test`/`build` scripts
- `tsconfig.base.json`: shared strict TypeScript compiler options
- `eslint.config.mjs`: flat config using `typescript-eslint` recommended rules plus `eslint-config-prettier`
- `.prettierrc.json` / `.prettierignore`: formatting config, scoped to code (`apps/`, `packages/`, root tooling config) — prose specification and governance documents under `docs/` and repo root are explicitly excluded from Prettier's scope, not reformatted
- `packages/contracts`, `packages/event-types`, `packages/runtime-adapters`, `packages/ui`, `packages/world-model`: each given a minimal `package.json` (`lint`/`typecheck`/`test` scripts), `tsconfig.json` extending the shared base, and a placeholder `src/index.ts` (`export {}`) — still reserved, no implementation added
- `typescript` pinned to `6.0.3` (not the newly released `7.0.x` line) because `typescript-eslint@8.65.0` does not yet support the TypeScript 7 API

### Added — FBL-004 Frontend application scaffold

Booted an empty `apps/agent-city` Next.js/TypeScript app with no meaningful UI, per the operator-authorized bounded sequence FBL-003–FBL-006. `pnpm install`, `pnpm run typecheck`, `pnpm run lint`, `pnpm run format`, `pnpm run test`, and `pnpm run build` all exit 0; `next start` boots and serves HTTP 200 with no console/server errors.

- `apps/agent-city/package.json`: `@foundry/agent-city`, approved-stack dependencies only (`next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`)
- `apps/agent-city/next.config.ts`: explicit `turbopack.root` pinned to the monorepo root (an unrelated lockfile in the host home directory otherwise causes Turbopack to mis-infer the workspace root)
- `apps/agent-city/tsconfig.json`: extends the shared base config with Next's required App Router settings
- `apps/agent-city/postcss.config.mjs`, `src/app/globals.css`: Tailwind CSS v4 wiring (CSS-first config, no `tailwind.config.ts` needed)
- `src/app/layout.tsx`, `src/app/page.tsx`: minimal root layout and an intentionally empty root page (`return null`) — no meaningful Foundry interface yet
- `src/app/page.test.tsx`: boot smoke test asserting the root page renders without throwing
- `pnpm-workspace.yaml`: explicitly declined the `sharp` optional native build script (Next's image-optimization dependency) since this app does not use `next/image` yet

### Added — FBL-005 Ultrawide application shell

Implemented the full-viewport region layout — top system bar, left navigation, central operational world, right live-intelligence, bottom event timeline, persistent command input, and a docked selected-object detail panel — per `docs/02-specification/interface-model.md` and ADR-005, per the operator-authorized bounded sequence FBL-003–FBL-006. Static placeholders only; no operational data, mock runtime, or 3D content. Unit tests (Vitest + Testing Library) and a new Playwright layout suite covering all three target viewports (5120×1440, 3840×1080, 2560×1440) — 30/30 passing — verify every mandatory region is present, non-collapsed, and that the shell root carries no app-wide `max-width`.

- `src/components/shell/AppShell.tsx`: the shell layout component (CSS grid, semantic landmarks with `aria-label` on every region, restrained placeholder text)
- `src/app/page.tsx`: now renders `AppShell` (previously an intentionally empty page for FBL-004)
- `src/app/page.test.tsx`: unit tests asserting every mandatory region renders, no `max-w-` utility on the shell root, and every region has an accessible label
- `vitest.config.ts`, `vitest.setup.ts`: jsdom test environment, `@testing-library/react` + `jest-dom` matchers, explicit `afterEach(cleanup)`
- `playwright.config.ts`, `e2e/shell-layout.spec.ts`: browser-based layout assertions across the three target viewport projects
- `package.json`: added `test:e2e` script (`playwright test`), kept separate from the default `test` (unit) script

### Added — FBL-006 Panel framework

Added collapse/resize/keyboard-operable behavior to the left navigation, right live-intelligence, and bottom event timeline regions established in FBL-005, per `docs/02-specification/interface-model.md` ("Panels are collapsible and resizable") and the operator-authorized bounded sequence FBL-003–FBL-006 — the final rung in that authorization. Generic primitives only: no domain behavior, mock events, approvals, agents, buildings, or 3D objects. 9 unit tests in `apps/agent-city` (up from 4) and 18 new unit tests in `packages/ui` (hooks/components in isolation) plus 18 new Playwright tests (6 scenarios × 3 viewports, alongside FBL-005's 30) — 48/48 e2e passing — cover collapse/expand, resize via keyboard and pointer drag, Tab-only reachability of every panel control, visible focus, and layout reset.

- `packages/ui/src/panel/useCollapsible.ts`, `useResizable.ts`: generic collapse and WAI-ARIA "window splitter" resize state hooks (headless — no styling, no domain content)
- `packages/ui/src/panel/CollapseToggleButton.tsx`, `ResizeHandle.tsx`: headless presentational primitives wired to the hooks above; keyboard-operable via native `<button>` semantics and `role="separator"` + arrow-key/Home/End/Enter handling
- `packages/ui/src/index.ts`: barrel export for the above; package gained `react` as a peer dependency and its own Vitest + Testing Library unit-test setup
- `apps/agent-city/src/components/shell/AppShell.tsx`: rewritten as a client component wiring the three resizable/collapsible regions (left nav, right intelligence, event timeline) plus a "Reset layout" control in the top system bar; central world and command input remain always-visible per Principle 23 (critical controls must not be hidden)
- `apps/agent-city/src/components/shell/AppShell.test.tsx`: unit tests for collapse/expand, independent panel state, handle visibility while collapsed, and layout reset
- `apps/agent-city/e2e/shell-panels.spec.ts`: Playwright tests for Tab-only navigation order, visible focus, keyboard-driven resize, pointer-drag resize, and reset — run across all three target viewports alongside the FBL-005 layout suite
- Layout state (collapsed/expanded, panel sizes) is frontend-local component state only — not persisted, per FBL-006's scope (persistence was explicitly not required)

### Stop

Operator authorization for this session's bounded execution sequence (FBL-003–FBL-006) is fully used. `FBL-007` (shared contracts) and every later rung remain **not authorized** and were not started.

### Fixed — Build Ladder introduction stale status

`docs/03-architecture/foundry-build-ladder.md`'s introduction still read "`FBL-003` is next" after `FBL-003`–`FBL-006` were completed. Corrected to record `FBL-001`–`FBL-006` complete and `FBL-007` as the newly authorized next rung. No rung identifier, dependency, requirement, or acceptance criterion was changed — status/governance language only.

### Added — FBL-007 Shared contracts

Populated `packages/contracts`, `packages/event-types`, and `packages/world-model` with the approved Foundation models as shared TypeScript types and Zod runtime-validatable schemas, per the operator-authorized bounded sequence FBL-007–FBL-011. No application/UI behavior, no runtime orchestration, no Future Registry entities. All three packages import successfully into `apps/agent-city`. 100 unit tests total across the repo (up from 31): 49 in `packages/contracts`, 14 in `packages/event-types`, 7 in `packages/world-model`, plus 3 new import-integration tests in `apps/agent-city`.

- `packages/contracts/src/common.ts` + `src/entities/*.ts`: schemas for every V1 entity — `Agent`, `Building`, `Project`, `Build`, `BuildStage`, `Revision`, `Requirement`, `Task`, `AgentRun`, `Artifact`, `Transfer`, `Vehicle`, `Approval`, `Upgrade`, `WorldState` — preserving required/optional fields, closed status vocabularies, and V1-limit constraints (e.g. R0–R2 only, the seven named `BuildStage`s, the three `Transfer` legs) exactly as `domain-model.md` documents them
- `packages/event-types/src/envelope.ts`: the shared event envelope (id, occurredAt, actorType, actorId, entityType, entityId, correlationId, optional causationId, severity, schemaVersion) plus a `defineEvent` helper
- `packages/event-types/src/events/*.ts`: every authoritative V1 event from `event-model.md` (67 event types across System/Operator/Agent/AgentRun/Build/Stage/Revision/Requirement/Artifact/Transfer/Approval/Building/Upgrade), combined into one `FoundryEventSchema` discriminated union
- `packages/event-types/src/commands.ts`: the exhaustive six-value `DemoCommandSchema` (`demo.start`/`pause`/`resume`/`set_speed`/`reset`/`replay`), `.strict()` on every params shape so undocumented/extra command fields are rejected, not silently accepted
- `packages/world-model/src/*.ts`: stable identifiers, layout positions, and state→visual mapping tables for the nine required V1 buildings, three agents, one vehicle, and road network — re-uses `@foundry/contracts` enums rather than redefining them
- `apps/agent-city/src/lib/contracts.test.ts`: proves all three packages import and validate successfully from the app
- `typescript-eslint` package unaffected; `zod@^4.4.3` added as a runtime dependency of `contracts`/`event-types`/`world-model`

### Added — FBL-008 Deterministic mock runtime

Built a replayable, in-memory V1 demo engine (`apps/agent-city/src/lib/mock-runtime/`) using only the FBL-007 contracts, per the operator-authorized bounded sequence FBL-007–FBL-011 and ADR-001 (mock-runtime-first). Placed app-locally per the ladder's own sanctioned alternative ("packages/runtime-adapters mock implementation or app-local mock service") — this is the full V1 domain simulation, a broader concern than `packages/runtime-adapters`' policy-boundary role for individual runtime invocations. No backend, database, filesystem persistence, network runtime, or AI execution. 145 unit tests total across the repo (up from 100): 45 new in the mock-runtime module.

- `script.ts`: `buildCanonicalScript(seed)` — the complete, deterministic, ordered V1 event sequence (objective submission → build creation → all 7 `BuildStage`s including the one intentional `frontend_implementation` requirement failure/retry/repair → all 3 transfer legs → Inspector validation → approval → completion → Warehouse upgrade eligibility/approval/completion)
- `runtime.ts`: `MockRuntime` — the scheduler implementing exactly the six bounded demo commands (`demo.start`/`pause`/`resume`/`set_speed`/`reset`/`replay`); rejects any other `commandType`; pause/resume preserves cursor position (no reorder, no loss); `reset` re-initializes from scratch; `replay` re-emits the identical seeded sequence
- `worldStateReducer.ts`: `reduceWorldState` — folds events into a `WorldState`, deduping by event id so duplicate delivery never duplicates derived state (e.g. the Warehouse's seeded-9-plus-1 package count per M-06)
- `approvalActions.ts`: pure builders for the non-happy-path Approval resolutions (reject, request-revision) — independently testable without a second divergent "canonical" script, since `v1-scope.md`'s Required workflow describes exactly one linear journey
- `ids.ts`, `eventFactory.ts`: deterministic id/timestamp generation and a schema-validating event builder (an authoring mistake fails immediately, not silently); fixed a real bug found by the determinism test — one event was stamping real wall-clock time instead of the deterministic clock, breaking same-seed reproducibility
- `eslint.config.mjs`: added `argsIgnorePattern`/`varsIgnorePattern: "^_"` for the standard intentionally-unused-parameter convention

### Added — FBL-009 Event timeline

Replaced the bottom timeline placeholder with a real, filterable, virtualized event feed driven by the FBL-008 mock runtime, per `docs/02-specification/interface-model.md` ("Bottom event timeline") and the operator-authorized bounded sequence FBL-007–FBL-011. Since no command bar exists until FBL-010, `RuntimeProvider` now auto-issues the already-approved `demo.start`/`demo.resume` command on mount so the demo — and therefore the timeline — is not permanently empty; this invokes an existing bounded command, it does not invent new operational behavior. 167 unit tests total across the repo (up from 145) and 66 Playwright tests (up from 48, 18 new × 3 viewports) — all passing. Two real bugs were found and fixed by this rung's own tests: `requirement.failed`/`stage.blocked` never carried a real severity (always defaulted to "info", making the severity filter untestable against the canonical script), and a stale `scrollTop` left over from a longer unfiltered view could point past the end of a shorter filtered one, making the virtualized slice come back empty even though matching rows existed.

- `src/lib/mock-runtime/RuntimeProvider.tsx`: React context sharing one `MockRuntime` instance app-wide (timeline now, controls in FBL-010); auto-starts/resumes the demo on mount
- `src/lib/mock-runtime/sessionPersistence.ts`: frontend-local (`sessionStorage`) `{seed, cursor}` marker — never a backend — letting history reconstruct after reload by re-deriving the identical deterministic sequence from the seed, per FBL-009's explicit "without adding backend persistence" requirement
- `src/lib/mock-runtime/runtime.ts`: added `fastForwardTo`/`getCursor`/`getSeed`, used by reload reconstruction
- `src/components/timeline/EventTimeline.tsx`: chronological, filterable (severity/entity/type) event feed; fixed-height windowed rendering (bounded DOM node count regardless of total event count); pause/resume autoscroll; click-to-inspect payload detail panel; explicit disabled "Jump to world object — not yet available" state (no 3D world exists before FBL-016+, so this is never misleadingly enabled)
- `src/components/timeline/describeEvent.ts`: human-readable summary for every one of the 67 authoritative V1 event types (Principle 24 — every meaningful animation/event has a textual equivalent), with a defensive fallback for any future addition

### Added — FBL-010 2D operational controls

Implemented the selected-object detail panel, the approval card (Approve/Reject/Request revision), the stage/agent list, live-intelligence panel, and command-bar handling for the bounded V1 demo command set, per `docs/02-specification/interface-model.md` and the operator-authorized bounded sequence FBL-007–FBL-011, so an operator can inspect state and act entirely without the 3D world (Principle 23; F-02/F-06/F-07). 210 unit tests total across the repo (up from 167, 43 new) and 90 Playwright tests (up from 66, 24 new × 3 viewports) — all passing.

- `apps/agent-city/src/components/controls/StageAgentPanel.tsx`: build-stage and agent list in the left navigation region, selectable (mouse and keyboard) to drive the detail panel
- `apps/agent-city/src/components/controls/SelectedObjectDetail.tsx`: docked detail panel showing the selected stage's requirement checklist or the selected agent's state
- `apps/agent-city/src/components/controls/ApprovalCard.tsx`: unmissable pending-approval surface (stands in for "Lighthouse attention" until the Lighthouse world object exists at FBL-014+) with keyboard-reachable Approve/Reject/Request revision actions
- `apps/agent-city/src/components/controls/CommandBar.tsx`: button-only (no free-text/natural-language input) handlers for the exhaustive six-value demo command set, with visible run/paused/rejected feedback
- `apps/agent-city/src/components/controls/LiveIntelligence.tsx`, `selection.ts`: right-panel summary content and the shared `Selection` type threaded through `AppShell`
- `apps/agent-city/src/lib/mock-runtime/selectors.ts`: pure projections (stages, requirements, agents) over the runtime's event log, shared by the new controls
- `apps/agent-city/src/lib/mock-runtime/runtime.ts`: `resolveApproval` (approve/reject/request-revision against the one pending `Approval`) and real `operator.command_submitted`/`_accepted`/`_rejected` event emission for every `submitCommand` call — not just an ad hoc UI callback; a pending approval now pauses playback itself (engine-level, not just UI-level) per F-06
- `apps/agent-city/src/lib/mock-runtime/RuntimeProvider.tsx`: exposes `resolveApproval` through the shared runtime context, used by `ApprovalCard`
- `apps/agent-city/src/lib/mock-runtime/worldStateReducer.ts`: infers a `blocked` build's recovery to `running` from the next `stage.started`/`stage.completed` transition — the event vocabulary has no dedicated "unblocked" event (a documented gap), so recovery is read the same way the block itself is, from the next stage-level transition; without this, FBL-010's stage detail view kept showing a resolved requirement failure as still-blocked
- `apps/agent-city/e2e/shell-timeline.spec.ts`: updated the "first row" assertion — the first timeline row is now the auto-issued `demo.start` command's own `operator.command_submitted` feedback event (a real, correct consequence of `runtime.ts` now emitting real command events), with the canonical script's `system.started` immediately after it
- `packages/event-types/src/events/operator.ts`: loosened `operator.command_rejected`'s `commandType` field to `z.string()` — a command is often rejected precisely because its `commandType` isn't one of the approved values, so the field must be able to name whatever was actually submitted
- `apps/agent-city/e2e/shell-controls.spec.ts`: FBL-010's required browser-level tests — keyboard-only approval resolution, reject/request-revision producing real non-fabricated events, typed command emission, rejected-command feedback, and command-bar/stage-list keyboard reachability
- `apps/agent-city/e2e/shell-panels.spec.ts`: the FBL-006 Tab-order test now tabs up to a generous bound rather than exactly the panel-control count, since FBL-009/FBL-010 legitimately added their own focusable content (timeline rows, stage/agent list items, command bar controls) ahead of some panel controls in tab order — it still asserts every FBL-006 panel control remains reachable

### Added — FBL-011 Empty React Three Fiber world

Bootstrapped an empty React Three Fiber canvas (Three.js via `@react-three/fiber`, per ADR-004) hosted in the shell's central world region, per the operator-authorized bounded sequence FBL-007–FBL-011 — the final rung in that authorization. No scene content: no geometry, lights, or camera rig — that begins at FBL-012. 211 unit tests total across the repo (up from 210, 1 new) and 96 Playwright tests (up from 90, 6 new × 3 viewports, plus 1 pre-existing assertion updated in place) — all passing. Canvas mounting cannot be meaningfully verified under jsdom (no real WebGL context), so the rung's "no console/WebGL errors" and "resize handling" requirements are verified at the browser level (Playwright), consistent with how this repo has always verified real-rendering behavior (see FBL-005/006's layout/panel suites); a Vitest smoke test still confirms the component mounts without throwing, since R3F only measures (and only attempts WebGL context creation) once its container reports a non-zero size, which jsdom never does.

- `apps/agent-city/src/components/world/WorldCanvas.tsx`: empty `<Canvas>`, absolutely positioned to fill the world region; resize handling is R3F's built-in `ResizeObserver`-based container measurement — no manual wiring needed until a camera exists (FBL-012)
- `apps/agent-city/src/components/world/WorldCanvas.test.tsx`: Vitest smoke test — mounts without throwing
- `apps/agent-city/src/components/shell/AppShell.tsx`: mounts `WorldCanvas` in the world region, behind the existing FBL-010 approval card/detail panel overlays; updated the region's placeholder copy from "No 3D world yet" to reflect that the canvas now exists (no scene content until FBL-012+)
- `apps/agent-city/e2e/shell-world.spec.ts`: FBL-011's required browser-level tests — canvas mounts with no console/page errors, and the canvas fills and tracks the world region's size (including on panel-driven resize, not just initial load) — run across all three target viewports
- `apps/agent-city/e2e/shell-controls.spec.ts`: updated one FBL-010 assertion that checked for the now-changed placeholder text ("No 3D world yet" → "Empty 3D world scaffold")
- `three`, `@react-three/fiber` added as dependencies of `apps/agent-city`; `@types/three` as a dev dependency

### Stop

Operator authorization for this session's bounded execution sequence (FBL-007–FBL-011) is fully used. `FBL-012` and every later rung remain **not authorized** and were not started.

### Planned

- Build ladder rung `FBL-012` (camera and navigation) — requires separate, explicit operator authorization before it may begin

## [1.0.0] — 2026-07-30

### Changed — FBL-001 Foundation audit resolution

Resolved all 4 BLOCKER and all 6 MAJOR findings from `docs/audits/foundry-foundation-v1-audit.md` (2026-07-28) by amending active documents. Full finding-by-finding detail: `docs/audits/foundation-v1-fbl-001-closure-matrix.md`.

- `docs/01-mission/v1-scope.md`: canonicalized the work→validate→approve→transfer→dock sequence (B-01); added the named, ordered V1 `BuildStage` list and the transfer/approval scope note (B-02, B-01)
- `docs/02-specification/v1-acceptance.md`: reordered "Primary user journey" steps 9–13 to match the canonical B-01 sequence
- `docs/02-specification/domain-model.md`: added `Revision` (B-03), `Vehicle` and `AgentRun` (B-04) entities; clarified `Transfer` approval-gating scope (B-01); added missing emitted events for `Agent`, `Build`, `BuildStage`, `Transfer` (M-03); renamed `Requirement`'s emitted `requirement.completed` to `requirement.passed` (M-04); added the Warehouse Level 2 seeded-history counting rule (M-06)
- `docs/02-specification/event-model.md`: added `Revision` and `AgentRun` event families (B-03, B-04); clarified `transfer.ready` preconditions (B-01); added `build.ready`, `build.resumed`, `stage.ready`, `transfer.blocked`, `agent.returned_home` (M-03); renamed `requirement.completed` to `requirement.passed` (M-04); added the demo `commandType` contract (M-01); added `system.health_changed` health/reason vocabularies covering connection loss/restore (M-02)
- `docs/02-specification/world-model.md`: cross-referenced the B-01 approval scope on QA/Road network; cross-referenced the B-04 `Vehicle` entity on Utility vehicle
- `docs/02-specification/interface-model.md`: cross-referenced the M-01 demo command enumeration and the M-02 connection-state event mapping
- `docs/00-foundry/principles.md`: added principle 3a, the mock-engine stand-in operational authority rule (M-05)
- `docs/00-foundry/glossary.md`: added `Revision`, `Vehicle`, `AgentRun` entries

### Added — FBL-002 Foundation 1.0 approval and freeze

- `docs/audits/foundation-v1-fbl-001-closure-matrix.md`: closure matrix cross-referencing all 4 BLOCKER and all 6 MAJOR findings to their FBL-001 resolutions
- `docs/audits/foundry-foundation-v1-post-fbl-001-audit.md`: independent post-FBL-001 audit (2026-07-30) — result **PASS**, 0 open BLOCKER findings, 0 open MAJOR findings, audited amendment baseline commit `377547a`; found no inaccurate closure-matrix claim
- Recorded explicit operator approval (2026-07-30) promoting Foundry Foundation from `1.0-rc1` to `1.0`, citing the independent post-FBL-001 audit above

### Changed — Foundation 1.0 promotion

- `FOUNDATION_VERSION.md`: version updated to **1.0**, status **Approved for implementation**, implementation status **Ready**; operator approval record added
- `docs/handoffs/002-frontend-foundation.md`: BLOCKED banner removed; handoff now states implementation follows `docs/03-architecture/foundry-build-ladder.md` rung by rung and does not itself authorize a single combined build; identifies `FBL-003` as the next eligible rung; all existing scope prohibitions preserved unchanged
- `docs/03-architecture/foundry-build-ladder.md`: status and governance language updated — `FBL-001` and `FBL-002` marked complete, Foundation 1.0 approval recorded, `FBL-003` identified as next; restated that every rung still requires separate operator authorization

## [1.0.0-rc1] — 2026-07-28

### Added

- Foundry Foundation **1.0-rc1** Core Documentation Package
- Repository normalization (`apps/`, `packages/`, `docs/`, reserved dirs)
- Authoritative documents under `docs/00-foundry/` through `docs/04-future/`
- Architecture decision records ADR-001 through ADR-006
- Handoffs `001-foundation-audit.md` and `002-frontend-foundation.md` (frontend handoff blocked)

### Changed

- Platform framing: Foundry is the platform; Agent City is the first application; V1 is the first operational neighborhood

### Archived

- Pre-Foundry Agent City draft preserved at `docs/archive/foundation-v0/` (not authoritative)
