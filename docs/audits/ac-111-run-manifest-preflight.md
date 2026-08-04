# AC-111 Run Manifest — Read-Only Preflight

**Type:** Read-only preflight. **Nothing here was executed.**
**Date:** 2026-08-04
**Verified against:** commit `26e0709`
**Authorization:** Item 5 of the operator's 24-hour safe work queue

**No Claude Code was invoked. No process was spawned. No model was called. No money was spent.** This document describes what a run *would* be, so the operator can decide whether to authorize one. It is not an authorization and it does not create one.

---

## 1. What `AC-111` would actually run

| | |
| --- | --- |
| **Stage** | `backend_implementation` — the one stage `v1-scope.md` allocates to the controlled `claude_code` runtime, and the only stage `Plan.Authorize` will accept |
| **Runtime** | Claude Code, non-interactive (`--print`), JSON output |
| **Model** | `sonnet` (currently hard-coded in the runner — see M-3) |
| **Tools granted** | `Read, Write, Edit, Glob, Grep` — **no Bash**, so the run cannot execute anything, including its own validation |
| **Workspace** | A fresh directory under the OS temp dir, created per run (`mkdtemp foundry-fbl028-`). Never the Foundry repository, never `$HOME`, never a real project |
| **Network** | Reachable. A real run must reach the Anthropic API; declared and recorded, not prevented |
| **Environment** | `HOME` and `USER` only, built from empty. Notably **not** `PATH` |
| **Wall-clock limit** | 10 minutes, then SIGTERM to the whole process group, SIGKILL after 5 s |
| **Output capture** | 1 MiB stdout, 1 MiB stderr, dropped past the cap rather than buffered |
| **Spend ceiling** | `--max-budget-usd`, currently hard-coded to `2` — see **M-2**, this is the manifest's most important open item |

### The exact argument vector

Every element is a fixed literal, which is what lets the allowlist validate the vector position by position with no wildcard anywhere:

```
<claude> --print --output-format json --model sonnet
         --tools Read,Write,Edit,Glob,Grep
         --permission-mode acceptEdits
         --safe-mode --strict-mcp-config
         --disable-slash-commands --no-session-persistence
         --max-budget-usd <N>
```

The task specification travels on **stdin**, never as an argument — so prose never has to pass through an allowlist that would then have to accept arbitrary characters.

### The binary

```
/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe   (present, 270,518,240 bytes)
```

Overridable by `FOUNDRY_CLAUDE_PATH`. Its identity is **not** recorded in evidence today — see **M-5**.

## 2. How the verdict would be decided

Not by anything the run says about itself.

1. **Write scope** — `git status --porcelain` and `git diff --cached HEAD` against a baseline commit made before the stage ran. Any path outside the permitted set fails the run.
2. **Correctness** — a pre-written test suite executed by Foundry, through the same policy boundary, under a narrower policy (`R1`, no network, no `claude`, no shell).
3. **Verdict** — derived from 1 and 2 plus the process exit status. The stage's stdout is captured as evidence and **never consulted as a verdict**.

The stage had no Bash, so it could neither run those tests nor fake their result.

## 3. Evidence that would be retained

| Artifact | Contents |
| --- | --- |
| `evidence.json` | Full `ControlledStageEvidence`: outcome, verdict, policy id, risk class, command line, file manifests before and after (SHA-256 per file), run evidence, write-scope result, test result, timestamps |
| `diff.patch` | The complete staged diff against the baseline |
| `stdout.txt` / `stderr.txt` | Redacted capture |
| `tests.txt` | Independent test output |

Redaction covers registered literals plus Anthropic/OpenAI, GitHub, AWS, Slack, and Google key shapes, bearer headers, PEM private-key blocks, and JWTs — longest-match-first, with a 6-character floor so short strings do not blank unrelated text.

**Evidence placement now survives a fresh clone.** `AC-119` added `.gitignore` negations under `docs/evidence/`, so run logs can no longer be silently dropped the way Finding 6's were.

## 4. What the operator would be authorizing

One `Plan.Authorize` command, already built and closed at `AC-110`:

| Field | Value | Who sets it |
| --- | --- | --- |
| `stageName` | `backend_implementation` | Operator (only this stage is accepted) |
| `maxBudgetUsd` | Operator's choice, ≤ **$25** | **Operator** |
| `acknowledgedContentHash` | The hash shown in the panel | Client states, **backend verifies and overwrites** |
| `planContentHash` | Backend SHA-256 over persisted plan content | **Backend only** |
| `authorizedBy`, `authorizedAt`, `planRevision`, `workspace`, `riskClass`, `authorizationId` | Derived | **Backend only** — unrepresentable in the payload |

**Single-use.** One authorization per plan, never reissued; the gate additionally refuses once a real `AgentRun` exists for the stage.

