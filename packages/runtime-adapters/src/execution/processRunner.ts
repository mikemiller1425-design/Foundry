import { spawn } from "node:child_process";
import type { ExecutionLimits } from "../policy";
import type { CapturedOutput } from "../types";

/**
 * Bounded, terminable process execution.
 *
 * Three properties this module exists to guarantee:
 *
 * 1. **No shell, ever.** `shell: false` is not configurable. The
 *    argument vector reaches `execve` as data.
 * 2. **A timeout terminates the whole process tree.** Killing just the
 *    direct child is the common bug: the child dies, its grandchildren
 *    keep running with the sandbox's file handles, and the run *looks*
 *    contained. The child is therefore spawned as a process-group
 *    leader so the group can be signalled as a unit.
 * 3. **Output is bounded at capture time.** Excess bytes are counted and
 *    dropped rather than buffered, so a run that prints without end
 *    cannot exhaust memory before the timeout notices.
 */

export interface SpawnOutcome {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  /** Raw (unredacted) capture — the caller redacts before retaining. */
  output: CapturedOutput;
  durationMs: number;
  /** Set when the process could not be started at all. */
  spawnError?: string;
}

export interface SpawnParameters {
  absoluteExecutable: string;
  args: readonly string[];
  cwd: string;
  env: Record<string, string>;
  limits: ExecutionLimits;
  signal?: AbortSignal;
  /**
   * Written to the child's stdin, which is then closed.
   *
   * This exists so free-form text — a task specification, a prompt —
   * never has to become an argument. An argument vector is something the
   * allowlist must validate character by character; stdin is a data
   * channel that carries no syntax and can hold arbitrary content
   * without weakening a single rule in `containment/commands.ts`.
   */
  stdin?: string;
}

/** Accumulates a stream into a byte-bounded buffer, counting what it drops. */
class BoundedBuffer {
  private readonly chunks: Buffer[] = [];
  private kept = 0;
  private total = 0;

  constructor(private readonly maxBytes: number) {}

  push(chunk: Buffer): void {
    this.total += chunk.byteLength;
    const remaining = this.maxBytes - this.kept;
    if (remaining <= 0) return;
    const slice = chunk.byteLength <= remaining ? chunk : chunk.subarray(0, remaining);
    this.chunks.push(slice);
    this.kept += slice.byteLength;
  }

  get truncated(): boolean {
    return this.total > this.kept;
  }

  get totalBytes(): number {
    return this.total;
  }

  toString(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

export function runProcess(parameters: SpawnParameters): Promise<SpawnOutcome> {
  const { absoluteExecutable, args, cwd, env, limits, signal, stdin } = parameters;
  const startedAt = Date.now();

  return new Promise<SpawnOutcome>((resolve) => {
    const stdout = new BoundedBuffer(limits.maxStdoutBytes);
    const stderr = new BoundedBuffer(limits.maxStderrBytes);

    const child = spawn(absoluteExecutable, [...args], {
      cwd,
      env,
      // Never a shell: the argument vector must stay data.
      shell: false,
      // Own process group, so termination can cover descendants too.
      detached: true,
      // stdin is a pipe only when there is something to send; otherwise
      // it stays closed so a child can never block waiting on input that
      // will never arrive.
      stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    if (stdin !== undefined && child.stdin) {
      // A child that exits before reading raises EPIPE here. That is the
      // child's decision, not a failure of the run — the exit code and
      // captured output already describe what happened.
      child.stdin.on("error", () => {});
      child.stdin.end(stdin);
    }

    let timedOut = false;
    let settled = false;
    let graceTimer: NodeJS.Timeout | undefined;

    /**
     * Signals the child's entire process group. Falls back to the child
     * alone if the group is already gone — a missing group is not an
     * error worth surfacing, but a *silently un-killed* tree would be.
     */
    const terminateTree = (sig: NodeJS.Signals): void => {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, sig);
      } catch {
        try {
          child.kill(sig);
        } catch {
          // Already exited.
        }
      }
    };

    const beginTermination = (): void => {
      terminateTree("SIGTERM");
      graceTimer = setTimeout(() => terminateTree("SIGKILL"), limits.killGraceMs);
      // A pending SIGKILL timer must not by itself hold the event loop open.
      graceTimer.unref?.();
    };

    const onAbort = (): void => {
      timedOut = false;
      beginTermination();
    };

    const killTimer: NodeJS.Timeout = setTimeout(() => {
      timedOut = true;
      beginTermination();
    }, limits.timeoutMs);
    killTimer.unref?.();

    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));

    const settle = (outcome: Omit<SpawnOutcome, "output" | "durationMs">): void => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      if (graceTimer) clearTimeout(graceTimer);
      signal?.removeEventListener("abort", onAbort);
      resolve({
        ...outcome,
        durationMs: Date.now() - startedAt,
        output: {
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
          stdoutBytes: stdout.totalBytes,
          stderrBytes: stderr.totalBytes,
        },
      });
    };

    child.on("error", (error: Error) => {
      settle({ exitCode: null, signal: null, timedOut, spawnError: error.message });
    });

    // `close` rather than `exit`: it fires once the stdio streams have
    // also ended, so output produced just before exit is never lost.
    child.on("close", (code, closeSignal) => {
      settle({ exitCode: code, signal: closeSignal, timedOut });
    });
  });
}
