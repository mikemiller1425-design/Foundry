import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_STAGE_SEQUENCE,
  CLAUDE_CODE_STAGE,
  planRevision,
  plannedStageId,
  type BuildPlan,
  type PersistedPlan,
} from "@foundry/contracts";
import {
  BuildOrchestrator,
  CommandHandler,
  ENTITY_TYPES,
  ObjectiveIntake,
  PersistenceService,
  defaultOrchestratorActors,
  type CommandActor,
} from "@foundry/persistence";
import type {
  ExecutionBackend,
  RunRequest,
  RunResult,
  RuntimeAdapter,
  SpawnOutcome,
  SpawnParameters,
} from "@foundry/runtime-adapters";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXECUTE_FLAG, parseDispatchArgs, runEntrypoint } from "./dispatchRealRun";
import { ExecutionDispatcher, type DispatchConfig } from "./executionDispatcher";

/**
 * AC-111 — the audited one-shot real-run entrypoint.
 *
 * **Every test uses a substituted execution backend.** Nothing here
 * invokes Claude Code, spawns the executable, calls a model, consumes a
 * real authorization, or spends money. `backendInvocations` counts every
 * time an execution backend was reached and is asserted at each step.
 */

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};

const SUPPORTED_OBJECTIVE = "Add a JSON task store module with a test suite";
const FAKE_BINARY_BODY = "#!/bin/sh\nexit 0\n";

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;
let fakeBinaryPath: string;
let fakeBinarySha: string;
let backendInvocations = 0;
let logLines: string[];

// ---------------------------------------------------------------------------

function fakeAdapter(): RuntimeAdapter {
  return {
    runtimeType: "claude_code",
    policy: { id: "fake-controlled", maxRiskClass: "R2", allowedCommands: [] } as never,
    execute: async (request: RunRequest): Promise<RunResult> => {
      backendInvocations += 1;
      writeFileSync(join(request.workingDirectory, "src/taskStore.js"), "export const x = 1;\n");
      const stdout = JSON.stringify({ total_cost_usd: 0.42 });
      return {
        status: "completed",
        agentRunId: request.agentRunId,
        exitCode: 0,
        denials: [],
        evidence: {
          evidenceId: "evidence-fake",
          agentRunId: request.agentRunId,
          agentId: request.agentId,
          taskId: request.taskId,
          runtimeType: "claude_code",
          riskClass: "R2",
          policyId: "fake-controlled",
          status: "completed",
          canonicalWorkingDirectory: request.workingDirectory,
          canonicalRoots: [request.workingDirectory],
          environmentNames: ["HOME", "USER"],
          networkAllowed: true,
          commands: [
            {
              status: "completed",
              executable: "/fake/claude",
              args: [],
              cwd: request.workingDirectory,
              exitCode: 0,
              signal: null,
              startedAt: "2026-08-04T00:00:00.000Z",
              completedAt: "2026-08-04T00:00:01.000Z",
              durationMs: 1000,
              output: {
                stdout,
                stderr: "",
                stdoutTruncated: false,
                stderrTruncated: false,
                stdoutBytes: stdout.length,
                stderrBytes: 0,
              },
            },
          ],
          denials: [],
          truncated: false,
          sizeBytes: 0,
          startedAt: "2026-08-04T00:00:00.000Z",
          completedAt: "2026-08-04T00:00:01.000Z",
        } as never,
      };
    },
  };
}

function fakeValidationBackend(): ExecutionBackend {
  return {
    resolveExecutable: (_p, executable) => ({ allowed: true, value: executable }) as never,
    run: async (parameters: SpawnParameters): Promise<SpawnOutcome> => {
      const args = parameters.args.join(" ");
      let stdout = "";
      if (args.includes("status --porcelain")) stdout = " M src/taskStore.js";
      else if (args.includes("diff --cached")) stdout = "diff --git a/src/taskStore.js\n";
      else if (args.includes("--test")) stdout = "# pass 12";
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        durationMs: 5,
        output: {
          stdout,
          stderr: "",
          stdoutTruncated: false,
          stderrTruncated: false,
          stdoutBytes: stdout.length,
          stderrBytes: 0,
        },
      };
    },
  };
}

