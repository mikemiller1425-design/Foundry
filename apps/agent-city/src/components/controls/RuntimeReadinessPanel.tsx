"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { runtimeSourceLabel } from "@/lib/runtime/adapter";

export function RuntimeReadinessPanel() {
  const { runtimeMode, runtimeSource, projectionStatus, connectionStatus, mutationsEnabled } =
    useRuntime();
  const sourceDeclared = Boolean(runtimeMode && runtimeSource);
  const projection = projectionStatus ?? "unavailable";
  const backendSafe =
    runtimeMode !== "backend" ||
    !mutationsEnabled ||
    (connectionStatus === "connected" && projection === "current");
  const aligned = sourceDeclared && backendSafe;

  return (
    <section className="foundry-detail rounded-xl p-3" aria-label="Frontend read boundary">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="foundry-eyebrow">Read boundary</p>
          <h3 className="mt-1 text-xs font-medium text-neutral-200">Backend handoff</h3>
        </div>
        <span className={aligned ? "text-[9px] text-emerald-300" : "text-[9px] text-amber-300"}>
          {aligned ? "Contract aligned" : "Degraded metadata"}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-[10px]">
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">authority</dt>
          <dd className="truncate text-right text-neutral-300">
            {runtimeSourceLabel(runtimeSource)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">projection</dt>
          <dd className="text-neutral-300">{projection}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">connection</dt>
          <dd className="text-neutral-300">{connectionStatus}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-600">writes</dt>
          <dd className="text-neutral-300">
            {mutationsEnabled
              ? runtimeMode === "backend"
                ? "backend-gated"
                : "fixture-local"
              : "disabled"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[9px] leading-relaxed text-neutral-600">
        This reports frontend adapter posture only—not backend, security, accessibility, or
        production readiness.
      </p>
    </section>
  );
}
