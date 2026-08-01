# FBL-034 — Ultrawide Performance Validation: Measurements

**Rung:** FBL-034 — Ultrawide performance validation
**Date:** 2026-08-01
**Machine:** Apple M4 Pro (12 CPU cores, 16 GPU cores), 24 GB, macOS 25.5.0
**Primary display:** Samsung LS49C95xU — native 5120×1440, the rung's primary target
**Status of this file:** automated measurements only. **Operator observation is a separate record and has not been performed.**

---

## 1. What was measured, and against what

Budgets are `docs/02-specification/v1-acceptance.md` § "Performance", verbatim:

| Budget line | Value |
| --- | --- |
| Usable shell, local warm start | < 3 s |
| Frame rate, world mode | 45+ FPS target |
| Frame rate, under full panels | 30 FPS minimum |
| Event feed | 10,000 retained events via virtualization/filtering |
| Selection feedback | < 100 ms |
| Realtime update visible | < 500 ms |

Every one of these is now an **asserting** test. A recorded number that nothing gates is a number that drifts.

## 2. Measurement conditions, and why they are what they are

Three deliberate choices, because each changes the answer:

- **Serial, not parallel** (`workers: 1`). The functional suite runs a dozen browsers at once, which is the right way to *stress* the app and the wrong way to *measure* it — the result would be the machine contending with itself.
- **Production build**, not `next dev`. Dev-mode React ships warnings, no minification, and per-render bookkeeping the operator never pays for.
- **GPU-backed, and proven so.** Chromium on macOS defaults to SwiftShader — software rasterization. `assertMeasuringAtViewport` reads back the live WebGL renderer string and **fails the run** if it is a software device, and asserts `window.innerWidth/Height` match the project's viewport. A budget "met" under SwiftShader, or at a silently clamped window, would be a false pass recorded as evidence.

Renderer confirmed for every run: `ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro)`.

## 3. Performance budgets — results

Production build, serial, GPU-backed. All four configurations pass every line.

| Metric | 5120×1440 | 3840×1080 | 2560×1440 | 5120×1440 @2× | Budget |
| --- | --- | --- | --- | --- | --- |
| Warm start | 38 ms | 38 ms | 38 ms | 40 ms | ≤ 3000 ms |
| FPS, average, full panels | 84.5 | 91.2 | 83.7 | 76.1 | ≥ 45 |
| FPS, sustained low (95th pct frame) | 36.9 | 59.9 | 36.9 | 36.8 | ≥ 30 |
| Selection feedback, median | 9.2 ms | 11.3 ms | 16.3 ms | 12.7 ms | ≤ 100 ms |
| Selection feedback, worst | 9.7 ms | 12.4 ms | 27.2 ms | 15.4 ms | ≤ 100 ms |
| Realtime update visible, worst | 12.2 ms | 10.0 ms | 24.1 ms | 17.5 ms | ≤ 500 ms |

The fourth column is **supplementary, beyond the three required viewports**: the primary target on a HiDPI-scaled display, where the same layout is backed by four times the pixels (6427×1946 drawing buffer). The operator's own display can present the panel that way, so the budget is checked against the more expensive possibility rather than the flattering one.

Two honest readings of these numbers:

- **The tail, not the average, is the number that matters.** Average FPS sits at 76–91, but the 95th-percentile frame implies ~37 FPS at three of the four configurations. That is above the 30 floor, and it is the figure that corresponds to what stutter feels like. It is reported because an average alone can hide periodic hitching.
- **Headroom is real but not precisely quantified.** These are frame-pacing measurements, not GPU/CPU frame-time budgets. They establish that the budgets are met; they do not establish the maximum the machine could sustain.

### 10,000-event feed

`src/components/timeline/EventTimeline.scale.test.tsx` — 4 tests, real component, real 10,000-event array:

- All 10,000 retained and counted (`10000 / 10000 events`), while **52 rows are mounted** — bounded by the container, not the feed.
- Scrolling to event ~9,000 keeps the window bounded and shows the correct slice (proving offset is applied, not the list truncated to its head).
- Filtering 10,000 events narrows to 2,000 with the DOM still bounded; clearing restores 10,000.

**Stated limitation:** this runs in jsdom, which performs no layout or paint. It measures the virtualization property and guards against an algorithmic regression (an O(n) DOM, a filter that rebuilds everything). It is **not** a frame-rate measurement. It lives here rather than in Playwright because the canonical demo script is finite and never reaches 10,000 events, and adding an operator surface for injecting synthetic ones would be inventing a feature this rung prohibits. A test's own validity is guarded too: it asserts the mounted window is at least container-height/row-height, so a failed height mock cannot make the boundedness assertions pass vacuously.

