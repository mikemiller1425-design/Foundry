# FBL-031 — Operator Observation Record

**Status:** ✅ **OBSERVED AND APPROVED**
**Rung:** FBL-031 — Capability-based Warehouse upgrade
**Confirmed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Operator response:** `APPROVED — CONTINUE`
**Implementation commits observed:** `6cccf5c` (implementation), `c715028` (operator seed helper)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What was observed

Three checks against the real backend (`:4000`, SQLite-backed) and the real frontend (`:3000`), with the upgrade made eligible by genuine operational history (ten successful packages, per the M-06 counting rule) rather than by fiat:

1. **Level 1 / capacity 25 before approval.** The Warehouse showed level 1 and capacity 25, with the Level 2 geometry not rendered, while the upgrade was merely `eligible` and the approval still pending.
2. **No premature change during `upgrading`.** After the operator approved the gate and the upgrade was requested, approved, and started, the Warehouse displayed the `upgrading` status while **level remained 1 and capacity remained 25** — the V-07 assertion.
3. **Level 2 and capacity 100 appeared together.** Only on `upgrade.completed` did the level become 2, the capacity become 100, and the Level 2 geometry render — atomically, with no intermediate state showing one without the other. A duplicate completion was refused as an idempotent no-op and did not double-apply the change.

## Scope of this confirmation

This records the operator's **observation** that FBL-031 behaves correctly as demonstrated, satisfying the rung's field 10 and its stop condition ("F-11/V-07 tests green **and operator-observed**").

It does not re-open or alter the FBL-028 approval or the FBL-029/FBL-030 observations.

## What this rung established

- **Capacity is real, not cosmetic.** It was specified in two documents but implemented nowhere; without it the "upgrade" would have been a level number changing beside an unrelated capability list — the cosmetic change principle 20 forbids.
- **Level and capacity change atomically**, written in a single reducer branch, so V-07 holds by construction rather than by ordering luck.
- **Eligibility is earned from persisted truth**: the ten-package counting rule, no unresolved critical event, ≥90% validation pass rate after retries, and event-persistence verification.

## Documented interpretations and limitations

Recorded because they are judgements, not facts:

- **Capacity is carried as a capability string** (`capacity_25` / `capacity_100`), because the frozen `Building` schema has no numeric capacity field. This is spec-conformant — `capabilities` is the declared field and `upgrade.completed.capabilitiesAdded` the declared mechanism — and it matches the vocabulary the FBL-008 mock script already used. A future mission baseline should give `Building` a real capacity field.
- **The ≥90% pass rate counts each stage once, by its final decision.** That is the reading of "after retries" that keeps the repair workflow V1 demonstrates from blocking the upgrade it earns, but it is an interpretation.
- **`Upgrade.Fail` carries an empty payload** per `event-model.md`, so a failure reason cannot be recorded on the event.

## Effect on the ladder

FBL-031's stop condition is **met** and the rung is **closed**.

FBL-032 (restart and recovery) is the next rung of the operator-authorized sequence and is authorized to begin.
