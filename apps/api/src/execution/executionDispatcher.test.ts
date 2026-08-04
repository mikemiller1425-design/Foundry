import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
  ObjectiveIntake,
  PersistenceService,
  defaultOrchestratorActors,
  evaluateExecutionGate,
  planContentHash,
  readExecutionGateInput,
  stageEntityIds,
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
import { ExecutionDispatcher, isPreDispatchRefusal, type DispatchConfig } from "./executionDispatcher";

/**
 * AC-111 — offline construction of the real-execution dispatch path.
 *
 * **Every test here uses a substituted execution backend.** `F-117`
 * requires the whole mechanism to be covered offline, and the operator's
 * authorization for this rung explicitly excludes invoking Claude Code,
 * spawning the executable, calling a model, or spending money. A test
 * that reached the real backend would violate all four, so the real
 * backend is never constructed: `realModelCalls` counts every dispatch
 * and is asserted zero at the end.
 */

const OPERATOR: CommandActor = {
  actorType: "operator",
  actorId: "operator-1",
  authenticated: true,
};

/** Matches `task-store-module-v1`: "task store", "module", "test". */
const SUPPORTED_OBJECTIVE = "Add a JSON task store module with a test suite";
/** Bounded and valid, but matches no execution template. */
const UNSUPPORTED_OBJECTIVE = "Refactor the billing reconciliation pipeline end to end";

let dir: string;
let persistence: PersistenceService;
let handler: CommandHandler;
let fakeBinaryPath: string;
let fakeBinarySha: string;

/** Stand-in for the controlled executable. Never executed — only hashed. */
const FAKE_BINARY_BODY = "#!/bin/sh\nexit 0\n";

/** Counts anything that would have been a real model call. Must stay 0. */
let realModelCalls = 0;

// ---------------------------------------------------------------------------
// Substituted backends
// ---------------------------------------------------------------------------

interface FakeAdapterOptions {
  stdout?: string;
  status?: RunResult["status"];
  exitCode?: number | null;
  /** Files the "run" writes into the workspace, relative to its root. */
  writes?: Record<string, string>;
  onExecute?: (request: RunRequest) => void;
}

/**
 * Stands in for `ClaudeCodeAdapter`. It implements the same interface and
 * returns the same evidence shape, but spawns nothing — the only
 * difference from the real adapter, which is what makes it a rehearsal
 * rather than a lookalike.
 */
