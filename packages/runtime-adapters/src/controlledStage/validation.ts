import { PolicyBoundary, processExecutionBackend, type ExecutionBackend } from "../boundary";
import { defineRuntimePolicy, type RuntimePolicy } from "../policy";
import type { CommandExecutionRecord, RunRequest, RunResult } from "../types";

/**
 * Independent validation of a controlled stage (FBL-028).
 *
 * Two things are checked, and neither consults the runtime's own claim
 * about how the run went:
 *
 * 1. **Write scope** — `git status --porcelain` against a baseline
 *    commit made *before* the stage ran. Any path outside the allowed
 *    set is a failed run, whatever the runtime reported.
 * 2. **Correctness** — the pre-written test suite, executed by Foundry.
 *    The stage had no shell, so it could neither run these tests nor
 *    fake their result.
 *
 * Validation commands run through the *same* `PolicyBoundary` as the
 * stage itself, under their own narrower policy. Foundry's own
 * verification steps are not exempt from containment — an escape in a
 * validation command would be just as much an escape.
 */

/** Identity used for the baseline commit; never a real user's. */
const COMMIT_IDENTITY = [
  "-c",
  "user.name=Foundry FBL-028",
  "-c",
  "user.email=fbl-028@foundry.invalid",
  "-c",
  "commit.gpgsign=false",
] as const;

const literals = (values: readonly string[]) =>
  values.map((value) => ({ kind: "literal" as const, value }));

/**
 * The exact test file Foundry runs. Named explicitly rather than passed
 * as a directory or a glob: a glob would need wildcard characters the
 * argument allowlist refuses, and naming the file keeps the validation
 * command a fixed literal vector like every other command here.
 */
export const TEST_TARGET = "test/taskStore.test.js";

export interface ValidationProfile {
  repositoryRoot: string;
  gitExecutablePath: string;
  nodeExecutablePath: string;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  maxEvidenceBytes: number;
  /** Defaults to `TEST_TARGET`. */
  testTarget?: string;
}

/**
 * The validation policy. Note what is *not* here: no `claude`, no
 * network tool, no `rm`, no shell. Each permitted `git` invocation is
 * its own rule, so "may read the diff" never implies "may push".
 */
export function buildValidationPolicy(profile: ValidationProfile): RuntimePolicy {
  const git = (args: readonly string[]) => ({
    executable: profile.gitExecutablePath,
    args: literals(args),
    maxArgs: args.length,
  });

  return defineRuntimePolicy({
    id: "fbl-028-independent-validation",
    workingDirectoryRoots: [profile.repositoryRoot],
    // Reading state and running a test suite: reversible internal action.
    maxRiskClass: "R1",
    allowedEnvironmentVariables: [],
    allowNetwork: false,
    executableSearchPath: [],
    limits: {
      timeoutMs: profile.timeoutMs,
      maxStdoutBytes: profile.maxStdoutBytes,
      maxStderrBytes: profile.maxStderrBytes,
      maxEvidenceBytes: profile.maxEvidenceBytes,
      killGraceMs: 2_000,
    },
    allowedCommands: [
      git(["init", "--quiet"]),
      git(["add", "-A"]),
      git([...COMMIT_IDENTITY, "commit", "--quiet", "-m", "baseline"]),
      git(["status", "--porcelain"]),
      // `--cached` after staging, rather than a plain `git diff HEAD`:
      // an unstaged diff shows nothing for a file the stage *created*,
      // so a run that added a rogue file would be detected by status but
      // its contents would be missing from the evidence.
      git(["diff", "--cached", "HEAD"]),
      git(["rev-parse", "HEAD"]),
      // `node --test <file>` runs the pre-written suite. No arbitrary
      // script argument is permitted — only this exact vector.
      {
        executable: profile.nodeExecutablePath,
        args: literals(["--test", profile.testTarget ?? TEST_TARGET]),
        maxArgs: 2,
      },
    ],
  });
}

function boundaryFor(
  profile: ValidationProfile,
  backend: ExecutionBackend,
  environmentSource: Record<string, string | undefined>,
): PolicyBoundary {
  return new PolicyBoundary(buildValidationPolicy(profile), {
    runtimeType: "mock",
    backend,
    environmentSource,
  });
}

export interface ValidationOptions {
  backend?: ExecutionBackend;
  environmentSource?: Record<string, string | undefined>;
}

const identity = (profile: ValidationProfile, args: readonly string[]) => ({
  executable: profile.gitExecutablePath,
  args,
});

