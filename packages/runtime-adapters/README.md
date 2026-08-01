# `@foundry/runtime-adapters`

Controlled adapters that invoke external runtimes (for example Claude Code) behind backend policy.

## Status

**FBL-027 complete** (policy boundary + `mock` adapter). **FBL-028's controlled run is complete, operator review pending** — one real Claude Code stage has been executed through the boundary; see `docs/evidence/fbl-028/`.

Backend-only. `apps/agent-city` neither depends on nor imports this package, and `src/frontendIsolation.test.ts` asserts both (ADR-006).

## Design

Everything is **deny-by-default**: a policy enumerates what is permitted, and each evaluator answers "allowed" only when an explicit entry matches. There is no wildcard, no denylist to keep in sync, and no escape hatch.

| Module | Responsibility |
| --- | --- |
| `policy.ts` | Policy vocabulary — command rules, argument rules, limits, risk ceiling, env allowlist, executable search path |
| `denial.ts` | The closed vocabulary of refusal reasons; denials are structured values, never thrown exceptions |
| `containment/paths.ts` | Physical (symlink-resolving) path containment against declared roots |
| `containment/commands.ts` | Executable + per-position argument allowlist; shell-metacharacter refusal |
| `containment/environment.ts` | Child environment built from nothing, populated only from the allowlist |
| `execution/executable.ts` | Bare name → absolute path via the policy's declared search path, never `PATH` |
| `execution/processRunner.ts` | Shell-free spawn, bounded output capture, timeout with process-tree termination |
| `redaction.ts` | Secret removal by registered value and by known credential shape |
| `evidence.ts` | Size-bounded, deep-frozen evidence records |
| `boundary.ts` | `PolicyBoundary` — the one path every runtime executes through |
| `adapters/mockAdapter.ts` | Deterministic `mock` runtime behind the same boundary |
| `adapters/claudeCodeAdapter.ts` | The one controlled `claude_code` adapter (FBL-028) |
| `controlledStage/fixture.ts` | Disposable fixture repository for the controlled stage |
| `controlledStage/validation.ts` | Independent validation under its own narrower policy |
| `controlledStage/runControlledStage.ts` | Orchestration; derives the verdict without consulting the runtime |

### Decisions worth knowing

- **Containment is physical, not lexical.** `/root/link → /etc` passes any `startsWith` test while pointing out of the sandbox, so paths are resolved with the OS (`realpath`) before being judged. Non-existent tails are permitted — a run must be able to create files — and resolution stops at the deepest existing ancestor, which cannot hide a symlink beyond it.
- **`..` is refused, never normalized.** Lexical normalization and kernel resolution disagree the moment a symlink is involved. A contained run never needs `..`, so refusing it removes the whole disagreement.
- **A dangling symlink is judged by its target.** A broken link still declares an intended destination; treating it as harmless would let a run create that target and land outside the sandbox next time.
- **The environment is built up, not filtered down.** Starting from `process.env` and deleting sensitive names fails open for every name nobody anticipated. Building from an empty object fails closed. Variables that can redirect execution (`PATH`, `LD_PRELOAD`, `NODE_OPTIONS`, `GIT_SSH_COMMAND`, …) can never be allowlisted at all.
- **Executables resolve through the policy, not `PATH`.** Otherwise whoever controls the environment decides what an allowlisted name actually runs.
- **Shell metacharacters are refused even though no shell exists.** `shell: false` makes exploitation impossible; the refusal makes the *attempt* visible in evidence.
- **The whole plan is approved before anything runs.** Lazy evaluation would let an allowed first command execute before a denied second one was noticed.
- **Timeouts terminate the process group.** Killing only the direct child leaves grandchildren holding the sandbox's file handles while the run *looks* contained.
- **Evidence is retained for every terminal outcome** — success, failure, denial, and timeout alike (principle 17) — and is deep-frozen (principle 18). Size bounding drops captured output, never the record itself.

### Known limitations

These bound what the boundary actually guarantees. The full operator-facing version is §12 of `docs/evidence/fbl-028/operator-review-report.md`.

- **The boundary governs invocation, not a running process.** It controls which binary runs, with which arguments, in which directory, with which environment, for how long, and what is captured. Once the process is executing, nothing here stops it from opening a path Foundry never mentioned — that needs OS-level sandboxing, which V1 does not implement. For the controlled Claude Code stage, that gap is covered by *layered* controls: the runtime's own `--tools` restriction (no `Bash`), directory scope, and post-hoc git verification that fails the run if anything outside the permitted paths changed. The last is detection, not prevention.
- **`allowNetwork` is a declared and recorded posture, not kernel-level enforcement.** No network namespace or packet filter is created, so a permitted executable that opens a socket is not stopped by this boundary. Network denial elsewhere in V1 rests on the command allowlist (no networking tool is allowlisted) and the environment allowlist.
- **The environment allowlist cannot keep a process away from the OS credential store.** Claude Code authenticates from the macOS Keychain, reached through the user session rather than any environment variable. Keeping secrets out of the *environment* is a real guarantee; sandboxing the Keychain is not one this boundary can make.
- **Shape-based secret redaction is a safety net, not a guarantee.** Registered values cannot be missed; unregistered ones are caught only if they match a known credential format.

## Tests

`pnpm --filter @foundry/runtime-adapters test` — 128 tests. The FBL-027 security suite: allowed/denied commands and arguments, injection attempts, absolute/relative/`..`/symlink/dangling-symlink escapes, environment leakage, secret redaction, real process-tree termination on timeout, output bounding, evidence retention across all four terminal outcomes, and mock-adapter interface conformance. Plus the FBL-028 F-12 integration suite, which drives the complete controlled-stage mechanism with **real** `git` and `node --test` — substituting only the Claude Code process — including a stage that exits `0` claiming success while the independent tests fail, one that rewrites the tests to pass, and one that smuggles in an extra file.