## 5. Blocking prerequisites — the manifest cannot be executed as-is

These come from the hardening review (`docs/audits/pre-ac-111-builder-execution-hardening-review.md`). Three would make an operator-facing guarantee **false** if `AC-111` ran without fixing them.

| ID | Prerequisite | Why it blocks |
| --- | --- | --- |
| **M-1** ⟵ H-1 | The run must use the **operational** database | The `FBL-028` runner opens its own SQLite under `docs/evidence/fbl-028/`. The `AgentRun` that marks the authorization spent would land where the `AC-110` gate never looks, so a second run could be dispatched under the same single-use authorization. `F-113` would be false in the running system while every test still passed |
| **M-2** ⟵ H-3 | `maxBudgetUsd` must come from the **persisted authorization** | It is hard-coded to `2`. The operator's chosen ceiling is currently recorded, displayed, and ignored |
| **M-3** ⟵ H-2 | Actual spend must be **read back and recorded** | Nothing parses the run's cost. The operator would not learn what their run cost, and a silently ignored `--max-budget-usd` would be undetectable |
| **M-4** ⟵ H-4 | Decide what the run **implements** | The workspace contains a fixed `taskStore.js` demo task. The operator's submitted objective does not reach the real run at all |
| **M-5** ⟵ H-5 | Record the binary's **identity** | Evidence names a path, not a version or hash. It cannot answer "what actually ran?" |
| **M-6** ⟵ H-6 | Write-scope paths must be **plan-derived** | Currently a caller-supplied argument |

**M-1, M-2, and M-3 are non-negotiable before a real run.** They are the difference between the authorization mechanism working and merely appearing to.

### M-4 is an operator decision, not an implementation detail

The real stage today implements a demo task unrelated to the submitted objective. Generalizing it collides with the mission's stated load-bearing guarantee — *the Builder must not write, modify, or execute its own validation* — because a generated objective needs a generated test suite, and the Builder must not be what writes it.

| Option | What it costs |
| --- | --- |
| **A.** Keep the fixed fixture; state plainly that the real stage does not implement the submitted objective | Cheapest and honest. Leaves `PV1-049` open and the § 3 journey incomplete — the operator's objective still would not drive real work |
| **B.** The deterministic Architect emits the test suite from the plan's acceptance criteria | Preserves independence. Requires acceptance criteria to become executable, which `AC-107` Decision 5 explicitly declined |
| **C.** A second, separate model invocation writes the tests | Independent of the Builder, but doubles cost and needs its own authorization |

This should be chosen deliberately before `AC-111` begins. What must not happen is option A shipping while the mission narrative implies the objective drove the run.

## 6. Cost and blast radius, if a run were authorized

| | |
| --- | --- |
| **Money at risk** | Bounded by `--max-budget-usd`. Today that is **$2** regardless of what the operator authorizes (M-2). Once M-2 is fixed, the operator's figure, ≤ $25 |
| **Time at risk** | ≤ 10 minutes, then the process tree is terminated |
| **Filesystem blast radius** | One `mkdtemp` directory. Foundry's own repository is not a declared root and is not reachable through the policy |
| **What could still write outside it** | Claude Code's own file tools, if its permission system failed. Foundry **detects** this after the fact via the git diff and fails the run; it does not **prevent** it. That is the honest status and it is unchanged by this preflight |
| **Credential exposure** | The environment carries no secret. Claude Code authenticates via the macOS Keychain through the user session, which this boundary does not sandbox — documented in `claudeCodeAdapter.ts` and unchanged |

## 7. Ladder position

`AC-111` depends on `AC-110` **and AC-103 closed**.

| Dependency | State |
| --- | --- |
| `AC-110` | ✅ Closed (`a82fcf4`, closure commit `f955327`) |
| `AC-103` | 🟡 **Diagnosed and remediated, awaiting the operator's acceptance** |

**`AC-111` is therefore not startable today**, independently of the M-items: its stated dependency on `AC-103` is not yet satisfied, because that rung's gate is the operator's acceptance of closure.

## 8. Recommended sequence

1. Operator **accepts `AC-103` closure** (or does not) — clears the ladder dependency.
2. Operator **decides M-4** — what the real run implements.
3. A `FIX` rung addresses **M-1, M-2, M-3**, plus M-5 and M-6 as evidence quality, with tests using a substituted execution backend so none of it costs money to verify. `F-117` already requires exactly that offline coverage.
4. Operator reviews an updated manifest reflecting those fixes.
5. Only then: operator authorizes one run, watches it, and reviews its evidence.

Step 3 is a normal implementation rung and is entirely offline — `F-117` requires the whole execution mechanism to be covered with a substituted backend, which means M-1 through M-6 can be built and proven **without a single real invocation**.

## 9. Status

**This is a proposal. It authorizes nothing, and nothing in it has been run.** `AC-111` remains not started.
