# AC-103 — Finding 6: Diagnosis and Remediation

**Type:** Rung deliverable record
**Rung:** `AC-103` — Finding 6 resolution **[FIX]**
**Date:** 2026-08-04
**Status:** Diagnosed and remediated; **awaiting the operator's acceptance of closure**. The rung is not closed.

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What Finding 6 was

Three Playwright-WebKit failures accepted at `FBL-035` **without diagnosis**, and explicitly recorded as open:

| Spec | Viewports |
| --- | --- |
| `e2e/shell-selection.spec.ts:150` — *"selecting the Lighthouse moves the FBL-012 camera to focus on it"* | 5120×1440, 3840×1080 |
| `e2e/shell-event-to-world-mapping.spec.ts:119` — *"every meaningful visual transition has a readable timeline equivalent"* | 5120×1440 |

`docs/evidence/fbl-035/operator-final-approval.md` is explicit that these are **"open and uninvestigated, not accepted non-defects."** `PV1-043` graded it a **BLOCKER for V1.1 entry** and noted the sharpest problem: *"No failure artifact is retained in the repository (`test-results/` is git-ignored), so there is currently **no reproduction record at all**."*

The ladder prohibits closing this by reclassification, by deleting or retrying the tests, or by raising timeouts.

## 1. The diagnosis

**These three failures are worker-contention artifacts of an unpinned worker count. They are not product defects, and they are not WebKit-specific behaviour.**

The mechanism was already measured and documented at `FBL-034`, in `playwright.config.ts`'s own comment: headless browsers on macOS rasterize WebGL in **software**, each burning a core on a ~3.1M-pixel canvas, so N parallel workers starve each other and the demo runtime's `setTimeout` pacing — *"a floor, never a promise"* — stretches with the load.

| Regime | Demo reaches the approval gate |
| --- | --- |
| software, 1 worker | ~12 s |
| software, 8 workers | ~42 s |
| GPU, 1 worker | ~6 s |
| GPU, 8 workers | ~10 s |

`FBL-034` repaired this for Chromium by requesting the real GPU (`--use-angle=metal`, `--ignore-gpu-blocklist`). **Those are Chromium switches. WebKit ignores them**, so a WebKit run is *always* in the software regime — precisely where contention bites hardest.

The cap that compensates for it, `--workers=3`, existed only as **prose** in `apps/agent-city/README.md`. `playwright.webkit.config.ts` did not set `workers`, so the `FBL-035` WebKit run used Playwright's default — **half the cores**, which is 6 on this machine.

Both failing specs are in the class that loses that race:

- `shell-event-to-world-mapping.spec.ts:119` drives the demo at 4× and asserts on **elapsed progress** through the run.
- `shell-selection.spec.ts:150` polls for the **camera to settle** on a focus target.

The `FBL-035` report anticipated exactly this class — *"they may be further instances of the same camera-timing class"* — and correctly refused to say so without evidence. This is that evidence.

## 2. The experiment

Three full WebKit suite runs on the same machine, same commit, same browser build. Logs retained in `runs/`.

| # | Run | Workers | Result | Finding 6 tests |
| --- | --- | --- | --- | --- |
| 1 | `--workers=3` on the command line | 3 | **375 passed / 3 failed** | **all 6 pass** |
| 2 | no flag, unpinned config (as `FBL-035` ran it) | **6** (default) | **374 passed / 4 failed** | **all 6 pass** |
| 3 | no flag, **config now pins 3** | 3 | **375 passed / 3 failed** | **all 6 pass** |

The decisive result is **run 2**. Raising the worker count did not merely fail to reproduce the original three — it produced a **fourth failure of the same class** that runs 1 and 3 do not have:

```
✘ 365 [webkit-2560x1440] › e2e/shell-v1-primary-journey.spec.ts:28:3 ›
      V1 primary journey — complete end-to-end run (FBL-022) ›
      every major transition is comprehensible within ten seconds …  (16.4s)
```

That spec is the ten-second-comprehension test: it drives the demo and asserts on elapsed progress, exactly like `shell-event-to-world-mapping.spec.ts:119`. Contention moved the failure to a *different member of the same family* — which is what a load-sensitive race does, and what a genuine product defect in camera focus or timeline correspondence would not do.

**The three failures remaining in every run are a different, already-classified finding.** `shell-panels.spec.ts:20` across all three viewports is **Finding 3a** — the `<button>`-not-Tab-reachable issue the operator classified as Safari configuration-dependent after observing real macOS Safari PASS (`docs/evidence/fbl-035/real-safari-observation.md`). That classification is **preserved and not revisited**, per operator direction at `FBL-035`.