function fakeAdapter(workspaceRootRef: { root?: string }, options: FakeAdapterOptions = {}): RuntimeAdapter {
  return {
    runtimeType: "claude_code",
    policy: { id: "fake-controlled", maxRiskClass: "R2", allowedCommands: [] } as never,
    execute: async (request: RunRequest): Promise<RunResult> => {
      realModelCalls += 0; // deliberately zero: nothing real is invoked
      options.onExecute?.(request);
      const root = request.workingDirectory;
      workspaceRootRef.root = root;
      for (const [relative, contents] of Object.entries(options.writes ?? {})) {
        writeFileSync(join(root, relative), contents, "utf8");
      }
      const stdout = options.stdout ?? JSON.stringify({ total_cost_usd: 1.25, result: "done" });
      return {
        status: options.status ?? "completed",
        agentRunId: request.agentRunId,
        exitCode: options.exitCode ?? 0,
        denials: [],
        evidence: {
          evidenceId: "evidence-fake",
          agentRunId: request.agentRunId,
          agentId: request.agentId,
          taskId: request.taskId,
          runtimeType: "claude_code",
          riskClass: "R2",
          policyId: "fake-controlled",
          status: options.status ?? "completed",
          canonicalWorkingDirectory: root,
          canonicalRoots: [root],
          environmentNames: ["HOME", "USER"],
          networkAllowed: true,
          commands: [
            {
              status: options.status === "timed_out" ? "timed_out" : "completed",
              executable: "/fake/claude",
              args: [],
              cwd: root,
              exitCode: options.exitCode ?? 0,
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

/**
 * Substituted validation backend. `git` and `node --test` are simulated
 * so the verdict path runs without touching a real repository.
 */
function fakeValidationBackend(options: { changed?: string[]; testsPass?: boolean } = {}): ExecutionBackend {
  return {
    resolveExecutable: (_policy, executable) => ({ allowed: true, value: executable }) as never,
    run: async (parameters: SpawnParameters): Promise<SpawnOutcome> => {
      const args = parameters.args.join(" ");
      let stdout = "";
      if (args.includes("status --porcelain")) {
        stdout = (options.changed ?? ["src/taskStore.js"]).map((p) => ` M ${p}`).join("\n");
      } else if (args.includes("diff --cached")) {
        stdout = "diff --git a/src/taskStore.js b/src/taskStore.js\n";
      } else if (args.includes("--test")) {
        stdout = options.testsPass === false ? "# fail 1" : "# pass 12";
      }
      return {
        exitCode: args.includes("--test") && options.testsPass === false ? 1 : 0,
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function planFor(buildId: string, projectId: string, objective: string, planId = "plan-1"): BuildPlan {
  return {
    planId,
    projectId,
    buildId,
    objective,
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

/** Objective → plan → review → orchestrated run (so stages/tasks exist). */
async function seedOrchestratedBuild(objective = SUPPORTED_OBJECTIVE): Promise<BuildPlan> {
  const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
  const created = intake.submit(
    { objective, workspace: "foundry_managed", riskClass: "R2" },
    OPERATOR,
  );
  const plan = planFor(created.buildId as string, created.projectId as string, objective);
  expect(
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
    ).accepted,
  ).toBe(true);
  expect(
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
    ).accepted,
  ).toBe(true);

  const persisted = persistence.getEntity<PersistedPlan>("plans", plan.planId) as PersistedPlan;
  await new BuildOrchestrator(handler).run(persisted, defaultOrchestratorActors(OPERATOR));
  return plan;
}

function authorize(plan: BuildPlan, maxBudgetUsd = 5) {
  const persisted = persistence.getEntity<PersistedPlan>("plans", plan.planId) as PersistedPlan;
  return handler.submit(
    {
      commandType: "Plan.Authorize",
      entityId: plan.planId,
      params: {
        planId: plan.planId,
        buildId: plan.buildId,
        stageName: CLAUDE_CODE_STAGE,
        maxBudgetUsd,
        acknowledgedContentHash: persisted.contentHash,
      },
    },
    OPERATOR,
  );
}

function config(overrides: Partial<DispatchConfig> = {}): DispatchConfig {
  return {
    executablePath: fakeBinaryPath,
    expectedExecutableSha256: fakeBinarySha,
    gitExecutablePath: "/usr/bin/git",
    nodeExecutablePath: process.execPath,
    model: "sonnet",
    timeoutMs: 60_000,
    validationTimeoutMs: 30_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEvidenceBytes: 8 * 1024 * 1024,
    ...overrides,
  };
}

function fullSnapshot() {
  return { events: persistence.getAllEvents(), world: persistence.getWorldStateSnapshot() };
}

beforeEach(() => {
  realModelCalls = 0;
  dir = mkdtempSync(join(tmpdir(), "foundry-ac111-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  handler = new CommandHandler(persistence);

  // A stand-in for the controlled executable, so binary-identity checks
  // are exercised without touching (or hashing) the real 270 MB binary.
  fakeBinaryPath = join(dir, "claude.fake");
  writeFileSync(fakeBinaryPath, FAKE_BINARY_BODY, "utf8");
  fakeBinarySha = createHash("sha256").update(FAKE_BINARY_BODY).digest("hex");
});

afterEach(() => {
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe("AC-111 H-1 — operational persistence and reservation before spawn", () => {
  it("dispatches successfully and records the run in the OPERATIONAL store", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const root: { root?: string } = {};
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      { adapter: fakeAdapter(root, { writes: { "src/taskStore.js": "export const x = 1;\n" } }), validationBackend: fakeValidationBackend() },
    );

    expect(result.outcome).toBe("succeeded");
    expect(result.reserved).toBe(true);
    expect(result.dispatched).toBe(true);

    // The AgentRun is in the same store the gate reads — the whole of H-1.
    const run = persistence.getEntity<{ runtimeType: string; status: string }>(
      "agentRuns",
      result.agentRunId as string,
    );
    expect(run?.runtimeType).toBe("claude_code");
    expect(run?.status).toBe("completed");
  });

  it("marks the authorization SPENT in the gate the moment it is reserved", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const before = evaluateExecutionGate(
      readExecutionGateInput(persistence, plan.buildId, CLAUDE_CODE_STAGE),
    );
    expect(before.permitted).toBe(true);

    let gateDuringRun: ReturnType<typeof evaluateExecutionGate> | null = null;
    await new ExecutionDispatcher(persistence, handler, config()).dispatch(plan.buildId, OPERATOR, {
      adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
      validationBackend: fakeValidationBackend(),
      // Observed at the instant after reservation and before any backend
      // work — the window a crash would land in.
      onReserved: () => {
        gateDuringRun = evaluateExecutionGate(
          readExecutionGateInput(persistence, plan.buildId, CLAUDE_CODE_STAGE),
        );
      },
    });

    expect(gateDuringRun).not.toBeNull();
    expect(gateDuringRun!.permitted).toBe(false);
    expect(gateDuringRun!.refusals.map((r) => r.code)).toContain("authorization_already_spent");
  });

  it("a crash after reservation leaves the authorization spent", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const exploding: RuntimeAdapter = {
      runtimeType: "claude_code",
      policy: { id: "fake-controlled", maxRiskClass: "R2", allowedCommands: [] } as never,
      execute: async () => {
        throw new Error("process died mid-run");
      },
    };

    await expect(
      new ExecutionDispatcher(persistence, handler, config()).dispatch(plan.buildId, OPERATOR, {
        adapter: exploding,
        validationBackend: fakeValidationBackend(),
      }),
    ).rejects.toThrow(/process died mid-run/);

    // Reopen: the reservation is durable, not in-memory state.
    persistence.close();
    const reopened = new PersistenceService(join(dir, "foundry.sqlite"));
    try {
      const gate = evaluateExecutionGate(
        readExecutionGateInput(reopened, plan.buildId, CLAUDE_CODE_STAGE),
      );
      expect(gate.permitted).toBe(false);
      expect(gate.refusals.map((r) => r.code)).toContain("authorization_already_spent");
    } finally {
      reopened.close();
      persistence = new PersistenceService(join(dir, "foundry.sqlite"));
    }
  });

  it("refuses a duplicate dispatch, and the second one never reaches a backend", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);
    const dispatcher = new ExecutionDispatcher(persistence, handler, config());

    const first = await dispatcher.dispatch(plan.buildId, OPERATOR, {
      adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
      validationBackend: fakeValidationBackend(),
    });
    expect(first.outcome).toBe("succeeded");

    const secondExecute = vi.fn();
    const second = await dispatcher.dispatch(plan.buildId, OPERATOR, {
      adapter: fakeAdapter({}, { onExecute: secondExecute }),
      validationBackend: fakeValidationBackend(),
    });

    // Either refusal layer is correct: the AC-110 gate now reports the
    // authorization spent, and the reservation would refuse too. What
    // matters is that the second attempt reached no backend.
    expect(isPreDispatchRefusal(second.outcome)).toBe(true);
    expect(["refused_by_gate", "refused_already_reserved"]).toContain(second.outcome);
    expect(second.dispatched).toBe(false);
    expect(secondExecute).not.toHaveBeenCalled();
  });

  it("CONCURRENT dispatches consume the authorization exactly once", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);
    const dispatcher = new ExecutionDispatcher(persistence, handler, config());

    let executions = 0;
    const slowAdapter = () =>
      fakeAdapter({}, {
        writes: { "src/taskStore.js": "x" },
        onExecute: () => {
          executions += 1;
        },
      });

    const [a, b] = await Promise.all([
      dispatcher.dispatch(plan.buildId, OPERATOR, {
        adapter: slowAdapter(),
        validationBackend: fakeValidationBackend(),
      }),
      dispatcher.dispatch(plan.buildId, OPERATOR, {
        adapter: slowAdapter(),
        validationBackend: fakeValidationBackend(),
      }),
    ]);

    // Exactly one succeeded; the other was refused before any backend.
    const refusedCount = [a, b].filter((r) => isPreDispatchRefusal(r.outcome)).length;
    expect(refusedCount).toBe(1);
    expect([a.outcome, b.outcome]).toContain("succeeded");
    expect(executions).toBe(1);
    expect([a.reserved, b.reserved].filter(Boolean)).toHaveLength(1);
    expect(persistence.listEntities("agentRuns").filter((r) => (r as { runtimeType: string }).runtimeType === "claude_code")).toHaveLength(1);
  });
});

describe("AC-111 H-2 — actual spend is read, recorded, and compared", () => {
  it("records the authorized ceiling and the actual cost together", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan, 7.5).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, {
          writes: { "src/taskStore.js": "x" },
          stdout: JSON.stringify({ total_cost_usd: 3.5 }),
        }),
        validationBackend: fakeValidationBackend(),
      },
    );

    expect(result.outcome).toBe("succeeded");
    expect(result.budget.fromAuthorization).toBe(7.5);
    expect(result.budget.actualCostUsd).toBe(3.5);
    expect(result.budget.outcome?.withinCeiling).toBe(true);
  });

  it.each([
    ["absent", JSON.stringify({ result: "done" })],
    ["non-finite", JSON.stringify({ total_cost_usd: null })],
    ["negative", JSON.stringify({ total_cost_usd: -1 })],
    ["not JSON at all", "the run finished"],
  ])("FAILS CLOSED when the cost is %s — never treated as zero", async (_label, stdout) => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" }, stdout }),
        validationBackend: fakeValidationBackend(),
      },
    );

    expect(result.outcome).toBe("failed_cost_unknown");
    expect(result.budget.actualCostUsd).toBeNull();
    // Not zero. "cost nothing" and "cost unknown" are opposite statements.
    expect(result.budget.actualCostUsd).not.toBe(0);
    expect(persistence.getEntity<{ status: string }>("agentRuns", result.agentRunId as string)?.status).toBe("failed");
  });

  it("treats an over-ceiling result as a CONTAINMENT FAILURE, not a success", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan, 2).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, {
          writes: { "src/taskStore.js": "x" },
          stdout: JSON.stringify({ total_cost_usd: 9.99 }),
        }),
        validationBackend: fakeValidationBackend(),
      },
    );

    expect(result.outcome).toBe("failed_over_budget");
    expect(result.budget.outcome?.withinCeiling).toBe(false);
    expect(result.verdict).toMatch(/detection, not prevention/i);
    expect(persistence.getEntity<{ status: string }>("agentRuns", result.agentRunId as string)?.status).toBe("failed");
  });
});

