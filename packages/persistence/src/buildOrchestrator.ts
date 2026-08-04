import {
  BUILD_STAGE_SEQUENCE,
  plannedStageId,
  type BuildPlan,
  type BuildStageName,
  type PersistedPlan,
  type CommandRequest,
} from "@foundry/contracts";
import type { ActorType } from "@foundry/event-types";
import { WORLD_AGENTS } from "@foundry/world-model";
import type { CommandActor, CommandHandler, CommandOutcome } from "./commandHandler";

/**
 * Backend orchestration of one reviewed build, with the mock executor
 * (AC-109).
 *
 * This is the first thing in Foundry that *advances* work rather than
 * recording an intention. Everything it does is therefore constrained by
 * one property, which is the whole point of the rung:
 *
 * > **The orchestrator is a client of `CommandHandler` and nothing else.**
 *
 * It is handed a `CommandHandler` and a plan. It has no
 * `PersistenceService`, no `appendEvent`, no reducer, no database handle,
 * and no way to reach one — so "the orchestrator cannot write a second
 * way" is enforced by what is reachable, not by review. `ObjectiveIntake`
 * established that shape at AC-103; this keeps it at the rung where the
 * temptation to break it is real, because an orchestrator that could write
 * directly would be faster and simpler and would quietly become a second
 * source of truth.
 *
 * Two further properties matter as much:
 *
 * - **Every state change is refusable.** The orchestrator proposes; the
 *   handler rules. When a step is refused the run stops at that step and
 *   reports it, rather than skipping ahead or retrying its way past a
 *   guard. Illegal ordering is therefore impossible to orchestrate, not
 *   merely avoided by careful sequencing.
 * - **Nothing here executes anything.** Every stage is advanced by the
 *   deterministic mock executor. No process is spawned, no shell is run,
 *   no network call is made, no model is invoked, and no money is spent.
 *   The `backend_implementation` stage — the one the plan allocates to the
 *   `claude_code` runtime — is advanced with `runtimeType: "mock"` like
 *   every other stage, and every event it produces says so. Real execution
 *   requires a single-use `ExecutionAuthorization` that does not exist yet
 *   (AC-110) and a real runtime that is not wired here (AC-111).
 *
 * ## Where the run stops
 *
 * At the **approval gate**, which sits between `qa_validation` and
 * `deployment_package`: `v1-scope.md` stage 7 is the "approval-gated
 * transfer to the Deployment Dock", and `domain-model.md` Transfer
 * invariant 4 gates the `qa_to_deployment_dock` leg on an approved
 * `Approval`. So six stages are orchestrated to completion, an `Approval`
 * is requested, and the run stops — deliberately leaving the seventh stage
 * uncreated, because creating it would claim gated work had begun.
 *
 * No transfer is created, no vehicle moves, and no execution authorization
 * is issued. Those belong to `AC-113` and `AC-110` respectively.
 *
 * ## Who acts
 *
 * Command actors mirror the canonical run's own attribution, because the
 * canonical run is the reference for what each event means:
 *
 * | Acts as | For |
 * | --- | --- |
 * | the assigned **agent** | assignment, travel, work, and starting its run |
 * | **runtime_adapter** `runtime-adapter-mock` | reporting a run's result |
 * | **backend** | stage lifecycle, artifacts, requirements, the approval |
 * | the **Inspector** agent | the independent validation decision |
 *
 * The mock executor stands in for the agent runtimes here, so it submits
 * commands under agent identities supplied by the process that mints agent
 * credentials. That is a real and stated limitation of a simulated run: at
 * `AC-111` a real agent runtime presents its own credential instead. What
 * is **not** relaxed is the independence the guard actually enforces — the
 * Inspector's validation still has to come from an Inspector-role agent
 * that did not produce the evidence it cites, and `buildOrchestrator.test.ts`
 * asserts a self-certifying variant is still refused.
 */

/** Which identity a step is submitted under. */
export type OrchestratorRole = "operator" | "backend" | "runtime_adapter" | BuildAgentRole;

export type BuildAgentRole = "architect" | "builder" | "inspector";

export interface OrchestrationStep {
  role: OrchestratorRole;
  request: CommandRequest;
  /** The plan stage this step belongs to; `null` for build-level steps. */
  stage: BuildStageName | null;
  /** Short human label, used in the run report and in evidence. */
  label: string;
}

export interface OrchestrationStepResult {
  step: OrchestrationStep;
  outcome: CommandOutcome;
}

