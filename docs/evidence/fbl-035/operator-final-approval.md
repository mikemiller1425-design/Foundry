# FBL-035 — Operator Final Approval: Agent City V1

**Status:** ✅ **V1 APPROVED FOR COMPLETION BY THE OPERATOR**
**Rung:** FBL-035 — Complete V1 acceptance verification (**terminal rung of the Build Ladder**)
**Approved by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Approval wording received, verbatim:** `I APPROVE AGENT CITY V1 FOR COMPLETION`
**Commit approved:** `c659d0e`
**Environment presented:** production build (`next build` + `next start`) served at `http://localhost:4500`, confirmed responding HTTP 200

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## Basis of this record

This records the **operator's decision** to approve Agent City V1 as complete.

Following the precedent set at FBL-033 and FBL-034, it is recorded as a decision rather than a narrated walkthrough. Field 10 of this rung requires the operator to perform the complete primary user journey personally, end-to-end and unassisted. The gate was properly presented — a production build running at the commit under test, together with a nine-step unassisted journey checklist covering open, build, block, repair, approve, complete, upgrade, jump-to-world-object, and reload — and the operator responded with the required approval wording.

**The assistant did not witness that journey and was not told its step-by-step results**, so this file does not narrate one. The operator governs (principle 14) and is entitled to approve on their own judgement; the assistant is not entitled to invent the contents of an observation it did not receive.

## What was verified automatically, at `c659d0e`

Reproducible from the commit. Detail: `docs/evidence/fbl-035/v1-acceptance-report.md`.

| Gate | Result |
| --- | --- |
| Typecheck | ✅ 8/8 projects |
| Lint | ✅ 0 errors, 0 warnings |
| Production build | ✅ all projects |
| Unit + integration | ✅ **813 passed** |
| Chromium browser suite, 3 target viewports | ✅ **378 passed / 0 failed** |
| Performance suite | ✅ **16/16 budgets**, three target viewports + supplementary HiDPI |

- Every **F-01–F-12** and **V-01–V-08** requirement is mapped to the tests that prove it, verified by reading those tests rather than trusting acceptance-ID annotations.
- **Excluded features remain unimplemented**, verified by searching source: `V1RiskClassSchema` is `z.enum(["R0","R1","R2"])` so R3–R5 are unrepresentable; the command bar is a closed six-command union with no text input; `apps/api` depends on workspace packages only.
- **Documentation matches implementation**, including `jump to world object`, which FBL-035 found missing and FBL-021A implemented rather than weakening the specification.
- **F-12** was re-executed live under a single, now-spent authorization. Evidence unchanged at approval time: `evidence.json` md5 `11635c1b0bd1c3703da7047a21ae351c`. The FBL-028 evidence is likewise unchanged (`agentrun.sqlite` md5 `6beec0833d05b49322777b9f919a3a55`).

## Open at the time of approval — accepted by operator decision

**This is recorded rather than closed, because it was not resolved.**

**Finding 6 — three unclassified Safari/WebKit automation failures.** Playwright's WebKit run stood at **372 passed / 6 failed** when approval was given:

- Three are **finding 3a**, the `<button>`-not-Tab-reachable issue, classified earlier as Safari configuration-dependent after the operator observed real macOS Safari PASS (`real-safari-observation.md`). That classification is preserved.
- Three were **newly surfaced and undiagnosed**: `shell-selection.spec.ts:150` (5120×1440 and 3840×1080) and `shell-event-to-world-mapping.spec.ts:119` (5120×1440).

The operator was told these were open, undiagnosed, and unclassified, and was explicitly offered the option to have them investigated before signing off. They approved V1 with the finding open.

**What this approval therefore means:** V1 is complete on the evidence above, with automated WebKit coverage known to be incomplete. It does **not** mean finding 6 was resolved, waived on technical grounds, or shown to be a non-defect. `v1-acceptance.md` requires Safari to work, and the operator's real-Safari observation recorded a full PASS including the primary journey; it does not require Playwright's WebKit build to be green. Anyone reading this later should treat those three failures as **open and uninvestigated**, not as accepted non-defects.

## Effect on the ladder

FBL-035's stop condition — "Full acceptance report signed off" — is **met**. This is the **terminal stop of the Build Ladder**; no further rung exists in V1 scope.

**Agent City V1 is complete.**

Per FBL-035 field 14, any further work requires a new mission baseline (Future Registry promotion) and is out of this ladder's scope. No post-V1 work has been started.

## One documentation item deliberately left untouched

`FOUNDATION_VERSION.md` still records `Implementation: **Ready**`. Updating a Foundation 1.0 baseline document was not authorized by this approval, and the operator's standing instruction was to begin no post-V1 work, so it was left as-is and flagged instead.
