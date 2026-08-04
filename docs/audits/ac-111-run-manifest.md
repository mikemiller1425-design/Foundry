# AC-111 Run Manifest and Before-Run Operator Gate

**Type:** Proposal and operator gate. **Nothing here has been executed.**
**Date:** 2026-08-04
**Supersedes:** `docs/audits/ac-111-run-manifest-preflight.md` (2026-08-04), which recorded six blocking prerequisites. Three are now fixed; the preflight is retained unedited as the record of what was true then.
**Constructed at:** commit `f59c144` — `feat: AC-111 offline construction and pre-run hardening (no run dispatched)`

**This document authorizes nothing.** It describes exactly what one run would do, so the operator can decide whether to permit it. **No Claude Code has been invoked, no process spawned, no model called, and no money spent** at any point in producing it.

---

## 1. Blocking prerequisites — status

| ID | Prerequisite | Status |
| --- | --- | --- |
| **M-1** | Operational persistence; reserve before spawn | ✅ **Fixed** — dispatcher uses the gate's own store; `AgentRun.Start` precedes any workspace or backend |
| **M-2** | Budget from the persisted authorization | ✅ **Fixed** — read only from `ExecutionAuthorization`; hard-coded `$2` removed everywhere |
| **M-3** | Actual spend read back and recorded | ✅ **Fixed** — parsed, fails closed, ceiling and actual both recorded |
| **M-4** | Decide what the run implements | ✅ **Decided** — one declared template; general generation deferred beyond V1.1 |
| **M-5** | Binary identity recorded, mismatch refused | ✅ **Fixed** — path, SHA-256, size, package version; missing pin also refused |
| **M-6** | Write paths derived from the plan/template | ✅ **Fixed** — from the template, never a caller argument |

**All six are addressed.** What remains before a run is the operator's decision and two configuration acts (§ 5).

## 2. Exactly what would run

```
/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
  --print
  --output-format json
  --model sonnet
  --tools Read,Write,Edit,Glob,Grep
  --permission-mode acceptEdits
  --safe-mode
  --strict-mcp-config
  --disable-slash-commands
  --no-session-persistence
  --max-budget-usd <the operator's authorized ceiling>
```

Every element is a fixed literal validated position by position. **The task specification travels on stdin**, never as an argument, so prose never passes through an allowlist that would then have to accept arbitrary characters.

| | |
| --- | --- |
| **Stage** | `backend_implementation` — the only stage the plan may allocate to `claude_code` and the only one `Plan.Authorize` accepts |
| **Objective template** | `task-store-module-v1` |
| **Workspace** | Fresh `mkdtemp` under the OS temp directory, per run. Never the Foundry repository, never `$HOME`, never a real project |
| **Writable** | `src/taskStore.js` — one file, from the template |
| **Not writable** | `test/taskStore.test.js` — the independent suite. The Builder is told not to modify it and, having **no Bash**, cannot run it either |
| **Environment** | `HOME`, `USER`. Built from empty. **Not** `PATH` |
| **Network** | Reachable. **Declared and recorded, not OS-enforced** |
| **Wall clock** | 10 min → SIGTERM to the process group → SIGKILL after 5 s |
| **Capture** | 1 MiB stdout, 1 MiB stderr, dropped past the cap rather than buffered |
| **Money** | Bounded by the operator's authorized ceiling, ≤ $25 |

### The binary, as currently installed

```
path    : /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
sha256  : 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380
size    : 270,518,240 bytes
package : @anthropic-ai/claude-code@2.1.221
```

Hashed, not run. A mismatch at dispatch is a refusal before the workspace is created.

## 3. How the verdict is decided

Not by anything the run says about itself.

