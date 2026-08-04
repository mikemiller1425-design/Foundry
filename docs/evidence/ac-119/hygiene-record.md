# AC-119 — Repository, Evidence, and CI Hygiene

**Type:** Rung deliverable record
**Rung:** `AC-119` — CI, hygiene, and reproducibility **[HARD]**
**Date:** 2026-08-04
**Status:** Partial — three items fixed, two recorded with a stated reason for not acting. **The rung is not closed.**

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 1. AC-110 evidence header — verified and clarified *(operator-requested)*

**The operator asked for verification and clarification of the `AC-110` evidence header: actual closure commit `f955327` versus its pre-closure documentation base `b7891b0`.**

**Verified. The operator is right, and the header is imprecise.**

| Commit | Role | Header's treatment |
| --- | --- | --- |
| `a82fcf4` | **The implementation** under review | ✅ Correct — "Observed against" |
| `b7891b0` | **The documentation base** — the parent the record was authored on | ❌ Mislabelled as "Closed at" |
| `f955327` | **The closure commit** — contains the record, the ladder status, and the CHANGELOG entry | ❌ Not named at all |

`git show -s --format=%p f955327` → `b7891b0`, confirming `b7891b0` is the parent, not the closure.

**Why it happened:** a file cannot contain the hash of the commit that introduces it — the hash is computed over content that would have to include it. A record which is part of its own closure commit can only name its base. Calling that base "Closed at" was the error.

**Clarification appended** to `docs/evidence/ac-110/operator-observation.md` — 46 lines added, **0 removed**, verified with `git diff --numstat`. The original header is left exactly as written.

**Convention adopted for future rung records:** carry **"Implemented at"** and **"Documentation base"**, and do not claim a "Closed at" commit the record cannot know. The closure commit is discoverable instead:

```bash
git log --oneline --diff-filter=A -- docs/evidence/<rung>/operator-observation.md
```

Applied to the `AC-110` record, that returns `f955327`. Nothing about the approval, its basis, the evidence, or the closed status changes.

---

## 2. `pnpm format:write` would have broken the frozen baseline — **fixed**

**This was the most serious thing found, and it was hiding inside a cosmetic annoyance.**

`N-03` has been carried since the reconciliation as "`pnpm format` fails, pre-existing". The documented remedy for a failing Prettier check is `pnpm format:write`. Measured:

```
apps/agent-city/src/lib/mock-runtime/__fixtures__/v1-canonical-run.json
  before prettier : 64,759 bytes
  after prettier  : 64,094 bytes   →  DIFFERENT
```

`v1.1-acceptance.md` § 2 requires that fixture to remain **byte-identical**, and every V1.1 rung closure re-verifies it. So the obvious fix for a lint-adjacent nuisance would have silently rewritten the V1 regression baseline and broken a mission stop condition — with no error, because Prettier would have been doing exactly its job.

**Fix:** the fixture is excluded in `.prettierignore`, with the measurement recorded inline. This removes the hazard at its source rather than relying on nobody running the obvious command. Dirty-file count drops from 41 to 39.

---

## 3. Evidence could be silently swallowed by `.gitignore` — **fixed**

`F-134` requires every artifact an approval cites to be retrievable from a fresh clone. Two failures of that, both real:

- `PV1-043` recorded that Finding 6 had *"no reproduction record at all"* because `test-results/` is git-ignored.
- At `AC-103`, an hour before this record, the diagnosis run logs were **dropped from a `git add` without any error** because `.gitignore` line 27 ignores `*.log`. They had to be renamed to `.txt` to be retained.

The same mechanism, twice, three months apart. Evidence a gitignore rule can quietly discard is not retained evidence.

**Fix:** `.gitignore` now negates those patterns under `docs/evidence/` only:

```
!docs/evidence/**/*.log
!docs/evidence/**/logs/
!docs/evidence/**/test-results/
```

Build noise stays ignored everywhere else. An artifact placed in `docs/evidence/` is now committed or visibly refused — never silently absent. Verified by probe: a `.log` under `docs/evidence/` is now trackable.

### F-134 audit — current state

Every artifact path cited from a `docs/evidence/**/*.md` record was checked for existence and for gitignore status:

| Result | Count |
| --- | --- |
| Cited artifact paths | 44 |
| **Missing from the tree** | **0** |
| Present but gitignored | 1 — `apps/agent-city/.next`, a build directory mentioned in prose, not an artifact |

`F-134`'s retrievability property **currently holds**. The fix above is what keeps it holding.

---

## 4. `N-03` — the remaining 39 files, and why they were not reformatted

| Bucket | Count |
| --- | --- |
| Total files failing `pnpm format` | 41 → **39** after the fixture exclusion |
| Touched during V1.1 (since `3cdd539`) | 14 |
| **Pre-existing, untouched since V1** | **27** |
| Evidence records among them | 0 |

**Deliberately not fixed in this queue.** Running `prettier --write` would rewrite 27 files last modified during V1, producing a large mechanical diff mixed into a hygiene commit and touching code the frozen V1 records describe. The operator authorized *hygiene*, not a repository-wide reformat, and a reformat of that size deserves its own explicit authorization and its own commit so the diff is reviewable as what it is.

**Recommendation:** a dedicated, separately-authorized commit doing `pnpm format:write` **and nothing else**, verified by the full suite afterwards. The dangerous part — the frozen fixture — is now excluded, so that commit is safe to run when authorized.

---

## 5. `F-133` — **no CI exists at all**

> `F-133`: CI reproduces every local gate — typecheck, lint, build, unit/integration — on every change, and cannot be bypassed silently.

**There is no CI configuration in this repository.** No `.github/workflows`, no `.circleci`, no `.gitlab-ci.yml`, no `Jenkinsfile`. Every gate reported in every evidence record to date was run locally, by the assistant, on one machine.

That is not a defect in what was recorded — the records say what was run and where — but `F-133` is unsatisfied in full, and this is the rung that owns it.

**Deliberately not created in this queue.** A workflow file is not inert: adding one causes runs on every push, which consumes GitHub Actions minutes and is billable on a private repository. The operator's standing instruction for this queue is **"do not spend money"**, and enabling automated billing without asking would violate it in spirit even though no model is invoked.

**Recommendation:** `AC-119` should propose the workflow for explicit authorization. The gates it would run are already established and reproducible:

```
pnpm typecheck   # 8/8
pnpm lint
pnpm build
pnpm -r run test
pnpm --filter @foundry/agent-city exec playwright test   # workers now pinned (AC-103)
```

The browser suite's worker cap is now structural rather than a remembered flag, which is a precondition for CI reliability that did not hold before `AC-103`.

---

## 6. What was changed

| File | Change |
| --- | --- |
| `.prettierignore` | Exclude the frozen `v1-canonical-run.json` |
| `.gitignore` | Negate `*.log` / `logs/` / `test-results/` under `docs/evidence/` |
| `docs/evidence/ac-110/operator-observation.md` | Clarification **appended** (46 added, 0 removed) |

No source file was modified. No test was changed. No evidence record was rewritten.

## 7. Status

`AC-119` is **not closed.** Items 1–3 are done; items 4 and 5 are recorded with a stated reason for not acting and a recommendation each. Both remaining items need an operator decision before they can proceed:

- **N-03:** authorize a standalone repository-wide `format:write` commit?
- **F-133:** authorize adding a CI workflow, accepting that it consumes Actions minutes?
