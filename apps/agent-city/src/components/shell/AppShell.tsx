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
import { SelectionActivity } from "@/components/controls/SelectionActivity";
import type { Selection } from "@/components/controls/selection";
import { StageAgentPanel } from "@/components/controls/StageAgentPanel";
import { EventTimeline } from "@/components/timeline/EventTimeline";
import { useRuntime } from "@/lib/mock-runtime";
import { runtimeSourceLabel } from "@/lib/runtime/adapter";
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
import { findFoundryDistrict, findFoundryParcel } from "@/lib/world/worldAtlas";
import { AgentLifePanel } from "@/components/controls/AgentLifePanel";
import { AgentTracePanel } from "@/components/controls/AgentTracePanel";
import { CommandCenterPanel } from "@/components/controls/CommandCenterPanel";
import { OperationalSnapshotPanel } from "@/components/controls/OperationalSnapshotPanel";
import { RuntimeReadinessPanel } from "@/components/controls/RuntimeReadinessPanel";
import { WorldOverview } from "@/components/world/WorldOverview";
import { TenantSpacePreview } from "@/components/world/TenantSpacePreview";
import { AtmospherePanel } from "@/components/world/AtmospherePanel";
import { useAtmospherePreference } from "@/lib/world/useAtmospherePreference";
import { useReducedMotion } from "@/lib/world/useReducedMotion";
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
  const [viewMode, setViewMode] = useState<"map" | "world" | "operate">("operate");
  const [tenantPreviewId, setTenantPreviewId] = useState<string | null>(null);
  const [atmosphereOpen, setAtmosphereOpen] = useState(false);
  const { preference: atmosphere, setMode, setAmbientMotion } = useAtmospherePreference();
  const reducedMotion = useReducedMotion();
  const lighthouseMarkerRef = useRef<LighthouseMarkerState | null>(null);
  const worldObjectMarkerMapRef = useRef<WorldObjectMarkerMap>(new Map());
  const cameraRef = useRef<CameraControllerHandle>(null);
  const { selectBuilding, clearSelection, worldState, runtimeSource } = useRuntime();

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
      if (next.kind === "district") {
        const district = findFoundryDistrict(next.id);
        if (district?.center) {
          const [x, y, z] = district.center;
          cameraRef.current?.focus({ x, y, z }, { distance: district.cameraDistance ?? 24 });
        }
        return;
      }
      if (next.kind === "parcel") {
        const parcel = findFoundryParcel(next.id);
        if (parcel) {
          const [x, y, z] = parcel.center;
          cameraRef.current?.focus({ x, y: y + 0.6, z }, { distance: 13 });
        }
        return;
      }
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
      if (findFoundryParcel(id)) {
        handleSelect({ kind: "parcel", id });
        return;
      }
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
      setAtmosphereOpen(false);
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

  // Preserve a useful world viewport on compact screens. This is only an
  // automatic entry posture: the individual panel toggles remain available,
  // so the operator can deliberately open any surface they need.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const compact = window.matchMedia("(max-width: 900px)");
    const enterCompactWorld = (matches: boolean) => {
      if (!matches) return;
      leftNavCollapsible.collapse();
      rightIntelCollapsible.collapse();
      timelineCollapsible.collapse();
      setViewMode("world");
    };
    enterCompactWorld(compact.matches);
    const onChange = (event: MediaQueryListEvent) => enterCompactWorld(event.matches);
    compact.addEventListener("change", onChange);
    return () => compact.removeEventListener("change", onChange);
  }, [leftNavCollapsible.collapse, rightIntelCollapsible.collapse, timelineCollapsible.collapse]);

  const leftNavSize = leftNavCollapsible.collapsed
    ? LEFT_NAV_PANEL.collapsedSize
    : leftNavResizable.size;
  const rightIntelSize = rightIntelCollapsible.collapsed
    ? RIGHT_INTEL_PANEL.collapsedSize
    : rightIntelResizable.size;
  const timelineSize = timelineCollapsible.collapsed
    ? TIMELINE_PANEL.collapsedSize
    : timelineResizable.size;
  const leftNavColumn = leftNavCollapsible.collapsed
    ? "48px"
    : `clamp(240px, ${leftNavSize}vw, 520px)`;
  const rightIntelColumn = rightIntelCollapsible.collapsed
    ? "48px"
    : `clamp(240px, ${rightIntelSize}vw, 480px)`;

  function resetLayout() {
    leftNavCollapsible.reset();
    leftNavResizable.reset();
    rightIntelCollapsible.reset();
    rightIntelResizable.reset();
    timelineCollapsible.reset();
    timelineResizable.reset();
    setTenantPreviewId(null);
    setAtmosphereOpen(false);
    setViewMode("operate");
  }

  function showWorldMode() {
    setTenantPreviewId(null);
    setAtmosphereOpen(false);
    leftNavCollapsible.collapse();
    rightIntelCollapsible.collapse();
    timelineCollapsible.collapse();
    setViewMode("world");
  }

  function showMapMode() {
    setTenantPreviewId(null);
    setAtmosphereOpen(false);
    leftNavCollapsible.collapse();
    rightIntelCollapsible.collapse();
    timelineCollapsible.collapse();
    setViewMode("map");
  }

  function showOperateMode() {
    setTenantPreviewId(null);
    setAtmosphereOpen(false);
    leftNavCollapsible.expand();
    rightIntelCollapsible.expand();
    timelineCollapsible.expand();
    setViewMode("operate");
  }

  return (
    <div
      data-testid="shell-root"
      data-atmosphere={atmosphere.mode}
      className="foundry-shell grid h-dvh w-dvw overflow-hidden"
      style={{
        gridTemplateColumns: `${leftNavColumn} 4px minmax(0, 1fr) 4px ${rightIntelColumn}`,
        gridTemplateRows: `64px 1fr 4px ${timelineSize}vh 56px`,
      }}
    >
      <header
        data-testid="shell-top-bar"
        aria-label="System status bar"
        className="foundry-topbar col-span-full flex items-center gap-4 border-b px-5 text-sm"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-sky-300/25 bg-sky-300/10 text-sm font-bold text-sky-200"
          >
            F
          </div>
          <div className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold tracking-[0.08em]">FOUNDRY</span>
            <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Agent City · Operational district
            </span>
          </div>
        </div>
        <span
          className="foundry-chip hidden rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] sm:inline-flex"
          data-testid="runtime-source"
          title={
            runtimeSource?.kind === "backend"
              ? "World state is projected from backend-authoritative events."
              : "World state is projected from a deterministic frontend fixture."
          }
        >
          {runtimeSourceLabel(runtimeSource)}
        </span>
        <ConnectionBanner />
        <div
          role="group"
          aria-label="View mode"
          className="foundry-chip ml-auto flex items-center rounded-full p-0.5"
        >
          <button
            type="button"
            aria-pressed={viewMode === "map"}
            onClick={showMapMode}
            className="rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-neutral-400 aria-pressed:bg-violet-300/15 aria-pressed:text-violet-100 sm:px-3 sm:text-[10px]"
          >
            Map
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "world"}
            onClick={showWorldMode}
            className="rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-neutral-400 aria-pressed:bg-sky-300/15 aria-pressed:text-sky-100 sm:px-3 sm:text-[10px]"
          >
            World
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "operate"}
            onClick={showOperateMode}
            className="rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-neutral-400 aria-pressed:bg-sky-300/15 aria-pressed:text-sky-100 sm:px-3 sm:text-[10px]"
          >
            Operate
          </button>
        </div>
        <button
          type="button"
          aria-label="Atmosphere"
          aria-expanded={atmosphereOpen}
          aria-controls="world-atmosphere-panel"
          onClick={() => setAtmosphereOpen((open) => !open)}
          className="foundry-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] uppercase tracking-[0.08em] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          <span aria-hidden="true" className="text-sky-200">
            ◐
          </span>
          <span className="hidden sm:inline">Atmosphere</span>
        </button>
        <button
          type="button"
          onClick={resetLayout}
          className="foundry-chip hidden rounded-full px-3 py-1.5 text-[11px] hover:border-sky-300/40 hover:text-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:inline-flex"
        >
          Reset layout
        </button>
      </header>

      <nav
        data-testid="shell-left-nav"
        aria-label="Primary navigation"
        className="foundry-panel flex flex-col overflow-hidden border-r text-sm"
      >
        <div className="foundry-panel-header flex items-center justify-between gap-2 px-3">
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
            {leftNavCollapsible.collapsed ? "" : "World navigator"}
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
          className="foundry-resize-handle cursor-col-resize focus-visible:outline-none"
        />
      )}
      {leftNavCollapsible.collapsed && <div aria-hidden className="foundry-resize-handle" />}

      <main
        data-testid="shell-world"
        aria-label="Operational world"
        className="relative overflow-hidden text-sm"
      >
        <WorldCanvas
          controllerRef={cameraRef}
          lighthouseMarkerRef={lighthouseMarkerRef}
          worldObjectMarkerMapRef={worldObjectMarkerMapRef}
          selection={selection}
          onSelect={handleSelectWorldObjectId}
          atmosphereMode={atmosphere.mode}
          ambientMotion={atmosphere.ambientMotion && !reducedMotion}
        />
        <CameraHud controllerRef={cameraRef} />
        <LighthouseMarker markerRef={lighthouseMarkerRef} />
        <WorldObjectMarkers markerMapRef={worldObjectMarkerMapRef} />

        {viewMode === "map" && (
          <WorldOverview
            onClose={showWorldMode}
            onEnterDistrict={(districtId) => {
              handleSelect({ kind: "district", id: districtId });
              setViewMode("world");
            }}
          />
        )}

        {tenantPreviewId && (
          <TenantSpacePreview tenantId={tenantPreviewId} onClose={() => setTenantPreviewId(null)} />
        )}

        {atmosphereOpen && (
          <div id="world-atmosphere-panel">
            <AtmospherePanel
              mode={atmosphere.mode}
              ambientMotion={atmosphere.ambientMotion}
              reducedMotion={reducedMotion}
              onModeChange={setMode}
              onAmbientMotionChange={setAmbientMotion}
              onClose={() => setAtmosphereOpen(false)}
            />
          </div>
        )}

        <div
          aria-hidden="true"
          className="foundry-world-vignette pointer-events-none absolute inset-0"
        />

        <div className="foundry-world-copy pointer-events-none absolute top-5 left-5 max-w-xl">
          <p className="foundry-eyebrow">Foundry World / Agent City</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
            Operational district
          </h1>
          <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-slate-400">
            A live spatial projection of places, agents, and work. World state follows runtime
            events; visual selection never changes operational truth.
          </p>
        </div>

        {/* Approval interaction (interface-model.md): stands in for
            "Lighthouse attention" until the Lighthouse world object exists
            (FBL-014+) — pending approvals must still be unmissable. */}
        <div className="absolute top-5 right-5">
          <ApprovalCard />
        </div>
      </main>

      {!rightIntelCollapsible.collapsed && (
        <ResizeHandle
          handleProps={rightIntelResizable.handleProps}
          label="Resize right live-intelligence"
          className="foundry-resize-handle cursor-col-resize focus-visible:outline-none"
        />
      )}
      {rightIntelCollapsible.collapsed && <div aria-hidden className="foundry-resize-handle" />}

      <aside
        data-testid="shell-intel"
        aria-label="Live intelligence"
        className="foundry-panel flex flex-col overflow-hidden border-l text-sm"
      >
        <div className="foundry-panel-header flex items-center justify-between gap-2 px-3">
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
          <h2 className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
            {rightIntelCollapsible.collapsed ? "" : "World intelligence"}
          </h2>
        </div>
        {!rightIntelCollapsible.collapsed && (
          <div className="space-y-4 overflow-y-auto p-3 text-xs">
            <section
              data-testid="shell-detail-panel"
              aria-label="Selected object details"
              className="foundry-detail rounded-xl p-3"
            >
              <p className="foundry-eyebrow mb-2">Current focus</p>
              <SelectedObjectDetail
                selection={selection}
                onSelect={handleSelect}
                onPreviewTenant={setTenantPreviewId}
              />
              <SelectionActivity selection={selection} onLocate={handleSelectWorldObjectId} />
            </section>
            <section className="foundry-detail rounded-xl p-3" aria-label="District intelligence">
              <p className="foundry-eyebrow mb-2">District pulse</p>
              <LiveIntelligence />
            </section>
            <CommandCenterPanel />
            <AgentLifePanel onSelect={handleSelect} />
            <AgentTracePanel onSelect={handleSelect} />
            <OperationalSnapshotPanel />
            <RuntimeReadinessPanel />
          </div>
        )}
      </aside>

      {!timelineCollapsible.collapsed && (
        <ResizeHandle
          handleProps={timelineResizable.handleProps}
          label="Resize event timeline"
          className="foundry-resize-handle col-span-full cursor-row-resize focus-visible:outline-none"
        />
      )}
      {timelineCollapsible.collapsed && (
        <div aria-hidden className="foundry-resize-handle col-span-full" />
      )}

      <section
        data-testid="shell-timeline"
        aria-label="Event timeline"
        className="foundry-panel col-span-full flex min-h-0 flex-col overflow-hidden border-t text-sm"
      >
        <div className="foundry-panel-header flex shrink-0 items-center justify-between gap-2 px-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-300">
              Activity
            </h2>
            <span className="hidden text-[10px] text-neutral-600 sm:inline">
              Runtime event stream
            </span>
          </div>
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
        className="foundry-commandbar col-span-full flex items-center gap-2 overflow-x-auto border-t px-4"
      >
        <CommandBar />
      </footer>
    </div>
  );
}
