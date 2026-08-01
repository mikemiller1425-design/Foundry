import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ClaudeCodeAdapter, type ClaudeCodeProfile } from "../adapters/claudeCodeAdapter";
import type { ExecutionBackend } from "../boundary";
import { allow } from "../denial";
import type { SpawnOutcome, SpawnParameters } from "../execution/processRunner";
import { resolveExecutable } from "../execution/executable";
import { defineRuntimePolicy } from "../policy";
import { createFixtureRepository, type Fixture } from "./fixture";
import { runControlledStage } from "./runControlledStage";
import { parsePorcelain, type ValidationProfile } from "./validation";

/**
 * F-12 integration coverage.
 *
 * These tests exercise the *complete* controlled-stage mechanism —
 * baseline, execution, write-scope verification, independent tests,
 * verdict — with real `git` and real `node --test`. Only the Claude Code
 * process itself is substituted, so the suite is deterministic, free,
 * and offline while still proving every containment and validation path
 * the real run depends on.
 *
 * The real run is performed separately by
 * `apps/api/src/fbl028/runControlledStage.ts` (`pnpm --filter @foundry/api
 * fbl-028`) and its evidence is reviewed by the operator.
 */

const GIT = "/usr/bin/git";

/** A correct implementation, used to simulate a stage that succeeds. */
const CORRECT_IMPLEMENTATION = `let counter = 0;

function nextId() {
  counter += 1;
  return \`task-\${Date.now().toString(36)}-\${counter}\`;
}

export function createTaskStore(initialTasks = []) {
  const tasks = initialTasks.map((task) => ({ ...task }));

  return {
    addTask(title) {
      if (typeof title !== "string" || title.trim() === "") {
        throw new Error("title is required");
      }
      const task = {
        id: nextId(),
        title: title.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      tasks.push(task);
      return task;
    },
    completeTask(id) {
      const task = tasks.find((candidate) => candidate.id === id);
      if (!task) throw new Error("task not found: " + id);
      task.completed = true;
      return task;
    },
    deleteTask(id) {
      const index = tasks.findIndex((candidate) => candidate.id === id);
      if (index === -1) throw new Error("task not found: " + id);
      tasks.splice(index, 1);
      return true;
    },
    listTasks() {
      return [...tasks];
    },
    toJSON() {
      return tasks.map((task) => ({ ...task }));
    },
  };
}
`;

