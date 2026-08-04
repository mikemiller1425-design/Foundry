import {
  authorizesPlan,
  planRevision,
  type BuildStageName,
  type ExecutionAuthorization,
  type PersistedPlan,
} from "@foundry/contracts";
import { planContentHash, plansContentHashEquals } from "./planContentHash";
import type { PersistenceService } from "./persistenceService";

/**
 * The execution authorization gate (AC-110).
 *
 * This is the thing that must be passed before a real model invocation is
 * dispatched. `AC-111` builds the dispatcher; this rung builds the gate it
 * has to pass through, and proves it in both directions.
 *
 * ## What is and is not claimed here
 *
 * Stated plainly, because the difference matters: **there is no real
 * invocation for this gate to prevent yet.** No runtime is wired, no
 * process is spawned, and no authorization is spent. What this rung
 * delivers is the decision procedure, the persisted authorization record,
 * and the refusals — proven by test and over the wire. The claim "an
 * unauthorized real invocation is refused" becomes fully demonstrable at
 * `AC-111`, when there is an invocation to refuse; what is demonstrable
 * now is that the gate refuses, exhaustively and with zero side effects.
 *
 * ## Design
 *
 * **Pure and total.** It takes the documents and returns *every* reason it
 * refuses, rather than throwing on the first. An operator debugging a
 * refused authorization should see all of it at once instead of peeling
 * reasons off one attempt at a time.
 *
 * **It writes nothing.** Not "it happens not to write" — it holds no
 * `PersistenceService` and no `appendEvent`. Reading persisted truth is
 * `readExecutionGateInput`'s job, and that function only reads. So "an
 * unauthorized attempt has zero side effects" (`F-114`) is a property of
 * what the gate can reach, not of how carefully it was written.
 *
 * **It fails closed.** Every path that cannot establish permission returns
 * `permitted: false`. There is no default-allow branch, and the only way
 * to reach `permitted: true` is for every check to pass.
 */

export type ExecutionRefusalCode =
  | "no_plan"
  | "plan_not_reviewed"
  | "plan_review_not_proceed"
  | "no_authorization"
  | "plan_content_hash_mismatch"
  | "plan_modified"
  | "stage_not_authorized"
  | "stage_not_in_plan"
  | "stage_not_real_execution"
  | "build_mismatch"
  | "project_mismatch"
  | "plan_id_mismatch"
  | "workspace_mismatch"
  | "risk_class_mismatch"
  | "authorization_already_spent";

export interface ExecutionRefusal {
  code: ExecutionRefusalCode;
  reason: string;
  correctiveAction: string;
}

export interface ExecutionGateInput {
  /** The plan for the build, as persisted. `null` when there is none. */
  persistedPlan: PersistedPlan | null;
  buildId: string;
  /** The stage a caller proposes to execute for real. */
  stageName: BuildStageName;
  /**
   * The hash **recomputed from persisted content** by the caller.
   *
   * Passed in rather than derived here so this module stays pure, and so
   * the value is unambiguously the backend's own — see `planContentHash`.
   */
  currentContentHash: string | null;
  /**
   * Ids of real (`claude_code`) `AgentRun`s already recorded against this
   * build's stage. A non-empty list means the single-use authorization has
   * been spent.
   */
  spentRunIds: readonly string[];
}

export interface ExecutionGateDecision {
  permitted: boolean;
  refusals: ExecutionRefusal[];
  /** The authorization that permitted it, when one did. */
  authorization: ExecutionAuthorization | null;
  /** Always present, so a caller cannot mistake this for a dispatch. */
  executed: false;
}

function refusal(
  code: ExecutionRefusalCode,
  reason: string,
  correctiveAction: string,
): ExecutionRefusal {
  return { code, reason, correctiveAction };
}

/**
 * Decides whether one real execution of one stage is currently permitted.
 *
 * Reaching `permitted: true` still starts nothing. It reports that the
 * gate would open; opening it is `AC-111`'s act, under this same
 * authorization, once.
 */
