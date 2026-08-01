# FBL-028 — Controlled Claude Code Execution: Operator Review Report

**Status:** Awaiting operator review. **Not reviewed. Not approved.**
**Rung:** FBL-028 — Controlled Claude Code execution (ADR-006, F-12, `v1-scope.md` stage 4 `backend_implementation`)
**Run date:** 2026-08-01 (UTC)
**Outcome:** `succeeded` — determined by Foundry's independent validation, not by the runtime's self-report
**Raw evidence:** `evidence.json`, `diff.patch`, `stdout.txt`, `stderr.txt`, `tests.txt` (this directory)

> This report is presented for review. Nothing in it constitutes operator
> approval, and FBL-029 has not been started.

**Disclosure — the controlled stage was executed twice.** A first run (fixture `…-1hkdLx`, 22.3 s, $0.078) also succeeded. While reviewing it, a gap was found in the *evidence capture*, not in containment: write-scope verification used a plain `git diff HEAD`, which shows nothing for a file the stage newly *created*, so a rogue new file would have been named by `git status` while its contents went missing from the diff. The capture was fixed (stage, then `git diff --cached HEAD`), a regression test added, and the stage re-run so that the retained evidence corresponds exactly to the code being committed. This report and every artifact in this directory describe the **second** run (fixture `…-VGyvj1`). Both runs produced the same outcome: one file changed, zero denials, 12/12 independent tests passing. The first run's artifacts were overwritten and are not retained.

---

## 1. Exact prompt / task specification

Delivered on **stdin**, never as a command-line argument (see §3 for why):

```text
Implement the task store for this repository.

Read SPEC.md and test/taskStore.test.js, then write the complete
implementation into src/taskStore.js so that it satisfies the
specification exactly.

Rules:
- Modify only src/taskStore.js. Do not create, edit, or delete any other
  file, including the tests.
- Write plain ES module JavaScript. Do not add dependencies.
- The tests will be run independently after you finish. You cannot run
  them yourself.

When src/taskStore.js is complete, reply with a one-line summary.
```

The stage is the specified V1 Builder stage: `backend_implementation`, the one stage `v1-scope.md` assigns to the `claude_code` runtime. Risk class **R2** (controlled internal change), within the R0–R2 ceiling of principle 19.

## 2. Isolated repository and path policy

| Item | Value |
| --- | --- |
| Fixture root | `/private/var/folders/2_/…/T/foundry-fbl028-VGyvj1` (created by `mkdtemp`, per-user temp) |
| Canonical roots | exactly one — the fixture root |
| Canonical working directory | the fixture root |
| Created | fresh for this run, by `createFixtureRepository()` |
| Contents | `package.json`, `SPEC.md`, `src/taskStore.js` (stub), `test/taskStore.test.js` |
| Disposed | yes — removed after evidence capture |

**It was never run against** the Foundry repository, the user's home directory, `Documents`, any other real project, or any directory containing credentials or unrelated user data. The fixture contained nothing but the demo task.

Allowed write paths: **`src/taskStore.js`** only.

## 3. Command line, tools, and risk class

Executable (absolute, resolved from policy — **not** from `PATH`):

```text
/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
```

Argument vector — every element a fixed literal in the allowlist, no wildcards:

```text
--print --output-format json --model sonnet
--tools Read,Write,Edit,Glob,Grep
--permission-mode acceptEdits
--safe-mode --strict-mcp-config --disable-slash-commands
--no-session-persistence --max-budget-usd 2
```

| Control | Effect |
| --- | --- |
| `--tools Read,Write,Edit,Glob,Grep` | File tools only. **No `Bash`** — the run could not execute commands, and therefore could not run or fake its own validation. No `WebFetch`/`WebSearch`/`Task`. |
| no `--add-dir` | Tool access scoped to the fixture directory |
| `--safe-mode` | No CLAUDE.md, skills, plugins, hooks, custom agents, output styles |
| `--strict-mcp-config` (no `--mcp-config`) | No MCP servers |
| `--permission-mode acceptEdits` | Edits apply without prompting; no other tool existed to grant. **Not** `bypassPermissions`, and neither `--dangerously-skip-permissions` nor `--allow-dangerously-skip-permissions` appears anywhere. |
| `--max-budget-usd 2` | Spend ceiling |
| `--no-session-persistence` | No session written to disk |

Environment delivered to the child: **`HOME`, `USER`** — and nothing else. The child environment is constructed from empty, not filtered from the parent. Notably `PATH` was **not** granted (it is on the never-allowlistable set), so the run could not resolve helper binaries by name.

Timeout 10 min; stdout/stderr capped at 1 MiB each; evidence capped at 8 MiB. Prompt travelled on stdin so the argument allowlist never had to accept free-form prose.