export type OrchestrationStatus = "reached_approval_gate" | "refused" | "not_startable";

/**
 * The result of submitting `Build.Start`, plus the rest of the run.
 *
 * `started` answers the caller now; `continue()` finishes the run later.
 */
export interface OrchestrationHandle {
  started: boolean;
  /** The handler's answer to `Build.Start` — the authoritative refusal. */
  outcome: CommandOutcome;
  /** The finished result when the run never started; `null` when it did. */
  result: OrchestrationResult | null;
  continue: () => Promise<OrchestrationResult>;
}

export interface OrchestrationResult {
  status: OrchestrationStatus;
  buildId: string;
  planId: string;
  /** Steps actually submitted, in order, with the handler's answer to each. */
  results: OrchestrationStepResult[];
  /** The approval the run stopped at, when it reached the gate. */
  approvalId?: string;
  /** Present when the run stopped early: which step, and why. */
  refusedAt?: { label: string; commandType: string; reason?: string; correctiveAction?: string };
  /** True for every run this class performs. Never omitted, never false. */
  simulated: true;
  /** Named so a reader of the result cannot mistake it for a real runtime. */
  executor: "mock";
}

/**
 * The runtime every stage is actually advanced with.
 *
 * A single constant rather than a per-stage decision, because the honest
 * statement of this rung is that **the plan's runtime allocation is not
 * consulted**. `backend_implementation` is planned for `claude_code` and is
 * executed here by the mock, exactly like the other six.
 */
export const ORCHESTRATOR_RUNTIME_TYPE = "mock" as const;

/** The adapter identity that reports a mock run's result. */
export const MOCK_RUNTIME_ADAPTER_ID = "runtime-adapter-mock";

/** The identity backend-authored structural events are attributed to. */
export const ORCHESTRATOR_BACKEND_ID = "backend";

/**
 * The stages this rung orchestrates: the first six.
 *
 * `deployment_package` is absent on purpose — it is the approval-gated
 * stage, and the run stops before it.
 */
export const ORCHESTRATED_STAGES: readonly BuildStageName[] = BUILD_STAGE_SEQUENCE.slice(
  0,
  BUILD_STAGE_SEQUENCE.length - 1,
);

/** The gated stage the approval stands in front of. */
export const APPROVAL_GATED_STAGE: BuildStageName =
  BUILD_STAGE_SEQUENCE[BUILD_STAGE_SEQUENCE.length - 1] ?? "deployment_package";

/**
 * Which agent performs each stage, transcribed from the canonical run.
 *
 * `qa_validation` is the Inspector's own stage (`v1-scope.md` stage 6), so
 * assignment there is the job, not a conflict — the conflict F-05 names is
 * validating evidence you produced, which is checked separately.
 */
const STAGE_AGENT_ROLE: Record<BuildStageName, BuildAgentRole> = {
  planning: "architect",
  scaffold: "builder",
  frontend_implementation: "builder",
  backend_implementation: "builder",
  integration: "builder",
  qa_validation: "inspector",
  deployment_package: "builder",
};

/** The artifact each stage produces, from `domain-model.md` → Artifact types. */
const STAGE_ARTIFACT: Record<BuildStageName, { type: string; name: string }> = {
  planning: { type: "plan", name: "Plan artifact" },
  scaffold: { type: "source_code", name: "Application scaffold" },
  frontend_implementation: { type: "source_code", name: "Frontend implementation" },
  backend_implementation: { type: "source_code", name: "Backend implementation (simulated)" },
  integration: { type: "build_package", name: "Build package" },
  qa_validation: { type: "test_report", name: "QA test report" },
  deployment_package: { type: "deployment_package", name: "Deployment package" },
};

const AGENT_ID_BY_ROLE = new Map<string, string>(
  WORLD_AGENTS.map((agent) => [agent.role, agent.id]),
);
const HOME_BUILDING_BY_ROLE = new Map<string, string>(
  WORLD_AGENTS.map((agent) => [agent.role, agent.homeBuildingId]),
);

/** Deterministic per-stage identifiers, all derived from the plan. */
export function stageEntityIds(planId: string, stage: BuildStageName) {
  const stageId = plannedStageId(planId, stage);
  return {
    stageId,
    taskId: `${stageId}--task`,
    runId: `${stageId}--run`,
    artifactId: `${stageId}--artifact`,
    requirementId: `${stageId}--requirement`,
  };
}

