import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExecutionLimits } from "../policy";
import { runProcess } from "./processRunner";

/**
 * These tests spawn real processes. They use `/bin/sh` directly, which
 * the *policy* layer would never allowlist — that is the point: the
 * runner's containment guarantees (termination, output bounds) must hold
 * even for a process deliberately trying to outlive or outproduce them.
 */
describe("process runner", () => {
  let sandbox: string;

  const limits = (overrides: Partial<ExecutionLimits> = {}): ExecutionLimits => ({
    timeoutMs: 10_000,
    maxStdoutBytes: 1024,
    maxStderrBytes: 1024,
    maxEvidenceBytes: 64 * 1024,
    killGraceMs: 500,
    ...overrides,
  });

  beforeAll(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), "foundry-runner-"));
  });

  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  const writeScript = (name: string, body: string): string => {
    const scriptPath = path.join(sandbox, name);
    writeFileSync(scriptPath, body, "utf8");
    chmodSync(scriptPath, 0o755);
    return scriptPath;
  };

  const isAlive = (pid: number): boolean => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  it("captures stdout, stderr, and a zero exit code for a successful command", async () => {
    const script = writeScript(
      "success.sh",
      "#!/bin/sh\necho 'to stdout'\necho 'to stderr' >&2\nexit 0\n",
    );
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits(),
    });

    expect(outcome.exitCode).toBe(0);
    expect(outcome.timedOut).toBe(false);
    expect(outcome.output.stdout.trim()).toBe("to stdout");
    expect(outcome.output.stderr.trim()).toBe("to stderr");
  });

  it("records a non-zero exit code as a failure without throwing", async () => {
    const script = writeScript("fail.sh", "#!/bin/sh\necho 'failing' >&2\nexit 3\n");
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits(),
    });

    expect(outcome.exitCode).toBe(3);
    expect(outcome.output.stderr.trim()).toBe("failing");
  });

  it("passes only the environment it is given", async () => {
    const script = writeScript("env.sh", "#!/bin/sh\nenv\n");
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: { ALLOWED_ONLY: "yes" },
      limits: limits(),
    });

    expect(outcome.output.stdout).toContain("ALLOWED_ONLY=yes");
    // The parent process certainly has these; the child must not.
    expect(outcome.output.stdout).not.toContain("ANTHROPIC_API_KEY=");
    expect(outcome.output.stdout).not.toContain("SSH_AUTH_SOCK=");
  });

  it("bounds excess stdout instead of buffering it without limit", async () => {
    // Produces roughly 100 KiB against a 1 KiB budget.
    const script = writeScript(
      "loud.sh",
      "#!/bin/sh\ni=0\nwhile [ $i -lt 1000 ]; do\n  echo '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456'\n  i=$((i+1))\ndone\n",
    );
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits({ maxStdoutBytes: 1024 }),
    });

    expect(outcome.output.stdoutTruncated).toBe(true);
    expect(Buffer.byteLength(outcome.output.stdout, "utf8")).toBeLessThanOrEqual(1024);
    // The real volume is still recorded, so evidence does not understate it.
    expect(outcome.output.stdoutBytes).toBeGreaterThan(50_000);
  });

  it("bounds excess stderr independently of stdout", async () => {
    const script = writeScript(
      "loud-err.sh",
      "#!/bin/sh\ni=0\nwhile [ $i -lt 500 ]; do\n  echo '0123456789012345678901234567890123456789012345678901234567890123456789' >&2\n  i=$((i+1))\ndone\n",
    );
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits({ maxStderrBytes: 512 }),
    });

    expect(outcome.output.stderrTruncated).toBe(true);
    expect(Buffer.byteLength(outcome.output.stderr, "utf8")).toBeLessThanOrEqual(512);
  });

  it("terminates the complete process tree on timeout, not just the direct child", async () => {
    // The script backgrounds a long-lived grandchild, records its pid,
    // and then sleeps. Killing only the direct child would leave that
    // grandchild running — the exact failure this test exists to catch.
    const pidFile = path.join(sandbox, "grandchild.pid");
    const script = writeScript(
      "tree.sh",
      `#!/bin/sh\nsleep 120 &\necho $! > "${pidFile}"\nsleep 120\n`,
    );

    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits({ timeoutMs: 700, killGraceMs: 300 }),
    });

    expect(outcome.timedOut).toBe(true);
    // A signalled process has no exit code — timeout is not a clean exit.
    expect(outcome.exitCode).toBe(null);

    const grandchildPid = Number.parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    expect(Number.isInteger(grandchildPid)).toBe(true);

    // Allow the group signal to be delivered before asserting.
    for (let attempt = 0; attempt < 40 && isAlive(grandchildPid); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(isAlive(grandchildPid)).toBe(false);
  }, 20_000);

  it("retains output produced before a timeout", async () => {
    // A timed-out run must remain inspectable (principle 17) — losing
    // the logs is exactly when an operator most needs them.
    const script = writeScript(
      "slow-talker.sh",
      "#!/bin/sh\necho 'produced before the timeout'\nsleep 120\n",
    );
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits({ timeoutMs: 700, killGraceMs: 300 }),
    });

    expect(outcome.timedOut).toBe(true);
    expect(outcome.output.stdout).toContain("produced before the timeout");
  }, 20_000);

  it("terminates the tree when an external abort signal fires", async () => {
    const script = writeScript("abortable.sh", "#!/bin/sh\nsleep 120\n");
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 300);

    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits({ timeoutMs: 30_000, killGraceMs: 300 }),
      signal: controller.signal,
    });

    // Cancellation is not a timeout: the run was stopped deliberately.
    expect(outcome.timedOut).toBe(false);
    expect(outcome.exitCode).toBe(null);
    expect(outcome.signal).not.toBe(null);
  }, 20_000);

  it("reports a spawn failure as an outcome rather than an exception", async () => {
    const outcome = await runProcess({
      absoluteExecutable: path.join(sandbox, "does-not-exist"),
      args: [],
      cwd: sandbox,
      env: {},
      limits: limits(),
    });

    expect(outcome.spawnError).toBeDefined();
    expect(outcome.exitCode).toBe(null);
  });

  it("never interprets arguments through a shell", async () => {
    // If a shell were involved, `;` would start a second command and the
    // marker file would be created. It must not be.
    const marker = path.join(sandbox, "shell-escape-marker");
    const script = writeScript("echo-arg.sh", '#!/bin/sh\necho "$1"\n');
    const outcome = await runProcess({
      absoluteExecutable: script,
      args: [`hello; touch ${marker}`],
      cwd: sandbox,
      env: {},
      limits: limits(),
    });

    expect(outcome.output.stdout.trim()).toBe(`hello; touch ${marker}`);
    expect(() => readFileSync(marker)).toThrow();
  });
});
