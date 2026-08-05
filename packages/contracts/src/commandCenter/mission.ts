import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";
import { EvidenceRefSchema, attested } from "./attested";

/**
 * The operational mission (Decision C-2, ratified 2026-08-05).
 *
 * A mission is **backend-owned truth**. The frontend renders it and has no
 * authoring path into it — every field here is produced by projecting the
 * persisted event log, never by a client writing a value.
 *
 * The seven items C-2 enumerates are **lifecycle facets, not a universal
 * sequential stage enum**. That distinction is load-bearing: the earlier
 * reading would have produced one shared enum every mission walks in order,
 * and a NAS inventory does not have a "launch" step in the same sense a
 * software build does. Facets describe what a mission must be able to
 * *express*; stages describe how one particular mission type proceeds.
 *
 * Mission type is therefore first class, and stages are declared **per type**
 * (see `MissionTypeDefinition`). Registering a new type adds no member to any
 * shared enum — acceptance proof 1.
 */

// --- Autonomy -------------------------------------------------------------

/**
 * The four autonomy labels (Package 1b-ii scope item 7).
 *
 * **A label grants no authority.** Effective ability is the intersection of
 * authenticated principal, backend permissions, explicit authorization,
 * mission constraints, budget, and external-action approval requirements —
 * see `autonomyGrantsNothing` in `@foundry/persistence`. This enum exists so
 * the level can be *displayed*, not so it can be *consulted* for a decision.
 */
export const AutonomyLevelSchema = z.enum(["prepare", "approve", "supervise", "manage_exceptions"]);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

/**
 * A mission's autonomy as projected.
 *
 * `not_recorded` is a **projection state, not a fifth selectable level**
 * (operator Amendment 2). Historical software-build events carry no autonomy
 * field; inferring one from observed behavior would manufacture a governance
 * fact, and defaulting to any of the four would misreport how a completed run
 * was actually supervised.
 */
export const MissionAutonomySchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("recorded"),
    level: AutonomyLevelSchema,
    evidence: z.array(EvidenceRefSchema).min(1),
  }),
  z.object({ state: z.literal("not_recorded"), reason: z.string().min(1) }),
]);
export type MissionAutonomy = z.infer<typeof MissionAutonomySchema>;

// --- Per-type stage declaration ------------------------------------------

export const MissionStageStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "blocked",
  "completed",
  "failed",
  "cancelled",
  "not_recorded",
]);
export type MissionStageStatus = z.infer<typeof MissionStageStatusSchema>;

/** One stage a mission *type* declares. Never a member of a global enum. */
export const MissionStageDefinitionSchema = z.object({
  /** Unique within its mission type only. Two types may reuse a key freely. */
  key: z.string().min(1),
  label: z.string().min(1),
  /** A checkpoint is a stage the operator is expected to inspect. */
  isCheckpoint: z.boolean().default(false),
});
export type MissionStageDefinition = z.infer<typeof MissionStageDefinitionSchema>;

/**
 * A mission type and the stages it declares.
 *
 * Adding one of these is the *entire* mechanism for introducing a new kind of
 * mission. No shared enum, discriminated union, or switch statement is edited,
 * which is what acceptance proof 1 demonstrates and what keeps `nas_inventory`
 * from needing a Package 2 amendment to a Package 1b-ii type.
 */
export const MissionTypeDefinitionSchema = z.object({
  missionType: z.string().min(1),
  label: z.string().min(1),
  stages: z.array(MissionStageDefinitionSchema).min(1),
});
export type MissionTypeDefinition = z.infer<typeof MissionTypeDefinitionSchema>;

export const MissionStageStateSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  isCheckpoint: z.boolean(),
  status: MissionStageStatusSchema,
  evidence: z.array(EvidenceRefSchema),
});
export type MissionStageState = z.infer<typeof MissionStageStateSchema>;

// --- Lifecycle facets -----------------------------------------------------

