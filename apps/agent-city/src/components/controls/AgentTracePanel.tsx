"use client";

import { useRuntime } from "@/lib/mock-runtime";
import {
  activeAgentTraceLeg,
  deriveAgentTrace,
  type AgentTraceLeg,
} from "@/lib/world/agentTrace";
import { WORLD_AGENTS, WORLD_BUILDINGS } from "@foundry/world-model";
import type { Selection } from "./selection";

function placeLabel(id: string): string {
  return WORLD_BUILDINGS.find((building) => building.id === id)?.name ?? id;
}

function agentLabel(id: string): string {
  return WORLD_AGENTS.find((agent) => agent.id === id)?.role ?? id;
}

function evidenceCount(leg: AgentTraceLeg): number {
  return [leg.assignmentEventId, leg.departureEventId, leg.arrivalEventId].filter(Boolean).length;
}

export function AgentTracePanel({ onSelect }: { onSelect: (selection: Selection) => void }) {
  const { fixtureReplay } = useRuntime();
  if (!fixtureReplay) return null;

  const legs = deriveAgentTrace(fixtureReplay.events);
  const activeLeg = activeAgentTraceLeg(legs, fixtureReplay.cursor);

  return (
    <section className="foundry-detail rounded-xl p-3" aria-label="Agent trace replay">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="foundry-eyebrow">Agent trace</p>
          <h3 className="mt-1 text-xs font-medium text-neutral-200">Causal route recording</h3>
        </div>
        <span className="rounded-full border border-violet-300/20 px-2 py-0.5 text-[8px] uppercase tracking-[0.08em] text-violet-200">
          Fixture replay
        </span>
      </div>

      <p className="mt-2 text-[9px] leading-relaxed text-neutral-500">
        Replay a declared departure snapshot. Each leg links assignment, departure, and arrival
        evidence when those events exist.
      </p>

      <ol className="mt-3 space-y-1.5">
        {legs.map((leg) => {
          const active = activeLeg?.id === leg.id;
          const role = agentLabel(leg.agentId);
          const source = placeLabel(leg.sourceBuildingId);
          const destination = placeLabel(leg.destinationBuildingId);
          return (
            <li key={leg.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                aria-label={`Replay trace ${leg.sequence}: ${role} from ${source} to ${destination}`}
                onClick={() => {
                  fixtureReplay.previewAtCursor(leg.departureCursor);
                  onSelect({ kind: "agent", id: leg.agentId });
                }}
                className="foundry-nav-row group w-full rounded-lg border border-transparent px-2 py-2 text-left aria-[current=step]:border-violet-300/30 aria-[current=step]:bg-violet-300/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-neutral-600">
                    {String(leg.sequence).padStart(2, "0")}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-sky-300/50 to-violet-300/20" />
                  <span className="text-[8px] uppercase tracking-[0.08em] text-neutral-500">
                    {evidenceCount(leg)}/3 events
                  </span>
                </span>
                <span className="mt-1 flex items-center gap-1 text-[10px] text-neutral-300">
                  <span className="truncate">{source}</span>
                  <span aria-hidden="true" className="text-sky-300">
                    →
                  </span>
                  <span className="truncate">{destination}</span>
                </span>
                <span className="mt-0.5 block text-[9px] capitalize text-neutral-600">
                  {role} · departure event {leg.departureEventId.slice(-8)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-[9px] leading-relaxed text-neutral-600">
        Read-only fixture navigation. The arc is a declared source-to-destination cue, not a precise
        path, live location, or new operational event.
      </p>
    </section>
  );
}
