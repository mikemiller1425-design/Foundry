import type { FoundryEvent } from "@foundry/event-types";
import { createEventFactory } from "./eventFactory";

/**
 * Pure builders for the two non-happy-path Approval resolutions
 * (docs/02-specification/event-model.md → "Approval"). The canonical
 * demo script always approves; these exist so reject/revision-request
 * behavior is independently testable without a second divergent "canonical"
 * script (v1-scope.md's Required workflow describes exactly one linear
 * journey).
 */
export function buildApprovalRejectedEvents(options: {
  seed: string;
  correlationId: string;
  approvalId: string;
  resolvedBy: string;
  resolutionNote?: string;
}): FoundryEvent[] {
  const event = createEventFactory(options.seed, options.correlationId, "evt-reject");
  return [
    event({
      type: "approval.rejected",
      entityType: "Approval",
      entityId: options.approvalId,
      actorType: "operator",
      actorId: options.resolvedBy,
      payload: { resolvedBy: options.resolvedBy, resolutionNote: options.resolutionNote },
    }),
  ];
}

export function buildApprovalRevisionRequestedEvents(options: {
  seed: string;
  correlationId: string;
  approvalId: string;
  stageId: string;
  resolvedBy: string;
  revisionId: string;
  reason: string;
  resolutionNote?: string;
}): FoundryEvent[] {
  const event = createEventFactory(options.seed, options.correlationId, "evt-revision");
  const revisionRequested = event({
    type: "approval.revision_requested",
    entityType: "Approval",
    entityId: options.approvalId,
    actorType: "operator",
    actorId: options.resolvedBy,
    payload: { resolvedBy: options.resolvedBy, resolutionNote: options.resolutionNote },
  });
  const revisionCreated = event({
    type: "revision.requested",
    entityType: "Revision",
    entityId: options.revisionId,
    actorType: "backend",
    actorId: "backend",
    payload: {
      revisionId: options.revisionId,
      stageId: options.stageId,
      reason: options.reason,
      requestedBy: "approval",
      sourceApprovalId: options.approvalId,
    },
    causationId: revisionRequested.id,
  });
  const revisionStarted = event({
    type: "revision.started",
    entityType: "Revision",
    entityId: options.revisionId,
    actorType: "backend",
    actorId: "backend",
    payload: { revisionId: options.revisionId },
  });
  const revisionCompleted = event({
    type: "revision.completed",
    entityType: "Revision",
    entityId: options.revisionId,
    actorType: "backend",
    actorId: "backend",
    payload: { revisionId: options.revisionId, resultingStageStatus: "running" },
  });
  return [revisionRequested, revisionCreated, revisionStarted, revisionCompleted];
}