### Realtime update latency — what is and is not claimed

The < 500 ms budget spans two halves, measured separately rather than blurred into one number:

1. **Transport** (backend append → client-readable over HTTP): already measured against the real server by FBL-026's `apps/api/src/latency.test.ts`.
2. **Render** (event reaching the client → painted in the operator's timeline): nothing measured this before. It is the half that competes with the 3D world for the main thread, and it is what `e2e-perf/realtime-latency.perf.spec.ts` measures — 10.0–24.1 ms worst case.

Both halves travel the identical client path, so exercising it via a locally originated command event is representative. What is **not** claimed is a single end-to-end number: the mock runtime is its own authority (ADR-001) and has no network hop to measure.

---

## 4. The deferred defect: browser-suite flakiness under CPU contention

Deferred here from FBL-028 §12.7 by operator decision.

### Before

Full functional browser suite, three target viewports, as inherited at `916f051`:

```
8 failed | 3 skipped | 355 passed  (8.9 min)
```

**All 8 failures were at 5120×1440**, and they were not intermittent — they reproduced on the first run:

- **7 × approval-card never appeared within 30 s** (`shell-agents` ×2, `shell-event-to-world-mapping`, `shell-lighthouse`, `shell-selection`, `shell-v1-primary-journey` ×2).
- **1 × false keyboard-trap report** (`shell-accessibility.spec.ts:31`).

### Root cause

The functional suite runs **headless**, and headless Chromium on macOS rasterizes WebGL in **software** (SwiftShader). For an application whose main surface is a 3D world, each browser then burns a CPU core drawing a ~3.1M-pixel canvas. N parallel workers starve each other, and the demo runtime's `setTimeout` pacing — a floor, never a promise — stretches with the load.

Measured directly: wall-clock time for the demo to reach the approval gate at 5120×1440, 8 samples per cell.

| Renderer | 1 worker | 8 workers | 12 workers |
| --- | --- | --- | --- |
| SwiftShader (software) | 11.3–12.4 s | **41.2–42.2 s** | — |
| ANGLE / Metal (GPU) | 6.1–6.4 s | 9.7–10.6 s | 18.5–24.9 s |

At 8 workers the software figure is past the 30 s those specs allow. That is exactly the FBL-028 §12.7 signature — *different* specs failing on different runs, because whichever ones happened to be waiting on demo progress when the machine was busiest lost the race.

### Repairs

Five distinct defects, each fixed at its cause. **No timeout was raised to absorb a race, and no test is retried.**

1. **Software rasterization** — `playwright.config.ts` now requests the real GPU (`--use-angle=metal`, macOS only). This is a root-cause fix *and* a representativeness fix: the operator's browser is GPU-backed, so a suite rasterizing in software was measuring a machine nobody runs. The flag is a request, not a requirement — where Metal is unavailable ANGLE falls back and the suite still runs.

2. **Element detachment in the live feed** (`shell-timeline.spec.ts:118`, the named FBL-028 failure). The feed is virtualized: as rows arrive the mounted window slides, so a row resolved a moment ago is detached before the click lands. No timeout fixes this — waiting longer only gives the list more time to move. Tests now reach a genuinely stable state first via `pauseDemoForStableFeed`, which uses the operator's own Pause control and then confirms both that the runtime reports itself stopped *and* that the DOM has settled across successive polls. All six `waitForTimeout` calls in that spec are gone.

3. **Moving-target pointer clicks** (`shell-agents`, `shell-vehicle`). Agents walk between buildings and the vehicle snaps between transfer positions, so reading a screen position and then clicking there is a race by construction. Playback is brought to rest first; what is under test is the pointer hit target, not the animation.

4. **A descriptor that could not tell siblings apart** (`shell-accessibility.spec.ts`). Timeline rows share one `data-testid` and carry no `aria-label`, so eight consecutive *distinct* rows described identically and the no-trap check read that as focus being stuck. It fired only at 5120×1440, because only there is the feed tall enough that a 60-key walk ends inside the row list. **There was no keyboard trap** — the defect was in the descriptor, which now includes a positional sibling index.

5. **Transient states observable only because the machine was slow.** `shell-event-to-world-mapping.spec.ts:181` and `shell-v1-primary-journey.spec.ts:124` waited to observe brief states (cargo `Blocked`, a stage's `Mandatory requirement failed`). The accessible marker text is sampled every 150 ms while 4× playback emits every 50 ms, so such a state can vanish between two samples. These tests had been passing **because CPU starvation stretched every window until it happened to be wide enough** — a property that inverts as the machine gets faster, and which fixing (1) removed. They now observe transients at 1× speed, where the state genuinely outlasts the sampling interval, and accelerate afterwards for the stretch where only the end state matters.

Two test-level timeouts were raised (45 s → 90 s) *because the observation phase now deliberately runs at 1×*, which takes four times as long. That is a budget for work that genuinely takes longer, not slack bought to absorb a race.

6. **A phase-dependent pixel sample** (`shell-lighthouse.spec.ts:88`). The beacon rotates and pulses, so a single-instant readback caught whatever phase the animation was in — bright on one run, dim (48 vs the required 150) on the next, with nothing about the application having changed. It now samples across a window and keeps the brightest reading: over a full cycle the beacon must light up, and if the Lighthouse were missing no sample would ever be bright.

### After

Three consecutive full runs, all three viewports, **zero failures**:

| Run | Conditions | Result | Duration |
| --- | --- | --- | --- |
| 1 | Idle machine | **363 passed, 0 failed, 3 skipped** | 3.1 min |
| 2 | 6 CPU burners + repo-wide unit suite looping | **363 passed, 0 failed, 3 skipped** | 3.5 min |
| 3 | 12 CPU burners (all cores saturated) | **363 passed, 0 failed, 3 skipped** | 3.3 min |

Runs 2 and 3 reproduce the FBL-028 conditions deliberately — the browser suite competing with other real work — rather than hoping to observe them. Total wall-clock degradation under full core saturation is 6%.

---

## 5. A fix that was tried and rejected

Worth recording, because it looked right and was not.

The first attempt at the pacing problem was a **wall-clock-anchored scheduler**: instead of re-arming `setTimeout(interval)` from inside each callback (so every millisecond of lateness is added to the run and never recovered), each event would be anchored to the moment it was due, and a late tick would emit every event whose moment had passed. It came with six tests that were verified to fail against the old scheduler and pass against the new one — including proof that catching up never reordered, duplicated, skipped, or ran past the approval gate.

It was reverted. Catching up compresses transient states into a single React batch, so intermediate operational states **never paint** — the residence never visibly goes Vacant, the stage never visibly shows its failure. For a system whose entire purpose is making operational state visible, that is a worse defect than the flakiness it fixed, and it is precisely the "changing operational behavior" this rung prohibits. It was caught by the full suite: it turned 8 failures into 14.

The real cause was one layer down, in how the tests were rendering, not in how the runtime was pacing.

---

## 6. Optimization: none was required

The rung allows profiling and optimization, and requires before/after measurements for any optimization patch. **No application code was changed in this rung**, because no budget line was unmet — every one passes with margin at all three target viewports *and* at HiDPI.

Genuine per-frame waste does exist and was found while profiling: `WorldBuildings` and `AgentsSceneObject` allocate a fresh `Vector3` per object per frame (`scratchVector.current.clone()`, defeating the scratch vector's purpose) and re-derive per-building state labels inside `useFrame`. It is left alone deliberately. Rewriting working render code with no budget to meet would be churn carrying real regression risk for no measured benefit — the same discipline that says "do not lower the budget to pass" says "do not rewrite what already passes". It is recorded here so a future rung with a budget under pressure knows where to look first.

---

## 7. Full gate results

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | ✅ 8/8 projects |
| `pnpm lint` | ✅ 0 errors, 0 warnings |
| `pnpm test` (unit + integration) | ✅ **791 passed** (787 prior + 4 new) |
| `pnpm build` (production) | ✅ all projects |
| Functional browser suite | ✅ **363 passed / 0 failed / 3 skipped**, ×3 runs (2 under contention) |
| Performance suite | ✅ **16 passed**, every budget met at 4 viewport configurations |

`pnpm format` reports 26 pre-existing files with style issues, unchanged from `916f051`. Files this rung touched were formatted; the pre-existing debt was left alone rather than folded into this commit as unrelated churn.

One incidental repair: `vitest.config.ts` excluded `**/e2e/**` but not the new `**/e2e-perf/**`, so Vitest collected Playwright specs and failed on Playwright's test API.

---

## 8. What this rung does not establish

- **Operator observation has not happened.** Field 10 requires the operator to run the full journey on the target Mac at 5120×1440 and confirm it feels responsive at desk distance. Nothing in this file substitutes for that; the assistant did not perform it and does not claim it.
- Measurements are from one machine (M4 Pro, 16 GPU cores). They are a statement about the target Mac, not about hardware in general.
- The 10,000-event result is a DOM-boundedness and algorithmic measurement in jsdom, not a rendered frame-rate measurement (§3).
- Realtime latency is measured as the render half, composed with FBL-026's separately measured transport half; no single end-to-end number is claimed (§3).
- Frame-rate figures establish that budgets are met, not the maximum the hardware could sustain (§3).
- The GPU flag reduces contention rather than making the application tolerate unbounded contention. The application was never the bottleneck — it holds 76–91 FPS average GPU-backed — but a machine starved badly enough will still slow scripted playback down.


---

## 9. FBL-034 reopened — camera-settling moving-target race (2026-08-01)

Reopened by FBL-035 finding 5, under operator authorization.

### The defect

`shell-selection.spec.ts:23` ("pointer click on the Lighthouse selects it") reads the Lighthouse marker's projected screen position, converts it to viewport coordinates, and clicks there. The camera eases into its resting position for a short window after load, so the projection moves between the read and the click and the click lands on empty ground.

This is the same moving-target class repaired here originally for agents and the vehicle. Those were the instances failing at the time; the Lighthouse case was not, and was left untouched. **The Lighthouse does not move — the camera does**, which is why it was not caught by the earlier pass.

### Before

`shell-selection.spec.ts:23`, 12 repeats × 3 target viewports:

```
32 passed, 4 failed  (36 runs, 11% failure rate)
```

Failure signature, identical every time: the marker's reported position differs between successive reads (e.g. `38.40 / 72.46` → `55.08 / 31.75`), and `data-selected` never becomes `true`.

The same race had already been observed in WebKit (FBL-035 finding 3b). Its reproduction in Chromium confirmed the operator's classification: **engine-independent, and in the test rather than the product**.

### The repair

`stableProjectedPosition()` / `stableClickPointFor()` in `e2e/stable-state.ts`: poll the marker's `data-x-percent` / `data-y-percent` until two successive samples are identical, then convert to viewport coordinates in the same step so no camera frame can slip between reading and clicking.

Explicitly **not**: no timeout was raised, no retry was added, and **no production camera behaviour was changed**. A longer timeout makes the race rarer without removing it and misreports the application as slow; a retry hides it. The wait is on observed stability, so it costs exactly as long as settling actually takes.

### After

Same test, same 12 repeats × 3 viewports, plus the new regression guard:

```
72 passed, 0 failed
```

### Regression guard

`shell-selection.spec.ts` — "projected coordinates move before the camera settles, and the stable wait outlasts that window" asserts **both halves**: that an unstable window genuinely exists (so the old read-then-click procedure really could sample a moving target), and that after the stable wait successive reads are identical and equal to the returned value. Checking only the second half would pass on a machine where the camera settled instantly, proving nothing about the race.

Where the camera has already settled before sampling begins, that is logged rather than failed — failing there would report the machine's speed, not the code.

### Full-suite repeatability after the repair

| Run | Conditions | Result |
| --- | --- | --- |
| 1 | Idle machine | **377 passed, 0 failed** (3.7 min) |
| 2 | 6 CPU burners + repo-wide unit suite looping | **377 passed, 0 failed** (5.3 min) |
| 3 | 12 CPU burners (all cores saturated) | **378 passed, 0 failed** (3.8 min) |

(377/378 rather than 363: FBL-021A added the jump-to-world-object browser tests, and this reopening added the regression guard.)

### A second instance of the same race, found by the contention run

The first attempt at run 3 — 12 burners, all cores saturated — failed once, on `shell-lighthouse.spec.ts:88` ("the Lighthouse specifically is mounted and rendered at its own reported screen position").

It is **the same defect**: that test reads the beacon's projected position once and then samples that pixel across frames. If the camera is still easing, it samples empty sky. It had not surfaced before because settling is fastest on an idle machine — the contention run is precisely what made the window wide enough to lose.

Repaired identically, with `stableProjectedPosition`. Run 3 then passed 378/0 under the same saturation.

Worth recording for FBL-035: this makes it likely that **WebKit finding 3c was this race too**, not a `preserveDrawingBuffer` limitation as originally hypothesised — the failing test is the same one, and the operator's real-Safari observation already confirmed the world renders correctly at 5120×1440. The classification of 3c as "not a real Safari rendering defect" is unchanged; only the probable mechanism is now better understood.

### What was deliberately not done

- **No production camera behaviour was changed.** The easing is correct; the tests were sampling it wrong.
- **No timeout was raised** and **no Playwright retry was added.** Both would have converted a reproducible 11% failure into a rarer one, which is worse than leaving it visible.
