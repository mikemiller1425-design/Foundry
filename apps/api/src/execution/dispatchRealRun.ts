import {
  CLAUDE_CODE_STAGE,
  matchSupportedObjective,
  type PersistedPlan,
  type SupportedObjectiveTemplate,
} from "@foundry/contracts";
import {
  evaluateExecutionGate,
  readExecutionGateInput,
  stageEntityIds,
  type CommandActor,
  type ExecutionRefusal,
  type PersistenceService,
} from "@foundry/persistence";
import { controlledClaudeArgs } from "@foundry/runtime-adapters";
import { readBinaryIdentity, type BinaryIdentity } from "./binaryIdentity";
import type { DispatchConfig, DispatchEvidence } from "./executionDispatcher";

/**
 * The audited one-shot entrypoint for a real controlled run (AC-111).
 *
 * ## Why this exists
 *
 * The dispatcher was "reachable from code", which is not an operational
 * capability — it means the only way to start a real run is to write a
 * script, and an improvised script is precisely the thing that ends up
 * passing a hand-typed budget or a hand-typed path. This module is the
 * one audited way in.
 *
 * ## What a caller may say
 *
 * Three things, and nothing else:
 *
 * | Flag | Why it is permitted |
 * | --- | --- |
 * | `--build-id <id>` | Names *which* build. It selects; it never widens |
 * | `--pin-sha256 <hex>` | A **check**, not a permission. The executable path is fixed in committed config, so a pin can only match the file that is already there or refuse. There is no value that makes a different binary run |
 * | `--execute-real-run` | The only way to leave dry-run. Its absence is a refusal |
 *
 * **Every other flag is rejected**, loudly, by name. Not ignored — an
 * ignored `--budget 50` is worse than a rejected one, because the operator
 * would believe it took effect. Model, tools, timeout, workspace, budget,
 * writable paths, test command, executable path, objective text, and
 * template id are all refused, and a test asserts each.
 *
 * ## Where everything else comes from
 *
 * | Value | Source |
 * | --- | --- |
 * | Objective template, plan content hash, authorization, **budget ceiling**, writable paths | **Persisted backend truth** |
 * | Model, tools, timeouts, byte caps, executable path | **Committed configuration** (`operationalConfig.ts`) — a reviewable diff, never an argument |
 *
 * ## Dry run by default
 *
 * With no `--execute-real-run`, this reads persisted state, computes the
 * binary's identity, renders the exact argv, and **stops**. No
 * reservation, no workspace, no spawn, no mutation — proven by asserting
 * the whole persisted store is byte-equal before and after.
 *
 * ## Exactly one attempt
 *
 * The dispatcher is called once. There is no retry loop, no backoff, and
 * no re-dispatch on timeout, unknown cost, process failure, or containment
 * failure. A spent authorization is never automatically reused (`F-124`),
 * and the absence of a loop is the mechanism rather than a policy someone
 * has to remember.
 */


/**
 * The actor a real dispatch acts as — the **backend**, never an operator.
 *
 * ## Why this is not an operator
 *
 * The first version of the shell read `FOUNDRY_OPERATOR_ID` and marked it
 * `authenticated: true` with no `PrincipalRegistry` verification. That is
 * a shell variable asserting operator authority, which is precisely the
 * class of defect `FBL-029` removed from the command surface: identity
 * established by a credential the backend issued, never by a claim the
 * caller made.
 *
 * ## Why the backend actor is the correct one, not a workaround
 *
 * `AgentRun.Start` carries no operator requirement in `CommandHandler` —
 * it is not in `APPROVAL_RESOLUTION_COMMANDS`, `OPERATOR_PLAN_COMMANDS`,
 * `OPERATOR_UPGRADE_COMMANDS`, or `OPERATOR_BUILD_COMMANDS`. The commands
 * that *do* require an authenticated operator are the governance acts:
 * submitting an objective, reviewing a plan, starting a build, and
 * **authorizing execution**. All of those have already happened, through
 * the credentialed HTTP surface, by the time this entrypoint runs.
 *
 * So the operator's authority is not being re-asserted here — it is
 * already recorded, immutably, on the persisted `ExecutionAuthorization`:
 * who authorized, when, against which plan content hash, under what
 * ceiling. This dispatch is the **backend carrying out a decision the
 * operator already made and signed**, which is exactly what the backend
 * actor means. `AC-109`'s orchestrator uses the same identity for the
 * same reason.
 *
 * Claiming to be the operator here would add no authority and would
 * falsify the audit trail: the event log would say a human started this
 * run at a terminal, when what happened is that a program acted on a
 * recorded authorization.
 */
export const REAL_RUN_ACTOR: CommandActor = Object.freeze({
  actorType: "backend",
  actorId: "backend",
  authenticated: true,
});

