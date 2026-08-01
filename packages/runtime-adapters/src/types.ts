import type { Id, RuntimeType, Timestamp, V1RiskClass } from "@foundry/contracts";
import type { PolicyDenial } from "./denial";
import type { RuntimePolicy } from "./policy";

/**
 * The runtime-adapter contract (ADR-006).
 *
 * Every runtime — the deterministic mock, the controlled `claude_code`
 * stage, anything a later mission adds — implements exactly this
 * interface and is reached only through it. The frontend never invokes
 * an adapter: adapters are backend-side, behind policy, by construction.
 */

/** One command a run is asking to execute. */
export interface CommandInvocation {
  executable: string;
  args: readonly string[];
  /** Optional working directory; must itself be contained. Defaults to the run's root. */
  cwd?: string;
  /**
   * Text written to the command's stdin. Free-form content belongs here
   * rather than in `args`: stdin carries no syntax, so a task
   * specification can be arbitrary prose without any allowlist rule
   * being loosened to accommodate it.
   */
  stdin?: string;
}

export interface RunRequest {
  /** The `AgentRun` this execution belongs to (domain-model.md → AgentRun). */
  agentRunId: Id;
  agentId: Id;
  taskId: Id;
  /** Declared risk class; must not exceed the policy ceiling, and is R0–R2 by type. */
  riskClass: V1RiskClass;
  /** Absolute working directory for the run. Must canonicalize inside a policy root. */
  workingDirectory: string;
  /** The commands to execute, in order. */
  commands: readonly CommandInvocation[];
  /** Adapter-supplied environment values; each name must still be allowlisted. */
  environment?: Record<string, string>;
  /** Values to redact from every captured surface, in addition to shape matches. */
  secretValues?: readonly string[];
  /** Free-form task description recorded verbatim (post-redaction) in evidence. */
  taskSpecification?: string;
}

export type CommandOutcomeStatus = "completed" | "failed" | "timed_out" | "denied";

export interface CapturedOutput {
  /** Redacted stdout, truncated to the policy's byte budget. */
  stdout: string;
  /** Redacted stderr, truncated to the policy's byte budget. */
  stderr: string;
  /** True when output exceeded its budget and was dropped rather than buffered. */
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  /** Bytes produced before truncation, so evidence records the real volume. */
  stdoutBytes: number;
  stderrBytes: number;
}

export interface CommandExecutionRecord {
  status: CommandOutcomeStatus;
  executable: string;
  /** Argument vector as actually spawned (paths canonicalized), post-redaction. */
  args: readonly string[];
  cwd: string;
  /** Null when the process was signalled or never started. */
  exitCode: number | null;
  /** Signal that terminated the process, if any. */
  signal: string | null;
  startedAt: Timestamp;
  completedAt: Timestamp;
  durationMs: number;
  output: CapturedOutput;
  /** Populated when `status` is `denied` — the policy decision that refused it. */
  denial?: PolicyDenial;
}

export type RunStatus = "completed" | "failed" | "timed_out" | "denied";

/**
 * An immutable evidence record bound to exactly one `AgentRun`.
 *
 * Retained for *every* terminal outcome — success, failure, denial, and
 * timeout alike (principle 17). A run that was refused before it started
 * still produces evidence saying so; "nothing happened" is never how a
 * denial is recorded.
 */
export interface RunEvidence {
  evidenceId: Id;
  agentRunId: Id;
  agentId: Id;
  taskId: Id;
  runtimeType: RuntimeType;
  riskClass: V1RiskClass;
  policyId: string;
  status: RunStatus;
  /** Redacted task specification exactly as submitted. */
  taskSpecification?: string;
  canonicalWorkingDirectory: string;
  canonicalRoots: readonly string[];
  /** Environment variable *names* supplied to the child. Never values. */
  environmentNames: readonly string[];
  networkAllowed: boolean;
  commands: readonly CommandExecutionRecord[];
  /** Every policy refusal encountered, including ones that aborted the run. */
  denials: readonly PolicyDenial[];
  startedAt: Timestamp;
  completedAt: Timestamp;
  durationMs: number;
  /** True when the evidence itself hit the size ceiling and was trimmed. */
  truncated: boolean;
  /** Serialized byte size of the retained record. */
  sizeBytes: number;
}

export interface RunResult {
  status: RunStatus;
  agentRunId: Id;
  /** Exit code of the last executed command, or null if none ran. */
  exitCode: number | null;
  evidence: RunEvidence;
  /** Convenience view of `evidence.denials`. */
  denials: readonly PolicyDenial[];
}

/**
 * The one interface every runtime implements. `execute` never throws for
 * a policy refusal or a failing command — those are outcomes with
 * evidence, not exceptions. It throws only for programming errors.
 */
export interface RuntimeAdapter {
  readonly runtimeType: RuntimeType;
  readonly policy: RuntimePolicy;
  execute(request: RunRequest, signal?: AbortSignal): Promise<RunResult>;
}
