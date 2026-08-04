# AC-103 — Operator Acceptance of Closure

**Status:** ✅ **ACCEPTED BY THE OPERATOR**
**Rung:** `AC-103` — Finding 6 resolution **[FIX]**
**Accepted by:** mikemiller1425-design (human operator)
**Date:** 2026-08-04
**Implemented at:** commit `0ec8e2a` — `fix: diagnose and remediate Finding 6 — unpinned Playwright worker count (AC-103)`
**Documentation base:** commit `90d28ab`

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

*(Header convention per `AC-119`: a record cannot name the commit that introduces it. The closure commit is found with `git log --oneline --diff-filter=A -- docs/evidence/ac-103/operator-acceptance.md`.)*

---

## What the operator accepted

> I accept AC-103 closure.
>
> The retained evidence supports the diagnosis that Finding 6 was caused by unpinned WebKit worker contention. The remediation pins workers in configuration without raising timeouts, adding retries, skipping tests, or weakening assertions.

## The basis of this acceptance

Stated by standing, as `AC-110` established and the `AC-108`/`AC-109` corrections require.

The operator's acceptance is a **review of the retained evidence**, and they said so themselves — *"the retained evidence supports the diagnosis."* That is exactly the standard Decision 5 set for this rung, which is why the evidence had to exist before the gate could be offered. It is **not** a claim that the operator personally re-ran the WebKit suite.

**What the operator affirmed, item by item:**

| # | Affirmed | Against |
| --- | --- | --- |
| 1 | The retained evidence **supports the diagnosis** — Finding 6 was unpinned WebKit worker contention | `docs/evidence/ac-103/finding-6-diagnosis.md` and the three run logs in `runs/` |
| 2 | The remediation **pins workers in configuration** | `playwright.webkit.config.ts`, `playwright.config.ts` |
| 3 | It does so **without raising timeouts** | Prohibited work: *"raising timeouts as a substitute for root cause"* |
| 4 | **Without adding retries** | `retries: 0` unchanged in both configs |
| 5 | **Without skipping tests** | Prohibited work: *"deleting, skipping, or retrying the failing tests to make them green"* |
| 6 | **Without weakening assertions** | The specs assert exactly what they asserted before |

Items 3–6 are the rung's four prohibited shortcuts, checked one at a time rather than waved through. The operator's acceptance names each of them.

## Stop condition — satisfied

> *"Finding 6 closed with diagnosis, or explicitly re-accepted with an artifact. **Must close before AC-111.**"*

Closed **with diagnosis**, not by re-acceptance. The diagnosis is causal and was reproduced in both directions:

- **At the cap (3 workers):** 375 passed / 3 failed. All six Finding 6 test-instances green.
- **At the default (6 workers):** 374 passed / 4 failed — a **fourth failure of the same class** appears (`shell-v1-primary-journey.spec.ts:28`, the ten-second-comprehension spec).
- **With the cap now in configuration, no CLI flag:** 375 passed / 3 failed.

Contention moving the failure to a *different member of the same family* is what a load-sensitive race does, and what a genuine defect in camera focus or timeline correspondence would not.

## Prohibited work — none performed

| Prohibition | Status |
| --- | --- |
| Closing by reclassification without diagnosis | **Not done.** A causal diagnosis was produced and reproduced in both directions |
| Deleting, skipping, or retrying the failing tests | **Not done.** No test was deleted, skipped, or retried; `retries: 0` is unchanged |
| Raising timeouts as a substitute for root cause | **Not done.** Not one timeout was changed |
| Editing the `FBL-035` approval record | **Not done.** That record is untouched |
| Reopening `FBL-034` or `FBL-021A` | **Not done.** Neither was reopened; `FBL-034`'s own measurements are what made the diagnosis possible |

## What is closed, and what is not

**Closed:** Finding 6 / `PV1-043` — the three unclassified WebKit failures — with a causal diagnosis and retained reproduction evidence. `PV1-041` (the worker cap belonging in configuration rather than prose) is resolved by the same change.

**Not closed, and deliberately not touched:**

- **Finding 3a** — three `shell-panels.spec.ts:20` failures remain across all viewports. Classified at `FBL-035` as Safari configuration-dependent on the strength of the operator's real-Safari observation. **Not reopened.** WebKit automation is **not** 100% green, and this record does not claim it is.
- **`F-131`** — *"functional WebKit coverage is automated and reliable"* — is **advanced, not satisfied**. The cap is now structural, which is a precondition for reliability; full satisfaction belongs to `AC-117`, which owns the accessibility and WebKit rung.

## Verification at closure

Measured at `90d28ab` on a clean tree.

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm -r run test` → **1324 passed / 92 files / 0 failures** · `v1-canonical-run.json` **byte-identical**.

Browser suites, measured during the queue at `8e8f0f7`: **Chromium 378 passed / 0 failed**, matching the `FBL-035` figure; **WebKit 375 passed / 3 failed**, improved from `FBL-035`'s 372 / 6.

`pnpm build` was verified clean at `26e0709` during the queue's regression pass and was not re-run for this documentation-only closure.

## Ladder effect

`AC-111` depends on `AC-110` **and `AC-103` closed**. That dependency is now **satisfied**.

**`AC-111` is still not startable**, for reasons independent of this rung. `docs/audits/ac-111-run-manifest-preflight.md` records six prerequisites, three of which would make an operator-facing guarantee false if a real run proceeded without them:

| ID | Prerequisite |
| --- | --- |
| **M-1** | The run must use the **operational** database, or the spend marker lands where the `AC-110` gate never looks and single-use enforcement is not connected |
| **M-2** | `maxBudgetUsd` must come from the **persisted authorization**, not the hard-coded `2` |
| **M-3** | Actual spend must be **read back and recorded** |

`M-4` — what the real run implements — remains an operator decision.

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| **Finding 3a** — three WebKit Tab-reachability failures | Classified, not reopened | `AC-117` |
| **`F-131`** full satisfaction | Advanced by this rung | `AC-117` |
| **M-1 / M-2 / M-3** execution-wiring prerequisites | Recorded, not started | A `FIX` rung before `AC-111` |
| **M-4** — what the real run implements | Operator decision pending | Operator |
| **`N-03`** — 39 files still failing `pnpm format` | Operator decision pending | `AC-119` |
| **`F-133`** — no CI configuration exists at all | Operator decision pending | `AC-119` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (`N-06`) | Recorded, not regenerated | `AC-117` / `AC-119` |
| **`N-05`** — `next-env.d.ts` drift | Recorded | `AC-119` |

`AC-111` is **not started** and requires its own explicit operator authorization. It remains the first rung at which real money can be spent.