export const EXECUTE_FLAG = "--execute-real-run";

/** Flags a caller might reach for that would widen the run. All refused. */
const PROHIBITED_FLAGS = [
  "--budget",
  "--max-budget-usd",
  "--model",
  "--tools",
  "--timeout",
  "--timeout-ms",
  "--workspace",
  "--write-path",
  "--writable-paths",
  "--test-command",
  "--test-target",
  "--executable",
  "--executable-path",
  "--claude-path",
  "--objective",
  "--supported-objective-id",
  "--template",
  "--keep-workspace",
] as const;

export interface DispatchArgs {
  buildId: string;
  pinSha256: string;
  executeRealRun: boolean;
}

export type ParseResult =
  | { ok: true; args: DispatchArgs }
  | { ok: false; reason: string; correctiveAction: string };

export function parseDispatchArgs(argv: readonly string[]): ParseResult {
  let buildId: string | undefined;
  let pinSha256: string | undefined;
  let executeRealRun = false;

  /**
   * Every accepted flag may appear **at most once**.
   *
   * Neither first-wins nor last-wins is safe here. A duplicated
   * `--build-id` under last-wins would let the preflight describe one
   * build while the dispatch targeted another, which is a paid run
   * against something the operator never reviewed. Under first-wins the
   * operator's *later*, presumably corrected, value would be discarded in
   * silence. The only defensible answer to "you said it twice" is to say
   * so and stop.
   */
  const seen = new Set<string>();
  const duplicate = (flag: string): ParseResult => ({
    ok: false,
    reason: `\`${flag}\` was supplied more than once. Neither first-wins nor last-wins is safe: a duplicated \`--build-id\` could let the preflight describe one build while the dispatch targeted another, and discarding a corrected value silently is no better.`,
    correctiveAction: `Supply \`${flag}\` exactly once.`,
  });

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] as string;

    if (token === EXECUTE_FLAG) {
      if (seen.has(token)) return duplicate(token);
      seen.add(token);
      executeRealRun = true;
      continue;
    }
    if (token === "--build-id") {
      if (seen.has(token)) return duplicate(token);
      seen.add(token);
      buildId = argv[++i];
      continue;
    }
    if (token === "--pin-sha256") {
      if (seen.has(token)) return duplicate(token);
      seen.add(token);
      pinSha256 = argv[++i];
      continue;
    }

    const prohibited = PROHIBITED_FLAGS.find(
      (flag) => token === flag || token.startsWith(`${flag}=`),
    );
    if (prohibited) {
      return {
        ok: false,
        reason: `\`${prohibited}\` is not accepted. Runtime policy — model, tools, timeouts, workspace, writable paths, and the executable path — is fixed in committed configuration, and the budget comes from the persisted authorization the operator issued. A caller that could set these could widen containment without touching a policy file.`,
        correctiveAction: `Change the value where it lives: policy in \`apps/api/src/operationalConfig.ts\` (a reviewable diff), or the budget on the authorization via \`Plan.Authorize\`.`,
      };
    }

    return {
      ok: false,
      reason: `Unrecognised argument \`${token}\`. This entrypoint accepts only --build-id, --pin-sha256, and ${EXECUTE_FLAG}.`,
      correctiveAction: "Remove the unrecognised argument.",
    };
  }

  if (!buildId) {
    return {
      ok: false,
      reason: "--build-id is required.",
      correctiveAction: "Pass the build to dispatch, e.g. --build-id build-….",
    };
  }
  if (!pinSha256 || !/^[0-9a-f]{64}$/.test(pinSha256)) {
    return {
      ok: false,
      reason:
        "--pin-sha256 is required and must be 64 lowercase hex characters. An unpinned executable is refused rather than run: without a pin, 'the allowlisted path' and 'the program that runs' are different claims.",
      correctiveAction:
        "Verify the executable out of band, then pass its SHA-256. Do not copy whatever is currently on disk merely to satisfy this check.",
    };
  }

  return { ok: true, args: { buildId, pinSha256, executeRealRun } };
}

export interface PreflightReport {
  ok: boolean;
  /** The store this run would act on. Shown so it is never implicit. */
  databasePath: string;
  buildId: string;
  planId: string | null;
  supportedObjectiveId: string | null;
  planContentHash: string | null;
  authorizationId: string | null;
  authorizedCeilingUsd: number | null;
  allowedWritePaths: readonly string[];
  independentTestPath: string | null;
  binaryIdentity: BinaryIdentity | null;
  binaryPinMatches: boolean | null;
  argv: readonly string[];
  timeoutMs: number;
  networkEnforcement: "declared_and_recorded_not_enforced";
  gatePermitted: boolean;
  gateRefusals: readonly ExecutionRefusal[];
  /** Present when the preflight itself could not be completed. */
  blockedReason?: string;
}

