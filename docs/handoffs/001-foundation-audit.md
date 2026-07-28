# Handoff 001 — Foundation Audit

You are auditing **Foundry Foundation 1.0-rc1**.

## Mandatory instructions

1. Read all **active** Foundry documents:
   - `FOUNDATION_VERSION.md`
   - `README.md`
   - `docs/00-foundry/` (vision, glossary, principles)
   - `docs/01-mission/` (active-mission, v1-scope, exclusions)
   - `docs/02-specification/` (world, domain, event, interface, acceptance)
   - `docs/03-architecture/implementation-plan.md`
   - `docs/03-architecture/decisions/` (ADR-001 … ADR-006)
   - `docs/04-future/registry.md`
2. **Ignore** `docs/archive/foundation-v0/` as implementation authority (historical only).
3. Write **no** application code.
4. Install **no** dependencies.
5. Do **not** modify the specifications.
6. Do **not** expand V1 scope.
7. Treat the Future Registry as non-active.

## Find and classify

Identify:

- contradictions
- undefined terminology
- impossible lifecycles
- events without producers
- visual states without events
- acceptance tests unsupported by the models
- Future Registry leakage into V1

Classify each finding as **BLOCKER**, **MAJOR**, **MINOR**, or **OPTIONAL**.

Cite exact source file and heading for every finding.

## Deliverable

Save findings only to:

`docs/audits/foundry-foundation-v1-audit.md`

Suggested structure:

1. Executive assessment
2. BLOCKER findings
3. MAJOR findings
4. MINOR findings
5. OPTIONAL findings
6. Terminology gaps
7. Lifecycle / state-machine issues
8. Event-model issues
9. Acceptance gaps
10. Future Registry leakage
11. Recommended next actions

## Stop condition

After writing the audit, print a concise summary and **stop**. Do not begin implementation. Do not modify governing docs.