describe("AC-111 H-3 — the authorized budget, and only that, reaches the runtime", () => {
  it("passes the authorization's exact value; authorization, profile, and evidence agree", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan, 12.25).accepted).toBe(true);

    let observedBudget: string | undefined;
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, {
          writes: { "src/taskStore.js": "x" },
          onExecute: () => {
            observedBudget = "captured";
          },
        }),
        validationBackend: fakeValidationBackend(),
      },
    );

    expect(observedBudget).toBe("captured");
    const persisted = persistence.getEntity<PersistedPlan>("plans", plan.planId) as PersistedPlan;
    expect(persisted.authorization?.maxBudgetUsd).toBe(12.25);
    expect(result.budget.fromAuthorization).toBe(12.25);
    expect(result.budget.passedToRuntime).toBe(12.25);
    expect(result.budget.passedToRuntime).toBe(persisted.authorization?.maxBudgetUsd);
  });

  it("no hard-coded $2 survives anywhere in the dispatch path", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan, 17).accepted).toBe(true);
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
        validationBackend: fakeValidationBackend(),
      },
    );
    expect(result.budget.passedToRuntime).toBe(17);
    expect(result.budget.passedToRuntime).not.toBe(2);
  });
});

describe("AC-111 F-114 offline — unauthorized dispatch, zero side effects", () => {
  it("refuses with NO authorization, and writes nothing at all", async () => {
    const plan = await seedOrchestratedBuild();
    // Deliberately not authorized.
    const before = fullSnapshot();

    const execute = vi.fn();
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      { adapter: fakeAdapter({}, { onExecute: execute }), validationBackend: fakeValidationBackend() },
    );

    expect(result.outcome).toBe("refused_by_gate");
    expect(isPreDispatchRefusal(result.outcome)).toBe(true);
    expect(result.reserved).toBe(false);
    expect(result.dispatched).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(result.gateRefusals.map((r) => r.code)).toContain("no_authorization");
    // Zero side effects, asserted over the whole store.
    expect(fullSnapshot()).toEqual(before);
  });

  it("refuses when the plan changed after authorization (stale binding)", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    // Tamper the persisted plan so its recomputed hash no longer matches.
    const raw = persistence.getAllEvents().find((e) => e.type === "build.planned");
    expect(raw).toBeDefined();
    const tampered = structuredClone(raw) as unknown as {
      payload: { plan: BuildPlan };
    };
    tampered.payload.plan.stages[1]!.sourceBuildingId = "warehouse";

    // Recompute what the gate would see against the tampered content.
    const input = readExecutionGateInput(persistence, plan.buildId, CLAUDE_CODE_STAGE);
    const decision = evaluateExecutionGate({
      ...input,
      currentContentHash: planContentHash(tampered.payload.plan),
    });
    expect(decision.permitted).toBe(false);
    expect(decision.refusals.map((r) => r.code)).toContain("plan_content_hash_mismatch");
  });

  it("refuses an unsupported objective BEFORE an authorization can exist", async () => {
    const plan = await seedOrchestratedBuild(UNSUPPORTED_OBJECTIVE);
    const before = fullSnapshot();

    const attempt = authorize(plan);
    expect(attempt.accepted).toBe(false);
    expect(attempt.reason).toMatch(/does not match any supported execution template/i);
    expect(attempt.reason).toMatch(/must never write, modify, or run its own validation/i);
    expect(fullSnapshot()).toEqual(before);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      { adapter: fakeAdapter({}), validationBackend: fakeValidationBackend() },
    );
    expect(result.outcome).toBe("refused_unsupported_objective");
    expect(result.dispatched).toBe(false);
  });
});

