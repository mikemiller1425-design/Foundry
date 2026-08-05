"use client";

import {
  FOUNDRY_DISTRICTS,
  FOUNDRY_WORLD_LINKS,
  findFoundryDistrict,
} from "@/lib/world/worldAtlas";
import { useState } from "react";

export function WorldOverview({
  onClose,
  onEnterDistrict,
}: {
  onClose: () => void;
  onEnterDistrict: (districtId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("agent-city-operations");
  const selected = findFoundryDistrict(selectedId) ?? FOUNDRY_DISTRICTS[0]!;

  return (
    <section
      aria-label="Foundry world overview"
      className="absolute inset-0 z-20 overflow-hidden bg-[#07101d]/96 backdrop-blur-sm"
    >
      <div className="absolute inset-x-0 top-0 z-10 p-5 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:p-7">
        <div>
          <p className="foundry-eyebrow">Foundry world / concept atlas</p>
          <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">World overview</h1>
          <p className="mt-2 max-w-[250px] text-[10px] leading-relaxed text-slate-400 sm:max-w-xl sm:text-xs">
            <span className="sm:hidden">
              Only Agent City Operations is implemented. All other nodes are uncommissioned
              concepts.
            </span>
            <span className="hidden sm:inline">
              Agent City Operations is the only implemented fixture district. Every other district
              and corridor is an uncommissioned visual concept—not property, availability, or
              backend capability.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="foundry-chip absolute top-5 right-5 shrink-0 rounded-full px-3 py-1.5 text-[10px] text-neutral-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 sm:static"
        >
          Return to district
        </button>
      </div>

      <div className="absolute inset-x-4 top-44 bottom-64 sm:inset-x-10 sm:top-36 sm:bottom-36">
        <div className="relative size-full overflow-hidden rounded-[2rem] border border-sky-300/10 bg-[radial-gradient(circle_at_center,rgba(38,73,104,0.32),rgba(5,12,23,0.72)_58%,rgba(3,8,16,0.95))]">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(100,216,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(100,216,255,.18)_1px,transparent_1px)] [background-size:48px_48px]"
          />
          <svg aria-hidden="true" className="absolute inset-0 size-full">
            {FOUNDRY_WORLD_LINKS.map((link) => {
              const from = findFoundryDistrict(link.fromDistrictId);
              const to = findFoundryDistrict(link.toDistrictId);
              if (!from || !to) return null;
              return (
                <line
                  key={link.id}
                  x1={`${from.mapPosition[0]}%`}
                  y1={`${from.mapPosition[1]}%`}
                  x2={`${to.mapPosition[0]}%`}
                  y2={`${to.mapPosition[1]}%`}
                  stroke="#607d9d"
                  strokeWidth="1.5"
                  strokeDasharray="5 8"
                  opacity="0.48"
                />
              );
            })}
          </svg>

          {FOUNDRY_DISTRICTS.map((district) => {
            const active = district.id === selected.id;
            const implemented = district.status === "active-fixture";
            return (
              <button
                key={district.id}
                type="button"
                onClick={() => setSelectedId(district.id)}
                aria-pressed={active}
                className="group absolute -translate-x-1/2 -translate-y-1/2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300"
                style={{ left: `${district.mapPosition[0]}%`, top: `${district.mapPosition[1]}%` }}
              >
                <span
                  aria-hidden="true"
                  className={`mx-auto grid size-10 place-items-center rounded-2xl border transition sm:size-14 ${
                    active
                      ? "scale-110 border-sky-200/70 bg-sky-300/18 shadow-[0_0_32px_rgba(100,216,255,.28)]"
                      : "border-white/15 bg-slate-900/90 group-hover:border-white/30"
                  }`}
                >
                  <span
                    className={`block rounded-full ${implemented ? "size-3" : "size-2 border"}`}
                    style={
                      implemented
                        ? {
                            backgroundColor: district.accent,
                            boxShadow: `0 0 14px ${district.accent}`,
                          }
                        : { borderColor: district.accent }
                    }
                  />
                </span>
                <span className="mt-2 block max-w-20 text-center text-[8px] font-medium text-slate-200 sm:max-w-40 sm:text-[11px]">
                  {district.label}
                </span>
                <span className="mt-0.5 block text-center text-[8px] uppercase tracking-[0.08em] text-slate-500">
                  {implemented ? "Active fixture" : "Uncommissioned"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-10 rounded-2xl border border-white/10 bg-[#0d1728]/95 p-4 sm:inset-x-auto sm:right-7 sm:bottom-7 sm:w-[360px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="foundry-eyebrow">Selected district</p>
            <h2 className="mt-1 text-sm font-medium text-white">{selected.label}</h2>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.08em] ${
              selected.status === "active-fixture"
                ? "border-sky-300/25 text-sky-200"
                : "border-slate-500/25 text-slate-400"
            }`}
          >
            {selected.status === "active-fixture" ? "Fixture" : "No implementation"}
          </span>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">{selected.purpose}</p>
        {selected.status === "active-fixture" ? (
          <button
            type="button"
            onClick={() => onEnterDistrict(selected.id)}
            className="mt-3 w-full rounded-lg border border-sky-300/25 bg-sky-300/10 px-3 py-2 text-left text-[10px] text-sky-100 hover:bg-sky-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            Enter fixture district →
          </button>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-2 text-[9px] text-slate-500">
            No parcels, tenants, agents, rights, or backend route exist for this concept.
          </p>
        )}
      </div>
    </section>
  );
}
