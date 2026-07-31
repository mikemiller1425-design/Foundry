import { z } from "zod";
import { IdSchema, PositionSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Vehicle (resolves audit finding B-04)
export const VehicleTypeSchema = z.literal("utility");
export type VehicleType = z.infer<typeof VehicleTypeSchema>;

export const VehicleStatusSchema = z.enum([
  "parked",
  "waiting",
  "loading",
  "in_transit",
  "unloading",
  "completed",
  "failed",
]);
export type VehicleStatus = z.infer<typeof VehicleStatusSchema>;

export const VehicleSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  vehicleType: VehicleTypeSchema,
  status: VehicleStatusSchema,
  homeBuildingId: IdSchema,
  position: PositionSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  currentTransferId: IdSchema.optional(),
  lastArrivedBuildingId: IdSchema.optional(),
});
export type Vehicle = z.infer<typeof VehicleSchema>;
