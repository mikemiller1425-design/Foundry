import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockRuntimeAdapter } from "./adapters/mockAdapter";
import { PolicyBoundary, processExecutionBackend } from "./boundary";
import { defineRuntimePolicy, type RuntimePolicy } from "./policy";
import { REDACTION_PLACEHOLDER } from "./redaction";
import type { RunRequest, RunResult, RuntimeAdapter } from "./types";

describe("policy boundary", () => {
  let sandbox: string;
  let outside: string;
  let policy: RuntimePolicy;

  const baseRequest = (overrides: Partial<RunRequest> = {}): RunRequest => ({
    agentRunId: "run-1",
    agentId: "agent-builder",
    taskId: "task-1",
    riskClass: "R2",
    workingDirectory: sandbox,
    commands: [{ executable: "node", args: ["--version"] }],
    ...overrides,
  });

  beforeAll(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), "foundry-boundary-"));
    outside = mkdtempSync(path.join(tmpdir(), "foundry-outside-"));
    mkdirSync(path.join(sandbox, "src"), { recursive: true });
    writeFileSync(path.join(sandbox, "src", "index.ts"), "export {};\n");
    writeFileSync(path.join(outside, "secret.txt"), "outside data");
    symlinkSync(outside, path.join(sandbox, "escape"));

    policy = defineRuntimePolicy({
      id: "boundary-test-policy",
      workingDirectoryRoots: [sandbox],
      maxRiskClass: "R2",
      allowedEnvironmentVariables: ["LANG"],
      limits: {
        timeoutMs: 5_000,
        maxStdoutBytes: 4096,
        maxStderrBytes: 4096,
        maxEvidenceBytes: 32 * 1024,
        killGraceMs: 300,
      },
      allowedCommands: [
        { executable: "node", args: [{ kind: "literal", value: "--version" }] },
        { executable: "cat", args: [{ kind: "containedPath" }] },
        { executable: "false", args: [] },
      ],
    });
  });

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  const mockAdapter = (options: ConstructorParameters<typeof MockRuntimeAdapter>[1] = {}) =>
    new MockRuntimeAdapter(policy, options);

  describe("evidence is retained for every terminal outcome", () => {
    it("success", async () => {
      const result = await mockAdapter({
        scripts: [{ executable: "node", stdout: "v22.0.0\n", exitCode: 0 }],
      }).execute(baseRequest());

      expect(result.status).toBe("completed");
      expect(result.exitCode).toBe(0);
      expect(result.evidence.status).toBe("completed");
      expect(result.evidence.commands).toHaveLength(1);
      expect(result.evidence.commands[0]?.output.stdout).toBe("v22.0.0\n");
      expect(result.evidence.sizeBytes).toBeGreaterThan(0);
    });

    it("failure", async () => {
      const result = await mockAdapter({
        scripts: [{ executable: "false", exitCode: 1, stderr: "it failed\n" }],
      }).execute(baseRequest({ commands: [{ executable: "false", args: [] }] }));

      expect(result.status).toBe("failed");
      expect(result.exitCode).toBe(1);
      expect(result.evidence.status).toBe("failed");
      expect(result.evidence.commands[0]?.output.stderr).toBe("it failed\n");
    });

    it("denial", async () => {
      const result = await mockAdapter().execute(
        baseRequest({ commands: [{ executable: "curl", args: ["https://example.test"] }] }),
      );

      expect(result.status).toBe("denied");
      expect(result.evidence.status).toBe("denied");
      expect(result.evidence.denials[0]?.code).toBe("command_not_allowed");
      // A denial is a recorded fact, not an absence of one.
      expect(result.evidence.commands).toHaveLength(1);
      expect(result.evidence.commands[0]?.status).toBe("denied");
    });

    it("timeout", async () => {
      const result = await mockAdapter({
        scripts: [{ executable: "node", timedOut: true, stdout: "partial output\n" }],
      }).execute(baseRequest());

      expect(result.status).toBe("timed_out");
      expect(result.evidence.status).toBe("timed_out");
      expect(result.evidence.commands[0]?.signal).toBe("SIGKILL");
      // Logs survive the timeout.
      expect(result.evidence.commands[0]?.output.stdout).toBe("partial output\n");
    });
  });

  describe("policy refusals", () => {
    it("denies an unknown command", async () => {
      const result = await mockAdapter().execute(
        baseRequest({ commands: [{ executable: "rm", args: ["-rf"] }] }),
      );
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("command_not_allowed");
    });

    it("denies a working directory outside the declared roots", async () => {
      const result = await mockAdapter().execute(baseRequest({ workingDirectory: outside }));
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("path_outside_root");
    });

    it("denies a path argument that escapes through a symlink", async () => {
      const result = await mockAdapter().execute(
        baseRequest({ commands: [{ executable: "cat", args: ["escape/secret.txt"] }] }),
      );
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("symlink_escape");
    });

    it("denies a '..' traversal argument", async () => {
      const result = await mockAdapter().execute(
        baseRequest({ commands: [{ executable: "cat", args: ["../outside/secret.txt"] }] }),
      );
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("path_traversal");
    });

    it("denies a shell injection attempt in an argument", async () => {
      const result = await mockAdapter().execute(
        baseRequest({ commands: [{ executable: "cat", args: ["src/index.ts; rm -rf /"] }] }),
      );
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("shell_metacharacter");
    });

    it("denies a per-command cwd that escapes the root", async () => {
      const result = await mockAdapter().execute(
        baseRequest({ commands: [{ executable: "node", args: ["--version"], cwd: outside }] }),
      );
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("path_outside_root");
    });

    it("executes nothing at all when any command in the plan is refused", async () => {
      // The allowed command comes first. If evaluation were lazy it would
      // already have run by the time the second was refused.
      const result = await mockAdapter({
        scripts: [{ executable: "node", stdout: "should never run\n" }],
      }).execute(
        baseRequest({
          commands: [
            { executable: "node", args: ["--version"] },
            { executable: "curl", args: ["https://example.test"] },
          ],
        }),
      );

      expect(result.status).toBe("denied");
      expect(result.evidence.commands.every((command) => command.status === "denied")).toBe(true);
      expect(JSON.stringify(result.evidence)).not.toContain("should never run");
    });

    it("denies a run whose risk class exceeds the policy ceiling", async () => {
      const r0Policy = defineRuntimePolicy({
        ...policy,
        id: "r0-only",
        maxRiskClass: "R0",
      });
      const result = await new MockRuntimeAdapter(r0Policy).execute(
        baseRequest({ riskClass: "R2" }),
      );
      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("risk_class_not_permitted");
    });

    it("cannot express a risk class above R2 at all", () => {
      // Principle 19 is enforced by the type/schema, not by a check that
      // could be forgotten.
      expect(() => defineRuntimePolicy({ ...policy, maxRiskClass: "R3" })).toThrow();
    });
  });

  describe("secret handling", () => {
    it("redacts registered secrets from captured output", async () => {
      const secret = "super-secret-run-token-value";
      const result = await mockAdapter({
        scripts: [{ executable: "node", stdout: `token=${secret}\n` }],
      }).execute(baseRequest({ secretValues: [secret] }));

      expect(result.evidence.commands[0]?.output.stdout).toBe(`token=${REDACTION_PLACEHOLDER}\n`);
      expect(JSON.stringify(result.evidence)).not.toContain(secret);
    });

    it("redacts credential-shaped material that was never registered", async () => {
      const leaked = "sk-ant-api03-LEAKEDLEAKEDLEAKEDLEAKED";
      const result = await mockAdapter({
        scripts: [{ executable: "node", stderr: `error using ${leaked}\n` }],
      }).execute(baseRequest());

      expect(JSON.stringify(result.evidence)).not.toContain(leaked);
    });

    it("redacts secrets from the task specification and from denial evidence", async () => {
      const secret = "specification-embedded-secret";
      const result = await mockAdapter().execute(
        baseRequest({
          taskSpecification: `deploy using ${secret}`,
          commands: [{ executable: "curl", args: ["https://example.test"] }],
          secretValues: [secret],
        }),
      );

      expect(result.status).toBe("denied");
      expect(JSON.stringify(result.evidence)).not.toContain(secret);
    });

    it("records environment variable names but never their values", async () => {
      const result = await mockAdapter({
        environmentSource: { LANG: "en_US.UTF-8" },
        scripts: [{ executable: "node", stdout: "ok\n" }],
      }).execute(baseRequest());

      expect(result.evidence.environmentNames).toEqual(["LANG"]);
      expect(JSON.stringify(result.evidence)).not.toContain("en_US.UTF-8");
    });
  });

  describe("evidence integrity", () => {
    it("is immutable once returned", async () => {
      const result = await mockAdapter({
        scripts: [{ executable: "node", stdout: "v22.0.0\n" }],
      }).execute(baseRequest());

      expect(Object.isFrozen(result.evidence)).toBe(true);
      expect(Object.isFrozen(result.evidence.commands)).toBe(true);
      expect(() => {
        (result.evidence as { status: string }).status = "completed";
      }).toThrow();
    });

    it("binds evidence to exactly one AgentRun", async () => {
      const result = await mockAdapter().execute(baseRequest({ agentRunId: "run-42" }));
      expect(result.evidence.agentRunId).toBe("run-42");
      expect(result.agentRunId).toBe("run-42");
    });

    it("bounds evidence size by dropping output, never the record itself", async () => {
      const tightPolicy = defineRuntimePolicy({
        ...policy,
        id: "tight-evidence",
        limits: { ...policy.limits, maxEvidenceBytes: 512, maxStdoutBytes: 64 * 1024 },
      });
      const result = await new MockRuntimeAdapter(tightPolicy, {
        scripts: [{ executable: "node", stdout: "x".repeat(20_000) }],
      }).execute(baseRequest());

      expect(result.evidence.truncated).toBe(true);
      expect(result.evidence.commands[0]?.output.stdout).toBe("");
      // The facts an operator needs are still there.
      expect(result.evidence.commands[0]?.output.stdoutBytes).toBe(20_000);
      expect(result.evidence.commands[0]?.exitCode).toBe(0);
      expect(result.evidence.commands[0]?.executable).toBe("node");
    });

    it("records the policy, roots, and network posture that governed the run", async () => {
      const result = await mockAdapter().execute(baseRequest());
      expect(result.evidence.policyId).toBe("boundary-test-policy");
      expect(result.evidence.canonicalRoots).toHaveLength(1);
      expect(result.evidence.networkAllowed).toBe(false);
      expect(result.evidence.runtimeType).toBe("mock");
      expect(result.evidence.riskClass).toBe("R2");
    });
  });

  describe("multi-command runs", () => {
    it("stops at the first failing command", async () => {
      const result = await mockAdapter({
        scripts: [
          { executable: "false", exitCode: 1 },
          { executable: "node", stdout: "should not reach here\n" },
        ],
      }).execute(
        baseRequest({
          commands: [
            { executable: "false", args: [] },
            { executable: "node", args: ["--version"] },
          ],
        }),
      );

      expect(result.status).toBe("failed");
      expect(result.evidence.commands).toHaveLength(1);
      expect(JSON.stringify(result.evidence)).not.toContain("should not reach here");
    });

    it("runs every command when all succeed", async () => {
      const result = await mockAdapter({
        scripts: [{ executable: "node", stdout: "ok\n" }],
      }).execute(
        baseRequest({
          commands: [
            { executable: "node", args: ["--version"] },
            { executable: "node", args: ["--version"] },
          ],
        }),
      );

      expect(result.status).toBe("completed");
      expect(result.evidence.commands).toHaveLength(2);
    });
  });

  describe("mock adapter conforms to the RuntimeAdapter interface", () => {
    it("satisfies the interface structurally and reports its runtime type", () => {
      const adapter: RuntimeAdapter = mockAdapter();
      expect(adapter.runtimeType).toBe("mock");
      expect(adapter.policy).toBe(policy);
      expect(typeof adapter.execute).toBe("function");
    });

    it("is deterministic: identical requests produce identical evidence", async () => {
      const fixedClock = () => new Date("2026-07-31T00:00:00.000Z");
      const options = {
        scripts: [{ executable: "node", stdout: "v22.0.0\n" }],
        now: fixedClock,
        newId: () => "evidence-fixed",
      };

      const first = await new MockRuntimeAdapter(policy, options).execute(baseRequest());
      const second = await new MockRuntimeAdapter(policy, options).execute(baseRequest());
      expect(JSON.stringify(first.evidence)).toBe(JSON.stringify(second.evidence));
    });

    it("produces the same denial decisions as the real backend for the same policy", async () => {
      // The mock and the process backend share the boundary, so a
      // containment decision cannot differ between them.
      const request = baseRequest({
        commands: [{ executable: "cat", args: ["escape/secret.txt"] }],
      });

      const viaMock = await mockAdapter().execute(request);
      const viaProcess = await new PolicyBoundary(policy, {
        runtimeType: "mock",
        backend: processExecutionBackend,
        environmentSource: {},
      }).execute(request);

      expect(viaMock.status).toBe("denied");
      expect(viaProcess.status).toBe("denied");
      expect(viaMock.denials[0]?.code).toBe(viaProcess.denials[0]?.code);
    });
  });

  describe("real process execution through the boundary", () => {
    const realPolicy = () =>
      defineRuntimePolicy({
        id: "real-process-policy",
        workingDirectoryRoots: [sandbox],
        maxRiskClass: "R1",
        allowedEnvironmentVariables: [],
        executableSearchPath: [path.join(sandbox, "bin")],
        limits: {
          timeoutMs: 5_000,
          maxStdoutBytes: 4096,
          maxStderrBytes: 4096,
          maxEvidenceBytes: 32 * 1024,
          killGraceMs: 300,
        },
        allowedCommands: [{ executable: "report", args: [{ kind: "containedPath" }] }],
      });

    beforeAll(() => {
      mkdirSync(path.join(sandbox, "bin"), { recursive: true });
      const script = path.join(sandbox, "bin", "report");
      writeFileSync(script, '#!/bin/sh\necho "read $1"\n', "utf8");
      chmodSync(script, 0o755);
    });

    it("runs an allowed command and captures real output", async () => {
      const boundary = new PolicyBoundary(realPolicy(), {
        runtimeType: "mock",
        backend: processExecutionBackend,
        environmentSource: { LANG: "en_US.UTF-8", ANTHROPIC_API_KEY: "sk-ant-must-not-leak-000" },
      });

      const result: RunResult = await boundary.execute(
        baseRequest({
          riskClass: "R1",
          commands: [{ executable: "report", args: ["src/index.ts"] }],
        }),
      );

      expect(result.status).toBe("completed");
      expect(result.exitCode).toBe(0);
      expect(result.evidence.commands[0]?.output.stdout).toContain("src/index.ts");
      // Nothing from the parent environment reached the child.
      expect(result.evidence.environmentNames).toEqual([]);
      expect(JSON.stringify(result.evidence)).not.toContain("sk-ant-must-not-leak");
    });

    it("refuses an allowlisted name that is absent from the declared search path", async () => {
      const boundary = new PolicyBoundary(
        defineRuntimePolicy({
          ...realPolicy(),
          id: "missing-binary",
          allowedCommands: [{ executable: "nowhere-to-be-found", args: [] }],
        }),
        { runtimeType: "mock", backend: processExecutionBackend, environmentSource: {} },
      );

      const result = await boundary.execute(
        baseRequest({
          riskClass: "R1",
          commands: [{ executable: "nowhere-to-be-found", args: [] }],
        }),
      );

      expect(result.status).toBe("denied");
      expect(result.denials[0]?.code).toBe("command_not_allowed");
    });
  });
});