## 4. Files before and after

| Path | Before | After |
| --- | --- | --- |
| `SPEC.md` | 1481 B · `6e1c6198…a957` | unchanged |
| `package.json` | 233 B · `30776ba9…ac48` | unchanged |
| `src/taskStore.js` | 250 B · `59291070…f844` | **changed** — 1375 B · `a27b1a80…266f` |
| `test/taskStore.test.js` | 3352 B · `a506359b…38f0` | unchanged |

No file was created or deleted. Three of four files are byte-identical before and after — including the test file, whose hash is unchanged, which is independent confirmation that the suite the stage was graded against is the one written before it ran. Full hashes are in `evidence.json` (`filesBefore` / `filesAfter`).

## 5. Diff

`git status --porcelain` reported exactly ` M src/taskStore.js`. Full unified diff: `diff.patch` (also embedded in `evidence.json`). The stub's `throw new Error("not implemented")` was replaced with a complete `createTaskStore` implementing `addTask`, `completeTask`, `deleteTask`, `listTasks`, and `toJSON`, with defensive copies on read.

The diff was read **from the repository** — status first, then `git add -A`, then `git diff --cached HEAD` against a baseline commit made before the stage ran. It is not a report the runtime produced about itself. Staging before diffing is deliberate: a plain `git diff HEAD` shows nothing for a file the stage *created*, so a rogue new file would have been named by status while its contents went missing from the evidence. A regression test pins this.

## 6. Exit status, stdout, stderr

