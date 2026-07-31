"use client";

import { CollapseToggleButton, ResizeHandle, useCollapsible, useResizable } from "@foundry/ui";
import { ApprovalCard } from "@/components/controls/ApprovalCard";
import { CommandBar } from "@/components/controls/CommandBar";
import { LiveIntelligence } from "@/components/controls/LiveIntelligence";
import { SelectedObjectDetail } from "@/components/controls/SelectedObjectDetail";
import type { Selection } from "@/components/controls/selection";
import { StageAgentPanel } from "@/components/controls/StageAgentPanel";
import { EventTimeline } from "@/components/timeline/EventTimeline";
import { useRuntime } from "@/lib/mock-runtime";
import { SELECTABLE_WORLD_OBJECTS } from "@/lib/world/selectableObjects";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import type { CameraControllerHandle } from "@/components/world/cameraController";
import { CameraHud } from "@/components/world/CameraHud";
import type { LighthouseMarkerState } from "@/components/world/lighthouseMarkerState";
import { LighthouseMarker } from "@/components/world/LighthouseMarker";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import { WorldObjectMarkers } from "@/components/world/WorldObjectMarkers";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEFT_NAV_PANEL, RIGHT_INTEL_PANEL, TIMELINE_PANEL } from "./panelConfig";
import { REGION_PLACEHOLDER } from "./regionPlaceholder";

