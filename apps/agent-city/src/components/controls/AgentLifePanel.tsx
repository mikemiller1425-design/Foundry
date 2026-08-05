"use client";

import { describeEvent } from "@/components/timeline/describeEvent";
import { useRuntime } from "@/lib/mock-runtime";
import { SELECTABLE_WORLD_OBJECTS } from "@/lib/world/selectableObjects";
import type { Selection } from "./selection";

const AGENT_EVENT_PREFIX = "agent.";

export function AgentLifePanel({ onSelect }: { onSelect: (selection: Selection) => void }) {
  const { events, worldState } = useRuntime();

  return (
    <section className="foundry-detail rounded-xl p-3" aria-label="Agent life">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="foundry-eyebrow">Agent life</p>
          <h3 className="mt-1 text-xs font-medium text-neutral-200">Canonical presence</h3>
        </div>
        <span className="text-[9px] uppercase tracking-[0.08em] text-sky-300">Event-derived</span>
      </div>
      <ul className="mt-3 space-y-2">
        {worldState.agents.map((agent) => {
          const latestEvent = [...events]
            .reverse()
            .find(
              (event) => event.entityId === agent.id && event.type.startsWith(AGENT_EVENT_PREFIX),
            );
          const place = SELECTABLE_WORLD_OBJECTS.find(
            (object) => object.id === agent.currentBuildingId,
          );
          return (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "agent", id: agent.id })}
                className="foundry-nav-row w-full rounded-lg px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11px] capitalize text-neutral-200">{agent.role}</span>
                  <span className="text-[9px] uppercase tracking-[0.08em] text-neutral-500">
                    {agent.status}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-neutral-500">
                  {place?.label ?? agent.currentBuildingId}
                </span>
                <span className="mt-1 block truncate text-[9px] text-neutral-600">
                  {latestEvent ? describeEvent(latestEvent) : "No projected agent event"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[9px] leading-relaxed text-neutral-600">
        Presence follows projected events; it is not autonomous simulation or precise location.
      </p>
    </section>
  );
}
