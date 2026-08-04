# Pre-AC-111 Builder Execution Hardening Review

**Type:** Read-only review. **No code was changed by this review.**
**Date:** 2026-08-04
**Scope:** The real-execution path that `AC-111` will drive — `@foundry/runtime-adapters` and `apps/api/src/fbl028/runControlledStage.ts` — reviewed against `F-113`–`F-117`, `AC-107` Decision 2, and the `AC-110` gate as built.
**Authorization:** Item 2 of the operator's 24-hour safe work queue. Nothing here was executed; no Claude Code was invoked and no money was spent.

---

## 0. Summary

**The invocation boundary is strong.** No shell ever, argv as data, deny-by-default command allowlist with no regex matcher, environment built from empty rather than inherited, symlink-resolving path containment, process-group termination on timeout, byte-bounded capture, and a verdict derived from a git diff plus a pre-written test suite the runtime could neither write nor run. That is a genuinely good foundation and this review does not propose weakening or re-litigating any of it.

**The gap is not in containment. It is in the wiring `AC-111` still has to do** — and three of the findings would, if carried into `AC-111` unchanged, make an operator-facing guarantee false rather than merely incomplete.

| ID | Finding | Severity |
| --- | --- | --- |
| **H-1** | The spend marker and the `AC-110` gate read **different databases** | **HIGH** |
| **H-2** | Actual spend is never read back, recorded, or compared to the ceiling | **HIGH** |
| **H-3** | The authorization's budget does not reach the runtime profile | **HIGH** |
| **H-4** | The real stage implements a **hard-coded demo task**, not the operator's objective | **MEDIUM** |
| **H-5** | The executable path is environment-controlled and its identity is unrecorded | **MEDIUM** |
| **H-6** | The write-scope allowlist is caller-supplied rather than plan-derived | **MEDIUM** |
| **H-7** | Workspace destruction is neither asserted nor recorded | **LOW** |
| **H-8** | `allowNetwork` is declarative, not enforced | **LOW (documentation)** |
| **H-9** | Timeout timers are `unref`'d | **LOW (verified benign)** |

---

## H-1 — The spend marker and the gate read different databases — **HIGH**

`AC-110`'s gate derives "this authorization is spent" from persisted truth: a real (`claude_code`) `AgentRun` linked through `Task` → `BuildStage` to the build. That is the right design — spend derived from a fact rather than from a mutable flag.

But `apps/api/src/fbl028/runControlledStage.ts` opens **its own** database:

```
const DB_PATH = process.env.FOUNDRY_DB_PATH
  ?? path.join(EVIDENCE_DIR, "agentrun.sqlite");   // docs/evidence/fbl-028/
```

It submits `AgentRun.Start` through a `CommandHandler` built over *that* store. So the `AgentRun` that is supposed to mark the authorization spent lands somewhere the gate never looks.

**Consequence if carried into `AC-111` unchanged:** a real run completes, the operator's authorization is still reported `permitted: true` by the gate, and a second run can be dispatched under the same single-use authorization. `F-113`'s *"one authorization cannot cover a second run"* would be false in the running system while every test still passed, because the tests exercise the gate and the runner against separate stores.

This is `PV1-022`'s "on a separate database" observation, still live, and now load-bearing in a way it was not at `FBL-028`.

**Recommendation:** `AC-111` must run the controlled stage against the **operational** `PersistenceService`, submitting `AgentRun.Start` through the same `CommandHandler` the gate's data comes from — and must submit it **before** the process is spawned, so a crash mid-run leaves the authorization spent rather than apparently unused. A test should assert that after a real (or substituted) run, `evaluateExecutionGate` reports `authorization_already_spent`.

---

## H-2 — Actual spend is never read back, recorded, or compared — **HIGH**

The entire budget enforcement is one argument handed to Claude Code:

```
"--max-budget-usd", String(profile.maxBudgetUsd)
```

Foundry then never looks at what the run cost. `--output-format json` is requested, but nothing parses the result for a cost field, nothing records a cost on the `AgentRun` or in the evidence, and nothing compares actual against authorized.

Three consequences, in increasing order of seriousness:

