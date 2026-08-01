import { randomUUID } from "node:crypto";
import type { RuntimeType } from "@foundry/contracts";
import { evaluateCommand } from "./containment/commands";
import { buildChildEnvironment } from "./containment/environment";
import {
  canonicalizeRoots,
  resolveContainedPath,
  type ContainmentContext,
} from "./containment/paths";
import { deny, type PolicyDecision, type PolicyDenial } from "./denial";
import { finalizeEvidence } from "./evidence";
import { resolveExecutable } from "./execution/executable";
import { runProcess, type SpawnOutcome, type SpawnParameters } from "./execution/processRunner";
import { RISK_CLASS_ORDER, type RuntimePolicy } from "./policy";
import { Redactor } from "./redaction";
import type {
  CommandExecutionRecord,
  RunEvidence,
  RunRequest,
  RunResult,
  RunStatus,
} from "./types";

/**
 * The policy boundary itself (ADR-006, FBL-027).
 *
 * Every runtime — mock or real — executes *through* this class, and the
 * only thing that varies between them is the `ExecutionBackend` that
 * finally turns an approved command into an outcome. Policy evaluation,
 * containment, redaction, and evidence capture are shared code, not a
 * convention each adapter re-implements. That is what makes the mock
 * adapter a meaningful rehearsal of the real one rather than a
 * lookalike that happens to satisfy the same type.
 *
 * The execution order matters and is deliberate: nothing is spawned
 * until *every* command in the request has already been approved.
 * Evaluating lazily would let an allowed first command run before a
 * denied second one was noticed — a partially-executed run that policy
 * had already refused.
 */

export interface ExecutionBackend {
  /** Resolves an allowlisted name to whatever the backend will invoke. */
  resolveExecutable(policy: RuntimePolicy, executable: string): PolicyDecision<string>;
  run(parameters: SpawnParameters): Promise<SpawnOutcome>;
}

/** The real backend: OS processes, no shell, bounded and terminable. */
export const processExecutionBackend: ExecutionBackend = {
  resolveExecutable,
  run: runProcess,
};

export interface BoundaryOptions {
  runtimeType: RuntimeType;
  backend: ExecutionBackend;
  /** Environment the allowlist draws from. Defaults to the parent process's. */
  environmentSource?: Record<string, string | undefined>;
  /** Clock seam, so evidence timestamps are assertable in tests. */
  now?: () => Date;
  /** Id seam, for the same reason. */
  newId?: () => string;
}

export class PolicyBoundary {
  private readonly now: () => Date;
  private readonly newId: () => string;
  private readonly environmentSource: Record<string, string | undefined>;

  constructor(
    readonly policy: RuntimePolicy,
    private readonly options: BoundaryOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? (() => randomUUID());
    this.environmentSource = options.environmentSource ?? process.env;
  }

  async execute(request: RunRequest, signal?: AbortSignal): Promise<RunResult> {
    const redactor = new Redactor(request.secretValues ?? []);
    const startedAt = this.now();
    const denials: PolicyDenial[] = [];
    const records: CommandExecutionRecord[] = [];

    const setup = this.prepare(request);
    if (!setup.allowed) {
      denials.push(setup.denial);
      return this.finish(request, redactor, startedAt, "denied", denials, records, {
        canonicalRoots: [],
        canonicalWorkingDirectory: request.workingDirectory,
        environmentNames: [],
      });
    }

    const { context, env } = setup.value;
    const environmentNames = Object.keys(env).sort();

    // Approve the whole plan before executing any of it.
    const approved: { executable: string; args: string[]; cwd: string; stdin?: string }[] = [];
    for (const invocation of request.commands) {
      const cwdDecision = invocation.cwd
        ? resolveContainedPath(context, invocation.cwd)
        : ({ allowed: true, value: context.canonicalWorkingDirectory } as const);
      if (!cwdDecision.allowed) {
        denials.push(cwdDecision.denial);
        break;
      }

      const commandDecision = evaluateCommand(
        this.policy,
        { ...context, canonicalWorkingDirectory: cwdDecision.value },
        invocation.executable,
        invocation.args,
      );
      if (!commandDecision.allowed) {
        denials.push(commandDecision.denial);
        break;
      }

      const executableDecision = this.options.backend.resolveExecutable(
        this.policy,
        commandDecision.value.executable,
      );
      if (!executableDecision.allowed) {
        denials.push(executableDecision.denial);
        break;
      }

      approved.push({
        executable: executableDecision.value,
        args: commandDecision.value.args,
        cwd: cwdDecision.value,
        stdin: invocation.stdin,
      });
    }

    if (denials.length > 0) {
      // A refused plan is recorded as a denial with evidence, including
      // the commands that *would* have run, and nothing is executed.
      for (const invocation of request.commands) {
        records.push(
          this.deniedRecord(
            invocation.executable,
            invocation.args,
            context.canonicalWorkingDirectory,
          ),
        );
      }
      return this.finish(request, redactor, startedAt, "denied", denials, records, {
        canonicalRoots: context.canonicalRoots,
        canonicalWorkingDirectory: context.canonicalWorkingDirectory,
        environmentNames,
      });
    }

    let status: RunStatus = "completed";

    for (const command of approved) {
      const commandStartedAt = this.now();
      const outcome = await this.options.backend.run({
        absoluteExecutable: command.executable,
        args: command.args,
        cwd: command.cwd,
        env,
        limits: this.policy.limits,
        signal,
        stdin: command.stdin,
      });
      const commandCompletedAt = this.now();

      const commandStatus = outcome.timedOut
        ? "timed_out"
        : outcome.exitCode === 0
          ? "completed"
          : "failed";

      records.push({
        status: commandStatus,
        executable: command.executable,
        args: command.args,
        cwd: command.cwd,
        exitCode: outcome.exitCode,
        signal: outcome.signal,
        startedAt: commandStartedAt.toISOString(),
        completedAt: commandCompletedAt.toISOString(),
        durationMs: outcome.durationMs,
        output: {
          ...outcome.output,
          stderr: outcome.spawnError
            ? `${outcome.output.stderr}\n[spawn error] ${outcome.spawnError}`
            : outcome.output.stderr,
        },
      });

      if (commandStatus !== "completed") {
        // A run stops at its first non-success. Continuing would execute
        // later commands against a state their author never anticipated.
        status = commandStatus;
        break;
      }
    }

    return this.finish(request, redactor, startedAt, status, denials, records, {
      canonicalRoots: context.canonicalRoots,
      canonicalWorkingDirectory: context.canonicalWorkingDirectory,
      environmentNames,
    });
  }

