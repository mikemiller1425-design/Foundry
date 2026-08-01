# `@foundry/runtime-adapters`

Controlled adapters that invoke external runtimes (for example Claude Code) behind backend policy.

## Status

**FBL-027 complete.** The policy boundary is implemented and the `mock` adapter runs behind it. No real external runtime is attached — that is FBL-028.

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

### Known limitation

`allowNetwork` is a **declared and recorded policy posture, not kernel-level enforcement**. This package does not create a network namespace or install a packet filter, so a permitted executable that opens a socket is not prevented from doing so by this boundary. Network denial in V1 rests on the command allowlist (no networking tool is allowlisted) and on the environment allowlist (no credentials or proxy configuration reach the child). Real isolation would require OS-level sandboxing and is not in V1 scope.

## Tests

`pnpm --filter @foundry/runtime-adapters test` — 103 tests, including the security suite required by FBL-027: allowed/denied commands and arguments, injection attempts, absolute/relative/`..`/symlink escapes, environment leakage, secret redaction, process-tree termination on timeout, output bounding, evidence retention across all four terminal outcomes, and mock-adapter interface conformance.