1. **The operator cannot see what a run cost.** They authorized a ceiling; the evidence does not tell them what was actually spent against it.
2. **A silent enforcement failure is undetectable.** If a future Claude Code version renames, deprecates, or ignores the flag, Foundry would keep passing it and keep believing spend was bounded. Nothing would surface the change.
3. **The ceiling is enforced entirely by the thing being constrained.** Every other guarantee at this boundary is enforced by Foundry *outside* the runtime — argv by the allowlist, write scope by a git diff, correctness by an independent test suite. Budget is the one control delegated wholly to the subject of the control, which is exactly the pattern `F-116` rejects elsewhere ("the runtime's own stdout is never consulted as a verdict").

**Recommendation:** parse the cost from the JSON result, record it on the run's evidence and in the `agentrun.completed` payload, display it to the operator, and treat *"cost absent from the response"* as a failed run rather than as zero. A run whose recorded cost exceeds the authorized ceiling should be reported as a containment failure even though the money is already spent — detection after the fact is still worth far more than silence.

---

## H-3 — The authorization's budget does not reach the profile — **HIGH**

`AC-110` issues an `ExecutionAuthorization` carrying an operator-chosen `maxBudgetUsd`, required, positive, finite, ≤ $25. The runner hard-codes:

```
maxBudgetUsd: 2,
```

**Consequence:** the number the operator typed into the authorization panel has no effect on the run. It is recorded, displayed, and ignored. That is worse than having no budget field, because the interface asserts a control that does not reach the mechanism.

**Recommendation:** `AC-111` must read `maxBudgetUsd` from the **persisted authorization** the gate returned, and from nowhere else — not a constant, not an environment variable, not a call-site argument. The value passed to the runtime and the value on the authorization should be asserted equal in evidence.

---

## H-4 — The real stage implements a hard-coded demo task — **MEDIUM**

`createFixtureRepository()` writes a fixed specification (`src/taskStore.js`) and a fixed pre-written suite (`test/taskStore.test.js`), and `TEST_TARGET` names that file as a literal in the validation allowlist. The controlled stage therefore implements **the same demo task regardless of the operator's objective**.

The V1.1 mission statement is "one bounded **real software objective**", submitted by the operator as free text. Today the objective flows into the Project, the Build, the plan, and the mock orchestration — and then stops. The one real execution does something unrelated to it.

This is the live remainder of `PV1-049` ("the product's stated philosophy is not what it does during normal operation"), and it is **the hardest genuine design problem in front of `AC-111`** — not because generating a workspace is difficult, but because of what validation requires:

> The Builder must not write, modify, or execute its own validation. `v1.1-mission.md` calls this "the load-bearing guarantee of the entire mission" and "non-negotiable."

A generated objective needs a *generated test suite*, and whatever writes that suite must not be the Builder. The available options each cost something, and `AC-111` should choose deliberately rather than drift:

| Option | Cost |
| --- | --- |
| Keep the fixed fixture; state plainly that the real stage does not yet implement the operator's objective | Honest, cheap, leaves `PV1-049` open and the §3 journey incomplete |
| Have the **Architect** (deterministic, template-driven) emit the test suite from the plan's acceptance criteria | Preserves independence; requires acceptance criteria to become executable, which `AC-107` Decision 5 explicitly declined |
| A second, separate model invocation writes the tests | Independent of the Builder, but doubles cost and adds an authorization |

**Recommendation:** this is an operator decision, not an implementation detail. `AC-111` should surface it as a choice with its consequences, and whichever is chosen should be recorded in the rung's evidence. What must not happen is the fixed fixture quietly shipping while the mission narrative implies the objective drove the run.

---

## H-5 — The executable path is environment-controlled, and unrecorded — **MEDIUM**

```
const CLAUDE_EXECUTABLE = process.env.FOUNDRY_CLAUDE_PATH ?? "/opt/homebrew/.../claude.exe";
const GIT_EXECUTABLE   = process.env.FOUNDRY_GIT_PATH   ?? "/usr/bin/git";
```

The policy correctly sets `executableSearchPath: []` so a bare name can never be resolved through `PATH` — that closes the classic hole. But the absolute path the allowlist then pins is itself taken from the environment, so whoever sets `FOUNDRY_CLAUDE_PATH` chooses which binary the allowlist authorizes. The allowlist is not violated; it is aimed.

The evidence records the *path string* in `commandLine`, but nothing about the binary's **identity** — no version, no hash. So the evidence cannot answer "what actually ran?", only "what path was named".

