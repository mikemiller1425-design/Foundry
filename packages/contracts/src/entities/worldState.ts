import { z } from "zod";
import { IdSchema } from "../common";
import { AgentSchema } from "./agent";
import { ApprovalSchema } from "./approval";
import { BuildSchema } from "./build";
import { BuildingSchema } from "./building";
import { TransferSchema } from "./transfer";
import { PersistedPlanSchema } from "../plan";

// docs/02-specification/domain-model.md → WorldState
// Read-optimized projection for the frontend; not itself a source of
// operational truth (Required invariant: "frontend cannot write WorldState
// as authority").
export const HealthStatusSchema = z.enum(["healthy", "degraded", "critical", "disconnected"]);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const HealthReasonSchema = z.enum([
  "nominal",
  "connection_lost",
  "connection_restored",
  "agent_unreachable",
  "runtime_unavailable",
]);
export type HealthReason = z.infer<typeof HealthReasonSchema>;

export const HealthSummarySchema = z.object({
  status: HealthStatusSchema,
  reasons: z.array(HealthReasonSchema),
});
export type HealthSummary = z.infer<typeof HealthSummarySchema>;

export const ConnectionStatusSchema = z.enum(["connected", "stale", "disconnected"]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const DemoControlFlagsSchema = z.object({
  running: z.boolean(),
  paused: z.boolean(),
  speedMultiplier: z.number().positive(),
});
export type DemoControlFlags = z.infer<typeof DemoControlFlagsSchema>;

export const WorldStateSchema = z.object({
  buildings: z.array(BuildingSchema),
  agents: z.array(AgentSchema),
  currentBuild: BuildSchema.nullable(),
  /**
   * The plan for the current build, with its review state (AC-108).
   *
   * Optional rather than required so every V1 fixture, the frozen
   * canonical run, and the mock runtime's projection stay valid unchanged —
   * they predate plans entirely. Absent means "no plan"; it never means
   * "a plan exists and is being withheld".
   */
  currentPlan: PersistedPlanSchema.nullable().optional(),
  activeTransfers: z.array(TransferSchema),
  approvals: z.array(ApprovalSchema),
  inventoryCounts: z.record(z.string(), z.number().int().nonnegative()),
  health: HealthSummarySchema,
  lastProcessedEventId: IdSchema.nullable(),
  demoControlFlags: DemoControlFlagsSchema.optional(),
  connectionStatus: ConnectionStatusSchema.optional(),
});
export type WorldState = z.infer<typeof WorldStateSchema>;
