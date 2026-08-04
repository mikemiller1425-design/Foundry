# AC-111 — Offline Construction and Pre-Run Hardening

**Type:** Rung deliverable record
**Rung:** `AC-111` — Real controlled Builder execution **[FEAT]**
**Date:** 2026-08-04
**Status:** Construction and offline hardening complete. **No run has been dispatched. The rung is not closed.**

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What was and was not done

**Built and proven offline.** Every test uses a substituted execution backend. **No Claude Code was invoked — not even `--version`. No process was spawned. No model was called. No authorization was consumed. No money was spent.**

The real `ClaudeCodeAdapter` is never constructed by any `AC-111` test; the dispatcher's `options.adapter` seam is supplied in all 29 cases, and a `realModelCalls` counter is asserted zero.

## 1. H-1 — operational persistence, and reservation before spawn

**The fix.** `ExecutionDispatcher` takes the **operational** `PersistenceService` and `CommandHandler` — the same store the `AC-110` gate reads. The `FBL-028` runner's private SQLite under `docs/evidence/fbl-028/` is not used and is not reachable from this path.

**The ordering is the substance:**

1. Resolve plan and authorization from persisted truth
2. Verify the binary's identity — **before anything is created**
3. Ask the `AC-110` gate — the only source of permission
4. **Reserve**: `AgentRun.Start` through `CommandHandler`, **before any workspace exists and before any backend is touched**
5. Create the disposable workspace
6. Execute
7. Verify write scope, run independent tests, read the cost
8. Record terminal state through the ordinary command path
9. Destroy the workspace and **verify** it is gone

**A crash after step 4 leaves the authorization spent.** Proven by test: the adapter throws mid-run, the database is closed and reopened, and the gate still reports `authorization_already_spent`. That is the conservative direction — a run that may have cost money is never silently available to repeat (`F-124`).

**Duplicate and concurrent dispatch cannot consume one authorization twice.** Two layers, both tested:

- The gate refuses once a real `AgentRun` exists for the stage.
- The reservation refuses independently, because `AgentRun.Start` is a creation command and `CommandHandler.submit` is synchronous.

The concurrency test fires two dispatches with `Promise.all` and asserts **exactly one** executed, **exactly one** `claude_code` `AgentRun` exists, and the other reached no backend.

## 2. H-2 — actual spend is read, recorded, and compared

`parseRunCostUsd` reads the cost from the run's structured output. **It fails closed in every ambiguous case**, and a test covers each: cost absent, non-finite, negative, and output that is not JSON at all. Each produces `failed_cost_unknown`, and the test asserts the recorded cost is `null` and **not** `0` — *"the run cost nothing"* and *"we do not know what the run cost"* are opposite statements.

**Over-ceiling is a containment failure.** The verdict says so, and says why it is worth recording anyway:

> "The money is already spent — this is detection, not prevention — but an overspend is recorded as a failed run rather than a success with a footnote."

**One thing is unverified, and is recorded as such.** The exact cost field name in Claude Code's `--output-format json` result could not be confirmed, because confirming it requires a real invocation, which this rung prohibits. Three candidates are accepted (`total_cost_usd`, `cost_usd`, `totalCostUsd`). If **none** is present the run fails closed, so an unrecognised shape produces a failed run rather than an invented number. **This is the single item most likely to need correction on the first real run.**

## 3. H-3 — the authorized budget, and only that

The ceiling is read **only** from the persisted `ExecutionAuthorization` and passed unmodified to the runtime profile. Tests assert the authorization, the invocation profile, and the evidence all carry the same value, at three different figures.

**The hard-coded `$2` is gone.** The historical `FBL-028` entrypoint now requires `FOUNDRY_MAX_BUDGET_USD` and **refuses without it** — a budget nobody chose is not a ceiling. No path in the repository carries a default budget.

## 4. The V1.1 objective decision

**Exactly one declared template**, `task-store-module-v1`, whose semantics match the pre-written independent fixture and tests.

| Property | Value |
| --- | --- |
| `supportedObjectiveId` | `task-store-module-v1` |
| Matching rule | **Deterministic keyword conjunction over normalised text** — every one of `"task store"`, `"module"`, `"test"` must be present |
| Allowed write paths | `src/taskStore.js` — **from the template**, never a caller argument (H-6) |
| Independent test path | `test/taskStore.test.js` — the Builder is told not to modify it and, having no shell, cannot run it |

**No model, no fuzzy matching, no synonym table, no scoring.** Those would all be ways of silently reinterpreting what the operator asked for. A near-miss like *"a task repository module with specs"* is refused, and a test asserts it.