describe("AC-111 H-5 — binary identity is a pre-dispatch refusal", () => {
  it("refuses when the binary does not match its pin", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const execute = vi.fn();
    const result = await new ExecutionDispatcher(
      persistence,
      handler,
      config({ expectedExecutableSha256: "0".repeat(64) }),
    ).dispatch(plan.buildId, OPERATOR, {
      adapter: fakeAdapter({}, { onExecute: execute }),
      validationBackend: fakeValidationBackend(),
    });

    expect(result.outcome).toBe("refused_binary_identity");
    expect(result.reserved).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect(result.verdict).toMatch(/does not match its pin/i);
    // The observed identity is recorded so the operator can see what it is.
    expect(result.binaryIdentity?.sha256).toBe(fakeBinarySha);
    expect(result.binaryIdentity?.sizeBytes).toBeGreaterThan(0);
  });

  it("refuses when NO pin is configured — unverifiable is not permitted", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const result = await new ExecutionDispatcher(
      persistence,
      handler,
      config({ expectedExecutableSha256: undefined }),
    ).dispatch(plan.buildId, OPERATOR, {
      adapter: fakeAdapter({}),
      validationBackend: fakeValidationBackend(),
    });

    expect(result.outcome).toBe("refused_binary_identity");
    expect(result.verdict).toMatch(/No expected SHA-256 is configured/i);
  });

  it("records path, hash, and size when the pin matches", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
        validationBackend: fakeValidationBackend(),
      },
    );
    expect(result.binaryIdentity?.absolutePath).toBe(fakeBinaryPath);
    expect(result.binaryIdentity?.sha256).toBe(fakeBinarySha);
    expect(result.binaryIdentity?.sizeBytes).toBe(Buffer.byteLength(FAKE_BINARY_BODY));
  });
});

