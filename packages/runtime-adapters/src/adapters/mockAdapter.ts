import type { RuntimeType } from "@foundry/contracts";
import { PolicyBoundary, type ExecutionBackend } from "../boundary";
import { allow } from "../denial";
import type { RuntimePolicy } from "../policy";
import type { SpawnOutcome, SpawnParameters } from "../execution/processRunner";
import type { RunRequest, RunResult, RuntimeAdapter } from "../types";

/**
 * The `mock` runtime adapter (ADR-001, ADR-006).
 *
 * It is not a stub that pretends to satisfy `RuntimeAdapter`. It runs
 * the *same* `PolicyBoundary` as the real adapter — same containment,
 * same allowlist, same redaction, same evidence — and swaps out only the
 * final step where an approved command becomes an outcome. So a policy
 * bug shows up in mock tests, and the deterministic suite exercises the
 * code path that will later carry a real external runtime, rather than a
 * parallel one that merely resembles it.
 *
 * Determinism (ADR-001) comes from scripted outcomes: the same request
 * against the same scripts yields byte-identical results, with no clock
 * or process scheduling in the loop.
 */

export interface MockCommandScript {
  executable: string;
  /** When given, the argument vector must match exactly for this script to apply. */
  args?: readonly string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  /** Simulates a timeout, including the process-tree termination outcome. */
  timedOut?: boolean;
  durationMs?: number;
  /** Simulates a failure to start the process at all. */
  spawnError?: string;
}

export interface MockAdapterOptions {
  scripts?: readonly MockCommandScript[];
  environmentSource?: Record<string, string | undefined>;
  now?: () => Date;
  newId?: () => string;
}

function createMockBackend(scripts: readonly MockCommandScript[]): ExecutionBackend {
  return {
    // The mock never touches the filesystem to find a binary — an
    // allowlisted name is enough, so the deterministic suite runs
    // identically on any machine.
    resolveExecutable: (_policy: RuntimePolicy, executable: string) => allow(executable),

    run(parameters: SpawnParameters): Promise<SpawnOutcome> {
      const script = scripts.find(
        (candidate) =>
          candidate.executable === parameters.absoluteExecutable &&
          (candidate.args === undefined ||
            (candidate.args.length === parameters.args.length &&
              candidate.args.every((arg, index) => arg === parameters.args[index]))),
      );

      const stdout = script?.stdout ?? "";
      const stderr = script?.stderr ?? "";
      const timedOut = script?.timedOut ?? false;
      const limits = parameters.limits;

      const bound = (text: string, maxBytes: number) => {
        const buffer = Buffer.from(text, "utf8");
        return {
          text: buffer.subarray(0, maxBytes).toString("utf8"),
          truncated: buffer.byteLength > maxBytes,
          bytes: buffer.byteLength,
        };
      };

      const out = bound(stdout, limits.maxStdoutBytes);
      const err = bound(stderr, limits.maxStderrBytes);

      return Promise.resolve({
        // A timed-out process has no exit code — it was signalled. The
        // mock reproduces that shape so tests can't accidentally depend
        // on a cleaner timeout result than reality provides.
        exitCode: timedOut ? null : (script?.exitCode ?? 0),
        signal: timedOut ? "SIGKILL" : null,
        timedOut,
        durationMs: script?.durationMs ?? (timedOut ? limits.timeoutMs : 0),
        spawnError: script?.spawnError,
        output: {
          stdout: out.text,
          stderr: err.text,
          stdoutTruncated: out.truncated,
          stderrTruncated: err.truncated,
          stdoutBytes: out.bytes,
          stderrBytes: err.bytes,
        },
      });
    },
  };
}

export class MockRuntimeAdapter implements RuntimeAdapter {
  readonly runtimeType: RuntimeType = "mock";
  private readonly boundary: PolicyBoundary;

  constructor(
    readonly policy: RuntimePolicy,
    options: MockAdapterOptions = {},
  ) {
    this.boundary = new PolicyBoundary(policy, {
      runtimeType: "mock",
      backend: createMockBackend(options.scripts ?? []),
      environmentSource: options.environmentSource ?? {},
      now: options.now,
      newId: options.newId,
    });
  }

  execute(request: RunRequest, signal?: AbortSignal): Promise<RunResult> {
    return this.boundary.execute(request, signal);
  }
}
