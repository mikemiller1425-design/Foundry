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

---

## Appendix B — three entrypoint defects, corrected (appended 2026-08-04)

**Appended, not edited.** Appendix A and everything above it are left exactly as written, including the commands this appendix supersedes. Principle 18.

The operator reviewed the entrypoint at `0b418d7` and found three defects. All were real. None had been caught by the 25 tests, because two of them lived in the shell (`dispatchRealRunCli.ts`) rather than in `runEntrypoint`, and the third was in documentation.

### B.1 Defect 1 — the parsed build and the dispatched build could differ

`dispatchRealRunCli.ts` validated the build id through `runEntrypoint`, and then its dispatch closure re-read raw `process.argv`:

```ts
process.argv[process.argv.indexOf("--build-id") + 1]
```

With `--build-id` supplied twice, `indexOf` returns the **first** occurrence while the parser had taken the **last**. The preflight would describe one build and the paid dispatch would target another — a real run against something the operator never reviewed.

**Corrected:**

- `dispatch` now receives the **validated** `buildId` and `pinSha256` as explicit parameters. `process.argv` is never read after `parseDispatchArgs`; the only two remaining mentions in the module are comments explaining why.
- Duplicate `--build-id`, `--pin-sha256`, and `--execute-real-run` are **refused**. Neither first-wins nor last-wins is defensible: one lets the preflight and the dispatch disagree, the other silently discards a corrected value.
- Regression tests: duplicates refuse at the parser and at the shell, before any mutation or backend call; and the build id shown in the preflight, handed to the dispatcher, and recorded in the evidence are asserted to be **one value**.

### B.2 Defect 2 — hidden caller-controlled inputs

The entrypoint claimed three accepted inputs while reading four environment variables: `FOUNDRY_DB_PATH`, `FOUNDRY_CLAUDE_PATH`, `FOUNDRY_GIT_PATH`, and `FOUNDRY_OPERATOR_ID`.

`FOUNDRY_OPERATOR_ID` was the worst of them: the shell marked whatever it contained as `authenticated: true` with no `PrincipalRegistry` verification — a shell variable asserting operator authority, which is exactly the class of defect `FBL-029` removed from the command surface.

**Corrected:**

- **No impersonation.** The entrypoint acts as the **backend** (`REAL_RUN_ACTOR`), never as an operator. This is not a workaround: `AgentRun.Start` carries no operator requirement, and the governance acts that *do* — submitting an objective, reviewing a plan, starting a build, authorizing execution — have all already happened through the credentialed HTTP surface. The operator's authority is already recorded immutably on the persisted `ExecutionAuthorization`: who, when, against which plan hash, under what ceiling. Claiming to be them here would add no authority and would falsify the audit trail.
- **No environment input.** The real-run database, executable, and Git paths are fixed in committed source. Setting any of the four variables is a **refusal that names them**, not a silent override — ignoring them would be its own defect, since an operator who exported one believes it took effect.
- **The API keeps `FOUNDRY_DB_PATH`.** `scripts/dev.mjs`, every integration test, and the isolated verification instances need it. The two configurations are now separated in `operationalConfig.ts` rather than shared, with the reason recorded there.
- The preflight now **prints the database path**, so which store a paid run would act on is never implicit.

### B.3 Defect 3 — the documented command could execute a stale bundle

Appendix A § A.2 documented `node dist/ac111-dispatch-real-run.js` with the advice to build first if `dist/` were stale. That made the reviewed source and the executed bundle separable by operator memory.

**Corrected. The canonical commands are now:**

```bash
# dry run (default — reads only, changes nothing)
pnpm --filter @foundry/api ac-111:dispatch -- \
  --build-id <BUILD_ID> \
  --pin-sha256 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380

# one real run (spends money, consumes the authorization)
pnpm --filter @foundry/api ac-111:dispatch -- \
  --build-id <BUILD_ID> \
  --pin-sha256 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380 \
  --execute-real-run
```

The `ac-111:dispatch` script is `node build.mjs && node dist/ac111-dispatch-real-run.js`, so the bundle is regenerated from the reviewed source immediately before every invocation. **Direct execution of `dist/` is no longer the documented operator path.** A test asserts the script builds before it runs, and a second runs the build step for real.

### B.4 Verification

