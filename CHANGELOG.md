# Changelog

All notable changes to the Foundry repository and Foundation baseline are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed — FBL-001 Foundation audit resolution

Resolved all 4 BLOCKER and all 6 MAJOR findings from `docs/audits/foundry-foundation-v1-audit.md` (2026-07-28) by amending active documents. Foundation remains **1.0-rc1**; this is documentation-only and does not advance, approve, or freeze the baseline (that is FBL-002, not yet executed). Full finding-by-finding detail: `docs/audits/foundation-v1-fbl-001-closure-matrix.md`.

- `docs/01-mission/v1-scope.md`: canonicalized the work→validate→approve→transfer→dock sequence (B-01); added the named, ordered V1 `BuildStage` list and the transfer/approval scope note (B-02, B-01)
- `docs/02-specification/v1-acceptance.md`: reordered "Primary user journey" steps 9–13 to match the canonical B-01 sequence
- `docs/02-specification/domain-model.md`: added `Revision` (B-03), `Vehicle` and `AgentRun` (B-04) entities; clarified `Transfer` approval-gating scope (B-01); added missing emitted events for `Agent`, `Build`, `BuildStage`, `Transfer` (M-03); renamed `Requirement`'s emitted `requirement.completed` to `requirement.passed` (M-04); added the Warehouse Level 2 seeded-history counting rule (M-06)
- `docs/02-specification/event-model.md`: added `Revision` and `AgentRun` event families (B-03, B-04); clarified `transfer.ready` preconditions (B-01); added `build.ready`, `build.resumed`, `stage.ready`, `transfer.blocked`, `agent.returned_home` (M-03); renamed `requirement.completed` to `requirement.passed` (M-04); added the demo `commandType` contract (M-01); added `system.health_changed` health/reason vocabularies covering connection loss/restore (M-02)
- `docs/02-specification/world-model.md`: cross-referenced the B-01 approval scope on QA/Road network; cross-referenced the B-04 `Vehicle` entity on Utility vehicle
- `docs/02-specification/interface-model.md`: cross-referenced the M-01 demo command enumeration and the M-02 connection-state event mapping
- `docs/00-foundry/principles.md`: added principle 3a, the mock-engine stand-in operational authority rule (M-05)
- `docs/00-foundry/glossary.md`: added `Revision`, `Vehicle`, `AgentRun` entries

### Planned

- Foundation freeze (FBL-002): closure matrix review, a fresh consistency audit, and explicit operator approval before promoting `1.0-rc1` to `1.0`
- Frontend foundation work under `apps/agent-city/` after audit clearance and promotion

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