export function evaluateExecutionGate(input: ExecutionGateInput): ExecutionGateDecision {
  const refusals: ExecutionRefusal[] = [];
  const deny = (decisionRefusals: ExecutionRefusal[]): ExecutionGateDecision => ({
    permitted: false,
    refusals: decisionRefusals,
    authorization: null,
    executed: false,
  });

  const persisted = input.persistedPlan;
  if (!persisted) {
    return deny([
      refusal(
        "no_plan",
        `No plan is recorded for build ${input.buildId}. Nothing can be authorized, because there is nothing that describes what would run.`,
        "Submit an objective so the Architect produces a plan, then read and review it.",
      ),
    ]);
  }

  // Review is checked before the authorization: an authorization can only
  // exist on a reviewed plan, so reporting "no authorization" first would
  // send the operator to issue one they are not yet eligible to issue.
  if (!persisted.review) {
    refusals.push(
      refusal(
        "plan_not_reviewed",
        `Plan ${persisted.plan.planId} has not been reviewed. Nothing runs from a plan nobody read (principle 14: humans govern).`,
        "Read the plan and record a decision on it.",
      ),
    );
  } else if (persisted.review.decision !== "proceed") {
    refusals.push(
      refusal(
        "plan_review_not_proceed",
        `Plan ${persisted.plan.planId} was reviewed as ${persisted.review.decision}, not proceed.`,
        "A recorded review is an immutable decision. It is not re-decided.",
      ),
    );
  }

  const authorization = persisted.authorization;
  if (!authorization) {
    refusals.push(
      refusal(
        "no_authorization",
        `No execution authorization exists for plan ${persisted.plan.planId}. A reviewed plan is not permission to run: authorizing is a separate act (F-113).`,
        "Authorize exactly one stage, once, having read what would run.",
      ),
    );
    return deny(refusals);
  }

  // The authorization names one stage. A request for any other stage is
  // outside it, however valid the authorization is in every other respect.
  if (authorization.stageName !== input.stageName) {
    refusals.push(
      refusal(
        "stage_not_authorized",
        `The authorization covers \`${authorization.stageName}\`, not \`${input.stageName}\`. An authorization is never build-wide.`,
        `Authorize \`${input.stageName}\` separately, or execute the stage that was authorized.`,
      ),
    );
  }

  /**
   * **The binding** (`F-113a`).
   *
   * Compared against the hash the caller recomputed from persisted
   * content — never against anything the authorization carried alone, and
   * never against a value that reached the process from a client.
   */
  if (!input.currentContentHash) {
    refusals.push(
      refusal(
        "plan_content_hash_mismatch",
        "The plan's content hash could not be recomputed from persisted content, so the authorization cannot be shown to still bind to it.",
        "Re-read the persisted plan. An authorization is never honoured on an unverifiable binding.",
      ),
    );
  } else if (!plansContentHashEquals(authorization.planContentHash, input.currentContentHash)) {
    refusals.push(
      refusal(
        "plan_content_hash_mismatch",
        `The plan changed after it was authorized. Authorized against ${authorization.planContentHash}; the persisted plan now hashes to ${input.currentContentHash}. A modified plan invalidates its authorization (F-113).`,
        "Re-read the current plan and authorize against it, if that is still what you intend.",
      ),
    );
  }

  /**
   * Everything else the authorization asserts, checked against the plan.
   *
   * `authorizesPlan` re-checks the content hash too. That overlap is
   * deliberate: this module must refuse on the binding even if the shared
   * check is ever changed, and the shared check must refuse on it even if
   * a different caller forgets to. Two independent refusals for the most
   * consequential condition is the correct amount.
   */
  const pairing = authorizesPlan(authorization, persisted.plan, input.currentContentHash ?? "");
  for (const mismatch of pairing.mismatches) {
    if (mismatch === "plan_content_hash_mismatch") continue; // already reported above
    if (mismatch === "plan_modified") {
      refusals.push(
        refusal(
          "plan_modified",
          `The plan's revision indicator changed since authorization (authorized ${authorization.planRevision}, current ${planRevision(persisted.plan)}). This is a change indicator, not the binding — the binding is the content hash.`,
          "Re-read the current plan and authorize against it.",
        ),
      );
      continue;
    }
    refusals.push(
      refusal(
        mismatch,
        `The authorization does not match the persisted plan: ${mismatch.replace(/_/g, " ")}.`,
        "Re-read the current plan and authorize against it.",
      ),
    );
  }

  if (authorization.buildId !== input.buildId) {
    refusals.push(
      refusal(
        "build_mismatch",
        `The authorization was issued for build ${authorization.buildId}, not ${input.buildId}.`,
        "Authorize the build you intend to run.",
      ),
    );
  }

  /**
   * **Single-use** (`F-113`).
   *
   * Spend is derived from persisted truth — a real `AgentRun` already
   * recorded for this stage — rather than from a mutable "spent" flag
   * somebody has to remember to set. A run that started and then failed
   * still counts as spent, which is the behaviour `F-124` requires: a
   * spent real execution is never automatically restarted.
   */
  if (input.spentRunIds.length > 0) {
    refusals.push(
      refusal(
        "authorization_already_spent",
        `This authorization is spent: a real run already exists for \`${input.stageName}\` (${input.spentRunIds.join(", ")}). One authorization never covers a second run (F-113).`,
        "Issue a new authorization if you genuinely intend to run this stage again. A spent execution is never restarted automatically.",
      ),
    );
  }

  if (refusals.length > 0) return deny(refusals);

  return { permitted: true, refusals: [], authorization, executed: false };
}