1. **Write scope** — `git status --porcelain` and `git diff --cached HEAD` against a baseline commit made before the stage ran. Any path outside `src/taskStore.js` fails the run.
2. **Correctness** — `test/taskStore.test.js`, executed by Foundry through a narrower policy (`R1`, no network, no `claude`, no shell).
3. **Cost** — parsed from the structured result. Missing or malformed **fails the run**; over-ceiling is a containment failure.
4. **Verdict** — from 1–3 plus the process exit status. The stage's stdout is captured as evidence and never consulted as a verdict.

## 4. What would be spent, and what would be at risk

| | |
| --- | --- |
| **Money** | Up to the authorized ceiling. **This is the first and only irreversible cost.** |
| **The authorization** | **Consumed at reservation**, before the process starts. It is not refunded if the run fails, times out, or crashes |
| **Time** | ≤ 10 minutes |
| **Filesystem** | One temp directory, destroyed and verified afterwards |
| **What could still write outside it** | Claude Code's own file tools, if its permission system failed. Foundry **detects** this afterwards and fails the run; it does not prevent it |
| **Credentials** | The environment carries no secret. Claude Code authenticates via the macOS Keychain through the user session, which this boundary does not sandbox |

## 5. What the operator must do before a run

1. **Pin the binary deliberately.** Configure `expectedExecutableSha256` from § 2 — having satisfied yourself that this is the binary you intend, not because it is what happens to be on disk. Copying the value to make the refusal go away defeats the check.
2. **Choose a ceiling.** The authorization's `maxBudgetUsd`, ≤ $25. It is now the value actually passed to the runtime.

## 6. What is still unverified, stated plainly

**The cost field name.** Claude Code's `--output-format json` result is parsed for `total_cost_usd`, `cost_usd`, or `totalCostUsd`. **Which one it actually emits could not be confirmed**, because confirming it requires a real invocation.

The consequence is bounded and safe: if none is present, the run **fails closed** — recorded as `failed_cost_unknown`, cost `null`, never `0`. So the first real run may fail on this, having still spent money. That is the correct failure direction, and it is the single most likely correction the first run will produce.

**No HTTP route dispatches a run.** The dispatcher is reachable from code and tests only. Wiring an operator-facing control is deliberately deferred until after the first authorized run is reviewed — a button that spends money should not exist before the mechanism behind it has been watched once.

## 7. Before-run operator review gate

To authorize one run, confirm each of the following. Any "no" should stop the run.

| # | Confirm |
| --- | --- |
| 1 | I accept that **real money will be spent**, up to the ceiling I set, and that this is irreversible |
| 2 | I accept that the authorization is **consumed at reservation** and is not refunded on failure, timeout, or crash |
| 3 | I have **pinned the binary** from § 2 deliberately, not to silence a refusal |
| 4 | I have **chosen the ceiling** and understand it is now what reaches the runtime |
| 5 | I accept that the run implements the **`task-store-module-v1` template**, not arbitrary objective text, and that `PV1-049` stays partly open |
| 6 | I accept that write confinement is **detection, not prevention**, and that network is **declared, not OS-enforced** |
| 7 | I accept that the **cost field name is unverified**, and that the first run may fail closed on it after spending money |
| 8 | I understand the run is **watched, not interactive** — there is no operator at a terminal and no prompt to answer |

**Nothing in this document is an authorization.** Authorizing a run requires a fresh, explicit instruction from the operator, naming the ceiling and confirming the pin.

## 8. Status

`AC-111` is **constructed and hardened offline**. **No run has been dispatched.** The rung is **not closed**.

---

## Appendix A — the audited entrypoint (appended 2026-08-04)

**Appended, not edited.** Everything above is left exactly as written, including the statements this appendix corrects. Principle 18.

### A.1 The gap this closes

§ 6 above said *"No HTTP route dispatches a run. The dispatcher is reachable from code and tests only."* That was true, and it was insufficient: "reachable from code" means the only way to start a real run is to write a script, and an improvised script is exactly what ends up carrying a hand-typed budget or a hand-typed path. There is now **one audited, non-HTTP, one-shot entrypoint**.

