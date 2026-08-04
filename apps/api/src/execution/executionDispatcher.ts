import { existsSync, rmSync } from "node:fs";
import {
  CLAUDE_CODE_STAGE,
  matchSupportedObjective,
  type ExecutionAuthorization,
  type PersistedPlan,
  type PersistedRunEvidence,
  type SupportedObjectiveTemplate,
} from "@foundry/contracts";
import {
  CommandHandler,
  evaluateExecutionGate,
  readExecutionGateInput,
  stageEntityIds,
  type CommandActor,
  type ExecutionRefusal,
  type PersistenceService,
} from "@foundry/persistence";
import {
  ClaudeCodeAdapter,
  createFixtureRepository,
  runControlledStage,
  type ClaudeCodeProfile,
  type ControlledStageEvidence,
  type ExecutionBackend,
  type RuntimeAdapter,
  type ValidationProfile,
} from "@foundry/runtime-adapters";
import { assertExpectedBinary, type BinaryIdentity } from "./binaryIdentity";
import { evaluateBudget, parseRunCostUsd, type BudgetOutcome } from "./costParsing";

/**
 * Dispatch of the one real controlled Builder execution (AC-111).
 *
 * ## What this module fixes, and why it had to
 *
 * The `FBL-028` runner proved the *mechanism*. It could not be reused as
 * the `AC-111` dispatcher, because three of its properties would have made
 * an operator-facing guarantee **false** rather than merely incomplete —
 * recorded as H-1, H-2, and H-3 in the pre-`AC-111` hardening review:
 *
 * | Was | Now |
 * | --- | --- |
 * | Opened its **own** SQLite, so the `AgentRun` marking an authorization spent landed where the `AC-110` gate never looks | Uses the **operational** `PersistenceService` and `CommandHandler` — the same store the gate reads |
 * | Never read what the run cost | Parses the cost, fails closed on missing/malformed, records ceiling and actual |
 * | Hard-coded `maxBudgetUsd: 2` | Reads the ceiling **only** from the persisted `ExecutionAuthorization` |
 *
 * ## The ordering is the substance
 *
 * 1. Resolve the plan and its authorization from persisted truth.
 * 2. Verify the binary's identity — **before** anything is created.
 * 3. Ask the `AC-110` gate. It is the only source of permission.
 * 4. **Reserve**: submit `AgentRun.Start` through `CommandHandler`, before
 *    any workspace exists and before any backend is touched.
 * 5. Create the disposable workspace.
 * 6. Execute through the adapter.
 * 7. Verify write scope, run the independent tests, read the cost.
 * 8. Record a terminal `AgentRun` state through the ordinary command path.
 * 9. Destroy the workspace and verify it is gone.
 *
 * **Step 4 before steps 5–6 is the whole of H-1.** The reservation is a
 * persisted `agentrun.started` event in the operational store, which is
 * exactly what the gate reads to decide "already spent". So a crash at any
 * point after step 4 leaves the authorization **spent**, which is the
 * conservative direction: a run that may have cost money is never silently
 * available to be repeated. `F-124` requires precisely this — a spent real
 * execution is never automatically restarted.
 *
 * It is also the concurrency guard. `CommandHandler.submit` is synchronous
 * and `AgentRun.Start` is a creation command, so two dispatches racing for
 * the same authorization cannot both reserve: the second finds the run
 * already exists and is refused before it reaches a workspace or a backend.
 *
 * ## What this module does not claim
 *
 * It does not prevent an already-running process from writing outside the
 * workspace — that needs OS-level sandboxing, which V1.1 does not
 * implement. Write confinement here is **detection**: a git diff against a
 * pre-run baseline, and anything outside the permitted set fails the run.
 * Network availability is likewise **declared and recorded, not enforced**;
 * `allowNetwork` is copied into evidence and gates nothing.
 */

export type DispatchOutcome =
  | "succeeded"
  | "refused_unsupported_objective"
  | "refused_no_plan"
  | "refused_no_stage"
  | "refused_by_gate"
  | "refused_binary_identity"
  | "refused_already_reserved"
  | "failed_execution"
  | "failed_write_scope"
  | "failed_validation"
  | "failed_cost_unknown"
  | "failed_over_budget"
  | "failed_evidence_persistence"
  | "timed_out";