/** The id of the approval the run stops at. Derived, so a replay reuses it. */
export function gateApprovalId(planId: string): string {
  return `${planId}--approval-${APPROVAL_GATED_STAGE}`;
}

/**
 * The whole run, as data, before anything is submitted.
 *
 * Pure and deterministic: same plan in, same ordered step list out, with
 * no clock, no randomness, and no state read. That is what makes the
 * ordering itself testable — "stages progress in order" is a property of
 * this list, provable without a database, rather than something observed
 * once in a live run and hoped for afterwards.
 */
export function planOrchestration(plan: BuildPlan): OrchestrationStep[] {
  const steps: OrchestrationStep[] = [];
  const { planId, riskClass } = plan;

  steps.push({
    role: "operator",
    stage: null,
    label: "Start the build",
    request: { commandType: "Build.Start", entityId: plan.buildId, params: {} },
  });

  for (const stageName of ORCHESTRATED_STAGES) {
    const planned = plan.stages.find((entry) => entry.name === stageName);
    if (!planned) continue;

    const ids = stageEntityIds(planId, stageName);
    const agentRole = STAGE_AGENT_ROLE[stageName];
    const agentId = AGENT_ID_BY_ROLE.get(agentRole) ?? agentRole;
    const homeBuildingId = HOME_BUILDING_BY_ROLE.get(agentRole) ?? planned.sourceBuildingId;
    const artifact = STAGE_ARTIFACT[stageName];
    const requirement = planned.requirements[0];

    const add = (
      role: OrchestratorRole,
      label: string,
      commandType: CommandRequest["commandType"],
      entityId: string,
      params: Record<string, unknown> = {},
    ) => {
      steps.push({ role, stage: stageName, label: `${stageName}: ${label}`, request: { commandType, entityId, params } });
    };

    add("backend", "create stage", "BuildStage.Create", ids.stageId);
    add("backend", "assign agent", "Agent.Assign", agentId, {
      taskId: ids.taskId,
      stageId: ids.stageId,
      destinationBuildingId: planned.sourceBuildingId,
    });

    /**
     * Travel is unconditional, including when the agent's home and the
     * stage's source building are the same.
     *
     * `assigned` has exactly one non-failure out-edge in the Agent
     * transition graph — `traveling` — so there is no legal path from
     * "assigned" to "working" that does not depart and arrive. The trip is
     * real in the event log rather than a visual flourish, and a
     * zero-distance one is honest about an agent that was already there.
     */
    add(agentRole, "depart for the stage", "Agent.Depart", agentId, {
      sourceBuildingId: homeBuildingId,
      destinationBuildingId: planned.sourceBuildingId,
    });
    add(agentRole, "arrive", "Agent.Arrive", agentId, {
      destinationBuildingId: planned.sourceBuildingId,
    });

    add("backend", "start stage", "BuildStage.Start", ids.stageId, {
      assignedAgentIds: [agentId],
      sourceBuildingId: planned.sourceBuildingId,
    });

    /**
     * `runtimeType` is the mock on every stage, including the one the plan
     * allocated to `claude_code`. The event log is the record an operator
     * and an auditor read, so it has to say what actually ran.
     */
    add(agentRole, "start work", "Agent.StartWork", agentId, {
      taskId: ids.taskId,
      stageId: ids.stageId,
      runtimeType: ORCHESTRATOR_RUNTIME_TYPE,
    });
    add(agentRole, "start run", "AgentRun.Start", ids.runId, {
      agentId,
      taskId: ids.taskId,
      runtimeType: ORCHESTRATOR_RUNTIME_TYPE,
      riskClass,
    });

    // The artifact is authored by the backend, not by the working agent —
    // the same attribution the canonical run uses. It is also what keeps
    // the Inspector's evidence independent at `qa_validation`: an artifact
    // the Inspector created could not be cited by the Inspector.
    add("backend", "create artifact", "Artifact.Create", ids.artifactId, {
      artifactId: ids.artifactId,
      artifactType: artifact.type,
      name: artifact.name,
      checksumStatus: "pending",
    });
    add("backend", "validate artifact", "Artifact.Validate", ids.artifactId, {
      checksum: `sha256:${ids.artifactId}`,
      evidenceIds: [],
    });
    add("backend", "mark artifact ready", "Artifact.MarkReady", ids.artifactId);

    add("runtime_adapter", "report run result", "AgentRun.Complete", ids.runId, {
      exitCode: 0,
      outputArtifactIds: [ids.artifactId],
      evidenceIds: [],
    });

    add("backend", "start requirement", "Requirement.Start", ids.requirementId);
    add("backend", "pass requirement", "Requirement.Pass", ids.requirementId, {
      evidenceIds: [ids.artifactId],
      validatorType: requirement?.validatorType ?? "automated",
    });

    /**
     * F-05 — independent validation, at the one stage that has it.
     *
     * Submitted by the Inspector agent, citing evidence the Inspector did
     * not create. Neither the orchestrator nor the backend can produce
     * `stage.validation_passed`: `requireIndependentInspector` refuses any
     * actor that is not an authenticated Inspector-role agent, and refuses
     * an Inspector citing its own output.
     */
    if (stageName === "qa_validation") {
      add("inspector", "independent validation", "BuildStage.Validate", ids.stageId, {
        outcome: "passed",
        evidenceIds: [ids.artifactId],
        passedRequirementIds: [ids.requirementId],
      });
    }

    add(agentRole, "complete work", "Agent.CompleteWork", agentId, {
      taskId: ids.taskId,
      outputArtifactIds: [ids.artifactId],
    });

    add("backend", "complete stage", "BuildStage.Complete", ids.stageId, {
      artifactIds: [ids.artifactId],
    });
    add(agentRole, "return home", "Agent.ReturnHome", agentId, { homeBuildingId });
  }

  const qaIds = stageEntityIds(planId, "qa_validation");
  steps.push({
    role: "backend",
    stage: null,
    label: "Request the approval that gates deployment",
    request: {
      commandType: "Approval.Request",
      entityId: gateApprovalId(planId),
      params: {
        approvalId: gateApprovalId(planId),
        title: `Approve the ${APPROVAL_GATED_STAGE.replace(/_/g, " ")}`,
        reason:
          "Independent QA validation passed. The deployment package stage is gated on this approval (domain-model.md Transfer invariant 4).",
        riskClass: plan.riskClass,
        evidenceIds: [qaIds.artifactId],
        // Stated in the event itself, so the limit travels with the record
        // rather than living only in a panel. A resolved approval here
        // records a decision and advances nothing: carrying the build past
        // this gate is AC-113's work, and this text is what stops the
        // approval control from being a silent no-op (F-105).
        recommendedAction:
          "Review the QA evidence, then record your decision. This run was performed by the mock executor and no code was executed. Resolving this approval records the decision only — orchestration past this gate is not implemented in this rung.",
      },
    },
  });

  return steps;
}

