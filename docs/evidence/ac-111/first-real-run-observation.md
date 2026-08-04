# AC-111 — First Real Controlled Run: Observation and Evidence Audit

**Type:** Post-run audit record
**Rung:** `AC-111` — Real controlled Builder execution **[FEAT]**
**Date:** 2026-08-04
**Run performed by:** the operator, via `pnpm --filter @foundry/api ac-111:dispatch … --execute-real-run`
**Status:** The run succeeded. **`AC-111` is not closed.**

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

**Nothing in producing this record invoked Claude Code, called a model, retried the run, issued or consumed another authorization, or spent money.** Every database read was made against a read-only backup.

---

## 1. The run

The first real controlled Claude Code execution in Foundry's history. It succeeded.

| | |
| --- | --- |
| Build | `build-3d5a77c3-063f-4f56-8677-d72f052c6632` |
| Plan | `plan-30e79938-4c9b-4bb9-847e-2e752822c1b5` |
| Real `AgentRun` | `plan-30e79938-…--backend_implementation--real-run` |
| Evidence id cited | `deb0a728-bec4-4934-ae02-6e480b673538` |
| Outcome | succeeded, exit code 0 |
| Duration | 20:36:27.695Z → 20:37:02.638Z (~35 s) |

## 2. What survived — facts in backend truth

Verified by reading the persisted store. These are durable, replayable, and queryable.

| Fact | Where |
| --- | --- |
| The authorization: ceiling **$5**, stage `backend_implementation`, plan content hash `sha256:6d398138…`, authorized by `operator-1` | event **128** `operator.execution_authorized` |
| The run was **reserved before dispatch**: `runtimeType: claude_code`, `riskClass: R2`, linked to the `backend_implementation` task | event **133** `agentrun.started`, actor `backend/backend` |
| The run completed with **exit code 0** | event **134** `agentrun.completed` |
| The `AgentRun` entity: status `completed`, `startedAt`, `completedAt`, `exitCode: 0`, `evidenceIds` | `agentRuns` projection |

**H-1 held.** The reservation is in the operational store the `AC-110` gate reads, recorded as the backend rather than an impersonated operator, and it precedes the completion. The authorization is spent and the gate can see it.

## 3. What did not survive — computed, printed, and lost

**These facts were never persisted. This record does not claim otherwise.**

| Fact | Status |
| --- | --- |
| Authorized ceiling ($5) **on the run record** | ❌ not persisted (only on the authorization event, not on the run) |
| Ceiling passed to the runtime ($5) | ❌ not persisted |
| **Actual cost ($0.0790585)** | ❌ not persisted — the store contains **zero** events or entities mentioning cost |
| Budget / containment outcome | ❌ not persisted |
| Binary path, SHA-256, size, package identity | ❌ not persisted |
| Allowed write paths and write-scope result | ❌ not persisted |
| Independent-test result | ❌ not persisted |
| Workspace disposition and destruction verification | ❌ not persisted |
| Verdict text | ❌ not persisted |
| Network-enforcement declaration | ❌ not persisted |
| Truncation / redaction state | ❌ not persisted |
| **The `DispatchEvidence` record itself** | ❌ not persisted |

### The evidence id is a dangling pointer

`agentrun.completed` cites `deb0a728-bec4-4934-ae02-6e480b673538`. A search of the entire database finds that id in exactly **two** places:

1. the completion event that cites it, and
2. the `AgentRun` entity projected from that event.

**Records keyed by it: zero.** No file in the repository carries it either.

A reference to evidence that does not exist is **worse than no reference**, because it reads like an audit trail. Anyone auditing this run later would follow the id and find nothing.

## 4. Facts observed only in terminal output

The operator reported these from the dispatch output. They are **assistant-unverified and not persisted anywhere**; they are recorded here as the operator's report, which is the only surviving trace.

- Actual cost **$0.0790585** against a **$5** ceiling
- Workspace destroyed, destruction verified
- Verdict: independent tests passed; every change was inside permitted paths
- Evidence id `deb0a728-…`

**This record does not elevate these to backend truth.** They are terminal output, retained by an operator's report, and that is exactly their standing.

## 5. Why it happened

The dispatcher built a complete `DispatchEvidence` object in memory and returned it to the caller, which printed a summary. Nothing wrote it anywhere. The runtime boundary's own `evidenceId` was passed into `agentrun.completed`'s `evidenceIds` as though citing a record — but no code path had ever created one.