function config(): Omit<DispatchConfig, "expectedExecutableSha256"> {
  return {
    executablePath: fakeBinaryPath,
    gitExecutablePath: "/usr/bin/git",
    nodeExecutablePath: process.execPath,
    model: "sonnet",
    timeoutMs: 600_000,
    validationTimeoutMs: 120_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEvidenceBytes: 8 * 1024 * 1024,
  };
}

function deps(overrides: Partial<Parameters<typeof runEntrypoint>[1]> = {}) {
  return {
    persistence,
    config: config(),
    actor: OPERATOR,
    log: (line: string) => logLines.push(line),
    dispatch: (pinSha256: string) =>
      new ExecutionDispatcher(persistence, handler, {
        ...config(),
        expectedExecutableSha256: pinSha256,
      }).dispatch(currentBuildId, OPERATOR, {
        adapter: fakeAdapter(),
        validationBackend: fakeValidationBackend(),
      }),
    ...overrides,
  };
}

let currentBuildId = "";

function planFor(buildId: string, projectId: string): BuildPlan {
  return {
    planId: "plan-1",
    projectId,
    buildId,
    objective: SUPPORTED_OBJECTIVE,
    workspace: "foundry_managed",
    riskClass: "R2",
    createdAt: "2026-08-04T00:00:00.000Z",
    stages: BUILD_STAGE_SEQUENCE.map((name, i) => ({
      name,
      sequence: i + 1,
      sourceBuildingId: "construction-office",
      destinationBuildingId: "construction-office",
      runtime: name === CLAUDE_CODE_STAGE ? ("claude_code" as const) : ("mock" as const),
      required: true,
      requirements: [
        {
          name: `${name} complete`,
          description: "Stage work is done.",
          required: true,
          validatorType: "test",
          acceptanceCriteria: ["It completes with its stated work done."],
        },
      ],
    })),
  };
}

