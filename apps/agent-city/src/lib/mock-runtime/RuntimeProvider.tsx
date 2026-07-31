"use client";

import type { WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
  submitCommand: (raw: unknown) => void;
  resolveApproval: (
    decision: "approved" | "rejected" | "revision_requested",
    resolvedBy: string,
    resolutionNote?: string,
  ) => void;
  lastRejection: CommandRejection | null;
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
      const wasReset = isResetCommand(raw);
      if (wasReset) clearRuntimeCursor();
      runtime.submitCommand(raw);
      setIsRunning(runtime.isRunning());
      if (wasReset) {
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

  return (
    <RuntimeContext.Provider
      value={{
        events,
        worldState,
        isRunning,
        isComplete,
        submitCommand,
        resolveApproval,
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