export const MissionBlockerSchema = z.object({
  key: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["notice", "warning", "error", "critical"]),
  occurredAt: TimestampSchema,
  evidence: z.array(EvidenceRefSchema).min(1),
});
export type MissionBlocker = z.infer<typeof MissionBlockerSchema>;

export const MissionDecisionSchema = z.object({
  decisionId: IdSchema,
  kind: z.enum(["approval", "rejection", "revision_requested", "authorization", "other"]),
  summary: z.string().min(1),
  decidedAt: TimestampSchema,
  /** Who decided. Absent from some historical events, so attested. */
  decidedBy: attested(z.string().min(1)),
  evidence: z.array(EvidenceRefSchema).min(1),
});
export type MissionDecision = z.infer<typeof MissionDecisionSchema>;

export const MissionOutcomeSchema = z.enum([
  "succeeded",
  "failed",
  "cancelled",
  "in_progress",
  "not_recorded",
]);
export type MissionOutcome = z.infer<typeof MissionOutcomeSchema>;

export const MissionLoadoutSchema = z.object({
  /** Agents assigned to the mission, with the events that assigned them. */
  agents: z.array(
    z.object({
      agentId: IdSchema,
      role: attested(z.string().min(1)),
      evidence: z.array(EvidenceRefSchema).min(1),
    }),
  ),
  /** Authority actually granted — authorization records, not autonomy labels. */
  authority: attested(
    z.object({
      authorizationId: IdSchema,
      scope: z.string().min(1),
    }),
  ),
  budget: attested(
    z.object({
      authorizedCeilingUsd: z.number().positive(),
      currency: z.literal("USD"),
    }),
  ),
  constraints: attested(z.array(z.string().min(1))),
});
export type MissionLoadout = z.infer<typeof MissionLoadoutSchema>;

export const MissionArtifactSchema = z.object({
  artifactId: IdSchema,
  kind: attested(z.string().min(1)),
  evidence: z.array(EvidenceRefSchema).min(1),
});
export type MissionArtifact = z.infer<typeof MissionArtifactSchema>;

/**
 * The projected operational mission.
 *
 * Field-for-field this is the level-2 "tactical mission" surface Decision C-4
 * enumerates — objective, agents, autonomy, loadout, authority, stages and
 * checkpoints, blockers, decisions, cost, artifacts — which is acceptance
 * proof 23. Every one of them is either `Attested` or carries its own
 * `evidence` array, which is proof 24.
 */
export const OperationalMissionSchema = z.object({
  missionId: IdSchema,
  missionType: z.string().min(1),
  missionTypeLabel: z.string().min(1),

  /** Facet 1 — briefing. */
  objective: attested(z.string().min(1)),
  /** Facet 2 — approved loadout, authority, budget, constraints. */
  loadout: MissionLoadoutSchema,
  /** Facet 3 — launch. */
  launchedAt: attested(TimestampSchema),
  /** Facet 4 — mission-specific stages and checkpoints. */
  stages: z.array(MissionStageStateSchema),
  /** Facet 5 — blockers and exceptions. */
  blockers: z.array(MissionBlockerSchema),
  /** Facet 6 — operator decisions. */
  decisions: z.array(MissionDecisionSchema),
  /** Facet 7 — outcome. */
  outcome: MissionOutcomeSchema,
  /** Facet 8 — evidence-backed debrief. */
  debriefEvidence: z.array(EvidenceRefSchema),

  autonomy: MissionAutonomySchema,
  /** Spend attributable to the mission. Never revenue — see money.ts. */
  spendUsd: attested(z.number().nonnegative()),
  artifacts: z.array(MissionArtifactSchema),

  /** Every event id the projection consumed, for level-3 descent. */
  sourceEventIds: z.array(IdSchema),
});
export type OperationalMission = z.infer<typeof OperationalMissionSchema>;

/** The level-2 fields C-4 requires. Used by the test that proves proof 23. */
export const LEVEL_2_MISSION_FIELDS = [
  "objective",
  "agents",
  "autonomy",
  "loadout",
  "authority",
  "stages",
  "checkpoints",
  "blockers",
  "decisions",
  "cost",
  "artifacts",
] as const;