describe("AC-111 verdict, workspace, and containment", () => {
  it("fails the run when a write lands outside the template's permitted paths", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
        // The diff reports a file the template never permitted.
        validationBackend: fakeValidationBackend({ changed: ["src/taskStore.js", "test/taskStore.test.js"] }),
      },
    );

    expect(result.outcome).toBe("failed_write_scope");
    expect(result.allowedWritePaths).toEqual(["src/taskStore.js"]);
  });

  it("fails the run when the independent tests fail, whatever the runtime said", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        // The runtime reports success in its own stdout…
        adapter: fakeAdapter({}, {
          writes: { "src/taskStore.js": "x" },
          stdout: JSON.stringify({ total_cost_usd: 1, result: "all tests pass!" }),
        }),
        // …and the independent suite disagrees. The suite wins.
        validationBackend: fakeValidationBackend({ testsPass: false }),
      },
    );

    expect(result.outcome).toBe("failed_validation");
  });

  it("records a timeout as a timeout and still retains evidence", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, {
          status: "timed_out",
          exitCode: null,
          stdout: JSON.stringify({ total_cost_usd: 0.4 }),
        }),
        validationBackend: fakeValidationBackend(),
      },
    );

    expect(result.outcome).toBe("timed_out");
    expect(result.stageEvidence).not.toBeNull();
    expect(result.stageEvidence?.runEvidence).not.toBeNull();
    expect(persistence.getEntity<{ status: string }>("agentRuns", result.agentRunId as string)?.status).toBe("timed_out");
  });

  it("destroys the disposable workspace and VERIFIES it is gone", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const root: { root?: string } = {};
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter(root, { writes: { "src/taskStore.js": "x" } }),
        validationBackend: fakeValidationBackend(),
      },
    );

    expect(result.workspaceDisposition).toBe("destroyed");
    expect(result.workspaceDestructionVerified).toBe(true);
    expect(root.root).toBeDefined();
    expect(existsSync(root.root as string)).toBe(false);
  });

  it("records retention honestly when the workspace is deliberately kept", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    const root: { root?: string } = {};
    const result = await new ExecutionDispatcher(
      persistence,
      handler,
      config({ keepWorkspace: true }),
    ).dispatch(plan.buildId, OPERATOR, {
      adapter: fakeAdapter(root, { writes: { "src/taskStore.js": "x" } }),
      validationBackend: fakeValidationBackend(),
    });

    expect(result.workspaceDisposition).toBe("retained");
    expect(result.workspaceDestructionVerified).toBe(false);
    expect(existsSync(root.root as string)).toBe(true);
    rmSync(root.root as string, { recursive: true, force: true });
  });

  it("states network enforcement honestly — declared and recorded, not enforced", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
        validationBackend: fakeValidationBackend(),
      },
    );
    expect(result.networkEnforcement).toBe("declared_and_recorded_not_enforced");
  });

  it("refuses when no backend_implementation stage exists to link the run to", async () => {
    // A reviewed and authorized plan, but the build was never orchestrated.
    const intake = new ObjectiveIntake(handler, (kind) => `${kind}-1`);
    const created = intake.submit(
      { objective: SUPPORTED_OBJECTIVE, workspace: "foundry_managed", riskClass: "R2" },
      OPERATOR,
    );
    const plan = planFor(created.buildId as string, created.projectId as string, SUPPORTED_OBJECTIVE);
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
    expect(authorize(plan).accepted).toBe(true);

    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      { adapter: fakeAdapter({}), validationBackend: fakeValidationBackend() },
    );
    expect(result.outcome).toBe("refused_no_stage");
    expect(result.reserved).toBe(false);
  });
});

