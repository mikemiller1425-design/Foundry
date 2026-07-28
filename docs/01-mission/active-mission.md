# Active Mission — Agent City V1

**Foundation:** 1.0-rc1  
**Mission status:** Active (documentation only; implementation blocked pending audit)  
**Application:** Agent City  
**Neighborhood:** V1 Operational Neighborhood

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
| Foundation documentation (1.0-rc1) | In progress / complete pending audit |
| Foundation audit | Required next |
| Application code | Not started — **blocked** |
| Frontend foundation handoff | **BLOCKED** until audit review |

## Completion gate

V1 is complete only when every mandatory acceptance test in `docs/02-specification/v1-acceptance.md` passes, excluded features remain unimplemented, and documentation matches behavior.

## Stop condition

No excluded feature may be added as a substitute for a failing required feature. No application code may start until the foundation audit is reviewed and blocking findings are resolved.

## Related documents

- Scope: `docs/01-mission/v1-scope.md`
- Exclusions: `docs/01-mission/exclusions.md`
- Acceptance: `docs/02-specification/v1-acceptance.md`
- Audit handoff: `docs/handoffs/001-foundation-audit.md`
