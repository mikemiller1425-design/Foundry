import type { RuntimeType } from "@foundry/contracts";
import { PolicyBoundary, processExecutionBackend, type ExecutionBackend } from "../boundary";
import { defineRuntimePolicy, type RuntimePolicy } from "../policy";
import type { RunRequest, RunResult, RuntimeAdapter } from "../types";

/**
 * The one controlled `claude_code` adapter (ADR-006, FBL-028, F-12).
 *
 * ## What this boundary does and does not do
 *
 * FBL-027's boundary governs the *invocation*: which executable runs,
 * with which arguments, in which directory, with which environment, for
 * how long, and what is captured. Those guarantees are complete and
 * enforced here.
 *
 * It does **not** confine what an already-running process does with its
 * own file descriptors. Once `claude` is executing, nothing in this
 * package can stop it from opening a path Foundry never mentioned —
 * that would require OS-level sandboxing, which V1 does not implement.
 *
 * Containment of a real Claude Code run is therefore *layered*, and the
 * layers are listed here rather than buried, because an operator
 * reviewing this rung needs to know exactly which control stops what:
 *
 * | Layer | Enforced by | Stops |
 * | --- | --- | --- |
 * | Invocation policy | FBL-027 boundary | Wrong binary, wrong args, wrong cwd, environment/credential leakage, unbounded runtime, unbounded output |
 * | Tool restriction | Claude Code (`--tools`) | Shell execution, network fetches, subagents — the run gets file tools only |
 * | Directory scope | Claude Code (cwd, no `--add-dir`) | Tool access outside the fixture repository |
 * | Customization lockout | Claude Code (`--safe-mode`, `--strict-mcp-config`) | Project/user settings, hooks, plugins, MCP servers, skills |
 * | Spend ceiling | Claude Code (`--max-budget-usd`) | Unbounded API cost |
 * | Post-hoc verification | Foundry (git diff of the fixture) | *Detects* any write outside the allowed paths |
 *
 * The last row is detection, not prevention. It is the honest status of
 * write confinement at this rung: Foundry proves after the fact that
 * only permitted files changed, and treats anything else as a failed
 * run. Prevention of out-of-scope writes rests on Claude Code's own
 * permission system, not on Foundry's.
 *
 * ## Why the prompt travels on stdin
 *
 * A task specification is prose. Putting prose in an argument vector
 * would force the allowlist to accept arbitrary characters in an
 * argument position — dismantling the exact rule that makes injection
 * attempts detectable. stdin carries no syntax, so the argv stays a
 * fixed, fully-enumerated list of literals.
 */

/** Tools the controlled stage may use. Deliberately excludes Bash. */
export const CONTROLLED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"] as const;

export interface ClaudeCodeProfile {
  /** Absolute path to the isolated fixture repository. The only root. */
  repositoryRoot: string;
  /** Absolute path to the `claude` executable. */
  executablePath: string;
  /** Model alias or full model name. */
  model: string;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  maxEvidenceBytes: number;
  /** Hard ceiling on API spend for the run. */
  maxBudgetUsd: number;
  /**
   * Environment names the run may receive. `HOME` is required for
   * Claude Code to locate its own credentials; see the security note in
   * `buildClaudeCodePolicy`.
   */
  allowedEnvironmentVariables: readonly string[];
}

/**
 * The exact argument vector for a controlled run. Every element is a
 * fixed literal, so `containment/commands.ts` can validate the whole
 * vector position by position with no wildcard anywhere.
 */
export function controlledClaudeArgs(profile: ClaudeCodeProfile): string[] {
  return [
    // Non-interactive; there is no operator at a terminal to answer prompts.
    "--print",
    "--output-format",
    "json",
    "--model",
    profile.model,
    // File tools only. No Bash means the run cannot execute commands,
    // which is also why it cannot run — or fake — its own validation.
    "--tools",
    CONTROLLED_TOOLS.join(","),
    // Edits apply without prompting; no other tool is available to grant.
    "--permission-mode",
    "acceptEdits",
    // No CLAUDE.md, skills, plugins, hooks, custom agents, or output styles.
    "--safe-mode",
    // No MCP servers at all, since no --mcp-config is supplied.
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
    "--max-budget-usd",
    String(profile.maxBudgetUsd),
  ];
}

