import { IdSchema, V1RiskClassSchema } from "@foundry/contracts";
import { z } from "zod";
import { defineEvent } from "../envelope";

// docs/02-specification/event-model.md → "Approval"
export const ApprovalRequestedEvent = defineEvent(
  "approval.requested",
  z.object({
    approvalId: IdSchema,
    title: z.string().min(1),
    reason: z.string().min(1),
    riskClass: V1RiskClassSchema,
    evidenceIds: z.array(IdSchema),
    recommendedAction: z.string().min(1),
  }),
);

export const ApprovalApprovedEvent = defineEvent(
  "approval.approved",
  z.object({ resolvedBy: IdSchema, resolutionNote: z.string().optional() }),
);

export const ApprovalRejectedEvent = defineEvent(
  "approval.rejected",
  z.object({ resolvedBy: IdSchema, resolutionNote: z.string().optional() }),
);

export const ApprovalRevisionRequestedEvent = defineEvent(
  "approval.revision_requested",
  z.object({ resolvedBy: IdSchema, resolutionNote: z.string().optional() }),
);

export const APPROVAL_EVENTS = [
  ApprovalRequestedEvent,
  ApprovalApprovedEvent,
  ApprovalRejectedEvent,
  ApprovalRevisionRequestedEvent,
] as const;
