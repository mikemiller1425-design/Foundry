"use client";

import { FOUNDRY_DISTRICTS, FOUNDRY_PARCELS } from "@/lib/world/worldAtlas";
import type { Selection } from "./selection";

export function WorldAtlasPanel({
  selection,
  onSelect,
}: {
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <section aria-label="Fixture world atlas" className="foundry-detail rounded-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="foundry-eyebrow">World atlas</p>
          <h3 className="mt-1 text-xs font-medium text-neutral-200">Concept parcels</h3>
        </div>
        <span className="rounded-full border border-violet-300/20 bg-violet-300/8 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-violet-200">
          Fixture only
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
        Fictional tenants and tenure concepts for visual exploration; no ownership, lease, price,
        entitlement, or agent access is granted.
      </p>

      <ul className="mt-3 space-y-1">
        {FOUNDRY_DISTRICTS.map((district) => (
          <li key={district.id}>
            <button
              type="button"
              onClick={() => onSelect({ kind: "district", id: district.id })}
              aria-pressed={selection?.kind === "district" && selection.id === district.id}
              className="foundry-nav-row flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              <span className="text-[11px] text-neutral-200">{district.label}</span>
              <span className="text-[9px] uppercase tracking-[0.08em] text-violet-300">
                {district.status === "active-fixture" ? "Fixture" : "Concept"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ul className="mt-1 space-y-1 border-l border-white/8 pl-2">
        {FOUNDRY_PARCELS.map((parcel) => (
          <li key={parcel.id}>
            <button
              type="button"
              onClick={() => onSelect({ kind: "parcel", id: parcel.id })}
              aria-pressed={selection?.kind === "parcel" && selection.id === parcel.id}
              className="foundry-nav-row flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            >
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-sm"
                style={{ backgroundColor: parcel.accent }}
              />
              <span className="min-w-0 flex-1 truncate text-[10px] text-neutral-300">
                {parcel.label}
              </span>
              <span className="max-w-[42%] truncate text-[9px] text-neutral-600">
                {parcel.tenant ?? "Unassigned"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
