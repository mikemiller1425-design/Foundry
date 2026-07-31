import { FoundryEventSchema } from "@foundry/event-types";
import { describe, expect, it } from "vitest";
import {
  buildApprovalRejectedEvents,
  buildApprovalRevisionRequestedEvents,
} from "./approvalActions";
import { reduceWorldState } from "./worldStateReducer";
import { buildCanonicalScript } from "./script";

describe("buildApprovalRejectedEvents", () => {
  it("produces a single valid approval.rejected event", () => {
    const events = buildApprovalRejectedEvents({
      seed: "reject-test",
      correlationId: "build-1",
      approvalId: "approval-1",
      resolvedBy: "operator-1",
      resolutionNote: "Evidence insufficient",
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("approval.rejected");
    expect(FoundryEventSchema.safeParse(events[0]).success).toBe(true);
  });

  it("applying it to a WorldState with a pending approval marks it rejected", () => {
    const script = buildCanonicalScript("reject-integration");
    const requestedIndex = script.findIndex((e) => e.type === "approval.requested");
    const approvalId = script[requestedIndex]!.entityId;
    const upToRequest = script.slice(0, requestedIndex + 1);

    const rejectionEvents = buildApprovalRejectedEvents({
      seed: "reject-integration",
      correlationId: "build-1",
      approvalId,
      resolvedBy: "operator-1",
    });
    const state = reduceWorldState([...upToRequest, ...rejectionEvents]);
    expect(state.approvals[0]?.status).toBe("rejected");
  });
});

describe("buildApprovalRevisionRequestedEvents", () => {
  it("produces the full revision-request chain: approval.revision_requested + revision.requested/started/completed", () => {
    const events = buildApprovalRevisionRequestedEvents({
      seed: "revision-test",
      correlationId: "build-1",
      approvalId: "approval-1",
      stageId: "stage-1",
      resolvedBy: "operator-1",
      revisionId: "revision-1",
      reason: "Needs another pass",
    });
    expect(events.map((e) => e.type)).toEqual([
      "approval.revision_requested",
      "revision.requested",
      "revision.started",
      "revision.completed",
    ]);
    for (const e of events) {
      expect(FoundryEventSchema.safeParse(e).success).toBe(true);
    }
  });

  it("revision.requested carries causationId linking back to the approval.revision_requested event", () => {
    const events = buildApprovalRevisionRequestedEvents({
      seed: "revision-causation",
      correlationId: "build-1",
      approvalId: "approval-1",
      stageId: "stage-1",
      resolvedBy: "operator-1",
      revisionId: "revision-1",
      reason: "Needs another pass",
    });
    const [approvalEvent, revisionRequestedEvent] = events;
    expect(revisionRequestedEvent?.causationId).toBe(approvalEvent?.id);
  });

  it("applying it to a WorldState with a pending approval marks it revision_requested", () => {
    const script = buildCanonicalScript("revision-integration");
    const requestedIndex = script.findIndex((e) => e.type === "approval.requested");
    const approvalId = script[requestedIndex]!.entityId;
    const upToRequest = script.slice(0, requestedIndex + 1);

    const revisionEvents = buildApprovalRevisionRequestedEvents({
      seed: "revision-integration",
      correlationId: "build-1",
      approvalId,
      stageId: "stage-1",
      resolvedBy: "operator-1",
      revisionId: "revision-1",
      reason: "Needs another pass",
    });
    const state = reduceWorldState([...upToRequest, ...revisionEvents]);
    expect(state.approvals[0]?.status).toBe("revision_requested");
  });
});
