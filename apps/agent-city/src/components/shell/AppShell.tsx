"use client";

import { CollapseToggleButton, ResizeHandle, useCollapsible, useResizable } from "@foundry/ui";
import { ApprovalCard } from "@/components/controls/ApprovalCard";
import { BuildRunPanel } from "@/components/controls/BuildRunPanel";
import { CommandBar } from "@/components/controls/CommandBar";
import { ExecutionAuthorizationPanel } from "@/components/controls/ExecutionAuthorizationPanel";
import { ConnectionBanner } from "@/components/controls/ConnectionBanner";
import { LiveIntelligence } from "@/components/controls/LiveIntelligence";
import { ObjectiveForm } from "@/components/controls/ObjectiveForm";
import { OperatorCredentialPanel } from "@/components/controls/OperatorCredentialPanel";
import { PlanReviewPanel } from "@/components/controls/PlanReviewPanel";
import { SelectedObjectDetail } from "@/components/controls/SelectedObjectDetail";
import type { Selection } from "@/components/controls/selection";
import { StageAgentPanel } from "@/components/controls/StageAgentPanel";
import { EventTimeline } from "@/components/timeline/EventTimeline";
import { useRuntime } from "@/lib/mock-runtime";
import { SELECTABLE_WORLD_OBJECTS } from "@/lib/world/selectableObjects";
import { computeAgentPosition } from "@/lib/world/agentPosition";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import { WORLD_AGENTS } from "@foundry/world-model";
import type { CameraControllerHandle } from "@/components/world/cameraController";
import { CameraHud } from "@/components/world/CameraHud";
import type { LighthouseMarkerState } from "@/components/world/lighthouseMarkerState";
import { LighthouseMarker } from "@/components/world/LighthouseMarker";
import { WorldCanvas } from "@/components/world/WorldCanvas";
import { WorldObjectMarkers } from "@/components/world/WorldObjectMarkers";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEFT_NAV_PANEL, RIGHT_INTEL_PANEL, TIMELINE_PANEL } from "./panelConfig";

// Ultrawide application shell (FBL-005 layout, FBL-006 interaction,
// FBL-009 event timeline, FBL-010 2D operational controls, FBL-011 empty
// R3F world, FBL-012 camera and navigation, FBL-013 spatial environment,
// FBL-014 Lighthouse, FBL-015 object selection): full-viewport region
// layout with generic collapse/resize/keyboard behavior (@foundry/ui)
// and real controls driven by the FBL-008 mock runtime — see
// docs/02-specification/interface-model.md.
const AGENT_FOCUS_HEIGHT = 1.05;