It is still not a route and still not reachable from the browser. Starting a real run is a deliberate act at a terminal.

### A.2 The exact operator commands

**Dry run — the default. Reads only; changes nothing.**

```bash
pnpm --filter @foundry/api exec node dist/ac111-dispatch-real-run.js \
  --build-id <BUILD_ID> \
  --pin-sha256 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380
```

**One real run — spends money and consumes the authorization.**

```bash
pnpm --filter @foundry/api exec node dist/ac111-dispatch-real-run.js \
  --build-id <BUILD_ID> \
  --pin-sha256 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380 \
  --execute-real-run
```

Build first if `dist/` is stale: `pnpm --filter @foundry/api build`.

### A.3 What a caller may and may not supply

| Accepted | Why it cannot widen anything |
| --- | --- |
| `--build-id` | Selects *which* build. Selection is not permission |
| `--pin-sha256` | A **check**. The executable path is fixed in committed configuration, so a pin can only match the file already there or refuse. **No value makes a different binary run** |
| `--execute-real-run` | The only way out of dry run. Its absence is a refusal |

**Everything else is refused by name, not ignored** — an ignored `--budget 50` is worse than a rejected one, because the operator would believe it took effect. Refused: `--budget`, `--max-budget-usd`, `--model`, `--tools`, `--timeout`, `--workspace`, `--write-path`, `--test-command`, `--executable-path`, `--objective`, `--supported-objective-id`, `--keep-workspace`, and any unrecognised token.

| Value | Source |
| --- | --- |
| Objective template, plan content hash, authorization, **budget ceiling**, writable paths | **Persisted backend truth** |
| Model, tools, timeouts, byte caps, executable path, **database path** | **Committed configuration** — `apps/api/src/operationalConfig.ts`, shared with the running service so "the same database" is a fact rather than a coincidence |

### A.4 Correction — the cost field name is no longer uncertain

§ 6 above states that the cost field name *"could not be confirmed"* and lists three candidates. **That statement is superseded, and is left in place as the record of what was known then.**

**Anthropic's official headless/CLI documentation identifies `total_cost_usd` as the cost field in the `--output-format json` result.** It is the first candidate the parser checks, and the one it will find.

What does **not** change:

- The parser still accepts the same three candidates and still **fails closed** when none is present. Documentation is a much better basis than a guess, and it is still not the same thing as having observed this binary's output. Removing the fallback and the fail-closed path on the strength of a document would be trading a working safety property for tidiness.
- A missing or malformed cost is still recorded as `null`, never `0`.

**Residual risk, restated honestly:** materially lower than when § 6 was written. The first real run is now considerably less likely to fail on cost parsing — but if it does, it still fails closed, having spent money.

### A.5 Verification of the entrypoint

Offline only, with a substituted execution backend throughout. **No Claude Code was invoked, no process spawned, no model called, no authorization consumed, and no money spent.**

25 entrypoint tests, covering: the three accepted flags; refusal of twelve policy-widening flags by name; refusal of unrecognised tokens; a malformed or absent pin; **dry run with the whole persisted store asserted byte-equal before and after**; the preflight showing build, plan, template, plan hash, authorization id, ceiling, binary identity, exact argv, write scope, timeout, and the network limitation; refusal to dispatch without the flag, with zero side effects; dispatch with the flag using the **persisted** budget; wrong-pin refusal before execution; a second invocation reaching no backend; **concurrent invocations producing exactly one backend invocation and exactly one `claude_code` `AgentRun`**; and no retry after failure.

The CLI shell was additionally smoke-tested against a real empty database: it refused missing arguments, refused `--budget` by name, rendered a full preflight, and left the database at **0 events and 0 entities**.

### A.6 Status, unchanged

**No run has been dispatched. `AC-111` is not closed.** The before-run review gate in § 7 stands, and authorizing a run still requires a fresh, explicit instruction naming the ceiling and confirming the pin.

