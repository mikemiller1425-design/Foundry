"use client";

import type { FoundryEvent } from "@foundry/event-types";
import { describeEvent } from "@/components/timeline/describeEvent";
import { useRuntime } from "@/lib/mock-runtime";
import { resolveWorldTargetForEvent } from "@/lib/world/worldTargetForEvent";
import { useMemo } from "react";
import type { Selection } from "./selection";

const MAX_ACTIVITY_ITEMS = 4;

function payloadContains(payload: Record<string, unknown>, key: string, id: string): boolean {
  const value = payload[key];
  return value === id || (Array.isArray(value) && value.includes(id));
}

/**
 * The relation is deliberately structural and read-only. It joins a
 * selection to canonical envelope ids and declared payload references; it
 * never infers activity from a building's appearance or an agent's
 * proximity in the scene.
 */
export function eventRelatesToSelection(event: FoundryEvent, selection: Selection): boolean {
  const payload = event.payload as Record<string, unknown>;

  // District and parcel concepts are frontend-only spatial organization.
  // Canonical runtime events do not reference them until a future adapter
  // contract is explicitly ratified, so never infer a relationship here.
  if (selection.kind === "district" || selection.kind === "parcel") return false;

  if (selection.kind === "agent") {
    return (
      (event.entityType === "Agent" && event.entityId === selection.id) ||
      payloadContains(payload, "agentId", selection.id) ||
      payloadContains(payload, "assignedAgentIds", selection.id)
    );
  }

  if (selection.kind === "stage") {
    return (
      (event.entityType === "BuildStage" && event.entityId === selection.id) ||
      payloadContains(payload, "stageId", selection.id)
    );
  }

  if (selection.kind === "vehicle") {
    return (
      (event.entityType === "Vehicle" && event.entityId === selection.id) ||
      payloadContains(payload, "vehicleId", selection.id)
    );
  }

  return (
    (event.entityType === "Building" && event.entityId === selection.id) ||
    payloadContains(payload, "buildingId", selection.id) ||
    payloadContains(payload, "homeBuildingId", selection.id) ||
    payloadContains(payload, "sourceBuildingId", selection.id) ||
    payloadContains(payload, "destinationBuildingId", selection.id)
  );
}

export function SelectionActivity({
  selection,
  onLocate,
}: {
  selection: Selection | null;
  onLocate?: (worldObjectId: string) => void;
}) {
  const { events } = useRuntime();
  const related = useMemo(() => {
    if (!selection) return [];
    return (
      events
        // `building.selected` records navigation, not operational activity.
        // It remains intact in the canonical timeline, but excluding it here
        // prevents repeated inspection clicks from hiding the place's actual
        // transfers, work, state changes, and upgrades.
        .filter(
          (event) =>
            event.type !== "building.selected" && eventRelatesToSelection(event, selection),
        )
        .slice(-MAX_ACTIVITY_ITEMS)
        .reverse()
    );
  }, [events, selection]);

  if (!selection) return null;

  return (
    <section aria-label="Selected object activity" className="mt-3 border-t border-white/8 pt-3">
      <div className="flex items-center justify-between">
        <h3 className="foundry-section-title">Recent activity</h3>
        <span className="text-[10px] tabular-nums text-neutral-600">{related.length}</span>
      </div>
      {related.length === 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
          No recorded event references this selection.
        </p>
      ) : (
        <ol className="mt-2 space-y-1.5" data-testid="selection-activity-list">
          {related.map((event) => {
            const resolution = resolveWorldTargetForEvent(event);
            return (
              <li key={event.id}>
                <details className="group rounded-lg border border-white/8 bg-black/15 px-2 py-1.5">
                  <summary className="cursor-pointer list-none text-[10px] leading-relaxed text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
                    <span className="mr-1.5 font-mono text-neutral-600">
                      {event.occurredAt.slice(11, 19)}
                    </span>
                    {describeEvent(event)}
                  </summary>
                  <dl className="mt-1.5 border-t border-white/8 pt-1.5 text-[10px] text-neutral-500">
                    <div>
                      <dt className="inline">event: </dt>
                      <dd className="inline font-mono text-neutral-400">{event.type}</dd>
                    </div>
                    <div>
                      <dt className="inline">authority: </dt>
                      <dd className="inline">{event.actorType}</dd>
                    </div>
                    <div>
                      <dt className="inline">severity: </dt>
                      <dd className="inline">{event.severity}</dd>
                    </div>
                  </dl>
                  {resolution.resolved && onLocate && (
                    <button
                      type="button"
                      onClick={() => onLocate(resolution.target.id)}
                      className="mt-2 w-full rounded-md border border-sky-300/20 bg-sky-300/5 px-2 py-1 text-left text-[10px] text-sky-200 hover:bg-sky-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                    >
                      Locate {resolution.target.label} in world
                    </button>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
