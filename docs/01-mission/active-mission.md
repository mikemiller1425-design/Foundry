# Agent City V1 Mission — Closed

**Foundation:** 1.0  
**Mission status:** **Complete** — 2026-08-01  
**Application:** Agent City  
**Neighborhood:** V1 Operational Neighborhood  
**Superseded as the active mission by:** `docs/01-mission/agent-city-v1.1-mission.md` (V1.1, ratified 2026-08-03)

> **Active-mission pointer (2026-08-03, `AC-102`).** This document is **no longer the active mission**; it is the closed V1 mission record. The active mission is **Agent City V1.1 — Operational Readiness and First Real Build**, ratified 2026-08-03 and governed by `docs/01-mission/agent-city-v1.1-mission.md`, `docs/02-specification/v1.1-acceptance.md`, and `docs/03-architecture/agent-city-v1.1-build-ladder.md`.
>
> Nothing about V1 changed. Its mission definition, scope, completion gate, and evidence are untouched; `FBL-001`–`FBL-035` remain historical completed authority, never reopened or re-graded. Only the *which mission is active* pointer moved, which is why this is recorded as an append-only clarification rather than an edit to the V1 text below.

> **Status clarification (2026-08-03).** This document's *mission definition* — statement, primary user, display, hypothesis, completion gate — is Foundation 1.0 text and is unchanged in substance. Only the **operational status metadata** below has been corrected, under the change-control rule for clarifications that do not change meaning (`FOUNDATION_VERSION.md` § "Change control"). Before this correction the document stated in the present tense that implementation was blocked and had not begun, which contradicted `FOUNDATION_VERSION.md` — the other priority-1 document — and had been false since implementation began. See `docs/audits/agent-city-post-v1-truth-audit.md` PV1-002.

## Mission statement

> Build Agent City V1: a full-screen ultrawide operational neighborhood through which one human operator can supervise one AI-assisted software-build workflow from objective submission through planning, implementation, validation, approval, completion, and one capability-based upgrade.

## Primary user

One human **operator**.

## Primary display

49-inch ultrawide (preferred 5120×1440), with supported fallbacks at 3840×1080 and 2560×1440.

## Product hypothesis

A persistent operational world—residences, workplaces, institutions, cargo, vehicles, gates, and a Lighthouse—can make agent activity, prerequisites, blocked work, approvals, failures, and capability progression understandable within ten seconds while preserving exact controls and evidence in conventional interface panels.

## Current development status

| Stage | Status |
| --- | --- |
| Foundation documentation | **Complete** — promoted to approved `1.0` on 2026-07-30 and frozen |
| Foundation audit | **Complete** — `docs/audits/foundry-foundation-v1-post-fbl-001-audit.md`, result PASS |
| Application code | **Complete** — `apps/agent-city`, `apps/api`, six shared packages |
| Build Ladder | **Complete** — `FBL-001`–`FBL-035` including `FBL-021A`, terminal stop reached |
| Frontend foundation handoff | Superseded by the Build Ladder; retained as historical reference |

## Completion gate

V1 is complete only when every mandatory acceptance test in `docs/02-specification/v1-acceptance.md` passes, excluded features remain unimplemented, and documentation matches behavior.

**This gate was reached.** The operator approved completion on 2026-08-01 against commit `f78a675` with the wording `I APPROVE AGENT CITY V1 FOR COMPLETION`. The append-only record is `docs/evidence/fbl-035/operator-final-approval.md`; the verification report is `docs/evidence/fbl-035/v1-acceptance-report.md`.

**One item was open at approval and remains open.** Finding 6 — three undiagnosed Playwright-WebKit failures — was **accepted by operator decision rather than resolved**, and must not be read as an accepted non-defect. `v1-acceptance.md` requires Safari to work, not Playwright's WebKit build to be green; real macOS Safari was separately observed to pass.

## Stop condition

No excluded feature may be added as a substitute for a failing required feature.

**This mission is closed.** No further application code may be written under it. Any further implementation work requires a **new reviewed mission baseline**; this document grants no standing authorization, and completed `FBL-*` rungs are historical — never reopened, renumbered, or re-graded.

## Related documents

- Scope: `docs/01-mission/v1-scope.md`
- Exclusions: `docs/01-mission/exclusions.md`
- Acceptance: `docs/02-specification/v1-acceptance.md`
- Build Ladder (closed): `docs/03-architecture/foundry-build-ladder.md`
- Final approval: `docs/evidence/fbl-035/operator-final-approval.md`
- Audit handoff (historical): `docs/handoffs/001-foundation-audit.md`
- **Active mission (V1.1):** `docs/01-mission/agent-city-v1.1-mission.md`
- **Active ladder (V1.1):** `docs/03-architecture/agent-city-v1.1-build-ladder.md`
