"use client";

import { ATMOSPHERES, type AtmosphereMode } from "@/lib/world/atmosphere";

export function AtmospherePanel({
  mode,
  ambientMotion,
  reducedMotion,
  onModeChange,
  onAmbientMotionChange,
  onClose,
}: {
  mode: AtmosphereMode;
  ambientMotion: boolean;
  reducedMotion: boolean;
  onModeChange: (mode: AtmosphereMode) => void;
  onAmbientMotionChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="World atmosphere"
      className="absolute bottom-4 left-4 z-20 max-h-[calc(100%-2rem)] w-[min(20rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1220]/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="foundry-eyebrow">World atmosphere</p>
          <h2 className="mt-1 text-sm font-medium text-white">Choose how Foundry feels</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="foundry-chip rounded-full px-2 py-1 text-[9px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Close
        </button>
      </div>

      <div role="radiogroup" aria-label="Atmosphere palette" className="mt-4 grid gap-2">
        {ATMOSPHERES.map((atmosphere) => (
          <button
            key={atmosphere.id}
            type="button"
            role="radio"
            aria-checked={mode === atmosphere.id}
            onClick={() => onModeChange(atmosphere.id)}
            className="rounded-xl border border-white/8 bg-white/[0.025] p-3 text-left aria-checked:border-sky-300/40 aria-checked:bg-sky-300/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 rounded-full border border-white/20"
                style={{ background: atmosphere.ambientSignal }}
              />
              <span className="text-[11px] font-medium text-slate-200">{atmosphere.label}</span>
            </span>
            <span className="mt-1 block text-[9px] leading-relaxed text-slate-500">
              {atmosphere.description}
            </span>
          </button>
        ))}
      </div>

      <label className="mt-3 flex items-start gap-2 rounded-xl border border-white/8 p-3 text-[10px] text-slate-300">
        <input
          type="checkbox"
          checked={ambientMotion && !reducedMotion}
          disabled={reducedMotion}
          onChange={(event) => onAmbientMotionChange(event.target.checked)}
          className="mt-0.5 accent-sky-300"
        />
        <span>
          Ambient world motion
          <span className="mt-0.5 block text-[9px] leading-relaxed text-slate-500">
            {reducedMotion
              ? "Disabled because this device requests reduced motion."
              : "Decorative horizon signals only; agent and event state never changes."}
          </span>
        </span>
      </label>

      <p className="mt-3 text-[9px] leading-relaxed text-violet-200/75">
        Frontend-local preference. Palette and decorative motion change no events, severity,
        authority, permissions, controls, or backend data.
      </p>
    </section>
  );
}