/**
 * Reads everything a run would use, and **writes nothing**.
 *
 * Deliberately built from the same persisted reads the dispatcher does, so
 * what the operator is shown is what the dispatcher would act on rather
 * than a parallel description of it.
 */
export function buildPreflightReport(
  persistence: PersistenceService,
  config: Omit<DispatchConfig, "expectedExecutableSha256">,
  args: DispatchArgs,
  databasePath: string,
): PreflightReport {
  const empty: PreflightReport = {
    ok: false,
    databasePath,
    buildId: args.buildId,
    planId: null,
    supportedObjectiveId: null,
    planContentHash: null,
    authorizationId: null,
    authorizedCeilingUsd: null,
    allowedWritePaths: [],
    independentTestPath: null,
    binaryIdentity: null,
    binaryPinMatches: null,
    argv: [],
    timeoutMs: config.timeoutMs,
    networkEnforcement: "declared_and_recorded_not_enforced",
    gatePermitted: false,
    gateRefusals: [],
  };

  const persisted = persistence
    .listEntities<PersistedPlan>("plans")
    .find((entry) => entry.plan.buildId === args.buildId);
  if (!persisted) {
    return { ...empty, blockedReason: `No plan is recorded for build ${args.buildId}.` };
  }

  const match = matchSupportedObjective(persisted.plan.objective);
  if (!match.supported) {
    return {
      ...empty,
      planId: persisted.plan.planId,
      planContentHash: persisted.contentHash,
      blockedReason: match.reason,
    };
  }
  const template: SupportedObjectiveTemplate = match.template;

  // An unreadable executable is reported as a pin failure, not as an
  // absent check: "we could not look" must never read as "it is fine".
  let binaryIdentity: BinaryIdentity | null;
  try {
    binaryIdentity = readBinaryIdentity(config.executablePath);
  } catch {
    binaryIdentity = null;
  }
  const binaryPinMatches = binaryIdentity !== null && binaryIdentity.sha256 === args.pinSha256;

  const gate = evaluateExecutionGate(
    readExecutionGateInput(persistence, args.buildId, CLAUDE_CODE_STAGE),
  );
  const authorization = gate.authorization ?? persisted.authorization;

  // The exact vector, rendered from the same function the adapter uses.
  const argv = authorization
    ? [
        config.executablePath,
        ...controlledClaudeArgs({
          repositoryRoot: "<disposable workspace, created at dispatch>",
          executablePath: config.executablePath,
          model: config.model,
          timeoutMs: config.timeoutMs,
          maxStdoutBytes: config.maxStdoutBytes,
          maxStderrBytes: config.maxStderrBytes,
          maxEvidenceBytes: config.maxEvidenceBytes,
          maxBudgetUsd: authorization.maxBudgetUsd,
          allowedEnvironmentVariables: ["HOME", "USER"],
        }),
      ]
    : [];

  return {
    ok: gate.permitted && binaryPinMatches === true,
    databasePath,
    buildId: args.buildId,
    planId: persisted.plan.planId,
    supportedObjectiveId: template.id,
    planContentHash: persisted.contentHash,
    authorizationId: authorization?.authorizationId ?? null,
    authorizedCeilingUsd: authorization?.maxBudgetUsd ?? null,
    allowedWritePaths: template.allowedWritePaths,
    independentTestPath: template.independentTestPath,
    binaryIdentity,
    binaryPinMatches,
    argv,
    timeoutMs: config.timeoutMs,
    networkEnforcement: "declared_and_recorded_not_enforced",
    gatePermitted: gate.permitted,
    gateRefusals: gate.refusals,
  };
}

