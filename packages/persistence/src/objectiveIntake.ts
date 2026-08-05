import { randomUUID } from "node:crypto";
import { ObjectiveSubmissionSchema } from "@foundry/contracts";
import type { PersistedEvent } from "@foundry/event-types";
import type { CommandActor, CommandHandler, CommandOutcome } from "./commandHandler";

/**
 * Turns one operator intention into declared commands (AC-103).
 *
 * This is the first thing in Foundry that *decides what happens next*, and
 * it is deliberately the smallest possible version of that: an objective
 * becomes a `Project` and a `Build`, and then it stops. Nothing is planned,
 * scheduled, dispatched, or executed here — those belong to later rungs
 * with their own authorizations.
 *
 * The shape matters more than the size. Every V1.1 rung after this one adds
 * to an orchestrator, and the one property that must hold from the first
 * line is that **the orchestrator is a client of the same enforcement
 * everything else uses** (principle 1, ADR-002). So this class is given a
 * `CommandHandler` and nothing else: no `PersistenceService`, no
 * `appendEvent`, no reducer, no database. It cannot write a second way
 * because it cannot reach one — a property `objectiveIntake.test.ts`
 * asserts structurally rather than by review.
 *
 * That constraint is also why the V1 limits ("one active project", "one
 * active build") live in `CommandHandler` and not here. Intake reports the
 * handler's refusal; it does not make the ruling.
 */

export type ObjectiveRejectionCode = "unauthorized" | "invalid_objective" | "command_rejected";

export interface ObjectiveIssue {
  /** Dotted path into the submission, or `""` for a whole-submission issue. */
  field: string;
  message: string;
}

export interface ObjectiveIntakeResult {
  accepted: boolean;
  code?: ObjectiveRejectionCode;
  reason?: string;
  correctiveAction?: string;
  /** Per-field detail for `invalid_objective`; absent for other codes. */
  issues?: ObjectiveIssue[];
  projectId?: string;
  buildId?: string;
  objective?: string;
  /** The plan the Architect produced, when one was. */
  planId?: string;
  /**
   * Why planning did not happen, when the objective itself succeeded.
   * Reported rather than swallowed — a submission that quietly produced no
   * plan would leave the operator waiting for a panel that never arrives.
   */
  planRejection?: string;
  /** The events the accepted submission produced, in order. */
  events?: PersistedEvent[];
}

/** Mints the ids for a submission. Injectable so tests are deterministic. */
export type ObjectiveIdFactory = (kind: "project" | "build" | "plan") => string;

const defaultIdFactory: ObjectiveIdFactory = (kind) => `${kind}-${randomUUID()}`;

/**
 * Produces the plan for a newly created build (AC-108).
 *
 * Injected rather than imported so `@foundry/persistence` keeps no
 * dependency on the Architect implementation, and so a caller that wants
 * objective submission *without* planning — every existing test — simply
 * does not supply one.
 */
export type PlanFactory = (input: {
  planId: string;
  projectId: string;
  buildId: string;
  objective: string;
}) => { plan: unknown; stageIds: string[]; requirementCount: number };

export class ObjectiveIntake {
  constructor(
    private readonly commands: CommandHandler,
    private readonly newId: ObjectiveIdFactory = defaultIdFactory,
    private readonly planFactory?: PlanFactory,
  ) {}