/** Outcomes that mean nothing was dispatched and nothing was consumed. */
const PRE_DISPATCH_REFUSALS: ReadonlySet<DispatchOutcome> = new Set([
  "refused_unsupported_objective",
  "refused_no_plan",
  "refused_no_stage",
  "refused_by_gate",
  "refused_binary_identity",
  "refused_already_reserved",
]);

export interface DispatchEvidence {
  outcome: DispatchOutcome;
  /** One operator-readable line explaining the outcome. */
  verdict: string;
  buildId: string;
  planId: string | null;
  stageName: string;
  supportedObjectiveId: string | null;
  agentRunId: string | null;
  /** True only when `AgentRun.Start` was accepted — i.e. the authorization is spent. */
  reserved: boolean;
  /** True only when an execution backend was actually invoked. */
  dispatched: boolean;
  authorization: ExecutionAuthorization | null;
  /** The three places the budget must agree (H-3). */
  budget: {
    fromAuthorization: number | null;
    passedToRuntime: number | null;
    actualCostUsd: number | null;
    outcome: BudgetOutcome | null;
  };
  binaryIdentity: BinaryIdentity | null;
  allowedWritePaths: readonly string[];
  workspaceRoot: string | null;
  workspaceDisposition: "destroyed" | "retained" | "never_created";
  workspaceDestructionVerified: boolean;
  /**
   * Honest status of network confinement: declared in the policy and
   * recorded here, never enforced by this boundary.
   */
  networkEnforcement: "declared_and_recorded_not_enforced";
  gateRefusals: readonly ExecutionRefusal[];
  stageEvidence: ControlledStageEvidence | null;
  /** The durable evidence record this dispatch persisted, when it did. */
  evidenceId: string | null;
  startedAt: string;
  completedAt: string;
}

export interface DispatchConfig {
  /** Absolute path to the controlled executable. */
  executablePath: string;
  /** Required pin. Absent is a refusal, never an allow (H-5). */
  expectedExecutableSha256?: string;
  gitExecutablePath: string;
  nodeExecutablePath: string;
  model: string;
  timeoutMs: number;
  validationTimeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  maxEvidenceBytes: number;
  /** Retains the workspace for inspection. Recorded in evidence either way. */
  keepWorkspace?: boolean;
}

export interface DispatchOptions {
  /**
   * Substituted execution backend. **Every test uses one**; `F-117`
   * requires the whole mechanism to be covered offline. When absent, the
   * adapter's real process backend is used — which is the only path that
   * would spend money, and it is never reached from a test.
   */
  adapter?: RuntimeAdapter;
  validationBackend?: ExecutionBackend;
  environmentSource?: Record<string, string | undefined>;
  now?: () => Date;
  /** Injected so tests can observe ordering without a real filesystem race. */
  onReserved?: () => void | Promise<void>;
}

export class ExecutionDispatcher {
  constructor(
    private readonly persistence: PersistenceService,
    private readonly commands: CommandHandler,
    private readonly config: DispatchConfig,
  ) {}

