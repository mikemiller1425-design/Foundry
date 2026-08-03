"use client";

import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ObjectiveInput, ObjectiveSubmissionResult } from "@/lib/backend/objectiveSubmission";
import { DEFAULT_SEED, MockRuntime } from "./runtime";
import { clearRuntimeCursor, loadRuntimeCursor, saveRuntimeCursor } from "./sessionPersistence";

interface CommandRejection {
  commandType: string;
  reason: string;
}

export interface RuntimeContextValue {
  events: FoundryEvent[];
  worldState: WorldState;
  isRunning: boolean;
  isComplete: boolean;
  /**
   * FBL-026 (F-10): false whenever the projection is not a live view of
   * backend truth, which disables every mutation control. The mock
   * runtime is always "connected" — it *is* its own authority (ADR-001),
   * so demo/test mode behaves exactly as it did before this rung.
   */
  connectionStatus: ConnectionStatus;
  mutationsEnabled: boolean;
  submitCommand: (raw: unknown) => void;
  /**
   * AC-103: submits one bounded objective, creating a real Project and
   * Build as backend truth.
   *
   * Present in backend mode only, and its absence is what hides the
   * objective control rather than a mode flag read somewhere else. The mock
   * runtime is a deterministic recording of a run that already happened
   * (ADR-001) — it is its own authority, its canonical fixture is the V1
   * regression baseline, and an objective submitted into it could not
   * become real work. Offering a control there that cannot do its job is
   * the silent no-op this rung exists to remove, so the control is simply
   * not offered.
   */
  submitObjective?: (input: ObjectiveInput) => Promise<ObjectiveSubmissionResult>;
  resolveApproval: (
    decision: "approved" | "rejected" | "revision_requested",
    resolvedBy: string,
    resolutionNote?: string,
  ) => void;
  selectBuilding: (buildingId: string) => void;
  clearSelection: () => void;
  lastRejection: CommandRejection | null;
  /**
   * FBL-030: true when resolving an approval requires an operator
   * credential this client does not yet hold.
   *
   * The mock runtime is its own authority (ADR-001) and never requires
   * one, so this is false there and demo/test mode is unchanged. Against
   * the real backend it is true until the operator supplies a
   * credential — surfaced so the approval controls can say *why* they
   * are unavailable instead of failing silently when pressed.
   */
  operatorCredentialRequired?: boolean;
  /** Stores the operator credential for this client. Backend mode only. */
  setOperatorCredential?: (value: string) => void;
}

// Exported so tests can supply a fixed, hand-crafted event fixture via
// `<RuntimeContext.Provider value={...}>` without waiting on the live
// runtime's real timers.
export const RuntimeContext = createContext<RuntimeContextValue | null>(null);

function isResetCommand(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "commandType" in raw &&
    (raw as { commandType: unknown }).commandType === "demo.reset"
  );
}

// FBL-022: both `demo.reset` and `demo.replay` restart the runtime's own
// event history from scratch (runtime.ts clears `emittedIds`/`emittedLog`
// for each) — so both must also clear this component's locally
// accumulated `events` React state. Previously only `demo.reset` did;
// `demo.replay` left the prior run's events in place and then appended
// the replayed sequence on top (the runtime's own idempotency guard
// couldn't catch this, since it was cleared too), so a replay silently
// duplicated every timeline row from the run being replayed — exactly
// the "duplicate events cannot duplicate ... timeline records" invariant
// this rung requires.
function isHistoryResettingCommand(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null || !("commandType" in raw)) return false;
  const commandType = (raw as { commandType: unknown }).commandType;
  return commandType === "demo.reset" || commandType === "demo.replay";
}

/**
 * Shares one MockRuntime instance across the app (timeline, controls, and
 * later rungs all observe the same demo run). Reconstructs history after
 * reload from a frontend-local session marker — see sessionPersistence.ts.
 */
export function RuntimeProvider({
  children,
  seed = DEFAULT_SEED,
}: {
  children: ReactNode;
  seed?: string;
}) {
  const runtimeRef = useRef<MockRuntime | null>(null);
  runtimeRef.current ??= new MockRuntime(seed);
  const runtime = runtimeRef.current;

  const [events, setEvents] = useState<FoundryEvent[]>([]);
  const [worldState, setWorldState] = useState<WorldState>(() => runtime.getWorldState());
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [lastRejection, setLastRejection] = useState<CommandRejection | null>(null);

  useEffect(() => {
    const marker = loadRuntimeCursor();
    if (marker && marker.seed === runtime.getSeed()) {
      runtime.fastForwardTo(marker.cursor);
    }
    setEvents([...runtime.getEvents()]);
    setWorldState(runtime.getWorldState());
    setIsComplete(runtime.isComplete());

    const unsubscribeEvents = runtime.onEvent((event) => {
      setEvents((prev) => [...prev, event]);
      setWorldState(runtime.getWorldState());
      setIsRunning(runtime.isRunning());
      setIsComplete(runtime.isComplete());
      saveRuntimeCursor({ seed: runtime.getSeed(), cursor: runtime.getCursor() });
    });
    const unsubscribeRejections = runtime.onCommandRejected((rejection) => {
      setLastRejection(rejection);
    });

    // Auto-issue demo.start (or demo.resume, if reconstructed mid-run) on
    // mount so the demo is never permanently idle before the operator
    // touches the command bar. This invokes an existing bounded command; it
    // does not invent new operational behavior.
    if (!runtime.isComplete()) {
      if (runtime.getCursor() > 0) {
        runtime.submitCommand({ commandType: "demo.resume", params: {} });
      } else {
        runtime.submitCommand({ commandType: "demo.start", params: {} });
      }
      setIsRunning(runtime.isRunning());
    }

    return () => {
      unsubscribeEvents();
      unsubscribeRejections();
    };
  }, [runtime]);

  const submitCommand = useCallback(
    (raw: unknown) => {
      const resetsHistory = isHistoryResettingCommand(raw);
      if (isResetCommand(raw)) clearRuntimeCursor();
      runtime.submitCommand(raw);
      setIsRunning(runtime.isRunning());
      if (resetsHistory) {
        setEvents([]);
        setWorldState(runtime.getWorldState());
        setIsComplete(false);
      }
    },
    [runtime],
  );

  const resolveApproval = useCallback(
    (
      decision: "approved" | "rejected" | "revision_requested",
      resolvedBy: string,
      resolutionNote?: string,
    ) => {
      // Injected/resumed events flow back through the onEvent subscription
      // above, which already keeps events/worldState/isRunning in sync.
      runtime.resolveApproval(decision, resolvedBy, resolutionNote);
    },
    [runtime],
  );

  const selectBuilding = useCallback(
    (buildingId: string) => {
      runtime.selectBuilding(buildingId);
    },
    [runtime],
  );

  const clearSelection = useCallback(() => {
    runtime.clearSelection();
  }, [runtime]);

  return (
    <RuntimeContext.Provider
      value={{
        events,
        worldState,
        isRunning,
        isComplete,
        // The mock runtime is its own operational authority (ADR-001), so
        // it is never "disconnected" — FBL-026's stale/disabled behavior
        // applies to the backend-backed provider, not to demo/test mode.
        connectionStatus: "connected",
        mutationsEnabled: true,
        submitCommand,
        resolveApproval,
        selectBuilding,
        clearSelection,
        lastRejection,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  );
}

export function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error("useRuntime must be used within a RuntimeProvider");
  return ctx;
}
