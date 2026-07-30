# Foundry Foundation Version

```text
Foundry Foundation: 1.0
Status: Approved for implementation
Active application: Agent City
Active mission: V1 Operational Neighborhood
Implementation status: Ready
```

| Field | Value |
| --- | --- |
| Foundation version | **1.0** |
| Status | Approved for implementation |
| Active application | Agent City |
| Active mission | V1 Operational Neighborhood |
| Implementation | **Ready** — see `docs/03-architecture/foundry-build-ladder.md`; each rung still requires separate operator authorization |
| Active mission document | `docs/01-mission/active-mission.md` |
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

## Change control

- Clarifications that do not change meaning: update documents and `CHANGELOG.md`.
- Changes to principles, mission scope, domain language, or ADRs: update this file and `CHANGELOG.md`.
- Foundation 1.0 is frozen. Substantive changes to principles, mission scope, domain language, or ADRs require a new reviewed mission baseline, not a silent edit.
