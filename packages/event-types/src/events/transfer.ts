import { IdSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Transfer"
export const TransferCreatedEvent = defineEvent("transfer.created", z.object({}));

// resolves audit finding M-03
export const TransferBlockedEvent = defineEvent(
  "transfer.blocked",
  z.object({ blockerIds: z.array(IdSchema), reason: z.string().min(1) }),
);

// Per-leg preconditions (resolves audit finding B-01) are documented in
// domain-model.md Transfer invariants and enforced by the mock runtime /
// backend, not carried as event payload fields.
export const TransferReadyEvent = defineEvent("transfer.ready", z.object({}));

export const TransferStartedEvent = defineEvent(
  "transfer.started",
  z.object({
    vehicleId: IdSchema,
    sourceBuildingId: IdSchema,
    destinationBuildingId: IdSchema,
    artifactIds: z.array(IdSchema),
  }),
);

export const TransferArrivedEvent = defineEvent("transfer.arrived", z.object({}));

export const TransferCompletedEvent = defineEvent(
  "transfer.completed",
  z.object({ receiptArtifactId: IdSchema }),
);

export const TransferFailedEvent = defineEvent(
  "transfer.failed",
  z.object({
    reason: z.string().min(1),
    artifactSafetyState: z.string().min(1),
    recoveryAction: z.string().min(1),
  }),
);

export const TRANSFER_EVENTS = [
  TransferCreatedEvent,
  TransferBlockedEvent,
  TransferReadyEvent,
  TransferStartedEvent,
  TransferArrivedEvent,
  TransferCompletedEvent,
  TransferFailedEvent,
] as const;