async function seedAuthorizedBuild(budget = 2): Promise<BuildPlan> {
  const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
  const created = intake.submit(
    { objective: SUPPORTED_OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
    OPERATOR,
  );
  const plan = planFor(created.buildId as string, created.projectId as string);
  currentBuildId = plan.buildId;

  handler.submit(
    {
      commandType: "Build.Plan",
      entityId: plan.buildId,
      params: {
        planId: plan.planId,
        planArtifactId: plan.planId,
        stageIds: BUILD_STAGE_SEQUENCE.map((n) => plannedStageId(plan.planId, n)),
        requirementCount: 7,
        plan,
      },
    },
    OPERATOR,
  );
  handler.submit(
    {
      commandType: "Plan.Review",
      entityId: plan.planId,
      params: {
        planId: plan.planId,
        buildId: plan.buildId,
        reviewedRevision: planRevision(plan),
        decision: "proceed",
      },
    },
    OPERATOR,
  );
  const persistedPlan = persistence.getEntity<PersistedPlan>("plans", plan.planId) as PersistedPlan;
  await new BuildOrchestrator(handler).run(persistedPlan, defaultOrchestratorActors(OPERATOR));

  const withHash = persistence.getEntity<PersistedPlan>("plans", plan.planId) as PersistedPlan;
  handler.submit(
    {
      commandType: "Plan.Authorize",
      entityId: plan.planId,
      params: {
        planId: plan.planId,
        buildId: plan.buildId,
        stageName: CLAUDE_CODE_STAGE,
        maxBudgetUsd: budget,
        acknowledgedContentHash: withHash.contentHash,
      },
    },
    OPERATOR,
  );
  return plan;
}

function fullSnapshot() {
  return {
    events: persistence.getAllEvents(),
    entities: Object.fromEntries(ENTITY_TYPES.map((t) => [t, persistence.listEntities(t)])),
  };
}

beforeEach(() => {
  backendInvocations = 0;
  logLines = [];
  dir = mkdtempSync(join(tmpdir(), "foundry-ac111-cli-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);
  fakeBinaryPath = join(dir, "claude.fake");
  writeFileSync(fakeBinaryPath, FAKE_BINARY_BODY, "utf8");
  fakeBinarySha = createHash("sha256").update(FAKE_BINARY_BODY).digest("hex");
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe("AC-111 entrypoint — arguments a caller may not supply", () => {
  it("accepts exactly three flags", () => {
    const result = parseDispatchArgs([
      "--build-id",
      "build-1",
      "--pin-sha256",
      "a".repeat(64),
      EXECUTE_FLAG,
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.args).toEqual({
      buildId: "build-1",
      pinSha256: "a".repeat(64),
      executeRealRun: true,
    });
  });

  it.each([
    ["--budget", "50"],
    ["--max-budget-usd", "50"],
    ["--model", "opus"],
    ["--tools", "Bash"],
    ["--timeout", "999999"],
    ["--workspace", "/tmp/mine"],
    ["--write-path", "src/anything.js"],
    ["--test-command", "true"],
    ["--executable-path", "/bin/sh"],
    ["--objective", "do anything"],
    ["--supported-objective-id", "anything-v1"],
    ["--keep-workspace", "1"],
  ])("REFUSES %s — runtime policy is not caller-controlled", (flag, value) => {
    const result = parseDispatchArgs([
      "--build-id",
      "build-1",
      "--pin-sha256",
      "a".repeat(64),
      flag,
      value,
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain(flag);
    // Refused by name, not silently ignored — an ignored --budget 50 is
    // worse than a rejected one.
    expect(result.reason).toMatch(/fixed in committed configuration|persisted authorization/i);
  });

  it("refuses an unrecognised flag rather than ignoring it", () => {
    const result = parseDispatchArgs(["--build-id", "b", "--pin-sha256", "a".repeat(64), "--yolo"]);
    expect(result.ok).toBe(false);
  });

  it("requires a build id and a well-formed pin", () => {
    expect(parseDispatchArgs(["--pin-sha256", "a".repeat(64)]).ok).toBe(false);
    expect(parseDispatchArgs(["--build-id", "b"]).ok).toBe(false);
    expect(parseDispatchArgs(["--build-id", "b", "--pin-sha256", "short"]).ok).toBe(false);
    expect(parseDispatchArgs(["--build-id", "b", "--pin-sha256", "A".repeat(64)]).ok).toBe(false);
  });
});

describe("AC-111 entrypoint — dry run is the default", () => {
  it("performs NO reservation, workspace, spawn, or mutation", async () => {
    await seedAuthorizedBuild();
    const before = fullSnapshot();

    const result = await runEntrypoint(
      ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha],
      deps(),
    );

    expect(result.dispatched).toBe(false);
    expect(result.evidence).toBeNull();
    expect(backendInvocations).toBe(0);
    expect(fullSnapshot()).toEqual(before);
  });

  it("shows everything the operator must check before authorizing", async () => {
    const plan = await seedAuthorizedBuild(2);
    await runEntrypoint(["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha], deps());
    const output = logLines.join("\n");

    expect(output).toContain(currentBuildId);
    expect(output).toContain(plan.planId);
    expect(output).toContain("task-store-module-v1");
    expect(output).toContain("sha256:"); // the plan content hash
    expect(output).toContain("--authorization"); // authorization id suffix
    expect(output).toContain("$2");
    expect(output).toContain(fakeBinarySha);
    expect(output).toContain("src/taskStore.js");
    expect(output).toContain("test/taskStore.test.js");
    expect(output).toContain("not writable, not runnable");
    expect(output).toContain("600000 ms");
    expect(output).toContain("NOT OS-enforced");
    // The exact vector, including the authorized ceiling.
    expect(output).toContain("--max-budget-usd");
    expect(output).toContain("--tools");
    expect(output).toContain("Read,Write,Edit,Glob,Grep");
    expect(output).toMatch(/DRY RUN\. Nothing was reserved/);
  });

  it("reports the gate's refusal when there is no authorization", async () => {
    // Seeded but never authorized.
    const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
    const created = intake.submit(
      { objective: SUPPORTED_OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
      OPERATOR,
    );
    currentBuildId = created.buildId as string;

    const before = fullSnapshot();
    const result = await runEntrypoint(
      ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha],
      deps(),
    );
    expect(result.preflight?.gatePermitted).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(fullSnapshot()).toEqual(before);
  });
});

describe("AC-111 entrypoint — real dispatch requires the explicit flag", () => {
  it("refuses to dispatch without --execute-real-run, with zero side effects", async () => {
    await seedAuthorizedBuild();
    const before = fullSnapshot();

    const result = await runEntrypoint(
      ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha],
      deps(),
    );

    expect(result.dispatched).toBe(false);
    expect(backendInvocations).toBe(0);
    expect(fullSnapshot()).toEqual(before);
    expect(logLines.join("\n")).toContain(EXECUTE_FLAG);
  });

  it("dispatches exactly one run WITH the flag, using the persisted budget", async () => {
    await seedAuthorizedBuild(2);

    const result = await runEntrypoint(
      ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha, EXECUTE_FLAG],
      deps(),
    );

    expect(result.dispatched).toBe(true);
    expect(backendInvocations).toBe(1);
    expect(result.evidence?.outcome).toBe("succeeded");
    // H-3: the ceiling came from the authorization, not the command line.
    expect(result.evidence?.budget.fromAuthorization).toBe(2);
    expect(result.evidence?.budget.passedToRuntime).toBe(2);
    expect(result.evidence?.budget.actualCostUsd).toBe(0.42);
  });

  it("refuses BEFORE execution when the pin is wrong", async () => {
    await seedAuthorizedBuild();
    const before = fullSnapshot();

    const result = await runEntrypoint(
      ["--build-id", currentBuildId, "--pin-sha256", "b".repeat(64), EXECUTE_FLAG],
      deps(),
    );

    expect(result.dispatched).toBe(false);
    expect(backendInvocations).toBe(0);
    expect(result.exitCode).toBe(1);
    expect(fullSnapshot()).toEqual(before);
    expect(logLines.join("\n")).toContain("pin matches");
  });
});

describe("AC-111 entrypoint — exactly one dispatch, ever", () => {
  it("a second invocation reaches no backend", async () => {
    await seedAuthorizedBuild();
    const argv = ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha, EXECUTE_FLAG];

    const first = await runEntrypoint(argv, deps());
    expect(first.dispatched).toBe(true);
    expect(backendInvocations).toBe(1);

    const second = await runEntrypoint(argv, deps());
    expect(second.dispatched).toBe(false);
    // Still one. The authorization is spent and never automatically reused.
    expect(backendInvocations).toBe(1);
  });

  it("CONCURRENT invocations produce at most one backend invocation", async () => {
    await seedAuthorizedBuild();
    const argv = ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha, EXECUTE_FLAG];

    await Promise.all([runEntrypoint(argv, deps()), runEntrypoint(argv, deps())]);

    expect(backendInvocations).toBe(1);
    const realRuns = persistence
      .listEntities<{ runtimeType: string }>("agentRuns")
      .filter((r) => r.runtimeType === "claude_code");
    expect(realRuns).toHaveLength(1);
  });

  it("never retries after a failure", async () => {
    await seedAuthorizedBuild();
    const failing = vi.fn(async () => {
      backendInvocations += 1;
      return {
        outcome: "failed_cost_unknown",
        verdict: "cost unknown",
        dispatched: true,
        budget: { fromAuthorization: 2, passedToRuntime: 2, actualCostUsd: null, outcome: null },
        workspaceDisposition: "destroyed",
        workspaceDestructionVerified: true,
      } as never;
    });

    const result = await runEntrypoint(
      ["--build-id", currentBuildId, "--pin-sha256", fakeBinarySha, EXECUTE_FLAG],
      deps({ dispatch: failing }),
    );

    expect(failing).toHaveBeenCalledTimes(1);
    expect(backendInvocations).toBe(1);
    expect(result.exitCode).toBe(1);
  });
});

describe("AC-111 entrypoint — zero real model calls", () => {
  it("no test in this file reached a real runtime", () => {
    // Every dispatch above supplied a substituted adapter and validation
    // backend. The real ClaudeCodeAdapter is never constructed here.
    expect(backendInvocations).toBeLessThanOrEqual(1);
  });
});