  submit(raw: unknown, actor: CommandActor): ObjectiveIntakeResult {
    /**
     * Submitting an objective is a human act of direction, so it requires
     * an authenticated operator — the same standard `CommandHandler`
     * applies to resolving an approval (principle 14). An agent is refused
     * even when genuinely authenticated: an agent that could commission its
     * own work would make the operator's role decorative.
     *
     * This runs before validation so that an unauthenticated caller cannot
     * use the field-level error detail as a free schema oracle.
     */
    if (!actor.authenticated || actor.actorType !== "operator") {
      return {
        accepted: false,
        code: "unauthorized",
        reason:
          "Submitting an objective requires an authenticated operator (principle 14: humans govern). Agent, frontend, backend, and unauthenticated callers are rejected.",
        correctiveAction: "Present the operator credential printed by the API at startup.",
      };
    }

    const parsed = ObjectiveSubmissionSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        accepted: false,
        code: "invalid_objective",
        reason: "The objective is outside the bounded envelope this slice accepts.",
        correctiveAction:
          "Correct the fields listed below and resubmit. Nothing was created — a rejected submission leaves persisted state unchanged.",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      };
    }

    const { objective } = parsed.data;
    const projectId = this.newId("project");
    const buildId = this.newId("build");

    // `operator.objective_submitted` — the operator's intention becomes a
    // Project. `workspace` and `riskClass` are validated above but not sent:
    // the event carries neither field (`event-model.md`), and inventing a
    // payload field to hold them would be an undeclared event-model change
    // in a slice that executes nothing. They become persisted truth at the
    // rung where they govern a real run.
    const projectOutcome = this.commands.submit(
      { commandType: "Project.Create", entityId: projectId, params: { objective, projectId } },
      actor,
    );
    if (!projectOutcome.accepted) return this.fromRejectedCommand(projectOutcome);

    // `build.created` — the Build the operator will watch.
    const buildOutcome = this.commands.submit(
      {
        commandType: "Build.Create",
        entityId: buildId,
        params: { projectId, buildId, objective },
      },
      actor,
    );
    if (!buildOutcome.accepted) {
      /**
       * Reaching here means the Project was created and the Build was not.
       *
       * Every condition that can refuse `Build.Create` is checked before
       * the Project is created — an authenticated operator, a bounded
       * objective, no other open project or build — so this is a bug path,
       * not an operator path. It is reported rather than swallowed, and it
       * is deliberately *not* compensated: the event log is append-only
       * (principle 18), so there is no honest way to un-create the Project.
       * The next submission will be refused by the one-active-project
       * guard, which surfaces the inconsistency instead of hiding it.
       */
      return {
        ...this.fromRejectedCommand(buildOutcome),
        projectId,
        objective,
        events: projectOutcome.event ? [projectOutcome.event] : undefined,
      };
    }

    /**
     * AC-108 — the Architect plans the build it just created.
     *
     * Submitted through the same `CommandHandler`, as `Build.Plan`. It
     * produces a *proposal*: no `BuildStage` is scheduled, no agent is
     * assigned, and nothing executes. The operator reads it and records a
     * decision; that decision still authorizes nothing.
     *
     * A planning failure does **not** fail the submission. The objective,
     * the Project, and the Build are already real and correct; refusing
     * the whole submission because a proposal could not be drafted would
     * discard work the operator successfully performed. The failure is
     * reported instead, and the plan's absence is visible.
     */
    let planOutcome: CommandOutcome | undefined;
    let plannedId: string | undefined;
    if (this.planFactory) {
      const planId = this.newId("plan");
      plannedId = planId;
      const drafted = this.planFactory({ planId, projectId, buildId, objective });
      planOutcome = this.commands.submit(
        {
          commandType: "Build.Plan",
          entityId: buildId,
          params: {
            planId,
            planArtifactId: planId,
            stageIds: drafted.stageIds,
            requirementCount: drafted.requirementCount,
            plan: drafted.plan,
          },
        },
        actor,
      );
    }

    return {
      accepted: true,
      projectId,
      buildId,
      objective,
      // The plan's own id, not the command's `entityId` — `Build.Plan` is
      // addressed to the *build*, so reporting `entityId` here handed the
      // caller a build id labelled as a plan id. Caught by live check.
      planId: planOutcome?.accepted ? plannedId : undefined,
      planRejection: planOutcome && !planOutcome.accepted ? planOutcome.reason : undefined,
      events: [projectOutcome.event, buildOutcome.event, planOutcome?.event].filter(
        (event): event is PersistedEvent => event !== undefined,
      ),
    };
  }

  private fromRejectedCommand(outcome: CommandOutcome): ObjectiveIntakeResult {
    return {
      accepted: false,
      code: "command_rejected",
      reason: outcome.reason ?? `${outcome.commandType} was rejected.`,
      correctiveAction: outcome.correctiveAction,
    };
  }
}
