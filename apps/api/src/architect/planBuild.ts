import {
  BUILD_STAGE_SEQUENCE,
  CLAUDE_CODE_STAGE,
  type BuildPlan,
  type ObjectiveWorkspace,
  type PlannedStage,
  type V1RiskClass,
} from "@foundry/contracts";

/**
 * The Architect planning step (AC-108).
 *
 * Produces one schema-valid `BuildPlan` for a submitted objective. It is
 * **deterministic and template-driven**, and that is the design, not a
 * placeholder:
 *
 * - `interface-model.md` prohibits "unrestricted natural-language
 *   autonomous planning". A planner that invented its own stages, or
 *   called a model to decide them, would be exactly that.
 * - `v1-scope.md` § "V1 Build Stages" already fixes the seven stages, their
 *   locations, and their runtimes. The plan's shape is not an open
 *   question the Architect gets to answer; it is transcribed.
 * - What varies with the objective is the *objective*, which is carried
 *   through verbatim, and nothing else.
 *
 * So this function invents no requirements, no acceptance evidence, no
 * budget, and no runtime state beyond the approved objective and the
 * declared contract. Every value below is either from `v1-scope.md`, from
 * the operator's submission, or a generated identifier.
 *
 * **Nothing executes.** A plan is a proposal. Turning it into scheduled
 * stages is `AC-109`; authorizing a real run is `AC-110`.
 */

/**
 * Per-stage facts, transcribed from `v1-scope.md` § "V1 Build Stages".
 *
 * The `runtime` column is the load-bearing one: `backend_implementation`
 * is the single controlled Claude Code stage the specification names, and
 * `BuildPlanSchema` refuses the runtime anywhere else.
 */
const STAGE_TEMPLATE: Record<
  (typeof BUILD_STAGE_SEQUENCE)[number],
  {
    sourceBuildingId: string;
    destinationBuildingId: string;
    runtime: "mock" | "claude_code";
    summary: string;
    validatorType: string;
  }
> = {
  planning: {
    sourceBuildingId: "construction-office",
    destinationBuildingId: "construction-office",
    runtime: "mock",
    summary: "Produce the plan artifact: stages, requirements, and acceptance criteria.",
    validatorType: "plan_review",
  },
  scaffold: {
    sourceBuildingId: "construction-office",
    destinationBuildingId: "construction-office",
    runtime: "mock",
    summary: "Scaffold the application skeleton for the objective.",
    validatorType: "build",
  },
  frontend_implementation: {
    sourceBuildingId: "construction-office",
    destinationBuildingId: "construction-office",
    runtime: "mock",
    summary: "Implement the user-facing behaviour the objective describes, with its error states.",
    validatorType: "test",
  },
  backend_implementation: {
    sourceBuildingId: "construction-office",
    destinationBuildingId: "construction-office",
    // The one controlled Claude Code stage (v1-scope.md stage 4).
    runtime: "claude_code",
    summary: "Implement persistence and tests for the objective, under the controlled runtime.",
    validatorType: "test",
  },
  integration: {
    sourceBuildingId: "construction-office",
    destinationBuildingId: "warehouse",
    runtime: "mock",
    summary: "Wire the parts together and produce the single build package artifact.",
    validatorType: "build",
  },
  qa_validation: {
    sourceBuildingId: "warehouse",
    destinationBuildingId: "qa",
    runtime: "mock",
    summary: "Independent Inspector validation of the received artifact.",
    validatorType: "independent_validation",
  },
  deployment_package: {
    sourceBuildingId: "qa",
    destinationBuildingId: "deployment-dock",
    runtime: "mock",
    summary: "Approval-gated transfer to the Deployment Dock and receipt.",
    validatorType: "receipt",
  },
};

export interface PlanInputs {
  planId: string;
  projectId: string;
  buildId: string;
  objective: string;
  workspace: ObjectiveWorkspace;
  riskClass: V1RiskClass;
  createdAt: string;
}

/**
 * Deterministic stage identifiers.
 *
 * Derived from the plan id and the stage name so a plan is reproducible
 * and so `stageIds` is meaningful before any `BuildStage` entity exists.
 * These name *planned* stages; `AC-109` is what turns them into scheduled
 * `BuildStage` records.
 */
export function plannedStageId(planId: string, stageName: string): string {
  return `${planId}--${stageName}`;
}

export function planStageIds(planId: string): string[] {
  return BUILD_STAGE_SEQUENCE.map((name) => plannedStageId(planId, name));
}

export function buildPlanForObjective(inputs: PlanInputs): BuildPlan {
  const stages: PlannedStage[] = BUILD_STAGE_SEQUENCE.map((name, index) => {
    const template = STAGE_TEMPLATE[name];
    return {
      name,
      sequence: index + 1,
      sourceBuildingId: template.sourceBuildingId,
      destinationBuildingId: template.destinationBuildingId,
      runtime: template.runtime,
      required: true,
      requirements: [
        {
          name: `${name} complete`,
          description: template.summary,
          required: true,
          validatorType: template.validatorType,
          // Acceptance criteria are plain text and deliberately not
          // executable — an approved AC-107 contract decision. They state
          // what a human or an independent validator would check, not a
          // command to run.
          acceptanceCriteria: [
            `The ${name.replace(/_/g, " ")} stage completes with its stated work done.`,
            name === CLAUDE_CODE_STAGE
              ? "Correctness is determined by independent tests the Builder did not write and cannot run."
              : "Its output is reviewable and its completion is recorded as a declared event.",
          ],
        },
      ],
    };
  });

  return {
    planId: inputs.planId,
    projectId: inputs.projectId,
    buildId: inputs.buildId,
    objective: inputs.objective,
    workspace: inputs.workspace,
    riskClass: inputs.riskClass,
    stages,
    createdAt: inputs.createdAt,
  };
}

/** Total planned requirements, for the `build.planned` payload. */
export function planRequirementCount(plan: BuildPlan): number {
  return plan.stages.reduce((total, stage) => total + stage.requirements.length, 0);
}
