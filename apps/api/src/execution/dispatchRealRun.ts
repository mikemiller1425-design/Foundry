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

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] as string;

    if (token === EXECUTE_FLAG) {
      executeRealRun = true;
      continue;
    }
    if (token === "--build-id") {
      buildId = argv[++i];
      continue;
    }
    if (token === "--pin-sha256") {
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
): PreflightReport {
  const empty: PreflightReport = {
    ok: false,
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
  actor: CommandActor;
  /** Called at most once. Never retried. */
  dispatch: (pinSha256: string) => Promise<DispatchEvidence>;
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

  const report = buildPreflightReport(deps.persistence, deps.config, parsed.args);
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
  const evidence = await deps.dispatch(parsed.args.pinSha256);

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