| Field | Value |
| --- | --- |
| Exit code | `0` |
| Signal | none |
| Duration | 20.374 s (started `2026-08-01T04:04:42.547Z`) |
| stdout | 1824 bytes, not truncated (`stdout.txt`) |
| stderr | 0 bytes |
| Reported cost | $0.081 |
| `permission_denials` (Claude Code's own record) | `[]` — no disallowed tool was attempted |
| Policy denials (Foundry's record) | `[]` |

## 7. Timeout behaviour

Not exercised by this run (it completed in 20.4 s against a 10-minute budget). Timeout handling is covered by test, not by assumption:

- `processRunner.test.ts` spawns a process that backgrounds a long-lived grandchild, times out, and then asserts **the grandchild's PID is dead** — proving the whole process *group* is terminated, not just the direct child.
- The same suite asserts output produced before a timeout is retained.
- `controlledStage.test.ts` asserts a timed-out stage is recorded as `timed_out` with its partial logs intact.
- `agentRunLifecycle.test.ts` asserts a `timed_out` AgentRun keeps its `logRef` and `evidenceIds` across a backend restart.

## 8. Policy decisions

Zero denials during the run — the invocation matched the allowlist exactly. Denial paths are covered by 128 tests in `packages/runtime-adapters`, including unknown commands, disallowed arguments, shell-injection attempts, absolute/relative/`..`/symlink/dangling-symlink escapes, environment leakage, and risk classes above R2 (unrepresentable in the schema).

Validation commands ran under their **own, narrower** policy (`fbl-028-independent-validation`, R1, `allowNetwork: false`, empty environment allowlist, and only these exact vectors: `git init --quiet`, `git add -A`, `git … commit`, `git status --porcelain`, `git diff --cached HEAD`, `git rev-parse HEAD`, and one `node --test <file>` — no `push`, `remote`, `fetch`, or `clone`). Foundry's own verification is not exempt from containment.

## 9. Independent validation results

The tests were written **into the fixture in advance**, pinned the contract exactly, and the stage was told not to modify them — and, having no shell, could not run them either. Foundry ran them afterwards:

```text
✔ addTask returns a well-formed task            ✔ completeTask marks the task complete
✔ addTask trims the title                       ✔ completeTask throws for an unknown id
✔ addTask rejects an empty or non-string title  ✔ deleteTask removes the task and returns true
✔ task ids are unique                           ✔ deleteTask throws for an unknown id
✔ listTasks preserves insertion order           ✔ toJSON round-trips through createTaskStore
✔ listTasks does not expose the store's array   ✔ a restored store keeps working

pass 12   fail 0   exit 0
```

Success was decided by **write-scope containment + this exit code**. The stage's own summary ("Implemented `createTaskStore`…") is captured as evidence and was never consulted as a verdict. `controlledStage.test.ts` proves this directly with a case where the stage exits `0` and claims success while the independent tests fail — the run is recorded as `failed_validation`.

## 10. Denied attempts

None occurred. Claude Code's own `permission_denials` array is empty and Foundry recorded no policy denial.

## 11. Durability and duplicate protection

- The `AgentRun` was recorded through the ordinary FBL-023/025 path: `AgentRun.Start` → `AgentRun.Complete`, persisted as immutable events. Final state: id `agentrun-fbl-028-backend-implementation`, `runtimeType: claude_code`, `status: completed`, `riskClass: R2`, `exitCode: 0`, `evidenceIds: [7657ec85-8aa8-4688-aeb7-4a0669aed3ff]`.
- **Re-running the operator script against the same log refused**: `refusing to run: AgentRun already exists in the persisted log.` Nothing was executed — no baseline commit, no API call. Verified live against the real persisted log.
- `agentRunLifecycle.test.ts` proves the record survives a full close-and-reopen of the database, and that duplicate protection is rebuilt from the log rather than held in memory.

The run's SQLite database (`agentrun.sqlite`) is **not** committed — `*.sqlite` is gitignored repo-wide (FBL-023). Nothing is lost by this: the full persisted event log and the reconstructed `AgentRun` entity are embedded verbatim in `evidence.json` under `persistedEvents` and `persistedAgentRun`.

---

## 12. Limitations the operator should weigh

These are stated plainly because they bound what this rung actually proves.

1. **The boundary governs invocation, not a running process.** FBL-027 controls which binary runs, with which arguments, in which directory, with which environment, for how long, and what is captured. Once `claude` is executing, nothing in Foundry stops it from opening a path Foundry never mentioned. That would require OS-level sandboxing, which V1 does not implement.

2. **Write confinement is detection, not prevention.** Foundry proves *after the fact*, from the repository's own git state, that only permitted files changed, and fails the run otherwise. Prevention of out-of-scope writes rests on Claude Code's own permission system and the absence of `Bash`.

3. **`allowNetwork: true` for this policy, and it is not enforced anyway.** F-12 requires a *real* controlled Claude Code stage, which cannot be offline — this is the "specification explicitly requires and authorizes it" case. Separately, `allowNetwork` is a declared and recorded posture everywhere in this package: no network namespace or packet filter is created. Network denial elsewhere in V1 rests on the command allowlist and the environment allowlist.

4. **The environment allowlist does not keep the process away from the OS credential store.** Claude Code authenticates from the macOS Keychain, reached through the user session, not through any environment variable. Withholding `USER` only breaks the lookup; it does not sandbox it. Keeping secrets out of the *environment* is a real guarantee here. Keeping a process away from the *Keychain* is not one this boundary can make.

5. **Secret redaction by shape is a safety net, not a guarantee.** Registered values are matched literally and cannot be missed; unregistered credentials are caught only if they match a known format. This is why secrets are kept out of contained runs rather than relied on to be scrubbed on the way out.

6. **The fixture task is small.** It exercises the containment and validation mechanism end-to-end, not Claude Code's capability on a large codebase. That is deliberate — F-12 asks for one controlled stage with captured evidence — but it means this run is not evidence about performance at scale.

7. **The browser suite is flaky under load, and this deserves separate attention.** Across three full runs, a small number of specs failed — but *different ones each time*: first `shell-timeline.spec.ts:118` (element detached from the DOM while clicking a row in the live-updating timeline), then `shell-selection.spec.ts:23` and `shell-residences.spec.ts:112`. Every one of them is a timing-sensitive test against the animated 3D world and the deterministic mock runtime, and each passes in isolation.

   FBL-027 and FBL-028 are **backend-only** — no file under `apps/agent-city` was modified by either rung — so these cannot be regressions from this work. The first two runs competed for CPU with the controlled Claude Code run and the unit suites, and that is what the evidence points to: a **final run with nothing else executing passed completely — 342 passed, 3 skipped, 0 failed, exit 0** (§13).

   That clean result is the honest number for this rung's gate, but it does not make the flakiness disappear — it locates it. These specs fail under CPU contention, which CI will eventually reproduce. Recommend treating it as its own defect rather than considering it settled here.

   This is flagged rather than re-run quietly to green: a suite whose failures move around under load is a real maintenance signal, and it is worth its own remediation rather than being absorbed silently into this rung's evidence.

---

## 13. Verification gates

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | clean, all 8 projects |
| `pnpm lint` | clean |
| Unit + integration | **619 passed** (588 before this rung; +19 controlled-stage, +6 AgentRun durability, +6 multi-rule allowlist) |
| Browser (Playwright) | **342 passed, 3 skipped, 0 failed** on an isolated run. Two earlier runs, executed while the controlled stage and unit suites competed for CPU, each failed a *different* small set of timing-sensitive 3D specs — see limitation 7. |
| `pnpm build` | passes |
| Controlled run | `succeeded` |

## 14. What the operator is being asked to decide

Whether the containment demonstrated here is sufficient to proceed, and whether limitations 1–5 are acceptable as the standing posture for V1 or require hardening first. **FBL-029 has not been started and is not authorized.**