export function AppShell() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const lighthouseMarkerRef = useRef<LighthouseMarkerState | null>(null);
  const worldObjectMarkerMapRef = useRef<WorldObjectMarkerMap>(new Map());
  const cameraRef = useRef<CameraControllerHandle>(null);
  const { selectBuilding, clearSelection, worldState } = useRuntime();

  // The single funnel for every selection source (3D pointer click, 3D
  // keyboard Enter/Space, and the left navigator): updates the shared 2D
  // selection state, emits the real building.selected event for buildings
  // specifically (event-model.md — never a mutation of operational
  // truth; no equivalent event exists for agent/vehicle selection, so
  // those stay pure frontend state, same as the pre-existing 2D agent
  // list), and moves the FBL-012 camera to focus on any selected object
  // registered in SELECTABLE_WORLD_OBJECTS regardless of kind (FBL-019
  // generalized this from "building only" once the vehicle became the
  // first non-building 3D-selectable object).
  const handleSelect = useCallback(
    (next: Selection) => {
      setSelection(next);
      if (next.kind === "building") {
        selectBuilding(next.id);
      }
      const target = SELECTABLE_WORLD_OBJECTS.find((o) => o.id === next.id);
      if (target) {
        const [x, y, z] = target.focusPosition;
        cameraRef.current?.focus({ x, y, z });
        return;
      }
      // FBL-021A — agents are not in the static registry because they
      // move: their position is derived from the live `currentBuildingId`
      // (computeAgentPosition, the same function that places the 3D
      // object). Focusing them needs that live value rather than a fixed
      // one, which is why they are resolved here instead of being given a
      // frozen `focusPosition` that would point at the wrong building the
      // moment the agent walked away.
      if (next.kind === "agent") {
        const index = WORLD_AGENTS.findIndex((a) => a.id === next.id);
        const agent = worldState.agents.find((a) => a.id === next.id);
        const position = agent ? computeAgentPosition(agent.currentBuildingId, index) : null;
        if (position) {
          cameraRef.current?.focus({
            x: position.x,
            y: position.y + AGENT_FOCUS_HEIGHT,
            z: position.z,
          });
        }
      }
    },
    [selectBuilding, worldState],
  );

  // The 3D canvas reports only an id; the object's own registered kind
  // (SELECTABLE_WORLD_OBJECTS) determines whether it's a building or the
  // vehicle. Agents (FBL-020) have dynamic positions (they travel between
  // buildings), so they are recognized by id against WORLD_AGENTS instead
  // of the static SELECTABLE_WORLD_OBJECTS registry — the pre-existing 2D
  // "Agents" list (FBL-010) already selects them the same way.
  const handleSelectWorldObjectId = useCallback(
    (id: string) => {
      const target = SELECTABLE_WORLD_OBJECTS.find((o) => o.id === id);
      if (target) {
        handleSelect({ kind: target.kind, id } as Selection);
        return;
      }
      if (WORLD_AGENTS.some((a) => a.id === id)) {
        handleSelect({ kind: "agent", id });
        return;
      }
      handleSelect({ kind: "building", id });
    },
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
        <ConnectionBanner />
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
          <div className="space-y-4 overflow-y-auto p-4 pt-0 text-xs">
            {/* AC-103. Placed here rather than in the bottom command strip
                for two reasons: the strip's V1 contents are the exhaustive
                six demo-control commands (`interface-model.md`), and a
                rejected objective needs room for per-field reasons that a
                one-line strip cannot carry. It sits directly above "Current
                build" so the operator sees their own words become backend
                truth in the same column. Renders in backend mode only —
                see `RuntimeContextValue.submitObjective`. */}
            {/* AC-105. Above the objective form because it gates it: an
                operator whose credential is stale needs to see *that*
                before they wonder why submitting does nothing. Backend
                mode only — see `RuntimeContextValue.credentialState`. */}
            <OperatorCredentialPanel />
            <ObjectiveForm />
            {/* AC-108. Below the objective form because it is what the
                objective produces, and above the stage list because a plan
                is a proposal — the stages below it are the ones actually
                scheduled, which is still none. Backend mode only. */}
            <PlanReviewPanel />
            {/* AC-109. Directly below the plan because it is what a
                reviewed plan becomes, and above the stage list because it
                states what is actually executing them: the mock executor,
                not Claude Code. Backend mode only. */}
            {/* AC-110. Between the plan and the run: it is the decision a
                reviewed plan enables and the last human act before
                anything real could happen. Backend mode only. */}
            <ExecutionAuthorizationPanel />
            <BuildRunPanel />
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
          onSelect={handleSelectWorldObjectId}
        />
        <CameraHud controllerRef={cameraRef} />
        <LighthouseMarker markerRef={lighthouseMarkerRef} />
        <WorldObjectMarkers markerMapRef={worldObjectMarkerMapRef} />

        <h2 className="pointer-events-none relative font-medium">Central operational world</h2>
        <p className="pointer-events-none relative mt-2 text-neutral-400">
          Full V1 operational neighborhood: Lighthouse, residences, operational buildings, roads,
          the utility vehicle, and the Architect, Builder, and Inspector agents — placeholder
          geometry, driven by real event-to-world mapping.
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
            <EventTimeline onJumpToWorldObject={handleSelectWorldObjectId} />
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
