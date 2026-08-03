# AC-103 — Operator Verification Record

**Status:** ✅ **VERIFIED AND REPORTED BY THE OPERATOR**
**Rung:** AC-103 — Operator objective submission (V1.1 first implementation slice)
**Verified by:** mikemiller1425-design (human operator)
**Date:** 2026-08-03
**Verified against:** commit `9345a04` — `fix: advance the world-state projection with the event log (AC-103)`
**Mode:** backend mode (`apps/agent-city` against a live `apps/api`), two-terminal startup

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What the operator verified

The operator manually exercised objective submission in backend mode and reports the **objective-submission fix as verified**.

This follows the operator's own defect report against the preceding commit (`e1fa301`), in which a successful submission left "Current build" reading "No build yet." and the objective text appeared duplicated in the timeline. Both defects were diagnosed, fixed, and covered by regression tests in `9345a04`; this record confirms the operator has since seen the corrected behaviour in the running application.

## Standing and scope of this record

Stated precisely, because the difference matters:

- This is an **operator-reported manual verification**, not an assistant-witnessed one. The assistant did not observe the operator's session. It carries exactly the weight the operator's own report carries — the same standing as `docs/evidence/fbl-035/real-safari-observation.md`.
- It covers **objective submission in backend mode**. It is not an acceptance sign-off for `AC-103` as a whole, and it does not close the rung.
- It does **not** cover the browser suite, the six backend-mode screenshot baselines, or Finding 6. Each of those remains open on its own terms — see below.

## What remains open at the time of this record

- **The six backend-mode screenshot baselines** under `apps/agent-city/e2e/shell-realtime-connection.spec.ts-snapshots/` are expected to differ: the left navigator now carries the objective control, and `build.created`'s timeline description changed. The operator has **explicitly instructed that no baseline be regenerated, updated, or accepted** pending review. They remain as captured at `FBL-035`.
- **Finding 6** — the three unclassified Playwright-WebKit failures carried from V1 — remains open and undiagnosed, re-sequenced behind this product promise and preserved as required follow-up work.
- **The one-command startup** (V1.1 journey step 1) remains deferred by operator decision; this verification used the existing two-terminal startup.

## Automated evidence at this commit

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **924 passed / 80 files / 0 failures** (contracts 68, ui 18, world-model 7, event-types 14, runtime-adapters 128, persistence 169, agent-city 467, api 57).

The automated suite is not what this record attests to. It is recorded here so a later reader can see what was and was not machine-checked alongside the human check.
