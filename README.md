# Foundry

Foundry is a spatial operating platform for autonomous organizations. It enables humans to supervise, govern, train, and evolve real autonomous work through persistent virtual environments where meaningful visual elements correspond to actual operational entities, capabilities, states, transfers, and events.

Foundry is **not**:

- a game
- a decorative virtual world
- a conventional dashboard
- an AI-agent chat interface
- Agent City alone

Foundry is the platform.

## Getting started

```sh
pnpm install
pnpm dev
```

One command starts the backend and the frontend, in that order, health-gated, and stops both on Ctrl-C. Full instructions, options, and troubleshooting: **[`docs/operations/quickstart.md`](docs/operations/quickstart.md)**.

Every configuration variable, its default, and its effect: **[`.env.example`](.env.example)**.

## Foundry versus Agent City

```text
Foundry Platform
└── Agent City
    └── V1 Operational Neighborhood
```

| Layer | Meaning |
| --- | --- |
| **Foundry** | Spatial operating platform for autonomous organizations |
| **Agent City** | First spatial application built on Foundry |
| **V1 Operational Neighborhood** | First mission: one ultrawide neighborhood supervising one AI-assisted software-build workflow |

Do not describe Foundry as an operating system unless a future approved architecture decision explicitly adopts that classification.

## V1 objective

Build Agent City V1: a full-screen ultrawide operational neighborhood through which one human operator can supervise one AI-assisted software-build workflow from objective submission through planning, implementation, validation, approval, completion, and one capability-based upgrade.

## Core operational philosophy

> The virtual world is never a simulation of work. It is a spatial representation of real work.

- Backend state owns operational truth.
- Frontend state renders and temporarily caches truth.
- Meaningful animations require declared operational events.
- Humans govern; agents execute within explicit authority.
- Only the active mission may be implemented.
- Future Registry concepts do not authorize work.

## Documentation authority order

```text
1. Foundation version and active mission
2. Foundry principles
3. V1 scope and exclusions
4. Specification documents
5. Accepted architecture decisions
6. Implementation plan
7. Future Registry
8. Archived documents
```

Archived documents must never override active documents.

| Priority | Path |
| --- | --- |
| 1 | `FOUNDATION_VERSION.md`, `docs/01-mission/active-mission.md` |
| 2 | `docs/00-foundry/principles.md` |
| 3 | `docs/01-mission/v1-scope.md`, `docs/01-mission/exclusions.md` |
| 4 | `docs/02-specification/` |
| 5 | `docs/03-architecture/decisions/` |
| 6 | `docs/03-architecture/implementation-plan.md` |
| 7 | `docs/04-future/registry.md` |
| 8 | `docs/archive/foundation-v0/` (historical only) |

Supporting context: `docs/00-foundry/vision.md`, `docs/00-foundry/glossary.md`.

## Repository map

```text
apps/agent-city/     Agent City application (Next.js + React Three Fiber)
apps/api/            Backend service — owns operational truth (ADR-002)
packages/            Shared contracts, event types, world model, adapters, persistence, UI
docs/00-foundry/     Vision, glossary, principles
docs/01-mission/     Active mission, scope, exclusions
docs/02-specification/ World, domain, event, interface, acceptance
docs/03-architecture/ Implementation plan, Build Ladder, and ADRs
docs/04-future/      Future Registry (non-active)
docs/audits/         Audit deliverables
docs/proposals/      Proposals awaiting review (non-authoritative)
docs/evidence/       Per-rung evidence and operator records (append-only)
docs/handoffs/       Claude Code / agent handoffs
docs/archive/        Historical drafts (not authoritative)
assets/ config/ scripts/ tools/ tests/   Reserved placeholders
```

## Current status

| Item | Value |
| --- | --- |
| Foundation | **1.0** — approved and frozen (2026-07-30) |
| Status | Approved for implementation |
| Active application | Agent City |
| Active mission | **V1.1 — Operational Readiness and First Real Build**, ratified 2026-08-03 |
| Prior mission | V1 Operational Neighborhood — **Complete** (2026-08-01) |
| Application code | `apps/agent-city`, `apps/api`, and six shared packages |
| Dependencies installed | Yes (pnpm workspace, eight projects) |
| Implementation | **V1 complete** — `FBL-001`–`FBL-035` including `FBL-021A`, each closed under its own operator authorization |
| Tests | 813 unit/integration tests across 78 files, plus browser, WebKit, and performance suites |
| Open item carried past completion | **Finding 6** — three undiagnosed Playwright-WebKit failures, accepted by operator decision rather than resolved |

`FOUNDATION_VERSION.md` is the authoritative record of foundation version and mission status. `docs/03-architecture/foundry-build-ladder.md` is the closed V1 implementation program.

## Implementation authority

Foundation 1.0 is frozen and approved for implementation. Further implementation work required a new reviewed mission baseline; **that baseline exists** — Agent City **V1.1**, ratified 2026-08-03, governed by `docs/01-mission/agent-city-v1.1-mission.md` and `docs/03-architecture/agent-city-v1.1-build-ladder.md`. Work proceeds rung by rung on the `AC-1xx` ladder, and **each rung still requires its own explicit operator authorization** — the ladder grants none standing.

The V1 Build Ladder reached its terminal stop at `FBL-035` and is closed. Completed `FBL-*` rungs are historical: never reopened, renumbered, or re-graded.

Substantive changes to principles, mission scope, domain language, or ADRs require a new reviewed mission baseline, not a silent edit. See `FOUNDATION_VERSION.md` § "Change control".
