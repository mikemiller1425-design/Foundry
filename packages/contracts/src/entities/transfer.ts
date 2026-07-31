import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Transfer
export const TransferStatusSchema = z.enum([
  "created",
  "blocked",
  "ready",
  "loading",
  "in_transit",
  "unloading",
  "completed",
  "failed",
  "cancelled",
]);
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

// The three explicit V1 transfer legs (resolves audit finding B-01) — see
// docs/01-mission/v1-scope.md § "Transfer and approval scope".
export const TransferLegSchema = z.enum([
  "construction_office_to_warehouse",
  "warehouse_to_qa",
  "qa_to_deployment_dock",
]);
export type TransferLeg = z.infer<typeof TransferLegSchema>;

export const TransferSchema = z.object({
  id: IdSchema,
  buildId: IdSchema,
  stageId: IdSchema,
  leg: TransferLegSchema,
  status: TransferStatusSchema,
  sourceBuildingId: IdSchema,
  destinationBuildingId: IdSchema,
  artifactIds: z.array(IdSchema),
  vehicleId: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  blockerIds: z.array(IdSchema).optional(),
  failureReason: z.string().optional(),
  receiptArtifactId: IdSchema.optional(),
});
export type Transfer = z.infer<typeof TransferSchema>;
