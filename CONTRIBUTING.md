# Contributing to Foundry

## Authority order

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

Archived documents under `docs/archive/` must never override active documents.

Current foundation status is **1.0** — approved and frozen (2026-07-30). Agent City V1 is complete (2026-08-01); the V1 Build Ladder reached its terminal stop at `FBL-035`. Further implementation requires a new reviewed mission baseline.

## Rules

1. Do not expand the active mission without an explicit mission amendment.
2. Do not implement Future Registry concepts.
3. Prefer contract-first vertical slices (ADR-003).
4. Backend owns operational truth (ADR-002). Frontend may display, cache, interpolate, and animate—never unilaterally declare completion, approval, transfer readiness, or upgrade activation.
5. Meaningful world activity must correspond to real events.
6. Record new out-of-scope ideas in the Future Registry, then return to the active mission.
7. Do not commit secrets, credentials, or local environment files.
8. Do not write application code outside an authorized rung of the active mission's build ladder. Completed rungs are historical: never reopened, renumbered, or re-graded. When no ladder rung is authorized, no application code may be written.

## Documentation changes

- Clarify wording without changing meaning: update the document and note in `CHANGELOG.md`.
- Change principles, scope, domain language, or ADRs: update `FOUNDATION_VERSION.md` and `CHANGELOG.md`.

## Code changes (when authorized)

- Keep shared language in `packages/contracts`, `packages/event-types`, and `packages/world-model`.
- Keep runtime integrations behind `packages/runtime-adapters`.
- Put Agent City application code in `apps/agent-city/`.

## Pull requests

PRs should state which foundation documents they implement or amend, which acceptance criteria they address, and what remains out of scope.
