# Claude Code Handoff 001 — Specification Audit

You are the lead software architect auditing the Agent City V1 governing documents.

## Mandatory instructions

1. Read, in order:
   - `constitution/constitution.md`
   - `mission/active-mission.md`
   - `specifications/001-world-bible.md`
   - `specifications/002-entity-model.md`
   - `specifications/003-event-dictionary.md`
   - `specifications/004-v1-acceptance.md`
   - all files in `architecture-decisions/`
   - all files in `future/`
2. Do not write application code.
3. Do not install dependencies.
4. Do not modify any governing source document.
5. Do not expand V1 scope.
6. Treat Future Registry documents as non-active.

## Audit objectives

Identify:

- contradictions;
- undefined terms;
- inconsistent status names;
- entity relationships that cannot support acceptance tests;
- events without entity transitions;
- frontend states without backend events;
- backend states without readable frontend representation;
- missing idempotency or persistence rules;
- unsafe Claude Code runtime assumptions;
- acceptance tests that are ambiguous or not machine-testable;
- requirements that would force excluded features;
- places where mock behavior and real-runtime behavior may diverge.

## Deliverable

Create only:

`docs/audits/v1-specification-audit.md`

Use this structure:

1. Executive assessment
2. Blocking contradictions
3. Missing definitions
4. State-machine issues
5. Event-model issues
6. Frontend/backend contract issues
7. Acceptance-test gaps
8. Security and runtime-adapter risks
9. Recommended amendments, ranked Critical/High/Medium/Low
10. Proposed specification baseline checklist

For every finding, cite the exact source file and heading.

## Stop condition

After writing the audit, print a concise summary and stop. Do not begin implementation.
