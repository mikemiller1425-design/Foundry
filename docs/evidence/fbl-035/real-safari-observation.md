# FBL-035 — Real-Safari Observation Record

**Status:** ✅ **OBSERVED AND REPORTED BY THE OPERATOR**
**Rung:** FBL-035 — Complete V1 acceptance verification
**Observed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Build observed:** production build (`next build` + `next start`) at commit `40c3713`, served on `localhost:4500`

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## Why this observation exists

Running the functional suite against Playwright's WebKit produced 7 failures across 3 issues. **Playwright WebKit is not Safari**, so those results were explicitly not treated as conclusive, and no earlier rung was reopened on their strength. The operator elected to verify in real Safari first — the cheaper and more decisive check — before authorizing any product change.

## Environment reported by the operator

- Actual macOS Safari (not Playwright WebKit)
- 49-inch display at 5120×1440, browser maximized
- Safari Tab-highlight setting **enabled**

## Results as reported

**A — Keyboard: PASS.** Tab and Shift+Tab reached the critical controls; focus remained visible; Enter/Space activated controls; focus left the 3D canvas normally; no keyboard trap.

**B — Lighthouse selection: PASS.** After allowing the camera to settle, selection worked reliably — also after pan/zoom and after Reset View. Selection ring, left-navigation state, and detail panel all matched the Lighthouse. No settled-camera product defect observed.

**C — Rendering: PASS.** The application filled the ultrawide display. All required world objects, panels, ground, fog, lighting, agents, roads, and vehicle rendered correctly. Animation remained continuous for at least 30 seconds and the world tracked the timeline. No blank canvas, corruption, clipping, tearing, or stale frames. Multiple objects selected correctly with matching detail panels and selection rings.

**Primary journey: PASS.** Operated in real Safari; working correctly, usable, and responsive at normal desk distance.

## Classification (operator-directed, evidence-consistent)

| # | WebKit issue | Classification |
| --- | --- | --- |
| 3a | `<button>` elements not reached by Tab | **Safari configuration / automation-dependent.** Not a confirmed product defect. |
| 3b | Lighthouse pointer selection fails | **Automation-only moving-target race.** Not a settled-camera product defect. |
| 3c | Canvas pixel readback fails at 5120×1440 | **WebKit test-instrumentation behaviour.** Not a real Safari rendering defect. |

Per operator direction, **FBL-006, FBL-014, and FBL-015 are not reopened** on the strength of these observations.

**Independent corroboration of 3b:** the same race subsequently reproduced in **Chromium** during the acceptance rerun (`shell-selection.spec.ts:23` at 3840×1080, marker position moving `38.40 / 72.46` → `55.08 / 31.75` between reads). The race is engine-independent and lives in the test, not the product — which is what the operator's classification predicted. It is tracked separately as finding 5 and remains open.

## What this record does not establish

- It is an **observation of the three Safari findings**, not FBL-035 sign-off. Field 10's "complete primary user journey … personally, end-to-end, unassisted" is a separate determination that belongs to the operator; the primary-journey PASS above is recorded as reported and is **not** counted as sign-off here.
- It does not bear on finding 4 (`jump to world object` never implemented) or finding 5 (intermittent Chromium failure). Both remain open and blocking.
- A prior `approved continue` message was **withdrawn by the operator as premature** and was never recorded as approval. No file changes had been made on its strength; `git status` and `git diff` were both empty at the time of withdrawal.

## Effect on the ladder

The Safari coverage gap is **closed as a non-defect**. FBL-035 remains **open**: two blocking findings stand, and operator sign-off has not been given. **V1 is not complete.**