export function renderPreflight(report: PreflightReport, executeRequested: boolean): string {
  const lines: string[] = [];
  const row = (label: string, value: unknown) =>
    lines.push(`  ${label.padEnd(24)} ${value === null || value === undefined ? "—" : String(value)}`);

  lines.push("AC-111 controlled execution — PREFLIGHT (dry run)");
  lines.push("");
  row("database", report.databasePath);
  row("build", report.buildId);
  row("plan", report.planId);
  row("objective template", report.supportedObjectiveId);
  row("plan content hash", report.planContentHash);
  row("authorization", report.authorizationId);
  row(
    "authorized ceiling",
    report.authorizedCeilingUsd === null ? null : `$${report.authorizedCeilingUsd}`,
  );
  lines.push("");
  row("executable", report.binaryIdentity?.absolutePath);
  row("sha256", report.binaryIdentity?.sha256);
  row("size (bytes)", report.binaryIdentity?.sizeBytes);
  row(
    "package",
    report.binaryIdentity?.packageVersion
      ? `${report.binaryIdentity.packageName ?? "package"}@${report.binaryIdentity.packageVersion}`
      : null,
  );
  row("pin matches", report.binaryPinMatches === null ? null : report.binaryPinMatches ? "yes" : "NO");
  lines.push("");
  row("writable", report.allowedWritePaths.join(", ") || "—");
  row("independent tests", `${report.independentTestPath ?? "—"} (not writable, not runnable)`);
  row("timeout", `${report.timeoutMs} ms, then process-group SIGTERM → SIGKILL`);
  row("network", "declared and recorded, NOT OS-enforced");
  row("workspace", "fresh mkdtemp, destroyed and verified after the run");
  lines.push("");
  lines.push("  argv:");
  for (const token of report.argv) lines.push(`    ${token}`);
  if (report.argv.length === 0) lines.push("    — (no authorization, so no vector to show)");
  lines.push("");
  row("gate", report.gatePermitted ? "PERMITTED" : "REFUSED");
  for (const refusal of report.gateRefusals) lines.push(`    - ${refusal.code}: ${refusal.reason}`);
  if (report.blockedReason) lines.push(`  blocked: ${report.blockedReason}`);
  lines.push("");

  if (!executeRequested) {
    lines.push(
      `  DRY RUN. Nothing was reserved, created, spawned, or written. Pass ${EXECUTE_FLAG} to dispatch one real run.`,
    );
  }
  return lines.join("\n");
}

export interface EntrypointDependencies {
  persistence: PersistenceService;
  config: Omit<DispatchConfig, "expectedExecutableSha256">;
  /** Reported in the preflight so the target store is never implicit. */
  databasePath: string;
  actor: CommandActor;
  /**
   * Called at most once. Never retried.
   *
   * Receives the **validated** build id and pin explicitly. The shell must
   * never re-read `process.argv` after parsing: doing so made the parsed
   * build and the dispatched build separable, which is exactly how a paid
   * run reaches a build the operator did not review.
   */
  dispatch: (buildId: string, pinSha256: string) => Promise<DispatchEvidence>;
  log?: (line: string) => void;
}

export interface EntrypointResult {
  exitCode: number;
  preflight: PreflightReport | null;
  dispatched: boolean;
  evidence: DispatchEvidence | null;
}

/**
 * The whole entrypoint, with its dependencies injected so every test runs
 * it end to end against a substituted backend.
 */
export async function runEntrypoint(
  argv: readonly string[],
  deps: EntrypointDependencies,
): Promise<EntrypointResult> {
  const log = deps.log ?? ((line: string) => console.log(line));

  const parsed = parseDispatchArgs(argv);
  if (!parsed.ok) {
    log(`REFUSED: ${parsed.reason}`);
    log(`  ${parsed.correctiveAction}`);
    return { exitCode: 2, preflight: null, dispatched: false, evidence: null };
  }

  const report = buildPreflightReport(deps.persistence, deps.config, parsed.args, deps.databasePath);
  log(renderPreflight(report, parsed.args.executeRealRun));

  if (!parsed.args.executeRealRun) {
    return { exitCode: report.ok ? 0 : 1, preflight: report, dispatched: false, evidence: null };
  }

  if (!report.ok) {
    log(
      `REFUSED: preflight did not pass, so no run was dispatched. ${
        report.blockedReason ?? "See the gate refusals above."
      }`,
    );
    return { exitCode: 1, preflight: report, dispatched: false, evidence: null };
  }

  log("");
  log("EXECUTING ONE REAL RUN. This spends money and consumes the authorization.");

  // Exactly one attempt. No loop, no retry, no re-dispatch on any outcome.
  // Both values come from `parsed.args`, which is the single source of
  // truth after parsing — never from `process.argv`.
  const evidence = await deps.dispatch(parsed.args.buildId, parsed.args.pinSha256);

  log(`outcome: ${evidence.outcome}`);
  log(`verdict: ${evidence.verdict}`);
  log(
    `budget:  authorized $${evidence.budget.fromAuthorization ?? "—"} · passed $${
      evidence.budget.passedToRuntime ?? "—"
    } · actual ${evidence.budget.actualCostUsd === null ? "UNKNOWN" : `$${evidence.budget.actualCostUsd}`}`,
  );
  log(
    `workspace: ${evidence.workspaceDisposition}${
      evidence.workspaceDestructionVerified ? " (verified)" : ""
    }`,
  );
  log("The authorization is spent. It is never automatically reused.");

  return {
    exitCode: evidence.outcome === "succeeded" ? 0 : 1,
    preflight: report,
    dispatched: evidence.dispatched,
    evidence,
  };
}

/** The stage a real run targets, re-exported so the CLI need not guess. */
export function realRunAgentRunId(planId: string): string {
  return `${stageEntityIds(planId, CLAUDE_CODE_STAGE).stageId}--real-run`;
}
