"use client";

import { describeEvent } from "@/components/timeline/describeEvent";
import { useRuntime } from "@/lib/mock-runtime";
import {
  deriveOperationalComparison,
  selectEvidenceReferences,
} from "@/lib/runtime/operationalSnapshot";
import { useMemo, useState } from "react";

type SnapshotView = "changes" | "evidence";

function Metric({
  label,
  current,
  previous,
}: {
  label: string;
  current: string | number;
  previous: string | number;
}) {
  const changed = current !== previous;
  return (
    <div className="rounded-lg border border-white/8 bg-black/15 p-2">
      <dt className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">{label}</dt>
      <dd className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xs text-neutral-200">{current}</span>
        <span className={changed ? "text-[9px] text-sky-300" : "text-[9px] text-neutral-600"}>
          {changed ? `was ${previous}` : "unchanged"}
        </span>
      </dd>
    </div>
  );
}

export function OperationalSnapshotPanel() {
  const { events } = useRuntime();
  const [view, setView] = useState<SnapshotView>("changes");
  const comparison = useMemo(() => deriveOperationalComparison(events), [events]);
  const evidence = useMemo(() => selectEvidenceReferences(events), [events]);

  return (
    <section className="foundry-detail rounded-xl p-3" aria-label="Operational snapshot">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="foundry-eyebrow">Operational snapshot</p>
          <h3 className="mt-1 text-xs font-medium text-neutral-200">Projection history</h3>
        </div>
        <div
          role="group"
          aria-label="Operational snapshot view"
          className="foundry-chip rounded-lg p-0.5"
        >
          {(["changes", "evidence"] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={view === candidate}
              onClick={() => setView(candidate)}
              className="rounded-md px-2 py-1 text-[9px] capitalize text-neutral-500 aria-pressed:bg-sky-300/10 aria-pressed:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              {candidate}
            </button>
          ))}
        </div>
      </div>

      {view === "changes" ? (
        <div className="mt-3">
          <p className="text-[9px] leading-relaxed text-neutral-600">
            Current canonical projection compared with the previous operational event checkpoint.
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-1.5">
            <Metric
              label="Build"
              current={comparison.current.buildStatus}
              previous={comparison.previous.buildStatus}
            />
            <Metric
              label="Stages done"
              current={comparison.current.completedStages}
              previous={comparison.previous.completedStages}
            />
            <Metric
              label="Evidence refs"
              current={comparison.current.evidenceReferences}
              previous={comparison.previous.evidenceReferences}
            />
            <Metric
              label="Exceptions seen"
              current={comparison.current.exceptionEvents}
              previous={comparison.previous.exceptionEvents}
            />
          </dl>
          <div className="mt-2 rounded-lg border border-white/8 p-2">
            <p className="text-[9px] uppercase tracking-[0.08em] text-neutral-600">Latest change</p>
            <p className="mt-1 text-[10px] leading-relaxed text-neutral-300">
              {comparison.current.latestEvent
                ? describeEvent(comparison.current.latestEvent)
                : "No operational event recorded"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[9px] leading-relaxed text-neutral-600">
            References only. “Recorded” means a durable record event exists; contents are not
            inspected or verified here.
          </p>
          {evidence.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-white/10 p-2 text-[10px] text-neutral-600">
              No evidence references in this projection.
            </p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {evidence.slice(0, 6).map((item) => (
                <li key={item.id} className="rounded-lg border border-white/8 bg-black/15 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="min-w-0 truncate font-mono text-[9px] text-neutral-300"
                      title={item.id}
                    >
                      {item.id}
                    </span>
                    <span
                      className={
                        item.state === "recorded"
                          ? "text-[9px] text-emerald-300"
                          : "text-[9px] text-amber-300"
                      }
                    >
                      {item.state === "recorded" ? "Recorded" : "Reference only"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[9px] text-neutral-600">
                    {item.latestEventType} · {item.referenceCount} reference
                    {item.referenceCount === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