  async dispatch(
    buildId: string,
    actor: CommandActor,
    options: DispatchOptions = {},
  ): Promise<DispatchEvidence> {
    const now = options.now ?? (() => new Date());
    const startedAt = now().toISOString();

    const base = {
      buildId,
      stageName: CLAUDE_CODE_STAGE as string,
      startedAt,
      networkEnforcement: "declared_and_recorded_not_enforced" as const,
    };

    const refuse = (
      outcome: DispatchOutcome,
      verdict: string,
      extra: Partial<DispatchEvidence> = {},
    ): DispatchEvidence => ({
      ...base,
      outcome,
      verdict,
      planId: null,
      supportedObjectiveId: null,
      agentRunId: null,
      reserved: false,
      dispatched: false,
      authorization: null,
      budget: {
        fromAuthorization: null,
        passedToRuntime: null,
        actualCostUsd: null,
        outcome: null,
      },
      binaryIdentity: null,
      allowedWritePaths: [],
      workspaceRoot: null,
      workspaceDisposition: "never_created",
      workspaceDestructionVerified: false,
      gateRefusals: [],
      stageEvidence: null,
      evidenceId: null,
      completedAt: now().toISOString(),
      ...extra,
    });

    // ---- 1. Persisted truth ------------------------------------------------

    const persisted = this.persistence
      .listEntities<PersistedPlan>("plans")
      .find((entry) => entry.plan.buildId === buildId);

    if (!persisted) {
      return refuse(
        "refused_no_plan",
        `No plan is recorded for build ${buildId}; there is nothing to execute.`,
      );
    }

    // The template is re-derived here rather than trusted from the
    // authorization: a record is a record, and the thing about to run
    // should be decided by what is persisted now.
    const match = matchSupportedObjective(persisted.plan.objective);
    if (!match.supported) {
      return refuse("refused_unsupported_objective", match.reason, {
        planId: persisted.plan.planId,
      });
    }
    const template: SupportedObjectiveTemplate = match.template;

    // ---- 2. Binary identity, before anything is created --------------------

    const binaryCheck = assertExpectedBinary(
      this.config.executablePath,
      this.config.expectedExecutableSha256,
    );
    if (!binaryCheck.ok) {
      return refuse("refused_binary_identity", binaryCheck.reason, {
        planId: persisted.plan.planId,
        supportedObjectiveId: template.id,
        binaryIdentity: binaryCheck.identity ?? null,
      });
    }
    const binaryIdentity = binaryCheck.identity;

    // ---- 3. The AC-110 gate — the only source of permission ----------------

    const gate = evaluateExecutionGate(
      readExecutionGateInput(this.persistence, buildId, CLAUDE_CODE_STAGE),
    );
    if (!gate.permitted || !gate.authorization) {
      return refuse(
        "refused_by_gate",
        `Execution is not permitted: ${gate.refusals.map((r) => r.code).join(", ")}.`,
        {
          planId: persisted.plan.planId,
          supportedObjectiveId: template.id,
          binaryIdentity,
          gateRefusals: gate.refusals,
        },
      );
    }
    const authorization = gate.authorization;

    /**
     * H-3 — the ceiling comes from the persisted authorization and from
     * nowhere else. No constant, no environment variable, no argument.
     */
    const authorizedCeilingUsd = authorization.maxBudgetUsd;

    // The stage must already exist, so the reservation links to it and the
    // gate can see the spend. Without it, `AgentRun.Start` would attach to
    // whatever stage happened to be current.
    const ids = stageEntityIds(persisted.plan.planId, CLAUDE_CODE_STAGE);
    const stage = this.persistence.getEntity<{ id: string }>("buildStages", ids.stageId);
    const task = this.persistence.getEntity<{ id: string }>("tasks", ids.taskId);
    if (!stage || !task) {
      return refuse(
        "refused_no_stage",
        `Build ${buildId} has no persisted \`${CLAUDE_CODE_STAGE}\` stage and task, so a real run could not be linked to one. The reservation would not be visible to the authorization gate.`,
        {
          planId: persisted.plan.planId,
          supportedObjectiveId: template.id,
          binaryIdentity,
        },
      );
    }

    const agentRunId = `${ids.stageId}--real-run`;

    // ---- 4. RESERVE — before any workspace, before any backend -------------

    const reservation = this.commands.submit(
      {
        commandType: "AgentRun.Start",
        entityId: agentRunId,
        params: {
          agentId: "agent-builder",
          taskId: ids.taskId,
          runtimeType: "claude_code",
          riskClass: persisted.plan.riskClass,
        },
      },
      actor,
    );

    if (!reservation.accepted) {
      return refuse(
        "refused_already_reserved",
        `A real run is already reserved for this stage (${agentRunId}): ${
          reservation.reason ?? "AgentRun.Start was refused"
        }. One authorization never covers a second run.`,
        {
          planId: persisted.plan.planId,
          supportedObjectiveId: template.id,
          agentRunId,
          authorization,
          binaryIdentity,
          budget: {
            fromAuthorization: authorizedCeilingUsd,
            passedToRuntime: null,
            actualCostUsd: null,
            outcome: null,
          },
        },
      );
    }

    // From here the authorization is SPENT, whatever happens next.
    await options.onReserved?.();

    const reserved = {
      ...base,
      planId: persisted.plan.planId,
      supportedObjectiveId: template.id,
      agentRunId,
      reserved: true,
      authorization,
      binaryIdentity,
      allowedWritePaths: template.allowedWritePaths,
      gateRefusals: [] as readonly ExecutionRefusal[],
    };

    // ---- 5. The disposable workspace --------------------------------------

    const fixture = createFixtureRepository();

    /**
     * Disposal is called explicitly rather than from `finally`.
     *
     * A `finally` block runs *after* the return expression has already
     * been evaluated, so any disposition it recorded arrived too late to
     * appear in the returned evidence — the first version of this method
     * reported `retained` for every destroyed workspace. Caught by test.
     */
    let workspaceDisposition: DispatchEvidence["workspaceDisposition"] = "retained";
    let workspaceDestructionVerified = false;
    const disposeWorkspace = (): void => {
      if (this.config.keepWorkspace) {
        workspaceDisposition = "retained";
        return;
      }
      rmSync(fixture.root, { recursive: true, force: true });
      workspaceDestructionVerified = !existsSync(fixture.root);
      workspaceDisposition = workspaceDestructionVerified ? "destroyed" : "retained";
    };

    const claudeProfile: ClaudeCodeProfile = {
      repositoryRoot: fixture.root,
      executablePath: this.config.executablePath,
      model: this.config.model,
      timeoutMs: this.config.timeoutMs,
      maxStdoutBytes: this.config.maxStdoutBytes,
      maxStderrBytes: this.config.maxStderrBytes,
      maxEvidenceBytes: this.config.maxEvidenceBytes,
      // H-3: the authorized value, unmodified.
      maxBudgetUsd: authorizedCeilingUsd,
      allowedEnvironmentVariables: ["HOME", "USER"],
    };

    const validationProfile: ValidationProfile = {
      repositoryRoot: fixture.root,
      gitExecutablePath: this.config.gitExecutablePath,
      nodeExecutablePath: this.config.nodeExecutablePath,
      timeoutMs: this.config.validationTimeoutMs,
      maxStdoutBytes: this.config.maxStdoutBytes,
      maxStderrBytes: this.config.maxStderrBytes,
      maxEvidenceBytes: this.config.maxEvidenceBytes,
      testTarget: template.independentTestPath,
    };

    let stageEvidence: ControlledStageEvidence;
    try {
      const adapter = options.adapter ?? new ClaudeCodeAdapter(claudeProfile);

      // ---- 6/7. Execute, then verify from outside the runtime -------------

      stageEvidence = await runControlledStage(
        {
          agentRunId,
          agentId: "agent-builder",
          taskId: ids.taskId,
          // H-6: permitted writes come from the template, not a caller.
          fixture: { ...fixture, allowedWritePaths: template.allowedWritePaths },
          claudeProfile,
          validationProfile,
        },
        {
          adapter,
          validationBackend: options.validationBackend,
          environmentSource: options.environmentSource,
          // The reservation above already refused a duplicate; this is the
          // same answer from the layer below, kept so the runner's own
          // guard is not quietly bypassed.
          hasExistingRun: () => false,
        },
      );
    } catch (error) {
      // The authorization stays spent. A run that may have started is
      // never silently made available to repeat (F-124).
      disposeWorkspace();
      this.recordTerminal(agentRunId, "fail", actor, {
        failureCode: "dispatch_error",
        failureMessage: error instanceof Error ? error.message : String(error),
        evidenceIds: [],
      });
      throw error;
    }

    // ---- H-2: what did it actually cost? ----------------------------------

    const runStdout = stageEvidence.runEvidence?.commands[0]?.output.stdout ?? "";
    const cost = parseRunCostUsd(runStdout);

    let outcome: DispatchOutcome;
    let verdict: string;
    let actualCostUsd: number | null = null;
    let budgetOutcome: BudgetOutcome | null = null;
    let costUnknownReason: string | undefined;

    if (!cost.ok) {
      outcome = "failed_cost_unknown";
      verdict = cost.reason;
      costUnknownReason = cost.reason;
    } else {
      actualCostUsd = cost.costUsd;
      budgetOutcome = evaluateBudget(authorizedCeilingUsd, cost.costUsd);
      if (!budgetOutcome.withinCeiling) {
        outcome = "failed_over_budget";
        verdict = `Containment failure: the run cost $${cost.costUsd} against an authorized ceiling of $${authorizedCeilingUsd}. The money is already spent — this is detection, not prevention — but an overspend is recorded as a failed run rather than a success with a footnote.`;
      } else {
        outcome = mapStageOutcome(stageEvidence.outcome);
        verdict = stageEvidence.verdict;
      }
    }

    /**
     * ---- 8a. DURABLE EVIDENCE, before any terminal event ----------------
     *
     * The first real run cited an evidence id that no record existed for.
     * Everything below — ceiling, cost, containment verdict, binary
     * identity, write scope, test result, workspace disposition — was
     * computed, printed, and lost when the process exited.
     *
     * So the record is persisted **first**, and read back, and only then
     * may a terminal event reference it. A reference to evidence that does
     * not exist is worse than no reference: it reads like an audit trail.
     */
    const evidenceId = stageEvidence.runEvidence?.evidenceId ?? `${agentRunId}--evidence`;
    const runCommand = stageEvidence.runEvidence?.commands[0];

    /**
     * Dispose **before** the record is built.
     *
     * The first version built the evidence first and disposed afterwards,
     * so every record claimed `workspaceDisposition: "retained"` and
     * `workspaceDestructionVerified: false` even when the workspace had
     * been destroyed moments later — the same class of mistake as the
     * `finally`-after-return defect found earlier in this rung. Evidence
     * about a workspace must be written after the workspace's fate is
     * settled, not before. Caught by test.
     */
    disposeWorkspace();

    const durable: PersistedRunEvidence = {
      evidenceId,
      agentRunId,
      buildId,
      planId: persisted.plan.planId,
      supportedObjectiveId: template.id,
      authorizationId: authorization.authorizationId,
      stageName: CLAUDE_CODE_STAGE,
      riskClass: persisted.plan.riskClass,
      authorizedCeilingUsd,
      ceilingPassedToRuntimeUsd: claudeProfile.maxBudgetUsd,
      actualCostUsd,
      budgetOutcome,
      ...(costUnknownReason ? { costUnknownReason } : {}),
      binaryIdentity,
      writeScope: stageEvidence.writeScope
        ? {
            allowedWritePaths: [...template.allowedWritePaths],
            changedPaths: [...stageEvidence.writeScope.changedPaths],
            unauthorizedPaths: [...stageEvidence.writeScope.unauthorizedPaths],
            withinScope: stageEvidence.writeScope.withinScope,
          }
        : null,
      independentTest: stageEvidence.tests
        ? {
            testTarget: template.independentTestPath,
            passed: stageEvidence.tests.passed,
            exitCode: stageEvidence.tests.exitCode,
            timedOut: stageEvidence.tests.timedOut,
          }
        : null,
      workspaceRoot: fixture.root,
      workspaceDisposition,
      workspaceDestructionVerified,
      outcome,
      exitCode: runCommand?.exitCode ?? null,
      verdict,
      startedAt,
      completedAt: now().toISOString(),
      networkEnforcement: "declared_and_recorded_not_enforced",
      stdoutTruncated: runCommand?.output.stdoutTruncated ?? false,
      stderrTruncated: runCommand?.output.stderrTruncated ?? false,
      // The boundary redacts every retained capture before it is returned.
      redactionApplied: true,
    };

    const evidencePersisted = this.persistEvidence(evidenceId, agentRunId, durable, actor);

    const budgetSummary = {
      authorizedCeilingUsd,
      actualCostUsd,
      withinCeiling: budgetOutcome ? budgetOutcome.withinCeiling : null,
      evidenceId,
    };

    if (!evidencePersisted.ok) {
      /**
       * Evidence could not be made durable. **Do not report an ordinary
       * successful completion**, whatever the run itself did.
       *
       * Money may already have been spent — the run happened — and that
       * fact is preserved in the failure message rather than hidden by it.
       * A completion citing evidence that does not exist is precisely the
       * defect this rung is correcting; producing another one here would
       * be worse than failing loudly.
       */
      const failure = `Evidence could not be persisted (${evidencePersisted.reason}). The run itself completed as \`${outcome}\`, so MONEY MAY ALREADY HAVE BEEN SPENT${
        actualCostUsd === null ? " (cost unknown)" : ` ($${actualCostUsd})`
      } — but no durable record exists, so this is reported as an audit failure rather than a completion.`;

      this.recordTerminal(agentRunId, "fail", actor, {
        failureCode: "evidence_persistence_failed",
        failureMessage: failure,
        // Deliberately empty: citing an id with no record behind it is the
        // exact defect being corrected.
        evidenceIds: [],
      });

      return {
        ...reserved,
        outcome: "failed_evidence_persistence",
        verdict: failure,
        dispatched: true,
        budget: {
          fromAuthorization: authorizedCeilingUsd,
          passedToRuntime: claudeProfile.maxBudgetUsd,
          actualCostUsd,
          outcome: budgetOutcome,
        },
        workspaceRoot: fixture.root,
        workspaceDisposition,
        workspaceDestructionVerified,
        stageEvidence,
        evidenceId: null,
        completedAt: now().toISOString(),
      };
    }

    // ---- 8b. Terminal state, now that its evidence demonstrably exists ---

    if (outcome === "failed_cost_unknown") {
      this.recordTerminal(agentRunId, "fail", actor, {
        failureCode: "cost_unknown",
        failureMessage: verdict,
        evidenceIds: [evidenceId],
        budget: budgetSummary,
      });
    } else if (outcome === "failed_over_budget") {
      this.recordTerminal(agentRunId, "fail", actor, {
        failureCode: "over_budget",
        failureMessage: verdict,
        evidenceIds: [evidenceId],
        budget: budgetSummary,
      });
    } else if (outcome === "succeeded") {
      this.recordTerminal(agentRunId, "complete", actor, {
        exitCode: runCommand?.exitCode ?? 0,
        outputArtifactIds: [],
        evidenceIds: [evidenceId],
        budget: budgetSummary,
      });
    } else if (outcome === "timed_out") {
      this.recordTerminal(agentRunId, "timeout", actor, {
        evidenceIds: [evidenceId],
        logRef: evidenceId,
        budget: budgetSummary,
      });
    } else {
      this.recordTerminal(agentRunId, "fail", actor, {
        failureCode: stageEvidence.outcome,
        failureMessage: stageEvidence.verdict,
        evidenceIds: [evidenceId],
        budget: budgetSummary,
      });
    }

    // The workspace was destroyed and verified above, before the evidence
    // record was written, so the record states its actual fate.
    return {
      ...reserved,
      outcome,
      verdict,
      dispatched: true,
      budget: {
        fromAuthorization: authorizedCeilingUsd,
        passedToRuntime: claudeProfile.maxBudgetUsd,
        actualCostUsd,
        outcome: budgetOutcome,
      },
      workspaceRoot: fixture.root,
      workspaceDisposition,
      workspaceDestructionVerified,
      stageEvidence,
      evidenceId,
      completedAt: now().toISOString(),
    };
  }