## 3. The remediation

**The worker cap is now pinned in configuration, in both Playwright configs.**

| File | Change |
| --- | --- |
| `apps/agent-city/playwright.webkit.config.ts` | `workers: 3`, with the measurement and the reason recorded inline |
| `apps/agent-city/playwright.config.ts` | `workers: 3` (`PV1-041`) |

This is a **root-cause fix, not a tolerance adjustment**, and it is the same kind of fix `FBL-034` made for Chromium:

- **No timeout was raised.** Not one.
- **No test was skipped, deleted, or retried.** `retries: 0` is unchanged in both configs.
- **No test was reclassified.** The specs assert exactly what they asserted before.
- What changed is that the suite no longer over-subscribes the machine it runs on.

`F-131` requires that *"reliability is a property of the suite, not of the machine."* A cap documented in prose is a property of whoever remembers to type it. Run 3 confirms the cap now applies with **no command-line flag at all**.

`PV1-041`'s disposition — *"pin `workers` in the config, or make the README instruction the only invocation path"* — is satisfied by the first option.

## 4. Retained reproduction evidence

`PV1-043`'s specific complaint was that no reproduction record existed anywhere in the repository. Three complete run logs are now retained:

| File | What it proves |
| --- | --- |
| `runs/webkit-workers-3-cli.txt` | At the documented cap, the Finding 6 tests pass |
| `runs/webkit-workers-6-default.txt` | **Reproduces the failure mechanism** — a fourth same-class failure appears |
| `runs/webkit-workers-3-config-pinned.txt` | The fix applies from configuration alone |

**They are `.txt`, and that is not cosmetic.** `.gitignore` line 27 ignores `*.log`, so the logs were silently dropped from the first `git add` — the same mechanism that left Finding 6 with no reproduction record in the first place (`test-results/` is likewise ignored). Evidence that a gitignore rule can quietly discard is not retained evidence. Recorded as an `AC-119` hygiene item, since `F-134` requires every artifact an approval cites to be retrievable from a fresh clone.

Playwright trace archives were produced for each run and are **not** committed: they are large binaries whose value is interactive, and the logs carry the finding. The invocation that regenerates them is in § 5.

## 5. Reproducing this

```bash
# The mechanism (expect a same-class failure to appear):
pnpm --filter @foundry/agent-city exec playwright test \
  --config=playwright.webkit.config.ts --workers=6

# The fixed state (no flag needed — the config pins it):
pnpm --filter @foundry/agent-city exec playwright test \
  --config=playwright.webkit.config.ts
```

Note that run 2's exact failure member is load-dependent: on a busier or quieter machine a *different* demo-paced spec may lose the race, or none may. That variability **is the finding** — it is what an unpinned worker count produces, and it is why the cap belongs in configuration rather than in a habit.

## 6. What this does and does not claim

**Claimed:** the three failures recorded as Finding 6 are contention artifacts; the mechanism is reproducible in both directions; the fix is structural; WebKit automation is now clean apart from the separately-classified Finding 3a.

**Not claimed:**

- **Not** that WebKit automation is 100% green. Three `shell-panels.spec.ts:20` failures remain. They are Finding 3a, classified at `FBL-035` on the strength of the operator's real-Safari observation, and this rung does not reopen them.
- **Not** that Playwright's WebKit is Safari. It is not, and `v1-acceptance.md` requires Safari to work — which the operator observed directly.
- **Not** that the `FBL-035` approval was wrong. It was given knowingly, with the finding recorded as open. This rung does the diagnosis that was deferred, which is what `PV1-043` asked for.

## 7. Requirement disposition

| ID | Requirement | Status |
| --- | --- | --- |
| **F-131** | Functional WebKit coverage is automated and reliable; reliability is a property of the suite, not of the machine | **Advanced** — the cap is now structural. Full satisfaction is `AC-117`'s, which owns the accessibility and WebKit rung |
| **PV1-041** | The browser suite requires a documented worker cap to be reliable | **Resolved** — pinned in both configs |
| **PV1-043 / Finding 6** | Three unclassified WebKit failures | **Diagnosed and remediated**, with retained reproduction evidence |

## 8. Operator gate

The ladder's gate for this rung is **"Accept closure against the standard chosen in Decision 5."** Decision 5 requires closure *with diagnosis and retained reproduction evidence*, and prohibits closure by assertion.

This record is the diagnosis; `runs/` is the retained evidence. **The rung remains open until the operator accepts.**
