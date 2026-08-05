import type { FoundryEvent } from "@foundry/event-types";

export interface AgentTraceLeg {
  id: string;
  sequence: number;
  agentId: string;
  sourceBuildingId: string;
  destinationBuildingId: string;
  assignmentEventId: string | null;
  departureEventId: string;
  arrivalEventId: string | null;
  stageId: string | null;
  taskId: string | null;
  departureCursor: number;
  arrivalCursor: number | null;
}

/**
 * Builds a route index from declared fixture events only. A leg begins only
 * at `agent.departed`; assignment is supporting context and arrival is
 * attached only when the recording explicitly contains it. No path, intent,
 * or live position is inferred.
 */
export function deriveAgentTrace(events: readonly FoundryEvent[]): readonly AgentTraceLeg[] {
  const latestAssignment = new Map<string, Extract<FoundryEvent, { type: "agent.assigned" }>>();
  const openLeg = new Map<string, number>();
  const legs: AgentTraceLeg[] = [];

  events.forEach((event, index) => {
    if (event.type === "agent.assigned") {
      latestAssignment.set(event.entityId, event);
      return;
    }

    if (event.type === "agent.departed") {
      const assignment = latestAssignment.get(event.entityId);
      const assignmentMatches =
        assignment?.payload.destinationBuildingId === event.payload.destinationBuildingId;
      legs.push({
        id: event.id,
        sequence: legs.length + 1,
        agentId: event.entityId,
        sourceBuildingId: event.payload.sourceBuildingId,
        destinationBuildingId: event.payload.destinationBuildingId,
        assignmentEventId: assignmentMatches && assignment ? assignment.id : null,
        departureEventId: event.id,
        arrivalEventId: null,
        stageId: assignmentMatches && assignment ? assignment.payload.stageId : null,
        taskId: assignmentMatches && assignment ? assignment.payload.taskId : null,
        departureCursor: index + 1,
        arrivalCursor: null,
      });
      openLeg.set(event.entityId, legs.length - 1);
      return;
    }

    if (event.type === "agent.arrived") {
      const legIndex = openLeg.get(event.entityId);
      if (legIndex === undefined) return;
      const leg = legs[legIndex];
      if (!leg || leg.destinationBuildingId !== event.payload.destinationBuildingId) return;
      legs[legIndex] = {
        ...leg,
        arrivalEventId: event.id,
        arrivalCursor: index + 1,
      };
      openLeg.delete(event.entityId);
    }
  });

  return legs;
}

export function activeAgentTraceLeg(
  legs: readonly AgentTraceLeg[],
  cursor: number,
): AgentTraceLeg | null {
  return (
    [...legs]
      .reverse()
      .find(
        (leg) =>
          leg.departureCursor <= cursor &&
          (leg.arrivalCursor === null || cursor < leg.arrivalCursor),
      ) ?? null
  );
}
