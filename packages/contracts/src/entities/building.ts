import { z } from "zod";
import { IdSchema, PositionSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Building
export const BuildingTypeSchema = z.enum([
  "lighthouse",
  "home",
  "construction_office",
  "warehouse",
  "qa",
  "deployment_dock",
  "construction_site",
]);
export type BuildingType = z.infer<typeof BuildingTypeSchema>;

export const BuildingStatusSchema = z.enum([
  "idle",
  "active",
  "waiting",
  "blocked",
  "degraded",
  "failed",
  "disconnected",
  "upgrading",
]);
export type BuildingStatus = z.infer<typeof BuildingStatusSchema>;

export const BuildingSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  buildingType: BuildingTypeSchema,
  level: z.number().int().positive(),
  status: BuildingStatusSchema,
  position: PositionSchema,
  capabilities: z.array(z.string()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  upgradeId: IdSchema.optional(),
  inventorySummary: z.string().optional(),
});
export type Building = z.infer<typeof BuildingSchema>;