// Ultrawide application shell (FBL-005 layout, FBL-006 interaction,
// FBL-009 event timeline, FBL-010 2D operational controls, FBL-011 empty
// R3F world, FBL-012 camera and navigation, FBL-013 spatial environment,
// FBL-014 Lighthouse, FBL-015 object selection): full-viewport region
// layout with generic collapse/resize/keyboard behavior (@foundry/ui)
// and real controls driven by the FBL-008 mock runtime — see
// docs/02-specification/interface-model.md.
export function AppShell() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const lighthouseMarkerRef = useRef<LighthouseMarkerState | null>(null);
  const worldObjectMarkerMapRef = useRef<WorldObjectMarkerMap>(new Map());
  const cameraRef = useRef<CameraControllerHandle>(null);
  const { selectBuilding, clearSelection } = useRuntime();

  // The single funnel for every selection source (3D pointer click, 3D
  // keyboard Enter/Space, and the left navigator): updates the shared 2D
  // selection state, emits the real building.selected event
  // (event-model.md — never a mutation of operational truth), and moves
  // the FBL-012 camera to focus on it.
  const handleSelect = useCallback(
    (next: Selection) => {
      setSelection(next);
      if (next.kind === "building") {
        selectBuilding(next.id);
        const target = SELECTABLE_WORLD_OBJECTS.find((o) => o.id === next.id);
        if (target) {
          const [x, y, z] = target.focusPosition;
          cameraRef.current?.focus({ x, y, z });
        }
      }
    },
    [selectBuilding],
  );

  const handleSelectBuildingId = useCallback(
    (id: string) => handleSelect({ kind: "building", id }),
    [handleSelect],
  );

  // Escape clears selection regardless of which control currently has
  // focus (interface-model.md "Keyboard operation": "Escape closes
  // panels where appropriate") — not scoped to the canvas, since the
  // navigator's own selected-object button may be what's focused.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setSelection((current) => {
        if (current) clearSelection();
        return null;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  const leftNavCollapsible = useCollapsible();
  const leftNavResizable = useResizable({
    defaultSize: LEFT_NAV_PANEL.defaultSize,
    min: LEFT_NAV_PANEL.min,
    max: LEFT_NAV_PANEL.max,
    axis: "x",
  });

  const rightIntelCollapsible = useCollapsible();
  const rightIntelResizable = useResizable({
    defaultSize: RIGHT_INTEL_PANEL.defaultSize,
    min: RIGHT_INTEL_PANEL.min,
    max: RIGHT_INTEL_PANEL.max,
    axis: "x",
    invert: true,
  });

  const timelineCollapsible = useCollapsible();
  const timelineResizable = useResizable({
    defaultSize: TIMELINE_PANEL.defaultSize,
    min: TIMELINE_PANEL.min,
    max: TIMELINE_PANEL.max,
    axis: "y",
    invert: true,
  });

  const leftNavSize = leftNavCollapsible.collapsed
    ? LEFT_NAV_PANEL.collapsedSize
    : leftNavResizable.size;
  const rightIntelSize = rightIntelCollapsible.collapsed
    ? RIGHT_INTEL_PANEL.collapsedSize
    : rightIntelResizable.size;
  const timelineSize = timelineCollapsible.collapsed
    ? TIMELINE_PANEL.collapsedSize
    : timelineResizable.size;

  function resetLayout() {
    leftNavCollapsible.reset();
    leftNavResizable.reset();
    rightIntelCollapsible.reset();
    rightIntelResizable.reset();
    timelineCollapsible.reset();
    timelineResizable.reset();
  }

  return (
    <div
      data-testid="shell-root"
      className="grid h-dvh w-dvw overflow-hidden bg-neutral-950 text-neutral-100"
      style={{
        gridTemplateColumns: `${leftNavSize}% 6px 1fr 6px ${rightIntelSize}%`,
        gridTemplateRows: `6vh 1fr 6px ${timelineSize}vh 6vh`,
      }}
    >
      <header
        data-testid="shell-top-bar"
        aria-label="System status bar"
        className="col-span-full flex items-center gap-4 border-b border-neutral-800 px-4 text-sm"
      >
        <span className="font-medium">Agent City — top system bar</span>
        <span className="text-neutral-400">{REGION_PLACEHOLDER}</span>
        <button
          type="button"
          onClick={resetLayout}
          className="ml-auto rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Reset layout
        </button>
      </header>

      <nav
        data-testid="shell-left-nav"
        aria-label="Primary navigation"
        className="flex flex-col overflow-hidden border-r border-neutral-800 text-sm"
      >
        <div className="flex items-center justify-between gap-2 p-2">
          <h2 className="truncate font-medium">
            {leftNavCollapsible.collapsed ? "" : "Left navigation"}
          </h2>
          <CollapseToggleButton
            collapsed={leftNavCollapsible.collapsed}
            onToggle={leftNavCollapsible.toggle}
            expandLabel="Expand left navigation"
            collapseLabel="Collapse left navigation"
            aria-label={
              leftNavCollapsible.collapsed ? "Expand left navigation" : "Collapse left navigation"
            }
            className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {leftNavCollapsible.collapsed ? "»" : "«"}
          </CollapseToggleButton>
        </div>
        {!leftNavCollapsible.collapsed && (
          <div className="overflow-y-auto p-4 pt-0 text-xs">
            <StageAgentPanel selection={selection} onSelect={handleSelect} />
          </div>
        )}
      </nav>

      {!leftNavCollapsible.collapsed && (
        <ResizeHandle
          handleProps={leftNavResizable.handleProps}
          label="Resize left navigation"
          className="cursor-col-resize bg-neutral-800 hover:bg-sky-600 focus-visible:bg-sky-500 focus-visible:outline-none"
        />
      )}
      {leftNavCollapsible.collapsed && <div aria-hidden className="bg-neutral-800" />}

      <main
        data-testid="shell-world"
        aria-label="Operational world"
        className="relative overflow-hidden p-4 text-sm"
      >
        <WorldCanvas
          controllerRef={cameraRef}
          lighthouseMarkerRef={lighthouseMarkerRef}
          worldObjectMarkerMapRef={worldObjectMarkerMapRef}
          selection={selection}
          onSelect={handleSelectBuildingId}
        />
        <CameraHud controllerRef={cameraRef} />
        <LighthouseMarker markerRef={lighthouseMarkerRef} />
        <WorldObjectMarkers markerMapRef={worldObjectMarkerMapRef} />

        <h2 className="pointer-events-none relative font-medium">Central operational world</h2>
        <p className="pointer-events-none relative mt-2 text-neutral-400">
          Lighthouse, residences, operational buildings, and roads — no vehicle or agents yet
          until build ladder rung FBL-019+.
        </p>

        {/* Approval interaction (interface-model.md): stands in for
            "Lighthouse attention" until the Lighthouse world object exists
            (FBL-014+) — pending approvals must still be unmissable. */}
        <div className="absolute top-4 right-4">
          <ApprovalCard />
        </div>

        <aside
          data-testid="shell-detail-panel"
          aria-label="Selected object details"
          className="absolute right-4 bottom-4 w-64 rounded border border-neutral-800 bg-neutral-900/90 p-3 text-xs"
        >
          <SelectedObjectDetail selection={selection} />
        </aside>
      </main>

      {!rightIntelCollapsible.collapsed && (
        <ResizeHandle
          handleProps={rightIntelResizable.handleProps}
          label="Resize right live-intelligence"
          className="cursor-col-resize bg-neutral-800 hover:bg-sky-600 focus-visible:bg-sky-500 focus-visible:outline-none"
        />
      )}
      {rightIntelCollapsible.collapsed && <div aria-hidden className="bg-neutral-800" />}

      <aside
        data-testid="shell-intel"
        aria-label="Live intelligence"
        className="flex flex-col overflow-hidden border-l border-neutral-800 text-sm"
      >
        <div className="flex items-center justify-between gap-2 p-2">
          <CollapseToggleButton
            collapsed={rightIntelCollapsible.collapsed}
            onToggle={rightIntelCollapsible.toggle}
            expandLabel="Expand right live-intelligence"
            collapseLabel="Collapse right live-intelligence"
            aria-label={
              rightIntelCollapsible.collapsed
                ? "Expand right live-intelligence"
                : "Collapse right live-intelligence"
            }
            className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {rightIntelCollapsible.collapsed ? "«" : "»"}
          </CollapseToggleButton>
          <h2 className="truncate font-medium">
            {rightIntelCollapsible.collapsed ? "" : "Right live-intelligence"}
          </h2>
        </div>
        {!rightIntelCollapsible.collapsed && (
          <div className="overflow-y-auto p-4 pt-0 text-xs">
            <LiveIntelligence />
          </div>
        )}
      </aside>

      {!timelineCollapsible.collapsed && (
        <ResizeHandle
          handleProps={timelineResizable.handleProps}
          label="Resize event timeline"
          className="col-span-full cursor-row-resize bg-neutral-800 hover:bg-sky-600 focus-visible:bg-sky-500 focus-visible:outline-none"
        />
      )}
      {timelineCollapsible.collapsed && (
        <div aria-hidden className="col-span-full bg-neutral-800" />
      )}

      <section
        data-testid="shell-timeline"
        aria-label="Event timeline"
        className="col-span-full flex min-h-0 flex-col overflow-hidden border-t border-neutral-800 text-sm"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 p-2 pb-0">
          <h2 className="font-medium">Bottom event timeline</h2>
          <CollapseToggleButton
            collapsed={timelineCollapsible.collapsed}
            onToggle={timelineCollapsible.toggle}
            expandLabel="Expand event timeline"
            collapseLabel="Collapse event timeline"
            aria-label={
              timelineCollapsible.collapsed ? "Expand event timeline" : "Collapse event timeline"
            }
            className="shrink-0 rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {timelineCollapsible.collapsed ? "Expand" : "Collapse"}
          </CollapseToggleButton>
        </div>
        {!timelineCollapsible.collapsed && (
          <div className="min-h-0 flex-1">
            <EventTimeline />
          </div>
        )}
      </section>

      <footer
        data-testid="shell-command-input"
        aria-label="Command input"
        className="col-span-full flex items-center gap-2 border-t border-neutral-800 px-4"
      >
        <CommandBar />
      </footer>
    </div>
  );
}