/**
 * Builds the policy for one controlled run.
 *
 * **Security note on credentials and network.** A real Claude Code run
 * has two irreducible requirements: it must reach the Anthropic API,
 * and it must find its own credentials. `--bare` would confine
 * authentication to `ANTHROPIC_API_KEY`, but with no such key available
 * the run would simply fail. Three consequences follow, and none of
 * them is hidden — each is recorded in the run's evidence:
 *
 * - `allowNetwork` is `true` for this policy. F-12 requires a real
 *   controlled Claude Code stage, and a real one cannot be offline.
 *   This is the "explicitly requires and authorizes it" case.
 * - The environment allowlist is `HOME` and `USER` — the empirically
 *   minimal pair, established by bisection. Neither is a credential.
 *   Notably `PATH` is *not* granted, so the run cannot resolve helper
 *   binaries by name.
 * - **The environment allowlist does not keep the process away from the
 *   operating system's credential store.** Claude Code authenticates
 *   from the macOS Keychain, which it reaches through the user session,
 *   not through any environment variable. Withholding `USER` only
 *   breaks the lookup; it does not sandbox it. Keeping secrets out of
 *   the *environment* is a real guarantee here; keeping a process away
 *   from the *Keychain* is not one this boundary can make.
 */
export function buildClaudeCodePolicy(profile: ClaudeCodeProfile): RuntimePolicy {
  return defineRuntimePolicy({
    id: "fbl-028-controlled-claude-code",
    workingDirectoryRoots: [profile.repositoryRoot],
    // The controlled Builder stage writes source files inside one
    // repository: a controlled internal change, R2 (principle 19).
    maxRiskClass: "R2",
    allowedEnvironmentVariables: [...profile.allowedEnvironmentVariables],
    allowNetwork: true,
    executableSearchPath: [],
    limits: {
      timeoutMs: profile.timeoutMs,
      maxStdoutBytes: profile.maxStdoutBytes,
      maxStderrBytes: profile.maxStderrBytes,
      maxEvidenceBytes: profile.maxEvidenceBytes,
      killGraceMs: 5_000,
    },
    allowedCommands: [
      {
        executable: profile.executablePath,
        args: controlledClaudeArgs(profile).map((value) => ({
          kind: "literal" as const,
          value,
        })),
        maxArgs: controlledClaudeArgs(profile).length,
      },
    ],
  });
}

export interface ClaudeCodeAdapterOptions {
  /** Swappable for tests; defaults to real process execution. */
  backend?: ExecutionBackend;
  environmentSource?: Record<string, string | undefined>;
  now?: () => Date;
  newId?: () => string;
}

export class ClaudeCodeAdapter implements RuntimeAdapter {
  readonly runtimeType: RuntimeType = "claude_code";
  readonly policy: RuntimePolicy;
  private readonly boundary: PolicyBoundary;

  constructor(
    private readonly profile: ClaudeCodeProfile,
    options: ClaudeCodeAdapterOptions = {},
  ) {
    this.policy = buildClaudeCodePolicy(profile);
    this.boundary = new PolicyBoundary(this.policy, {
      runtimeType: "claude_code",
      backend: options.backend ?? processExecutionBackend,
      environmentSource: options.environmentSource ?? process.env,
      now: options.now,
      newId: options.newId,
    });
  }

  /**
   * Executes the controlled stage. The caller supplies identity and the
   * task specification; the *command* is not the caller's to choose —
   * it is fixed by the profile, so no call site can widen what runs.
   */
  execute(request: RunRequest, signal?: AbortSignal): Promise<RunResult> {
    const specification = request.taskSpecification ?? "";
    return this.boundary.execute(
      {
        ...request,
        workingDirectory: this.profile.repositoryRoot,
        commands: [
          {
            executable: this.profile.executablePath,
            args: controlledClaudeArgs(this.profile),
            stdin: specification,
          },
        ],
      },
      signal,
    );
  }
}
