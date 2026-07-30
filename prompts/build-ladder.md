# Prompt: Build Foundry Build Ladder

Create the Foundry Build Ladder for Agent City V1.

Before writing anything, read:

- `FOUNDATION_VERSION.md`
- `README.md`
- `docs/00-foundry/`
- `docs/01-mission/`
- `docs/02-specification/`
- `docs/03-architecture/`
- `docs/audits/foundry-foundation-v1-audit.md`

Treat `docs/archive/` and `docs/04-future/` as non-authoritative for V1 implementation.

Do not write application code.
Do not install dependencies.
Do not modify existing specifications.
Do not begin any implementation rung.

## Create

`docs/03-architecture/foundry-build-ladder.md`

The Build Ladder must convert the approved V1 architecture into a sequential implementation program.

## For every rung include

1. Rung number and name
2. Objective
3. Why this rung exists
4. Prerequisites
5. Authoritative source documents
6. Allowed work
7. Explicitly prohibited work
8. Expected files and deliverables
9. Required automated tests
10. Required visual or operator validation
11. Acceptance criteria
12. Failure and rollback conditions
13. Stop condition
14. Dependency on the next rung

## Identifiers

Use stable sequential identifiers such as:

- FBL-001
- FBL-002
- FBL-003

Do not renumber completed rungs later. New intermediate work must use suffixes such as `FBL-006A`.

## Minimum required rungs

At minimum, define separate rungs for:

- Foundation audit resolution
- Foundation 1.0 approval and freeze
- Monorepo/tooling foundation
- Frontend application scaffold
- Ultrawide shell
- Panel framework
- Shared contracts
- Deterministic mock runtime
- Event timeline
- 2D operational controls
- Empty React Three Fiber world
- Camera and navigation
- Lighting and environment
- Lighthouse
- Object selection
- Three residences
- Operational buildings
- Roads
- Utility vehicle
- Agent representations
- Event-to-world mapping
- Complete simulated V1 workflow
- Persistence foundation
- Backend API
- State machines and prerequisite enforcement
- Realtime event delivery
- Runtime adapter boundary
- Controlled Claude Code execution
- Independent Inspector validation
- Human approval workflow
- Capability-based upgrade
- Restart and recovery
- Accessibility and reduced motion
- Ultrawide performance validation
- Complete V1 acceptance verification

Use contract-first vertical slices.

## Rules the ladder must preserve

- Backend state eventually owns operational truth.
- The frontend may initially use deterministic mock events.
- The mock runtime must remain available after backend integration.
- Meaningful animations must be event-driven.
- Claude Code cannot self-certify successful work.
- Inspector validation must remain independent from Builder execution.
- Future Registry concepts must not enter V1.
- A rung cannot begin until its prerequisites and the preceding rung's completion gate are satisfied.
- Every rung must end with verification and a hard stop.
- No rung may silently continue into the next rung.

## Include these final sections

- Ladder overview table
- Critical dependency path
- Rungs that may safely run in parallel
- Human visual-review gates
- Security and authority gates
- Definition of V1 completion
- Rules for amending the ladder

If the Foundation audit contains unresolved BLOCKER or MAJOR findings, make resolving them the first rung and explicitly block implementation until complete.

## After creating the file

1. Validate it against `docs/03-architecture/implementation-plan.md`.
2. Validate every V1 acceptance requirement has at least one implementing rung and one verification rung.
3. Report any specification gap discovered.
4. Do not modify other files.
5. Stop.
