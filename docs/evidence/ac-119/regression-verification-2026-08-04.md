# Clean Full Regression Verification — 2026-08-04

**Type:** Verification record
**Date:** 2026-08-04
**Verified at:** commit `8e8f0f7` — `chore: repository and evidence hygiene (AC-119, partial)`
**Tree state:** clean — zero uncommitted tracked changes at the time of measurement
**Authorization:** Item 4 of the operator's 24-hour safe work queue

This record is append-only. A later measurement is a new dated record, never an edit to this one (principle 18).

---

## Why this run exists

Three preceding items in the queue changed things that could plausibly regress something:

- `AC-103` pinned `workers: 3` in **both** Playwright configs. That changes how the browser suites execute.
- `AC-119` added an exclusion to `.prettierignore` and negations to `.gitignore`.
- Neither touched application source — but "should not have regressed anything" is a prediction, and this is the measurement.

## Results

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | **8 / 8 packages** ✓ |
| `pnpm lint` | **clean** ✓ |
| `pnpm build` | **2 / 2 buildable packages** ✓ (`agent-city`, `api`; the rest declare no build script) |
| `pnpm -r run test` | **1324 passed / 92 files / 0 failures** ✓ |
| Chromium browser suite | **378 passed / 0 failed / 3 skipped** ✓ |
| WebKit browser suite | **375 passed / 3 failed / 3 skipped** — the 3 are Finding 3a |
| `v1-canonical-run.json` | **byte-identical** ✓ |

### Unit and integration, by package

| Package | Files | Tests |
| --- | --- | --- |
| `packages/contracts` | 5 | 151 |
| `packages/ui` | 4 | 18 |
| `packages/world-model` | 1 | 7 |
| `packages/event-types` | 2 | 14 |
| `packages/runtime-adapters` | 8 | 128 |
| `packages/persistence` | 12 | 262 |
| `apps/agent-city` | 61 | 656 |
| `apps/api` | 9 | 88 |
| **Total** | **92** | **1324** |

### The frozen baseline

```
7775b5ce8ca4125df4592951b9ce3034ab9b3ddddb4cff9b01ad28ce1a059811
  apps/agent-city/src/lib/mock-runtime/__fixtures__/v1-canonical-run.json
```

**Identical to the hash recorded at the `AC-109` closure**, and unchanged against `HEAD`. This matters more than usual today: `AC-119` established that `pnpm format:write` *would* have rewritten this file, so the hash is confirmation that the exclusion landed before any such command could.

### V1 acceptance non-regression

`v1.1-acceptance.md` § 2 requires every V1 acceptance requirement to keep passing throughout V1.1, and calls a V1 regression a **mission stop condition**.

- `v1PrimaryJourney.test.ts` and `v1AcceptanceInvariants.test.ts`: **29 passed / 0 failed** — every numbered step of the V1 primary journey, asserted in order against the real mock runtime.
- Chromium browser suite at **378 passed**, matching the figure recorded in `docs/evidence/fbl-035/v1-acceptance-report.md`.

### The 3 skipped tests (both browser suites)

`e2e/shell-realtime-connection.spec.ts:85` across all three viewports — a `test.skip` predating this queue and unrelated to it. Skipped by the spec itself, not by configuration and not by anything done here. Recorded so the count is explained rather than merely reported.

### The 3 WebKit failures

`e2e/shell-panels.spec.ts:20` across all three viewports — **Finding 3a**, the `<button>`-not-Tab-reachable issue classified at `FBL-035` as Safari configuration-dependent after the operator observed real macOS Safari PASS. **Not reopened**, per operator direction at `FBL-035`.

All three **Finding 6** failures — `shell-selection.spec.ts:150` at two viewports and `shell-event-to-world-mapping.spec.ts:119` — now pass at all three viewports. Diagnosed at `AC-103`; see `docs/evidence/ac-103/finding-6-diagnosis.md`.

## What changed against the last recorded totals

| Measure | At `AC-110` closure | Now | Delta |
| --- | --- | --- | --- |
| Unit/integration tests | 1324 | 1324 | — |
| Chromium browser | not re-run at that closure | 378 / 0 | — |
| WebKit browser | 372 / 6 (at `FBL-035`) | **375 / 3** | **+3 passing, −3 failing** |

The WebKit improvement is `AC-103`: the three Finding 6 failures are gone, and the remaining three are the separately-classified Finding 3a.

## Scope — what was not run

Stated so the coverage of this record is not overread:

- **The performance suite** (`playwright.perf.config.ts`) was not run. `AC-117` owns the fresh performance baseline, and `PV1-040`/`N-06` are unchanged by this queue.
- **Screenshot baselines** were not regenerated, accepted, or compared. Six remain stale (`N-06`), owned by `AC-117`/`AC-119`.
- **No real-path execution suite exists to run.** `AC-111` has not begun; no Claude Code was invoked and no money was spent anywhere in this queue.

## Method

Every figure above was produced by running the command named, on this machine, at commit `8e8f0f7`, with a clean tree. Browser-suite logs from the `AC-103` investigation are retained under `docs/evidence/ac-103/runs/`; this run's Chromium log is not separately retained because it contains no failures to reproduce.
