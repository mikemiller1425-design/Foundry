# FBL-034 — Operator Observation Record

**Status:** ✅ **ACCEPTED AND APPROVED BY THE OPERATOR**
**Rung:** FBL-034 — Ultrawide performance validation
**Confirmed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Operator response:** `APPROVED — CONTINUE`
**Implementation commit accepted:** `98dfc2c` (`test: validate ultrawide performance and repair browser-suite races (FBL-034)`)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## Basis of this record

This records the **operator's decision** to accept FBL-034 and close the rung.

It is written this way deliberately, following the same distinction drawn at FBL-033. The rung's field 10 calls for the operator to run the full journey on the target Mac at 5120×1440 and confirm it feels responsive at desk distance. The assistant did **not** witness that walkthrough and was **not** told its step-by-step results, so this file does not narrate one. What is recorded is what actually occurred: the observation gate was presented with the environment running and explicit instructions, and the operator, who governs (principle 14), responded `APPROVED — CONTINUE`.

An operator is entitled to accept a rung on their own judgement. The assistant is not entitled to invent the contents of an observation it did not receive — so the distinction between *decision* and *witnessed detail* is preserved here rather than blurred.

**The gate was genuinely presented before this response arrived** — the distinction FBL-032's record found necessary to make. A production build was served at `http://localhost:4500` (confirmed responding HTTP 200), and a seven-step journey was specified: warm start, motion smoothness at 1×, selection responsiveness in the 3D world and navigator, event-feed scrolling and filtering, Pause/Resume and 4× playback to the approval gate, approval through build completion, and the Warehouse upgrade to Level 2.

## Automated evidence underpinning the acceptance

Verified by the assistant and independently reproducible from commit `98dfc2c`. Full detail: `docs/evidence/fbl-034/performance-measurements.md`.

- **Every budget line in `v1-acceptance.md` § Performance is met**, at the three target viewports and at a supplementary HiDPI configuration (5120×1440 @2×, a 6427×1946 drawing buffer): warm start 38–40 ms (budget 3000), FPS average 76.1–91.2 (budget 45), FPS sustained-low 36.8–59.9 (budget 30), selection feedback worst 9.7–27.2 ms (budget 100), realtime-visible worst 10.0–24.1 ms (budget 500).
- **Every budget is an asserting test**, not a recorded number, and the measurement conditions are asserted too — the run fails if WebGL falls back to a software renderer or the window is not at the project's viewport.
- **The 10,000-event feed retains all 10,000 while mounting 52 rows** — bounded by the container, not the feed.
- **The FBL-028 §12.7 flakiness is resolved at its root cause** (software WebGL rasterization in the headless browser suite), with five further defects fixed at their cause. **363 passed / 0 failed across three consecutive full runs, two under deliberate CPU contention.** Before: 8 failed / 355 passed.
- **No application code was changed**: no budget line was unmet, so no optimization patch was warranted.
- Gates at `98dfc2c`: typecheck 8/8, lint clean, 791 unit/integration tests passing, production build passing, performance suite 16/16.

## What this rung did not establish

Recorded so the gaps are visible rather than assumed closed:

- **No witnessed operator walkthrough is recorded here**, for the reason given above. The subjective "feels responsive at desk distance" judgement is the operator's and is accepted as their decision, not reproduced as narrated detail.
- **Measurements come from one machine** (Apple M4 Pro, 16 GPU cores, 5120×1440 Samsung LS49C95xU). They are a statement about the target Mac, not about hardware in general.
- **The 10,000-event result is a jsdom measurement** of DOM boundedness and algorithmic cost, not a rendered frame-rate measurement. The canonical demo script is finite and never reaches 10,000 events, and adding an operator surface to inject synthetic ones would be inventing a feature this rung prohibits.
- **Realtime latency is measured as the render half only**, composed with FBL-026's separately measured transport half. No single end-to-end number is claimed.
- **Frame-rate figures establish that budgets are met, not the hardware maximum.** They are frame-pacing measurements, not GPU/CPU frame-time budgets.
- **The GPU fix reduces contention rather than making the application tolerate unbounded contention.** The application was never the bottleneck, but a machine starved badly enough will still slow scripted playback.
- **Known per-frame waste was left in place**: `WorldBuildings` and `AgentsSceneObject` allocate a `Vector3` per object per frame and re-derive state labels inside `useFrame`. This is a recorded finding for a future rung, not a defect waived — no budget was under pressure, and rewriting working render code with nothing to gain carries regression risk for no measured benefit.

## Effect on the ladder

FBL-034's stop condition is treated as **met** by operator decision, and the rung is **closed**.

FBL-033 and FBL-034 — the parallel hardening pair (track E) — are now **both closed**, which satisfies FBL-035's prerequisites. **FBL-035 (complete V1 acceptance verification) has not been started and is not authorized by this record.** It requires its own explicit operator authorization, per the Build Ladder's own rules and `FOUNDATION_VERSION.md` ("each rung still requires separate operator authorization").
