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

/**
 * Warehouse capacity per level (FBL-031).
 *
 * `domain-model.md` and `world-model.md` require capacity to move 25→100
 * on upgrade, but the frozen `Building` schema has no numeric capacity
 * field — so capacity is carried as a **capability string**, which is
 * the field the specification does provide for "what this building can
 * do", and which `upgrade.completed.capabilitiesAdded` is the declared
 * mechanism for changing.
 *
 * The `capacity_` prefix is not a new convention: the FBL-008 canonical
 * mock script already emits `capacity_100` in `capabilitiesAdded`. This
 * names the Level 1 counterpart the mock never had to state, so both
 * runtimes speak the same vocabulary.
 *
 * Encoding it this way is what makes the change *atomic*: level and
 * capacity are both written in the single `upgrade.completed` reducer
 * branch, so no intermediate state can ever show one without the other
 * (V-07).
 */
export const CAPACITY_CAPABILITY_PREFIX = "capacity_";
export const WAREHOUSE_LEVEL_1_CAPACITY = 25;
export const WAREHOUSE_LEVEL_2_CAPACITY = 100;

export function capacityCapability(capacity: number): string {
  return `${CAPACITY_CAPABILITY_PREFIX}${capacity}`;
}

/** Reads a building's capacity from its capabilities, or null if it declares none. */
export function readCapacity(capabilities: readonly string[]): number | null {
  for (const capability of capabilities) {
    if (!capability.startsWith(CAPACITY_CAPABILITY_PREFIX)) continue;
    const parsed = Number.parseInt(capability.slice(CAPACITY_CAPABILITY_PREFIX.length), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
