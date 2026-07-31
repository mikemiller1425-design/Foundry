"use client";

import type { FoundryEvent } from "@foundry/event-types";
import { useRuntime } from "@/lib/mock-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { describeEvent } from "./describeEvent";

const ROW_HEIGHT_PX = 28;
const OVERSCAN_ROWS = 6;
const ALL = "__all__";

const SEVERITY_LABEL: Record<string, string> = {
  info: "Info",
  notice: "Notice",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};

function dedupeById(events: readonly FoundryEvent[]): FoundryEvent[] {
  const seen = new Map<string, FoundryEvent>();
  for (const event of events) {
    if (!seen.has(event.id)) seen.set(event.id, event);
  }
  return [...seen.values()];
}

export function EventTimeline() {
  const { events: rawEvents } = useRuntime();
  const events = useMemo(() => dedupeById(rawEvents), [rawEvents]);

  const [severityFilter, setSeverityFilter] = useState(ALL);
  const [entityTypeFilter, setEntityTypeFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [autoscrollPaused, setAutoscrollPaused] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const severityOptions = useMemo(
    () => [...new Set(events.map((e) => e.severity))].sort(),
    [events],
  );
  const entityTypeOptions = useMemo(
    () => [...new Set(events.map((e) => e.entityType))].sort(),
    [events],
  );
  const typeOptions = useMemo(() => [...new Set(events.map((e) => e.type))].sort(), [events]);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (e) =>
          (severityFilter === ALL || e.severity === severityFilter) &&
          (entityTypeFilter === ALL || e.entityType === entityTypeFilter) &&
          (typeFilter === ALL || e.type === typeFilter),
      ),
    [events, severityFilter, entityTypeFilter, typeFilter],
  );

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // --- Bounded rendering (windowing): only rows in view + overscan are
  //     mounted, regardless of how many events exist. ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(el);
    setContainerHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (autoscrollPaused) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filteredEvents.length, autoscrollPaused]);

  // Narrowing/widening the filter changes which array `scrollTop` indexes
  // into. Without resetting it, a stale scrollTop from a longer unfiltered
  // view can land past the end of a much shorter filtered one, and the
  // windowed slice comes back empty even though matching rows exist.
  useEffect(() => {
    setScrollTop(0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [severityFilter, entityTypeFilter, typeFilter]);

  const totalHeight = filteredEvents.length * ROW_HEIGHT_PX;
  const visibleRowCount = Math.ceil(containerHeight / ROW_HEIGHT_PX) + OVERSCAN_ROWS * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN_ROWS);
  const endIndex = Math.min(filteredEvents.length, startIndex + visibleRowCount);
  const visibleEvents = filteredEvents.slice(startIndex, endIndex);
  const offsetTop = startIndex * ROW_HEIGHT_PX;

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-2 py-1">
        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Severity</span>
          <select
            aria-label="Filter by severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5"
          >
            <option value={ALL}>All</option>
            {severityOptions.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Entity</span>
          <select
            aria-label="Filter by entity type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5"
          >
            <option value={ALL}>All</option>
            {entityTypeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-neutral-400">Type</span>
          <select
            aria-label="Filter by event type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded border border-neutral-700 bg-neutral-900 px-1 py-0.5"
          >
            <option value={ALL}>All</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-pressed={autoscrollPaused}
          onClick={() => setAutoscrollPaused((prev) => !prev)}
          className="ml-auto rounded border border-neutral-700 px-2 py-0.5 hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          {autoscrollPaused ? "Resume autoscroll" : "Pause autoscroll"}
        </button>
        <span className="text-neutral-500">
          {filteredEvents.length} / {events.length} events
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={containerRef}
          role="log"
          aria-label="Event timeline"
          aria-live={autoscrollPaused ? "off" : "polite"}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ transform: `translateY(${offsetTop}px)` }}>
              {visibleEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  data-testid="timeline-row"
                  onClick={() => setSelectedEventId(event.id)}
                  aria-pressed={selectedEventId === event.id}
                  style={{ height: ROW_HEIGHT_PX }}
                  className={`flex w-full items-center gap-2 truncate border-b border-neutral-900 px-2 text-left hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sky-500 ${
                    selectedEventId === event.id ? "bg-neutral-800" : ""
                  }`}
                >
                  <time className="shrink-0 text-neutral-500" dateTime={event.occurredAt}>
                    {event.occurredAt.slice(11, 19)}
                  </time>
                  <span
                    className={`shrink-0 rounded px-1 text-[10px] uppercase ${severityBadgeClass(event.severity)}`}
                  >
                    {event.severity}
                  </span>
                  <span className="shrink-0 text-neutral-400">{event.entityType}</span>
                  <span className="truncate">{describeEvent(event)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          data-testid="timeline-detail"
          aria-label="Selected event details"
          className="w-72 shrink-0 overflow-y-auto border-l border-neutral-800 p-2"
        >
          {selectedEvent ? (
            <>
              <h3 className="font-medium">{describeEvent(selectedEvent)}</h3>
              <dl className="mt-2 space-y-1 text-neutral-400">
                <div>
                  <dt className="inline text-neutral-500">type: </dt>
                  <dd className="inline">{selectedEvent.type}</dd>
                </div>
                <div>
                  <dt className="inline text-neutral-500">entity: </dt>
                  <dd className="inline">
                    {selectedEvent.entityType} {selectedEvent.entityId}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Not available — no 3D world object exists yet (build ladder rung FBL-016+)"
                className="mt-2 w-full cursor-not-allowed rounded border border-neutral-800 px-2 py-1 text-neutral-500"
              >
                Jump to world object — not yet available
              </button>
              <p className="mt-2 text-neutral-500">Payload</p>
              <pre className="mt-1 overflow-x-auto rounded bg-neutral-900 p-2 text-[10px] text-neutral-300">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-neutral-500">Select an event to inspect its payload.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function severityBadgeClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-900 text-red-200";
    case "error":
      return "bg-red-950 text-red-300";
    case "warning":
      return "bg-amber-900 text-amber-200";
    case "notice":
      return "bg-sky-900 text-sky-200";
    default:
      return "bg-neutral-800 text-neutral-300";
  }
}