describe("controlled stage (F-12)", () => {
  let fixtures: string[] = [];

  const claudeProfile = (root: string): ClaudeCodeProfile => ({
    repositoryRoot: root,
    executablePath: "/usr/bin/true",
    model: "sonnet",
    timeoutMs: 30_000,
    maxStdoutBytes: 256 * 1024,
    maxStderrBytes: 256 * 1024,
    maxEvidenceBytes: 2 * 1024 * 1024,
    maxBudgetUsd: 2,
    allowedEnvironmentVariables: ["HOME", "USER"],
  });

  const validationProfile = (root: string): ValidationProfile => ({
    repositoryRoot: root,
    gitExecutablePath: GIT,
    nodeExecutablePath: process.execPath,
    timeoutMs: 60_000,
    maxStdoutBytes: 512 * 1024,
    maxStderrBytes: 512 * 1024,
    maxEvidenceBytes: 2 * 1024 * 1024,
  });

  /**
   * Stands in for the Claude Code process: writes files the way a real
   * run would, then exits. Everything around it — policy, containment,
   * git, the test runner, the verdict — is real.
   */
  const stageBackend = (
    writes: Record<string, string>,
    outcome: Partial<SpawnOutcome> = {},
  ): ExecutionBackend => ({
    resolveExecutable: (_policy, executable) => allow(executable),
    run(parameters: SpawnParameters): Promise<SpawnOutcome> {
      for (const [relative, contents] of Object.entries(writes)) {
        writeFileSync(path.join(parameters.cwd, relative), contents, "utf8");
      }
      return Promise.resolve({
        exitCode: 0,
        signal: null,
        timedOut: false,
        durationMs: 5,
        output: {
          stdout: '{"result":"done"}',
          stderr: "",
          stdoutTruncated: false,
          stderrTruncated: false,
          stdoutBytes: 17,
          stderrBytes: 0,
        },
        ...outcome,
      });
    },
  });

  const newFixture = (): Fixture => {
    const fixture = createFixtureRepository();
    fixtures.push(fixture.root);
    return fixture;
  };

  const stageRequest = (fixture: Fixture) => ({
    agentRunId: "agentrun-fbl-028",
    agentId: "agent-builder",
    taskId: "task-backend-implementation",
    fixture,
    claudeProfile: claudeProfile(fixture.root),
    validationProfile: validationProfile(fixture.root),
  });

  beforeAll(() => {
    expect(existsSync(GIT)).toBe(true);
  });

  afterEach(() => {
    for (const root of fixtures) rmSync(root, { recursive: true, force: true });
    fixtures = [];
  });

  it("succeeds end-to-end, writing only allowed files and passing independent tests", async () => {
    const fixture = newFixture();
    const evidence = await runControlledStage(stageRequest(fixture), {
      adapter: new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: stageBackend({ "src/taskStore.js": CORRECT_IMPLEMENTATION }),
        environmentSource: { HOME: "/tmp", USER: "test" },
      }),
    });

    expect(evidence.outcome).toBe("succeeded");

    // Only the permitted path changed.
    expect(evidence.writeScope?.changedPaths).toEqual(["src/taskStore.js"]);
    expect(evidence.writeScope?.unauthorizedPaths).toEqual([]);

    // The captured diff is the repository's own, not a report about it.
    expect(evidence.writeScope?.diff).toContain("src/taskStore.js");
    expect(evidence.writeScope?.diff).toContain("not implemented");
    expect(evidence.writeScope?.diff).toContain("title is required");

    // Independent tests decided the verdict.
    expect(evidence.tests?.passed).toBe(true);
    expect(evidence.tests?.exitCode).toBe(0);
    // All twelve pre-written assertions ran and none failed.
    expect(evidence.tests?.stdout).toMatch(/pass 12/);
    expect(evidence.tests?.stdout).toMatch(/fail 0/);

    // Exit status and output are recorded.
    expect(evidence.runEvidence?.commands[0]?.exitCode).toBe(0);
    expect(evidence.runEvidence?.commands[0]?.output.stdout).toBe('{"result":"done"}');

    // Before/after manifests differ exactly where expected.
    const before = new Map(evidence.filesBefore.map((entry) => [entry.path, entry.sha256]));
    const after = new Map(evidence.filesAfter.map((entry) => [entry.path, entry.sha256]));
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    const changed = [...after]
      .filter(([key, hash]) => before.get(key) !== hash)
      .map(([key]) => key);
    expect(changed).toEqual(["src/taskStore.js"]);
  }, 120_000);

  it("fails validation when the stage writes something that does not work", async () => {
    const fixture = newFixture();
    const evidence = await runControlledStage(stageRequest(fixture), {
      adapter: new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: stageBackend({
          "src/taskStore.js": "export function createTaskStore() { return {}; }\n",
        }),
        environmentSource: { HOME: "/tmp", USER: "test" },
      }),
    });

    // The stage exited 0 and reported success. It does not get a vote.
    expect(evidence.runEvidence?.commands[0]?.exitCode).toBe(0);
    expect(evidence.outcome).toBe("failed_validation");
    expect(evidence.tests?.passed).toBe(false);
    expect(evidence.verdict).toContain("regardless of what the run reported");
    // Evidence is retained for the failed run.
    expect(evidence.tests?.stdout.length).toBeGreaterThan(0);
    expect(evidence.runEvidence).not.toBeNull();
  }, 120_000);

  it("rejects a run that writes outside its permitted paths", async () => {
    const fixture = newFixture();
    const evidence = await runControlledStage(stageRequest(fixture), {
      adapter: new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: stageBackend({
          "src/taskStore.js": CORRECT_IMPLEMENTATION,
          // Rewriting the tests is the classic way to "pass" them.
          "test/taskStore.test.js": "import { test } from 'node:test';\ntest('ok', () => {});\n",
        }),
        environmentSource: { HOME: "/tmp", USER: "test" },
      }),
    });

    expect(evidence.outcome).toBe("failed_write_scope");
    expect(evidence.writeScope?.unauthorizedPaths).toEqual(["test/taskStore.test.js"]);
    // Write-scope failure is decided before the tests are allowed to matter.
    expect(evidence.verdict).toContain("not permitted to touch");
  }, 120_000);

  it("captures the contents of a file the stage newly created, not just its name", async () => {
    // A plain `git diff HEAD` shows nothing for an untracked file, so a
    // rogue *new* file would be detected by status while its contents
    // went missing from the evidence. Staging before diffing is what
    // closes that gap, and this test is what keeps it closed.
    const fixture = newFixture();
    const evidence = await runControlledStage(stageRequest(fixture), {
      adapter: new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: stageBackend({
          "src/taskStore.js": CORRECT_IMPLEMENTATION,
          "src/rogue.js": "export const smuggled = 'this must appear in the diff';\n",
        }),
        environmentSource: { HOME: "/tmp", USER: "test" },
      }),
    });

    expect(evidence.outcome).toBe("failed_write_scope");
    expect(evidence.writeScope?.unauthorizedPaths).toEqual(["src/rogue.js"]);
    expect(evidence.writeScope?.diff).toContain("src/rogue.js");
    expect(evidence.writeScope?.diff).toContain("this must appear in the diff");
  }, 120_000);

  it("records a timed-out run as timed out and keeps its logs", async () => {
    const fixture = newFixture();
    const evidence = await runControlledStage(stageRequest(fixture), {
      adapter: new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: stageBackend(
          {},
          {
            exitCode: null,
            signal: "SIGKILL",
            timedOut: true,
            output: {
              stdout: "partial work before the timeout",
              stderr: "",
              stdoutTruncated: false,
              stderrTruncated: false,
              stdoutBytes: 31,
              stderrBytes: 0,
            },
          },
        ),
        environmentSource: { HOME: "/tmp", USER: "test" },
      }),
    });

    expect(evidence.outcome).toBe("timed_out");
    expect(evidence.runEvidence?.status).toBe("timed_out");
    expect(evidence.runEvidence?.commands[0]?.output.stdout).toContain("partial work");
  }, 120_000);

  it("refuses a duplicate execution request without running anything", async () => {
    const fixture = newFixture();
    let executions = 0;

    const evidence = await runControlledStage(stageRequest(fixture), {
      hasExistingRun: () => true,
      adapter: new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: {
          resolveExecutable: (_policy, executable) => allow(executable),
          run: () => {
            executions += 1;
            throw new Error("a duplicate request must never reach execution");
          },
        },
        environmentSource: { HOME: "/tmp", USER: "test" },
      }),
    });

    expect(evidence.outcome).toBe("duplicate_refused");
    expect(executions).toBe(0);
    expect(evidence.runEvidence).toBeNull();
    // The fixture is untouched: no baseline commit, no git directory.
    expect(existsSync(path.join(fixture.root, ".git"))).toBe(false);
    expect(readFileSync(path.join(fixture.root, "src", "taskStore.js"), "utf8")).toContain(
      "not implemented",
    );
  }, 120_000);

  describe("policy containment of the real command line", () => {
    const policyFor = (root: string) => new ClaudeCodeAdapter(claudeProfile(root)).policy;

    it("permits exactly one executable and one argument vector", () => {
      const fixture = newFixture();
      const policy = policyFor(fixture.root);
      expect(policy.allowedCommands).toHaveLength(1);
      expect(policy.allowedCommands[0]?.executable).toBe("/usr/bin/true");
      expect(policy.allowedCommands[0]?.args.every((arg) => arg.kind === "literal")).toBe(true);
    });

    it("grants file tools only — no Bash, no network tools, no subagents", () => {
      const fixture = newFixture();
      const tools = policyFor(fixture.root)
        .allowedCommands[0]?.args.map((arg) => (arg.kind === "literal" ? arg.value : ""))
        .find((value) => value.includes("Read"));

      expect(tools).toBe("Read,Write,Edit,Glob,Grep");
      for (const forbidden of ["Bash", "WebFetch", "WebSearch", "Task"]) {
        expect(tools).not.toContain(forbidden);
      }
    });

    it("locks out project settings, MCP servers, and skills", () => {
      const fixture = newFixture();
      const args = policyFor(fixture.root).allowedCommands[0]?.args.map((arg) =>
        arg.kind === "literal" ? arg.value : "",
      );
      expect(args).toContain("--safe-mode");
      expect(args).toContain("--strict-mcp-config");
      expect(args).toContain("--disable-slash-commands");
      expect(args).toContain("--no-session-persistence");
      expect(args).not.toContain("--dangerously-skip-permissions");
      expect(args).not.toContain("--allow-dangerously-skip-permissions");
      expect(args).not.toContain("--add-dir");
    });

    it("caps risk at R2 and bounds spend", () => {
      const fixture = newFixture();
      const policy = policyFor(fixture.root);
      expect(policy.maxRiskClass).toBe("R2");
      const args = policy.allowedCommands[0]?.args.map((arg) =>
        arg.kind === "literal" ? arg.value : "",
      );
      expect(args).toContain("--max-budget-usd");
    });

    it("declares the fixture as its only root and admits only HOME and USER", () => {
      const fixture = newFixture();
      const policy = policyFor(fixture.root);
      expect(policy.workingDirectoryRoots).toEqual([fixture.root]);
      expect(policy.allowedEnvironmentVariables).toEqual(["HOME", "USER"]);
    });

    it("cannot resolve any executable outside its declared search path", () => {
      const fixture = newFixture();
      const policy = policyFor(fixture.root);
      // The search path is empty: only the absolute path in the
      // allowlist can ever be spawned.
      expect(policy.executableSearchPath).toEqual([]);
      expect(resolveExecutable(policy, "git").allowed).toBe(false);
      expect(resolveExecutable(policy, "claude").allowed).toBe(false);
    });

    it("denies a working directory outside the fixture", async () => {
      const fixture = newFixture();
      const other = newFixture();
      const adapter = new ClaudeCodeAdapter(claudeProfile(fixture.root), {
        backend: stageBackend({}),
        environmentSource: { HOME: "/tmp", USER: "test" },
      });

      // The adapter pins cwd to the fixture, so an attempt to redirect it
      // is ignored rather than honoured — assert the run still executed
      // inside the fixture.
      const result = await adapter.execute({
        agentRunId: "r",
        agentId: "a",
        taskId: "t",
        riskClass: "R2",
        workingDirectory: other.root,
        commands: [],
        taskSpecification: "x",
      });

      expect(result.evidence.canonicalWorkingDirectory).not.toContain(path.basename(other.root));
    });
  });

  describe("validation policy containment", () => {
    it("denies commands that are not part of validation", async () => {
      const fixture = newFixture();
      const { buildValidationPolicy } = await import("./validation");
      const policy = buildValidationPolicy(validationProfile(fixture.root));

      const executables = policy.allowedCommands.map((rule) => rule.executable);
      expect(new Set(executables)).toEqual(new Set([GIT, process.execPath]));

      // No push, no fetch, no remote — reading the diff never implies
      // the ability to publish it.
      const gitVectors = policy.allowedCommands
        .filter((rule) => rule.executable === GIT)
        .map((rule) => rule.args.map((arg) => (arg.kind === "literal" ? arg.value : "")).join(" "));
      for (const forbidden of ["push", "remote", "fetch", "clone"]) {
        expect(gitVectors.some((vector) => vector.includes(forbidden))).toBe(false);
      }
    });

    it("runs validation with no network permitted and no environment", async () => {
      const fixture = newFixture();
      const { buildValidationPolicy } = await import("./validation");
      const policy = buildValidationPolicy(validationProfile(fixture.root));
      expect(policy.allowNetwork).toBe(false);
      expect(policy.allowedEnvironmentVariables).toEqual([]);
      expect(policy.maxRiskClass).toBe("R1");
    });

    it("rejects a policy that tries to permit R3 or above", () => {
      expect(() =>
        defineRuntimePolicy({
          id: "bad",
          workingDirectoryRoots: ["/tmp"],
          maxRiskClass: "R4",
          limits: {
            timeoutMs: 1000,
            maxStdoutBytes: 1,
            maxStderrBytes: 1,
            maxEvidenceBytes: 1,
          },
        }),
      ).toThrow();
    });
  });

  describe("porcelain parsing", () => {
    it("reads modified, added, deleted, and untracked entries", () => {
      expect(
        parsePorcelain(" M src/taskStore.js\nA  src/new.js\n D removed.js\n?? untracked.js\n"),
      ).toEqual(["src/taskStore.js", "src/new.js", "removed.js", "untracked.js"]);
    });

    it("reads the destination of a rename", () => {
      expect(parsePorcelain('R  "old name.js" -> "new name.js"\n')).toEqual(["new name.js"]);
    });

    it("returns nothing for a clean tree", () => {
      expect(parsePorcelain("")).toEqual([]);
    });
  });
});
