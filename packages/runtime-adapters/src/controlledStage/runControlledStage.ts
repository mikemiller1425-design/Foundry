import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { ClaudeCodeAdapter, type ClaudeCodeProfile } from "../adapters/claudeCodeAdapter";
import type { ExecutionBackend } from "../boundary";
import type { RunEvidence, RunResult, RuntimeAdapter } from "../types";
import type { Fixture } from "./fixture";
import {
  establishBaseline,
  runIndependentTests,
  verifyWriteScope,
  type TestValidationResult,
  type ValidationProfile,
  type WriteScopeResult,
} from "./validation";

/**
 * Orchestration for the one controlled Claude Code stage (FBL-028, F-12).
 *
 * The ordering here is the substance of the rung:
 *
 * 1. Refuse the run outright if this `AgentRun` already exists.
 * 2. Snapshot the fixture and commit a baseline.
 * 3. Execute the stage through the adapter — the only step involving a
 *    real external runtime.
 * 4. Snapshot again, diff against the baseline, and reject anything
 *    written outside the permitted paths.
 * 5. Run the pre-written tests.
 * 6. Decide success from steps 4 and 5 **only**.
 *
 * Step 6 is the point of the whole design. The stage's own stdout is
 * captured as evidence and is never consulted as a verdict.
 */

export interface FileManifestEntry {
  path: string;
  sizeBytes: number;
  sha256: string;
}

