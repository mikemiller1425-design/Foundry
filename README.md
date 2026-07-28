# Foundry

Foundry is a spatial operating platform for autonomous organizations. It enables humans to supervise, govern, train, and evolve real autonomous work through persistent virtual environments where meaningful visual elements correspond to actual operational entities, capabilities, states, transfers, and events.

Foundry is **not**:

- a game
- a decorative virtual world
- a conventional dashboard
- an AI-agent chat interface
- Agent City alone

Foundry is the platform.

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
apps/agent-city/     Agent City application (not implemented yet)
packages/            Shared contracts, event types, world model, adapters, UI
docs/00-foundry/     Vision, glossary, principles
docs/01-mission/     Active mission, scope, exclusions
docs/02-specification/ World, domain, event, interface, acceptance
docs/03-architecture/ Implementation plan and ADRs
docs/04-future/      Future Registry (non-active)
docs/audits/         Audit deliverables
docs/handoffs/       Claude Code / agent handoffs
docs/archive/        Historical drafts (not authoritative)
assets/ config/ scripts/ tools/ tests/   Reserved placeholders
```

## Current status

| Item | Value |
| --- | --- |
| Foundation | **1.0-rc1** |
| Status | Awaiting specification audit |
| Application code | None |
| Dependencies installed | None |
| Implementation | **Blocked** |

## Implementation blocked

Do not write application code, install dependencies, scaffold Next.js, or begin frontend/backend implementation until:

1. `docs/handoffs/001-foundation-audit.md` is executed
2. Findings are saved to `docs/audits/foundry-foundation-v1-audit.md`
3. Blocking findings are reviewed and resolved
4. Foundation status is explicitly advanced beyond `1.0-rc1`

`docs/handoffs/002-frontend-foundation.md` is **BLOCKED** until that review completes.
