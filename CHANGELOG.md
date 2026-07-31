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