export interface OrchestratorActors {
  /** The authenticated operator on whose direction the build starts. */
  operator: CommandActor;
  architect: CommandActor;
  builder: CommandActor;
  inspector: CommandActor;
  backend: CommandActor;
  runtimeAdapter: CommandActor;
}

/**
 * Builds the default non-operator identities.
 *
 * Exported so the API composes them in one place, and so a test can see
 * exactly which identities a run uses without reading the class.
 */
export function defaultOrchestratorActors(operator: CommandActor): OrchestratorActors {
  const agent = (role: BuildAgentRole): CommandActor => ({
    actorType: "agent",
    actorId: AGENT_ID_BY_ROLE.get(role) ?? role,
    authenticated: true,
  });
  const service = (actorType: ActorType, actorId: string): CommandActor => ({
    actorType,
    actorId,
    authenticated: true,
  });
  return {
    operator,
    architect: agent("architect"),
    builder: agent("builder"),
    inspector: agent("inspector"),
    backend: service("backend", ORCHESTRATOR_BACKEND_ID),
    runtimeAdapter: service("runtime_adapter", MOCK_RUNTIME_ADAPTER_ID),
  };
}

export interface OrchestratorOptions {
  /**
   * Pause between steps, in milliseconds.
   *
   * Pacing exists so the operator can *watch* stages progress rather than
   * find a finished build. It is a display concern only: every step is
   * submitted and enforced identically at any delay, and tests run at 0.
   */
  stepDelayMs?: number;
  /** Injectable so tests never wait on a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Called after each step, for live logging. */
  onStep?: (result: OrchestrationStepResult) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class BuildOrchestrator {
  private readonly stepDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly onStep?: (result: OrchestrationStepResult) => void;

  constructor(
    private readonly commands: CommandHandler,
    options: OrchestratorOptions = {},
  ) {
    this.stepDelayMs = options.stepDelayMs ?? 0;
    this.sleep = options.sleep ?? defaultSleep;
    this.onStep = options.onStep;
  }

  /**
   * Submits the first step — `Build.Start` — synchronously, and hands back
   * the rest of the run.
   *
   * Split this way so the caller gets a truthful, immediate answer to "did
   * this start?" while the remaining ~90 steps proceed at a watchable pace.
   * Every reason a run cannot begin — no plan, an unreviewed or rejected
   * plan, a plan that changed since it was reviewed, a build that is
   * already running, an unauthenticated caller — is a `CommandHandler`
   * ruling on this one command, so it is refused here, before any stage
   * exists, carrying the handler's own reason rather than a summary of it.
   *
   * `Build.Start` also *is* the duplicate-start guard. It is submitted
   * synchronously and `CommandHandler.submit` is synchronous, so two
   * requests racing for the same build cannot both pass it: the second
   * finds the build already running and is refused before its first stage.
   */
  begin(persisted: PersistedPlan, actors: OrchestratorActors): OrchestrationHandle {
    const plan = persisted.plan;
    const steps = planOrchestration(plan);
    const [first, ...rest] = steps;

    // `planOrchestration` always emits `Build.Start` first; this is a
    // total-function guard, not a reachable state.
    if (!first) throw new Error("planOrchestration produced no steps");

    const outcome = this.commands.submit(first.request, this.actorFor(first.role, actors));
    const results: OrchestrationStepResult[] = [{ step: first, outcome }];
    this.onStep?.(results[0] as OrchestrationStepResult);

    if (!outcome.accepted) {
      return {
        started: false,
        outcome,
        result: this.refusal(plan, results, first, outcome, "not_startable"),
        continue: () => Promise.resolve(this.refusal(plan, results, first, outcome, "not_startable")),
      };
    }

    return {
      started: true,
      outcome,
      result: null,
      continue: () => this.drain(plan, rest, results, actors),
    };
  }

  /**
   * Convenience for tests and for any caller that does not need to answer
   * before the run finishes: begin, then drain to the gate.
   */
  async run(persisted: PersistedPlan, actors: OrchestratorActors): Promise<OrchestrationResult> {
    return this.begin(persisted, actors).continue();
  }

  /**
   * Submits the remaining steps in order.
   *
   * Stops at the first refusal and reports which step and why. It does not
   * retry, skip, or route around a guard — a refused step means the world
   * is not in the state the run assumed, and continuing past that would be
   * the orchestrator overruling the enforcement layer it exists to obey.
   */
  private async drain(
    plan: BuildPlan,
    steps: OrchestrationStep[],
    results: OrchestrationStepResult[],
    actors: OrchestratorActors,
  ): Promise<OrchestrationResult> {
    for (const [index, step] of steps.entries()) {
      if (this.stepDelayMs > 0) await this.sleep(this.stepDelayMs);

      const outcome = this.commands.submit(step.request, this.actorFor(step.role, actors));
      const result = { step, outcome };
      results.push(result);
      this.onStep?.(result);

      if (!outcome.accepted) return this.refusal(plan, results, step, outcome, "refused");
      void index;
    }

    return {
      status: "reached_approval_gate",
      buildId: plan.buildId,
      planId: plan.planId,
      results,
      approvalId: gateApprovalId(plan.planId),
      simulated: true,
      executor: "mock",
    };
  }

  private refusal(
    plan: BuildPlan,
    results: OrchestrationStepResult[],
    step: OrchestrationStep,
    outcome: CommandOutcome,
    status: Extract<OrchestrationStatus, "refused" | "not_startable">,
  ): OrchestrationResult {
    return {
      status,
      buildId: plan.buildId,
      planId: plan.planId,
      results,
      refusedAt: {
        label: step.label,
        commandType: step.request.commandType,
        reason: outcome.reason,
        correctiveAction: outcome.correctiveAction,
      },
      simulated: true,
      executor: "mock",
    };
  }

  private actorFor(role: OrchestratorRole, actors: OrchestratorActors): CommandActor {
    switch (role) {
      case "operator":
        return actors.operator;
      case "architect":
        return actors.architect;
      case "builder":
        return actors.builder;
      case "inspector":
        return actors.inspector;
      case "runtime_adapter":
        return actors.runtimeAdapter;
      case "backend":
        return actors.backend;
    }
  }
}
