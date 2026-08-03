# Foundry Foundation Version

```text
Foundry Foundation: 1.0
Status: Approved for implementation
Active application: Agent City
Active mission: V1.1 Operational Readiness and First Real Build
Active mission status: Active — ratified 2026-08-03
Prior mission: V1 Operational Neighborhood — Complete 2026-08-01
Agent City V1 implementation: Complete
Completion date: 2026-08-01
Final approval commit: f78a675
```

| Field | Value |
| --- | --- |
| Foundation version | **1.0** |
| Status | Approved for implementation |
| Active application | Agent City |
| Active mission | **V1.1 — Operational Readiness and First Real Build** |
| Active mission status | **Active** — ratified 2026-08-03 at `AC-102` |
| Active mission document | `docs/01-mission/agent-city-v1.1-mission.md` |
| Active mission ladder | `docs/03-architecture/agent-city-v1.1-build-ladder.md` (`AC-101`–`AC-120`, plus the preserved pre-ladder proof `AC-103P`) |
| Active mission acceptance | `docs/02-specification/v1.1-acceptance.md` |
| Prior mission | V1 Operational Neighborhood — **Complete** 2026-08-01 |
| Agent City V1 implementation | **Complete** — every rung `FBL-001`–`FBL-035` (including the `FBL-021A` amendment rung) closed with its own operator authorization |
| Completion date | **2026-08-01** |
| Final approval commit | **`f78a675`** |
| Final approval record | `docs/evidence/fbl-035/operator-final-approval.md` |
| Open item carried past completion | **Finding 6** — three unclassified Playwright-WebKit automation failures, accepted by operator decision at approval time and **not** resolved. See the record above. |
| Closed V1 mission document | `docs/01-mission/active-mission.md` |
| Audit handoff | `docs/handoffs/001-foundation-audit.md` |
| Independent post-FBL-001 audit | `docs/audits/foundry-foundation-v1-post-fbl-001-audit.md` (2026-07-30 — PASS, 0 BLOCKER, 0 MAJOR) |
| Prior draft archive | `docs/archive/foundation-v0/` |

## Authority

Active governing documents under `docs/00-foundry/`, `docs/01-mission/`, `docs/02-specification/`, and `docs/03-architecture/` constitute **Foundry Foundation 1.0**.

This baseline is approved for implementation. `docs/archive/foundation-v0/` is historical only and must not be used for implementation.

## Operator approval record

- **Approved by:** mikemiller1425-design (human operator)
- **Date:** 2026-07-30
- **Basis:** `docs/audits/foundry-foundation-v1-post-fbl-001-audit.md` — independent post-FBL-001 audit, result **PASS**, 0 open BLOCKER findings, 0 open MAJOR findings, audited amendment baseline commit `377547a`
- **Scope of this approval:** Promotion of Foundry Foundation from `1.0-rc1` to `1.0` only. It does not authorize any individual implementation rung — each rung on `docs/03-architecture/foundry-build-ladder.md` still requires its own separate, explicit operator authorization before it may begin.

## Mission completion status

Agent City V1 reached the Build Ladder's terminal stop (`FBL-035`) and was approved by the operator on **2026-08-01** with the wording `I APPROVE AGENT CITY V1 FOR COMPLETION`, against commit `f78a675`. The append-only record is `docs/evidence/fbl-035/operator-final-approval.md`.

**This section is operational status only.** It records that the active mission finished. It is **not** a new mission baseline, a specification amendment, or a change to any principle, domain term, or ADR — Foundry Foundation 1.0 and every frozen architectural meaning are unchanged, and the "Authority", "Operator approval record", and "Change control" sections below and above are untouched in substance. Per the change-control rule, this is a clarification that does not change meaning.

**One item remains explicitly open.** Finding 6 — three undiagnosed Playwright-WebKit automation failures (`shell-selection.spec.ts:150` at two viewports, `shell-event-to-world-mapping.spec.ts:119`) — was open when approval was given and was **accepted by operator decision rather than resolved**. It must not be read as an accepted non-defect. Real macOS Safari was separately observed to pass, and `v1-acceptance.md` requires Safari to work rather than requiring Playwright's WebKit build to be green.

Further implementation work required a new reviewed mission baseline. **That baseline exists as of 2026-08-03:** Agent City **V1.1**, ratified at `AC-102` — see the "Active mission" rows above. It promotes **nothing** from the Future Registry; it completes what V1 already scoped. `FOUNDATION_VERSION.md` had anticipated a new baseline only via Future Registry promotion and had no category for this case, which is recorded in `docs/audits/agent-city-post-v1-reconciliation.md` § 3.

V1.1 work proceeds on its own ladder (`AC-101` onward) in a namespace disjoint from `FBL-*`. The V1 Build Ladder is closed and untouched.

**One item from V1 remains open and is carried into V1.1:** Finding 6, owned by rung `AC-103`, still undiagnosed. A pre-ladder proof of objective submission (`AC-103P`) landed under direct operator authorization before the ladder was ratified; it closes no rung. See `docs/audits/agent-city-v1.1-rung-label-reconciliation.md`.

## Change control

- Clarifications that do not change meaning: update documents and `CHANGELOG.md`.
- Changes to principles, mission scope, domain language, or ADRs: update this file and `CHANGELOG.md`.
- Foundation 1.0 is frozen. Substantive changes to principles, mission scope, domain language, or ADRs require a new reviewed mission baseline, not a silent edit.
