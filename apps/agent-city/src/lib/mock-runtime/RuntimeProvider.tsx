"use client";

import type { WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ObjectiveInput, ObjectiveSubmissionResult } from "@/lib/backend/objectiveSubmission";
import type { BuildRunResult } from "@/lib/backend/buildRun";
import type { ExecutionGateReport } from "@/lib/backend/executionGate";
import type { CredentialState } from "@/lib/backend/credentialState";
import type { CommandFailure } from "@/lib/backend/commandFeedback";
import type { RuntimeReadAdapter } from "@/lib/runtime/adapter";
import { DEFAULT_SEED, MockRuntime } from "./runtime";
import { clearRuntimeCursor, loadRuntimeCursor, saveRuntimeCursor } from "./sessionPersistence";

export interface RuntimeContextValue extends RuntimeReadAdapter {
  /**
   * AC-106: which runtime is attached, stated rather than inferred.
   *
   * A control that behaves differently against a real backend must not
   * deduce that from a proxy: the mock runtime is permanently "connected"
   * (it is its own authority, ADR-001), so connection status cannot tell
   * the two apart. Optional for the many test fixtures that supply a
   * partial context; absent is read as `"mock"`.
   */
  /**
   * FBL-026 (F-10): false whenever the projection is not a live view of
   * backend truth, which disables every mutation control. The mock
   * runtime is always "connected" — it *is* its own authority (ADR-001),
   * so demo/test mode behaves exactly as it did before this rung.
   */
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
  /**
   * The last command that did not succeed, classified (AC-106).
   *
   * The mock runtime produces only its own bounded demo-command
   * rejections, which are `blocked`; the backend provider produces the
   * full taxonomy.
   */
  lastRejection: CommandFailure | null;
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
  /**
   * AC-105: the distinguishable credential situation.
   *
   * Absent, stale, invalid, backend-unreachable, and ready are five
   * different problems with five different fixes; the single
   * `operatorCredentialRequired` boolean collapsed four of them into one
   * prompt. Present in backend mode only — the mock runtime is its own
   * authority and needs no credential (ADR-001).
   */
  credentialState?: CredentialState;
  /** The credential this browser holds, for masked display. */
  storedCredential?: string | null;
  /** True when this host's launch path handed over a credential. */
  handoffAvailable?: boolean;
  /** Adopts the credential this API session handed to the frontend server. */
  useHandoffCredential?: () => void;
  /** Discards the stored credential, so a mistaken token is recoverable. */
  clearOperatorCredential?: () => void;
  /**
   * AC-108: records the operator's review of the current plan.
   *
   * Backend mode only — the mock runtime produces no plan. Recording a
   * review authorizes nothing; execution requires a separate single-use
   * authorization that does not exist yet.
   */
  reviewPlan?: (input: {
    decision: "proceed" | "rejected" | "revision_requested";
    note?: string;
  }) => Promise<void>;
  /**
   * AC-109: starts the orchestrated run for the current build.
   *
   * Backend mode only, and for the same reason `submitObjective` is: the
   * mock runtime is a deterministic recording of a run that already
   * happened (ADR-001), so there is nothing here for it to orchestrate.
   * Offering a control that could not do its job is the silent no-op
   * AC-106 removed, so the control is simply not offered.
   *
   * **The run is simulated.** Every stage is advanced by the deterministic
   * mock executor; no Claude Code is invoked and no money is spent. The
   * result carries the backend's own `simulated`/`executor` fields rather
   * than a claim made here.
   */
  startBuildRun?: () => Promise<BuildRunResult>;
  /**
   * AC-110: issues the single-use execution authorization for one stage.
   *
   * Backend mode only. **Authorizing is not running.** It records
   * permission for one future run of one stage, bound to a
   * backend-generated hash of the plan's persisted content; performing
   * that run is AC-111, and nothing here starts, schedules, or spends it.
   *
   * The plan content hash is deliberately not a parameter. The client
   * states which hash it read (the provider reads it from the projected
   * plan), the backend recomputes its own and refuses on disagreement — a
   * client-supplied value is never the binding (F-113a).
   */
  authorizeExecution?: (input: {
    stageName: string;
    maxBudgetUsd: number;
    note?: string;
  }) => Promise<void>;
  /**
   * AC-110: reads the gate's current verdict. Read-only, no side effects.
   *
   * Asking whether execution would be permitted must never be able to
   * cause it, so this is a `GET` against a handler with no write path.
   */
  readExecutionGate?: (stageName: string) => Promise<ExecutionGateReport | null>;
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
  const [lastRejection, setLastRejection] = useState<CommandFailure | null>(null);

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
      // The mock runtime refuses only its own bounded demo commands, and
      // only ever because the demo is not in a state that allows them —
      // which is exactly `blocked`. It has no transport, so it can produce
      // no other kind (AC-106).
      setLastRejection({
        kind: "blocked",
        commandType: rejection.commandType,
        title: "Blocked by current state",
        reason: rejection.reason,
        action: "Satisfy the stated prerequisite, then retry.",
      });
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
        runtimeMode: "mock",
        projectionStatus: "current",
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