  /** Risk-class ceiling, root canonicalization, working directory, environment. */
  private prepare(
    request: RunRequest,
  ): PolicyDecision<{ context: ContainmentContext; env: Record<string, string> }> {
    if (RISK_CLASS_ORDER[request.riskClass] > RISK_CLASS_ORDER[this.policy.maxRiskClass]) {
      return deny(
        "risk_class_not_permitted",
        `Run declares risk class ${request.riskClass}, above this policy's ceiling of ${this.policy.maxRiskClass}.`,
        request.riskClass,
      );
    }

    const roots = canonicalizeRoots(this.policy.workingDirectoryRoots);
    if (!roots.allowed) return roots;

    // The working directory is resolved against the roots themselves —
    // it has no prior directory to be relative to, so a relative value
    // here would be ambiguous rather than convenient.
    const firstRoot = roots.value[0];
    if (firstRoot === undefined) {
      return deny("working_directory_not_declared", "Policy declares no working-directory roots.");
    }
    const bootstrap: ContainmentContext = {
      canonicalRoots: roots.value,
      canonicalWorkingDirectory: firstRoot,
      declaredRoots: this.policy.workingDirectoryRoots,
    };
    const workingDirectory = resolveContainedPath(bootstrap, request.workingDirectory);
    if (!workingDirectory.allowed) return workingDirectory;

    const environment = buildChildEnvironment(
      this.policy,
      this.environmentSource,
      request.environment ?? {},
    );
    if (!environment.allowed) return environment;

    return {
      allowed: true,
      value: {
        context: {
          canonicalRoots: roots.value,
          canonicalWorkingDirectory: workingDirectory.value,
          declaredRoots: this.policy.workingDirectoryRoots,
        },
        env: environment.value.env,
      },
    };
  }

  private deniedRecord(
    executable: string,
    args: readonly string[],
    cwd: string,
  ): CommandExecutionRecord {
    const at = this.now().toISOString();
    return {
      status: "denied",
      executable,
      args: [...args],
      cwd,
      exitCode: null,
      signal: null,
      startedAt: at,
      completedAt: at,
      durationMs: 0,
      output: {
        stdout: "",
        stderr: "",
        stdoutTruncated: false,
        stderrTruncated: false,
        stdoutBytes: 0,
        stderrBytes: 0,
      },
    };
  }

  private finish(
    request: RunRequest,
    redactor: Redactor,
    startedAt: Date,
    status: RunStatus,
    denials: PolicyDenial[],
    commands: CommandExecutionRecord[],
    placement: {
      canonicalRoots: readonly string[];
      canonicalWorkingDirectory: string;
      environmentNames: readonly string[];
    },
  ): RunResult {
    const completedAt = this.now();
    const draft: Omit<RunEvidence, "truncated" | "sizeBytes"> = {
      evidenceId: this.newId(),
      agentRunId: request.agentRunId,
      agentId: request.agentId,
      taskId: request.taskId,
      runtimeType: this.options.runtimeType,
      riskClass: request.riskClass,
      policyId: this.policy.id,
      status,
      taskSpecification: request.taskSpecification,
      canonicalWorkingDirectory: placement.canonicalWorkingDirectory,
      canonicalRoots: placement.canonicalRoots,
      environmentNames: placement.environmentNames,
      networkAllowed: this.policy.allowNetwork,
      commands,
      denials,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };

    const evidence = finalizeEvidence(draft, redactor, this.policy.limits.maxEvidenceBytes);
    const lastExecuted = [...evidence.commands].reverse().find((c) => c.status !== "denied");

    return {
      status,
      agentRunId: request.agentRunId,
      exitCode: lastExecuted?.exitCode ?? null,
      evidence,
      denials: evidence.denials,
    };
  }
}