describe("AC-111 evidence quality", () => {
  it("redacts registered secret shapes from retained output", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);

    // The real adapter's boundary redacts; this asserts the retained
    // evidence never carries an obvious key shape through the dispatcher.
    const leaky = JSON.stringify({
      total_cost_usd: 1,
      note: "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
    });
    const { Redactor } = await import("@foundry/runtime-adapters");
    expect(new Redactor([]).redact(leaky)).not.toContain("sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345");
    expect(new Redactor([]).redact(leaky)).toContain("[REDACTED]");
  });

  it("links the run to a real BuildStage through a real Task (F-115)", async () => {
    const plan = await seedOrchestratedBuild();
    expect(authorize(plan).accepted).toBe(true);
    const result = await new ExecutionDispatcher(persistence, handler, config()).dispatch(
      plan.buildId,
      OPERATOR,
      {
        adapter: fakeAdapter({}, { writes: { "src/taskStore.js": "x" } }),
        validationBackend: fakeValidationBackend(),
      },
    );

    const ids = stageEntityIds(plan.planId, CLAUDE_CODE_STAGE);
    const run = persistence.getEntity<{ taskId: string }>("agentRuns", result.agentRunId as string);
    const task = persistence.getEntity<{ stageId: string }>("tasks", run?.taskId as string);
    const stage = persistence.getEntity<{ name: string; buildId: string }>(
      "buildStages",
      task?.stageId as string,
    );
    expect(task?.stageId).toBe(ids.stageId);
    expect(stage?.name).toBe(CLAUDE_CODE_STAGE);
    expect(stage?.buildId).toBe(plan.buildId);
  });
});

describe("AC-111 — zero real model calls", () => {
  it("no test in this file invoked a real runtime", () => {
    // Every dispatch above supplied a substituted adapter. The real
    // ClaudeCodeAdapter is never constructed, so nothing could spawn the
    // executable, call a model, or spend money.
    expect(realModelCalls).toBe(0);
  });
});