/** Hashes every file in the fixture, so "before" and "after" are facts. */
export function fileManifest(root: string): FileManifestEntry[] {
  const entries: FileManifestEntry[] = [];

  const walk = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      // The git database changes on every command and says nothing about
      // what the stage wrote.
      if (name === ".git") continue;
      const full = path.join(directory, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      const contents = readFileSync(full);
      entries.push({
        path: path.relative(root, full),
        sizeBytes: contents.byteLength,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  };

  walk(root);
  return entries;
}

export type ControlledStageOutcome =
  | "succeeded"
  | "failed_validation"
  | "failed_write_scope"
  | "failed_execution"
  | "denied"
  | "timed_out"
  | "duplicate_refused";

export interface ControlledStageEvidence {
  agentRunId: string;
  outcome: ControlledStageOutcome;
  /** Why the run was judged as it was, in one operator-readable line. */
  verdict: string;
  fixtureRoot: string;
  allowedWritePaths: readonly string[];
  taskSpecification: string;
  policyId: string;
  riskClass: string;
  commandLine: readonly string[];
  filesBefore: FileManifestEntry[];
  filesAfter: FileManifestEntry[];
  runEvidence: RunEvidence | null;
  baselineEvidence: RunEvidence | null;
  writeScope: WriteScopeResult | null;
  tests: TestValidationResult | null;
  startedAt: string;
  completedAt: string;
}

export interface ControlledStageRequest {
  agentRunId: string;
  agentId: string;
  taskId: string;
  fixture: Fixture;
  claudeProfile: ClaudeCodeProfile;
  validationProfile: ValidationProfile;
}

export interface ControlledStageOptions {
  /** Adapter override; defaults to a real `ClaudeCodeAdapter`. */
  adapter?: RuntimeAdapter;
  /** Backend used for the validation commands. */
  validationBackend?: ExecutionBackend;
  environmentSource?: Record<string, string | undefined>;
  /**
   * Duplicate-run guard. Returns true when this `AgentRun` id has
   * already been started. Backed by the persisted event log in real
   * use, so a resubmitted request cannot produce a second execution.
   */
  hasExistingRun?: (agentRunId: string) => boolean;
  signal?: AbortSignal;
  now?: () => Date;
}

export async function runControlledStage(
  request: ControlledStageRequest,
  options: ControlledStageOptions = {},
): Promise<ControlledStageEvidence> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const { fixture, claudeProfile, validationProfile } = request;

  const adapter =
    options.adapter ??
    new ClaudeCodeAdapter(claudeProfile, {
      environmentSource: options.environmentSource,
    });

  const base = {
    agentRunId: request.agentRunId,
    fixtureRoot: fixture.root,
    allowedWritePaths: fixture.allowedWritePaths,
    taskSpecification: fixture.taskSpecification,
    policyId: adapter.policy.id,
    riskClass: adapter.policy.maxRiskClass,
    commandLine: [
      claudeProfile.executablePath,
      ...adapter.policy.allowedCommands.flatMap((rule) =>
        rule.args.map((arg) => (arg.kind === "literal" ? arg.value : `<${arg.kind}>`)),
      ),
    ],
    startedAt,
  };

  // 1. Duplicate guard, before anything is executed or written.
  if (options.hasExistingRun?.(request.agentRunId)) {
    return {
      ...base,
      outcome: "duplicate_refused",
      verdict: `AgentRun ${request.agentRunId} already exists; a resubmitted request never starts a second execution.`,
      filesBefore: [],
      filesAfter: [],
      runEvidence: null,
      baselineEvidence: null,
      writeScope: null,
      tests: null,
      completedAt: now().toISOString(),
    };
  }

  // 2. Baseline.
  const baseline = await establishBaseline(validationProfile, {
    backend: options.validationBackend,
    environmentSource: {},
  });
  const filesBefore = fileManifest(fixture.root);

  if (baseline.status !== "completed") {
    return {
      ...base,
      outcome: "failed_execution",
      verdict: `Could not establish a baseline commit (${baseline.status}); the run was not started.`,
      filesBefore,
      filesAfter: filesBefore,
      runEvidence: null,
      baselineEvidence: baseline.evidence,
      writeScope: null,
      tests: null,
      completedAt: now().toISOString(),
    };
  }

  // 3. The controlled execution.
  const run: RunResult = await adapter.execute(
    {
      agentRunId: request.agentRunId,
      agentId: request.agentId,
      taskId: request.taskId,
      riskClass: "R2",
      workingDirectory: fixture.root,
      commands: [],
      taskSpecification: fixture.taskSpecification,
    },
    options.signal,
  );

  // 4. What actually changed on disk.
  const filesAfter = fileManifest(fixture.root);
  const writeScope = await verifyWriteScope(validationProfile, fixture.allowedWritePaths, {
    backend: options.validationBackend,
    environmentSource: {},
  });

  // 5. Independent correctness.
  const tests = await runIndependentTests(validationProfile, {
    backend: options.validationBackend,
    environmentSource: {},
  });

  // 6. The verdict, derived only from steps 4 and 5 plus the process's
  //    own exit status — never from what the stage said it did.
  const completedAt = now().toISOString();
  const common = {
    ...base,
    filesBefore,
    filesAfter,
    runEvidence: run.evidence,
    baselineEvidence: baseline.evidence,
    writeScope,
    tests,
    completedAt,
  };

  if (run.status === "denied") {
    return {
      ...common,
      outcome: "denied",
      verdict: `Policy refused the run: ${run.denials.map((d) => d.code).join(", ")}.`,
    };
  }

  if (run.status === "timed_out") {
    return {
      ...common,
      outcome: "timed_out",
      verdict:
        "The run exceeded its timeout; the process tree was terminated and evidence retained.",
    };
  }

  // Write scope is checked before the exit code, because an escape
  // matters whether or not the run reported success.
  if (!writeScope.withinScope) {
    return {
      ...common,
      outcome: "failed_write_scope",
      verdict: `The stage modified paths it was not permitted to touch: ${writeScope.unauthorizedPaths.join(", ")}.`,
    };
  }

  if (run.status !== "completed") {
    return {
      ...common,
      outcome: "failed_execution",
      verdict: `The runtime exited non-zero (exit ${String(run.exitCode)}).`,
    };
  }

  if (!tests.passed) {
    return {
      ...common,
      outcome: "failed_validation",
      verdict: `Independent tests failed (exit ${String(tests.exitCode)}), regardless of what the run reported.`,
    };
  }

  return {
    ...common,
    outcome: "succeeded",
    verdict:
      "Independent tests passed and every change was inside the permitted paths. Success determined by Foundry's own validation, not by the runtime's self-report.",
  };
}
