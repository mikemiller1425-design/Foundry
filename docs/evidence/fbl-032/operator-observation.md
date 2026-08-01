# FBL-032 — Operator Observation Record

**Status:** ✅ **OBSERVED AND APPROVED**
**Rung:** FBL-032 — Restart and recovery
**Confirmed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Operator response:** `APPROVED — CONTINUE`
**Implementation commit observed:** `96968c1` (`test: prove restart and recovery across every reachable state (FBL-032)`)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What was observed

Four restoration checks against the real backend (`:4000`, SQLite-backed) and the real frontend (`:3000`), each exercised by **both** a browser reload and a full backend restart:

1. **Mid-build** — a running/validating stage returned identically after reload and after restart, rebuilt from the persisted log alone.
2. **Blocked** — an Inspector validation failure turned QA red; the red state and the inspectable failure record survived reload and restart.
3. **Pending approval** — the approval card and the Lighthouse attention signal were restored after reload and restart, with the approval still pending and still gating progression.
4. **Post-completion** — the resolved approval retained `resolvedBy: operator-1` across restart, a conflicting reversal was still refused, and an upgrade eligibility evaluation was correctly refused on real metrics (9/10 packages) rather than assumed.

## Procedural note

An earlier `APPROVED — CONTINUE` arrived before this gate had been presented — no services were running and no steps had been given, so nothing could have been observed. It was **not** recorded as an observation. This record covers only the observation performed after the gate was actually presented.

## Scope of this confirmation

This records the operator's **observation** that FBL-032 behaves correctly as demonstrated, satisfying the rung's field 10 and its stop condition ("full recovery suite green across all reachable states, **operator-observed** for at least the four states listed").

It does not re-open or alter any earlier approval or observation.

## What this rung established

- **ADR-002's closing property holds:** truth that cannot survive a restart is not truth, and every state the workflow can reach is reconstructed from the persisted log alone.
- **V-07 survives a restart** — an upgrade interrupted mid-`upgrading` recovers at Level 1 / capacity 25, so a restart cannot be used to smuggle in an unearned capability change.
- **Authorization is not in-memory state** — after a restart an unauthorized command is still refused, and a client reconnecting with pre-restart state that resubmits a conflicting decision is rejected rather than silently applied.
- **No earlier-rung defect was revealed**, so no earlier rung was reopened. Had one been, the ladder requires repairing it in the responsible rung rather than patching it here.

## Residual risks carried forward

- The **5120×1440 `approval-card` timeout** and **`shell-timeline.spec.ts:118`** did not appear in this rung's browser run (342 passed / 0 failed — the first fully clean run of the sequence). **One clean run does not retire them**; both remain open intermittent defects assigned to FBL-034.
- The operator credential does not survive a browser reload, by design — V1 has no session system.
- Recovery is proven for states reachable through the real command path. The mock runtime's in-memory playback is not restart-recoverable, which is correct: it is not the authority (ADR-001).

## Effect on the ladder

FBL-032's stop condition is **met** and the rung is **closed**.

FBL-033 (accessibility and reduced motion) is the next rung of the operator-authorized sequence and is authorized to begin.