The gap was not noticed earlier because every offline test asserted on the **returned** `DispatchEvidence`, which is fully populated in memory. No test asked whether any of it was still there afterwards.

## 6. What was changed, and what was not

### Not changed — history is intact

**Events 133 and 134 were not edited, deleted, recreated, or backfilled.** The `AgentRun` entity was not rewritten. The database is byte-for-byte as the run left it: **135 events, 39 entities before and after** every step of this work, verified around the full test suite. The dangling evidence id remains dangling, permanently, because that is what happened.

### Changed — future runs persist evidence durably

Through the declared architecture, not a log file:

| Layer | Addition |
| --- | --- |
| Contract | `PersistedRunEvidenceSchema` — 26 fields covering every item in § 3 |
| Event | `agentrun.evidence_recorded`, joined to the runtime vocabulary |
| Command | `AgentRun.RecordEvidence` (a **creation** command — a second record for one id is refused) |
| Reducer | `agentRunEvidence` entity type, keyed by evidence id, idempotent under replay |
| Terminal events | optional `budget` summary on `agentrun.completed` / `failed` / `timed_out` |

**Ordering is the substance.** Evidence is persisted **before** the terminal event, and **read back** before that event is emitted — an accepted command is not proof a record is queryable, which is precisely the assumption that produced the dangling id. A terminal event may only cite evidence that has been retrieved.

**If evidence cannot be made durable**, the run is recorded as `agentrun.failed` with `failureCode: "evidence_persistence_failed"` and an **empty** `evidenceIds`, never as an ordinary completion. The failure message preserves the truth that money may already have been spent:

> "The run itself completed as `succeeded`, so MONEY MAY ALREADY HAVE BEEN SPENT ($3) — but no durable record exists, so this is reported as an audit failure rather than a completion."

**Backward compatibility.** The `budget` summary is optional because every historical mock `agentrun.*` event carries none, and requiring one would invalidate `v1-canonical-run.json`. `actualCostUsd` is nullable because **`null` means unknown and must never be recorded as `0`**.

## 7. A defect found while building the fix

The evidence record was originally constructed **before** the workspace was disposed, so every record would have claimed `workspaceDisposition: "retained"` and `workspaceDestructionVerified: false` even when the workspace had been destroyed a moment later.

This is the same class of mistake as the `finally`-after-return defect found earlier in this rung: **evidence about a thing must be written after that thing's fate is settled.** Disposal now runs before the record is built. Caught by test, before commit.

## 8. Verification

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1462 passed / 0 failures** (up from 1430) · `v1-canonical-run.json` **byte-identical**.

**Eleven new offline tests**, all with substituted backends and temporary databases: evidence persisted for successful, failed-validation, failed-write-scope, timed-out, unknown-cost, and over-budget runs; a terminal event never citing a nonexistent record (asserted by walking every `agentrun.*` event in the log); unknown cost recorded as `null` and explicitly **not** `0`; durable evidence surviving a close and reopen of SQLite; an evidence-persistence failure proven unable to produce a false successful completion; and a duplicate record refused rather than overwriting.

**No real model call occurred.** The real `ClaudeCodeAdapter` is never constructed in any test.

**The operator's database was preserved exactly**: 135 events / 39 entities before and after the full suite, measured each time. Every test used its own temporary database. The audit itself read a read-only `.backup` copy, never the live file.

## 9. What this record does not claim

- **It does not claim the missing evidence was persisted.** § 3 lists what was lost; § 4 marks what exists only as operator-reported terminal output.
- **It does not claim the first run's evidence can be recovered.** It cannot. The process exited and the data is gone.
- **It does not backfill.** Writing a record now for `deb0a728-…` would fabricate an audit trail, which is worse than the gap.
- **It does not close `AC-111`.** The rung's stop condition is one successful real stage **with reviewed evidence**, and the evidence for *this* run does not durably exist.

## 10. Open

| Item | State |
| --- | --- |
| The first run's detailed evidence | **Permanently lost.** Recorded as such |
| Durable evidence for future runs | Implemented and tested offline; **never exercised by a real run** |
| `AC-111` closure | Requires the operator's decision — see the observation gate |
| `AC-112` | Not started |