**Recommendation:** for `AC-111`, resolve the executable from committed configuration rather than from ambient environment; and record the binary's identity in evidence — at minimum its reported version, ideally a SHA-256 of the file. `F-116` requires evidence sufficient to determine a verdict; "which program ran" belongs in that.

---

## H-6 — The write-scope allowlist is caller-supplied — **MEDIUM**

```
verifyWriteScope(profile, fixture.allowedWritePaths, …)
```

The permitted write set is an argument. At `FBL-028` that was fine — the fixture and the caller were the same rung. At `AC-111`, the permitted paths are a property of what the operator authorized, and a call site that could pass a wider set would widen containment without touching a policy file.

**Recommendation:** derive the allowed write paths from the plan (or the authorization), record them in the evidence next to the diff, and assert in the evidence that the set used matches the set authorized.

---

## H-7 — Workspace destruction is neither asserted nor recorded — **LOW**

`AC-107` Decision 2 and the mission both require a workspace Foundry "creates, controls, and **destroys**". The runner does `rmSync(fixture.root, …)` in a `finally`, unless `FOUNDRY_KEEP_FIXTURE=1`.

That is correct behaviour, but nothing verifies the directory is gone and nothing records its disposition. An operator reading the evidence cannot tell whether the workspace was destroyed or deliberately retained.

**Recommendation:** record `workspaceDisposition: "destroyed" | "retained"` in the evidence, and verify removal rather than assuming the call succeeded.

---

## H-8 — `allowNetwork` is declarative, not enforced — **LOW (documentation)**

`allowNetwork` is read in exactly one place: it is copied into the evidence record as `networkAllowed`. No code path consults it to permit or prevent anything. For the Claude Code policy it is `true` (correctly — a real run must reach the API); for the validation policy it is `false`, and **that `false` prevents nothing**. If `node --test` opened a socket, nothing would stop it.

This is not a defect in the current design — OS-level network confinement is out of V1 scope, and the adapter's own comment is admirably honest about layered containment. But `allowNetwork: false` on the validation policy reads like a control and is a label.

**Recommendation:** documentation only. Rename the field's doc comment to say it is *declared and recorded, not enforced*, or state it in the containment statement `AC-116` owns (`F-128` already requires distinguishing "prevented" from "detected" — this belongs there).

---

## H-9 — Timeout timers are `unref`'d — **LOW (verified benign)**

Both the wall-clock `killTimer` and the SIGKILL `graceTimer` call `.unref()`. An unref'd timer does not by itself hold the event loop open, which raises the question of whether a timeout could fail to fire in a short-lived process.

**Verified benign:** while a child is running, its stdio pipes are active handles that keep the loop alive, so the timer always fires. Recorded here so it is not rediscovered as a worry, and so that anyone who later changes the stdio configuration (for example to `"ignore"` on all three streams) knows this assumption exists.

---

## What this review deliberately does not re-open

- **Keychain reachability.** `claudeCodeAdapter.ts` already states plainly that the environment allowlist keeps secrets out of the *environment* but cannot keep the process away from the macOS Keychain. That is an accurate, recorded limitation of a boundary that does not do OS-level sandboxing. It is not a new finding and this review does not restate it as one.
- **Write prevention vs. detection.** The adapter's containment table already says the last layer is *detection* — Foundry proves after the fact that only permitted files changed. That honesty is the right posture for V1.1 and is not a finding.
- **The redaction set.** Registered-literal plus pattern redaction, longest-first, with a minimum length to avoid blanking unrelated text. Covers Anthropic/OpenAI, GitHub, AWS, Slack, Google, bearer headers, PEM blocks, and JWTs. Adequate.

## Verification status

**Read-only.** No file in `packages/runtime-adapters` or `apps/api/src/fbl028` was modified. No process was spawned, no model invoked, no network call made, and no money spent. Every claim above is a reading of committed source, cited by file.

## Disposition

**H-1, H-2, H-3 are prerequisites for `AC-111` to make a true claim**, not follow-ups. Each one, left as-is, would leave a specific operator-facing guarantee false: single-use enforcement (H-1), the spend ceiling (H-2), and the operator's chosen budget (H-3).

**H-4 is an operator decision** that should be made before `AC-111` begins, not discovered during it.

**H-5, H-6, H-7** are evidence-quality improvements that `AC-111` should carry.

**H-8, H-9** are documentation, and belong to `AC-116` and this record respectively.