function request(
  profile: ValidationProfile,
  commands: RunRequest["commands"],
  agentRunId: string,
): RunRequest {
  return {
    agentRunId,
    agentId: "foundry-validator",
    taskId: "fbl-028-validation",
    riskClass: "R1",
    workingDirectory: profile.repositoryRoot,
    commands,
  };
}

/**
 * Initializes the fixture repository and commits its pristine state, so
 * every later change is attributable to the controlled stage and to
 * nothing else.
 */
export async function establishBaseline(
  profile: ValidationProfile,
  options: ValidationOptions = {},
): Promise<RunResult> {
  const boundary = boundaryFor(
    profile,
    options.backend ?? processExecutionBackend,
    options.environmentSource ?? {},
  );
  return boundary.execute(
    request(
      profile,
      [
        identity(profile, ["init", "--quiet"]),
        identity(profile, ["add", "-A"]),
        identity(profile, [...COMMIT_IDENTITY, "commit", "--quiet", "-m", "baseline"]),
      ],
      "fbl-028-baseline",
    ),
  );
}

export interface WriteScopeResult {
  /** Paths reported as changed by git, relative to the repository root. */
  changedPaths: string[];
  /** Changed paths that the stage was not permitted to touch. */
  unauthorizedPaths: string[];
  withinScope: boolean;
  /** Full unified diff against the baseline commit. */
  diff: string;
  commands: readonly CommandExecutionRecord[];
}

/** Parses `git status --porcelain`, including its rename (`->`) form. */
export function parsePorcelain(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .map((line) => {
      const pathPart = line.slice(3);
      const renameIndex = pathPart.indexOf(" -> ");
      return renameIndex === -1 ? pathPart : pathPart.slice(renameIndex + 4);
    })
    .map((value) => value.replace(/^"(.*)"$/, "$1"));
}

/**
 * Determines what the controlled stage actually changed on disk.
 *
 * This is the check that makes the run's success independent of the
 * runtime's report: the diff is read from the repository, not from
 * anything the stage said about itself.
 */
export async function verifyWriteScope(
  profile: ValidationProfile,
  allowedWritePaths: readonly string[],
  options: ValidationOptions = {},
): Promise<WriteScopeResult> {
  const boundary = boundaryFor(
    profile,
    options.backend ?? processExecutionBackend,
    options.environmentSource ?? {},
  );

  // Order matters: read the working-tree status *before* staging, then
  // stage so that newly created files appear in the diff with their
  // contents. The fixture is disposable, so mutating its index costs
  // nothing and buys complete evidence.
  const result = await boundary.execute(
    request(
      profile,
      [
        identity(profile, ["status", "--porcelain"]),
        identity(profile, ["add", "-A"]),
        identity(profile, ["diff", "--cached", "HEAD"]),
      ],
      "fbl-028-write-scope",
    ),
  );

  const [status, _staged, diff] = result.evidence.commands;
  const changedPaths = parsePorcelain(status?.output.stdout ?? "");
  const allowed = new Set(allowedWritePaths);
  const unauthorizedPaths = changedPaths.filter((candidate) => !allowed.has(candidate));

  return {
    changedPaths,
    unauthorizedPaths,
    withinScope: unauthorizedPaths.length === 0,
    diff: diff?.output.stdout ?? "",
    commands: result.evidence.commands,
  };
}

export interface TestValidationResult {
  passed: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  commands: readonly CommandExecutionRecord[];
}

/**
 * Runs the pre-written test suite. Its exit code — not the stage's
 * summary — decides whether the run succeeded.
 */
export async function runIndependentTests(
  profile: ValidationProfile,
  options: ValidationOptions = {},
): Promise<TestValidationResult> {
  const boundary = boundaryFor(
    profile,
    options.backend ?? processExecutionBackend,
    options.environmentSource ?? {},
  );

  const result = await boundary.execute(
    request(
      profile,
      [
        {
          executable: profile.nodeExecutablePath,
          args: ["--test", profile.testTarget ?? TEST_TARGET],
        },
      ],
      "fbl-028-tests",
    ),
  );

  const command = result.evidence.commands[0];
  return {
    passed: result.status === "completed" && command?.exitCode === 0,
    exitCode: command?.exitCode ?? null,
    stdout: command?.output.stdout ?? "",
    stderr: command?.output.stderr ?? "",
    timedOut: result.status === "timed_out",
    commands: result.evidence.commands,
  };
}