Offline only, substituted backends throughout. **No Claude Code was invoked, no process spawned, no model called, no authorization consumed, and no money spent.**

- **15 new CLI-shell tests** that spawn the bundled entrypoint as a real subprocess — the layer both defects lived in, and which the earlier unit tests could not have reached.
- **39 entrypoint tests** (up from 25), including the duplicate-flag and build-identity regressions.
- **1422 tests total**, 0 failures. typecheck 8/8, lint clean, build clean, `v1-canonical-run.json` byte-identical.
- The shell tests were confirmed **read-only against the operator's live database**: 19 events and 0 entities before and after.

One further fragility was found and fixed while verifying: the first version of the shell test deleted the shared bundle to prove the build regenerated it, which opened a window where a concurrent test run found it missing. A test must not remove a shared build artifact; it now re-runs the build and observes a fresh write instead.

### B.5 Status, unchanged

**No run has been dispatched. `AC-111` is not closed.** The before-run review gate in § 7 stands, and authorizing a run still requires a fresh, explicit instruction naming the ceiling and confirming the pin.

---

## Appendix C — the documented command did not work (appended 2026-08-04)

**Appended, not edited.** Appendices A and B, and everything above them, are left exactly as written. The commands they contain are **retained as historical text** and are superseded by this appendix. Principle 18.

### C.1 What the operator observed

Appendix B § B.3 documented the canonical command with a `--` separator:

```bash
# SUPERSEDED — retained as the record of what was documented
pnpm --filter @foundry/api ac-111:dispatch -- \
  --build-id <BUILD_ID> \
  --pin-sha256 <SHA256>
```

pnpm forwards that separator to the script as a **literal argument**, and the entrypoint refused it:

```
REFUSED: Unrecognised argument `--`. This entrypoint accepts only
--build-id, --pin-sha256, and --execute-real-run.
```

Reproduced directly before writing this appendix.

### C.2 The corrected canonical commands

```bash
# dry run (default — reads only, changes nothing)
pnpm --filter @foundry/api ac-111:dispatch \
  --build-id <BUILD_ID> \
  --pin-sha256 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380

# one real run (spends money, consumes the authorization)
pnpm --filter @foundry/api ac-111:dispatch \
  --build-id <BUILD_ID> \
  --pin-sha256 7a181f36ed0fc4fbac6cee4ecf2b615eff93d8b434221fff5d7c878dc5ebf380 \
  --execute-real-run
```

**No `--`.** Verified reaching the preflight, printing the database path, the build, and the gate's refusal for an unknown build.

### C.3 Which part was wrong

**The refusal was correct behaviour; the documentation was wrong.** An argument parser that silently skipped tokens it did not recognise would be the actual defect — that is how `--budget 50` gets ignored while the operator believes it took effect. The parser did exactly the right thing. What failed is that **no operator following the manifest could reach a dry run at all**.

### C.4 Why the existing tests did not catch it

Fifteen CLI-shell tests spawned `node dist/ac111-dispatch-real-run.js` directly. Every one passed, because the bundle's argument handling was never the problem. The defect lived one layer further out — in **how pnpm passes arguments to the script** — and could only be caught by running the documented string through the documented tool.

**Corrected:** a subprocess test now invokes `pnpm --filter @foundry/api ac-111:dispatch …` exactly as documented, asserts it reaches the dry run, and measures the operational database's row counts before and after to prove **zero persisted mutation**. A companion test pins the `--` form as a refusal, so the defect cannot silently return. A third asserts this appendix's canonical block carries no separator.

This is the general lesson worth carrying: a command is documentation *and* an interface, and testing the thing beneath it is not testing it.

### C.5 Preflight wording corrected

The preflight described the independent test file as:

> `test/taskStore.test.js` (not writable, not runnable)

That read as though nobody runs the tests, which inverts the point. **Foundry runs them** — that is the entire basis of the verdict. What the *Builder* cannot do is modify or execute them, because it has no Bash. Now:

> `test/taskStore.test.js` (not writable or runnable by the Builder; executed independently by Foundry)

### C.6 Status, unchanged

**No run has been dispatched. `AC-111` is not closed.** The before-run review gate in § 7 stands. Authorizing a run still requires a fresh, explicit instruction naming the ceiling and confirming the pin.

