# FBL-033 — Operator Observation Record

**Status:** ✅ **ACCEPTED AND APPROVED BY THE OPERATOR**
**Rung:** FBL-033 — Accessibility and reduced motion
**Confirmed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Operator response:** `APPROVED — CONTINUE`, followed by an explicit instruction to record, commit, and push this observation.
**Implementation commit accepted:** `aa9810b` (`test: add accessibility and reduced-motion hardening pass (FBL-033)`)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## Basis of this record

This records the **operator's decision** to accept FBL-033 and close the rung.

It is written this way deliberately. The rung's field 10 calls for the operator to complete the primary journey keyboard-only, and again with `prefers-reduced-motion`. The assistant did not witness those walkthroughs and was not told their step-by-step results, so this file does **not** narrate them. What is recorded is what actually occurred: the operator, who governs (principle 14), directed that the rung be recorded as observed and approved.

An operator is entitled to accept a rung on their own judgement. The assistant is not entitled to invent the contents of an observation it did not receive — so the distinction between *decision* and *witnessed detail* is preserved here rather than blurred.

## Automated evidence underpinning the acceptance

The following was verified by the assistant and is independently reproducible from commit `aa9810b`:

- **Colour is never the sole signal.** 20 tests assert, structurally across the entire visual vocabulary — operational buildings, residences, vehicle, agents, cargo, construction site, and the Lighthouse — that every state carries a non-empty textual label, that no two states share a label, and that no state's colour encodes meaning its label omits. FBL-029's validation rejection is pinned as textually distinct from an ordinary block, not merely red-vs-orange.
- **Keyboard critical path.** 7 accessibility e2e tests × 3 target viewports (21/21 passing): reachability by Tab alone with no keyboard trap, deterministic focus order across repeated traversals, a visible focus indicator on every focused control, navigator equivalents for canvas objects, semantic landmark structure, and the reduced-motion journey preserving textual meaning.
- **Every wait is on stable state, never elapsed time.** A timing-based accessibility test reports that the application was slow, not that it was reachable.
- **No production code changed in this rung** — the audit found no colour-only state and no keyboard trap requiring repair.
- Gates at `aa9810b`: typecheck 8/8, lint clean, 787 unit/integration tests passing, production build passing.

## What this rung did not establish

Recorded so the gap is visible rather than assumed closed:

- **No automated accessibility scanner** (axe or equivalent) was run. Coverage is the hand-written suite above, which checks the acceptance criteria named in `v1-acceptance.md` but is not a general WCAG audit.
- **No screen-reader verification** was performed. Accessible names and roles are asserted structurally; how they are announced in practice was not tested.
- **No WebGL-unavailable fallback test** was added. The 2D interface remains an authoritative control surface by construction (ADR-005, principle 23), but that specific degradation path is unverified.

These are honest limitations of the automated pass, not defects found and waived.

## Effect on the ladder

FBL-033's stop condition is treated as **met** by operator decision, and the rung is **closed**.

FBL-034 (ultrawide performance validation) is the next rung of the operator-authorized sequence FBL-030–FBL-035 and is authorized to begin. It carries the two intermittent browser defects deferred to it: `shell-timeline.spec.ts:118` and the 5120×1440 `approval-card` timeouts.
