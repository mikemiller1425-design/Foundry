import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";

// docs/02-specification/domain-model.md → Upgrade
export const UpgradeStatusSchema = z.enum([
  "locked",
  "eligible",
  "awaiting_approval",
  "upgrading",
  "completed",
  "failed",
]);
export type UpgradeStatus = z.infer<typeof UpgradeStatusSchema>;

export const UpgradeSchema = z.object({
  id: IdSchema,
  buildingId: IdSchema,
  fromLevel: z.number().int().positive(),
  toLevel: z.number().int().positive(),
  status: UpgradeStatusSchema,
  requirementIds: z.array(IdSchema),
  createdAt: TimestampSchema,
  approvalId: IdSchema.optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  failureReason: z.string().optional(),
});
export type Upgrade = z.infer<typeof UpgradeSchema>;

// docs/02-specification/domain-model.md → Upgrade → "Warehouse Level 2
// prerequisites" / "Counting rule (resolves audit finding M-06)".
export const WAREHOUSE_LEVEL_2_SEEDED_PACKAGE_COUNT = 9;
export const WAREHOUSE_LEVEL_2_REQUIRED_PACKAGE_COUNT = 10;
export const WAREHOUSE_LEVEL_2_MIN_PASS_RATE = 0.9;