**Refusal happens before an authorization can exist.** `Plan.Authorize` refuses an unsupported objective, so the operator is never issued a permission the system cannot honour. The refusal states the rule, explains *why* the restriction exists, and says what they can still do (the mock executor accepts any bounded objective, because nothing executes).

**General objective-to-independent-test generation is deferred beyond V1.1**, and the refusal text says so. The reason is the mission's own load-bearing guarantee: a general objective needs a generated test suite, and whatever generates it must not be the Builder.

## 5. Binary identity (H-5)

Recorded per dispatch: absolute path, **byte SHA-256**, file size, and package name/version read from the nearest `package.json`.

**Obtained without executing anything.** Version identity comes from a file on disk, not from `--version` — which the operator prohibited for this rung and which would in any case be the runtime reporting on itself.

**An unexpected identity is a pre-dispatch refusal**, before the workspace is created and before any backend is touched. So is a *missing* pin: there is no "unpinned means allow" branch. Both are tested, and both assert the backend was never reached.

Observed identity of the currently installed binary, for pinning:

```
path    : /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
sha256  : 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380
size    : 270,518,240 bytes
package : @anthropic-ai/claude-code@2.1.221
```

Read-only. The file was hashed, not run.

## 6. Workspace disposition (H-7)

Destroyed after every run, and **verified gone** with `existsSync`, with the result recorded as `destroyed` / `retained` / `never_created`. Deliberate retention is recorded honestly as `retained` rather than presented as destruction.

**A real defect was found here by test.** Disposal was originally in a `finally` block — and `finally` runs *after* the return expression has been evaluated, so every destroyed workspace was reported as `retained`. Fixed by disposing explicitly before the result is assembled. See § 8.

## 7. Preserved, unchanged

No Bash · no subagents · no MCP · no `--add-dir` · fixed literal argv · environment built from empty (`HOME`, `USER` only; **not** `PATH`) · process-group termination on timeout · byte-bounded capture · external git-diff write verification · independent test-suite validation whose result the runtime cannot influence.

**Network availability is declared and recorded, not OS-enforced.** `allowNetwork` is copied into evidence and gates nothing; `networkEnforcement: "declared_and_recorded_not_enforced"` appears in every dispatch record so no reader can mistake it for a control. Write confinement is likewise **detection** — a git diff against a pre-run baseline — not prevention.

## 8. Defects found during construction

Both were found by the tests, before any commit:

1. **Workspace disposition was never recorded.** Disposal ran in `finally`, which executes *after* the return value is built, so the mutation arrived too late and every destroyed workspace reported `retained`. Disposal is now explicit.
2. **Terminal `AgentRun` events were silently rejected.** `AgentRun.Fail` and `AgentRun.Timeout` were submitted without `evidenceIds`, which their payload schemas require, so the events failed validation and every failed run stayed `running` forever. Now supplied on every terminal path.

The second is the more serious: the run would have looked successful-ish in the projection while the cost check had actually failed it.

## 9. Verification

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1368 passed / 94 files / 0 failures** (up from 1324) · `v1-canonical-run.json` **byte-identical**.

**29 offline dispatcher tests**, covering every scenario the authorization named: allowed dispatch · missing-authorization refusal · stale-hash refusal · duplicate refusal · concurrent refusal · budget propagation · missing-cost failure (×4 shapes) · over-budget containment failure · binary mismatch refusal · missing-pin refusal · write-scope failure · independent-validation failure · timeout with retained evidence · workspace destruction verified · honest retention · redaction · `AgentRun`→`Task`→`BuildStage` linkage (`F-115`) · unsupported-objective refusal · no-stage refusal · zero real model calls.

**`F-114`'s unauthorized-dispatch half is complete offline.** A dispatch with no authorization is refused with the whole persisted store asserted byte-equal before and after — zero side effects, measured rather than asserted.

## 10. Still open before a real run

| ID | Item | Owner |
| --- | --- | --- |
| **Cost field name** | Unverified; fails closed. Most likely correction on the first real run | Operator decision to proceed |
| **Binary pin** | Must be configured deliberately from § 5, not copied because it is what happens to be on disk | Operator |
| **M-4 residue** | The real stage implements the template, not arbitrary operator text. `PV1-049` stays partly open | Beyond V1.1 |
| **Stage status interaction** | The `AC-109` mock orchestration completes `backend_implementation` before a real run could replace it. Coherent for dispatch; the world-state story is `AC-112`/`AC-113`'s | `AC-112` |

**`AC-111` is not closed.** No run has been dispatched. Dispatching one requires fresh, explicit operator authorization.
