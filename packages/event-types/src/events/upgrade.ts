import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Upgrade"
export const UpgradeEligibleEvent = defineEvent(
  "upgrade.eligible",
  z.object({
    buildingId: IdSchema,
    upgradeId: IdSchema,
    requirementEvidence: z.array(z.string()),
  }),
);

export const UpgradeRequestedEvent = defineEvent("upgrade.requested", z.object({}));

export const UpgradeApprovedEvent = defineEvent("upgrade.approved", z.object({}));

export const UpgradeStartedEvent = defineEvent("upgrade.started", z.object({}));

export const UpgradeCompletedEvent = defineEvent(
  "upgrade.completed",
  z.object({
    fromLevel: z.number().int().positive(),
    toLevel: z.number().int().positive(),
    capabilitiesAdded: z.array(z.string()),
  }),
);

export const UpgradeFailedEvent = defineEvent("upgrade.failed", z.object({}));

export const UPGRADE_EVENTS = [
  UpgradeEligibleEvent,
  UpgradeRequestedEvent,
  UpgradeApprovedEvent,
  UpgradeStartedEvent,
  UpgradeCompletedEvent,
  UpgradeFailedEvent,
] as const;
