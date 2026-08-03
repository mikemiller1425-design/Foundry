# Handoff 002 — Frontend Foundation

> **HISTORICAL RECORD (banner added 2026-08-03).** This handoff is **spent**. Every rung it anticipated is closed: `FBL-001`–`FBL-035`, including `FBL-021A`, completed with final operator approval on 2026-08-01. The "next eligible rung" line below was accurate when written and has not been true since `FBL-003` closed; it is preserved unedited as part of the record rather than corrected in place. **Nothing in this document authorizes any work.** See `FOUNDATION_VERSION.md` and `docs/03-architecture/foundry-build-ladder.md` for current status; `docs/audits/agent-city-post-v1-truth-audit.md` PV1-009 for the finding.

```text
Foundation: 1.0 — approved for implementation
Implementation follows docs/03-architecture/foundry-build-ladder.md
Next eligible rung: FBL-003 — Monorepo and tooling foundation
```

**This handoff is reference material describing eventual frontend-foundation scope — it is not a single authorized build.** It does not itself grant execution authority. Implementation proceeds rung by rung per `docs/03-architecture/foundry-build-ladder.md`; each rung — starting with `FBL-003` — requires its own separate, explicit operator authorization before it may begin. Do not treat the deliverables below as one combined task to execute now.

## Mission (future)

Create the production frontend foundation for Agent City V1 inside `apps/agent-city/`. Implement only the shell, shared contracts, deterministic local demo/mock data adapter, and placeholder 3D neighborhood composition.

## Approved stack

- Next.js
- TypeScript
- React
- React Three Fiber
- Three.js
- Tailwind CSS
- Zustand
- Vitest
- Playwright

## Deliverables (per build ladder sequencing)

- full-screen ultrawide application shell
- left navigation, center world, right live-intelligence, bottom event timeline, command input
- placeholder geometry for all V1 world objects
- selection sync between canvas and navigator
- deterministic demo events using shared contracts
- accessible labels and keyboard selection
- responsive behavior at required viewports
- tests for layout, selection, event rendering, idempotent duplicates

## Prohibit

- Backend implementation
- Claude Code runtime integration
- OpenClaw integration
- Database
- External integrations
- Future Registry features
- Detailed production 3D assets
- Using `docs/archive/foundation-v0/` as authority

## Definition of done (per build ladder sequencing)

Typecheck, lint, unit tests, Playwright smoke, production build all pass. Provide summary, folder tree, test results, and unresolved risks. Stop.