/**
 * Gathers the gate's inputs from persisted truth. **Reads only.**
 *
 * The content hash is recomputed here from the persisted plan rather than
 * read back from the stored field. Trusting the stored value would make
 * the binding a check against a copy of itself; recomputing means a plan
 * whose stored hash and stored content ever disagreed fails closed.
 */
export function readExecutionGateInput(
  persistence: PersistenceService,
  buildId: string,
  stageName: BuildStageName,
): ExecutionGateInput {
  const persistedPlan =
    persistence
      .listEntities<PersistedPlan>("plans")
      .find((entry) => entry.plan.buildId === buildId) ?? null;

  return {
    persistedPlan,
    buildId,
    stageName,
    currentContentHash: persistedPlan ? planContentHash(persistedPlan.plan) : null,
    spentRunIds: realRunIdsForStage(persistence, buildId, stageName),
  };
}

/**
 * Real (`claude_code`) runs already recorded for a build's named stage.
 *
 * Resolved through the persisted relationships — `AgentRun.taskId` →
 * `Task.stageId` → `BuildStage` — rather than by pattern-matching
 * identifiers. Ids happen to be derivable today; relationships are what
 * the model actually guarantees.
 */
function realRunIdsForStage(
  persistence: PersistenceService,
  buildId: string,
  stageName: BuildStageName,
): string[] {
  const stageIds = new Set(
    persistence
      .listEntities<{ id: string; buildId: string; name: string }>("buildStages")
      .filter((stage) => stage.buildId === buildId && stage.name === stageName)
      .map((stage) => stage.id),
  );
  if (stageIds.size === 0) return [];

  const taskIds = new Set(
    persistence
      .listEntities<{ id: string; stageId: string }>("tasks")
      .filter((task) => stageIds.has(task.stageId))
      .map((task) => task.id),
  );

  return persistence
    .listEntities<{ id: string; taskId: string; runtimeType: string }>("agentRuns")
    .filter((run) => run.runtimeType === "claude_code" && taskIds.has(run.taskId))
    .map((run) => run.id);
}