  /**
   * Persists the evidence record and **reads it back**.
   *
   * The read-back is the whole point. An accepted command is not proof the
   * record is queryable — that is exactly the assumption that produced a
   * dangling evidence id the first time. A terminal event may only cite
   * evidence this method has actually retrieved.
   */
  private persistEvidence(
    evidenceId: string,
    agentRunId: string,
    evidence: PersistedRunEvidence,
    actor: CommandActor,
  ): { ok: true } | { ok: false; reason: string } {
    const outcome = this.commands.submit(
      {
        commandType: "AgentRun.RecordEvidence",
        entityId: evidenceId,
        params: { evidenceId, agentRunId, evidence },
      },
      actor,
    );
    if (!outcome.accepted) {
      return { ok: false, reason: outcome.reason ?? "AgentRun.RecordEvidence was refused" };
    }

    const readBack = this.persistence.getEntity<PersistedRunEvidence>(
      "agentRunEvidence",
      evidenceId,
    );
    if (!readBack) {
      return {
        ok: false,
        reason: `the command was accepted but no record is readable at agentRunEvidence/${evidenceId}`,
      };
    }
    return { ok: true };
  }

  /** Records the terminal `AgentRun` state through `CommandHandler`. */
  private recordTerminal(
    agentRunId: string,
    kind: "complete" | "fail" | "timeout",
    actor: CommandActor,
    params: Record<string, unknown>,
  ): void {
    const commandType =
      kind === "complete"
        ? "AgentRun.Complete"
        : kind === "timeout"
          ? "AgentRun.Timeout"
          : "AgentRun.Fail";
    this.commands.submit({ commandType, entityId: agentRunId, params }, actor);
  }
}

function mapStageOutcome(outcome: ControlledStageEvidence["outcome"]): DispatchOutcome {
  switch (outcome) {
    case "succeeded":
      return "succeeded";
    case "failed_write_scope":
      return "failed_write_scope";
    case "failed_validation":
      return "failed_validation";
    case "timed_out":
      return "timed_out";
    default:
      return "failed_execution";
  }
}

/** True when nothing was dispatched and no authorization was consumed. */
export function isPreDispatchRefusal(outcome: DispatchOutcome): boolean {
  return PRE_DISPATCH_REFUSALS.has(outcome);
}
