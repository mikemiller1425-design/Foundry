"use client";

import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { BackendClient } from "./backendClient";
import { applyConnectionStatus, areMutationsAllowed } from "./connectionState";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";

/**
 * FBL-026: makes the frontend a live projection of backend truth rather
 * than a poll-based approximation. Supplies the exact same
 * `RuntimeContext` shape the mock runtime does, so every existing panel
 * and world object works against either — the mock runtime remains fully
 * selectable for tests and demo mode (ADR-001), which is why this is a
 * separate provider rather than a replacement.
 *
 * Commands go over HTTP to the backend (which enforces them, FBL-025);
 * this client never applies a command locally or invents an event.
 */
export function BackendRuntimeProvider({
  children,
  baseUrl,
}: {
  children: ReactNode;
  baseUrl: string;
}) {
  const clientRef = useRef<BackendClient | null>(null);
  clientRef.current ??= new BackendClient({ baseUrl });
  const client = clientRef.current;

  const [events, setEvents] = useState<FoundryEvent[]>([]);
  const [rawWorldState, setRawWorldState] = useState<WorldState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastRejection, setLastRejection] = useState<RuntimeContextValue["lastRejection"]>(null);

  useEffect(() => {
    const unsubscribe = client.subscribe((state) => {
      setEvents(state.events);
      setRawWorldState(state.worldState);
      setConnectionStatus(state.connectionStatus);
    });
    void client.start();
    return () => {
      unsubscribe();
      client.stop();
    };
  }, [client]);

  const worldState = useMemo(
    () => applyConnectionStatus(rawWorldState ?? createInitialWorldState(), connectionStatus),
    [rawWorldState, connectionStatus],
  );

  const mutationsEnabled = areMutationsAllowed(connectionStatus);

  const postCommand = useCallback(
    async (body: unknown) => {
      // Never send a mutation while disconnected — the backend is the
      // authority and we cannot know current state (F-10).
      if (!mutationsEnabled) return;
      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/commands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const outcome = await res.json();
        setLastRejection(
          outcome?.accepted === false
            ? { commandType: String(outcome.commandType ?? "unknown"), reason: String(outcome.reason ?? "Rejected") }
            : null,
        );
      } catch (err) {
        setLastRejection({
          commandType: "unknown",
          reason: err instanceof Error ? err.message : "Command failed to reach the backend",
        });
      }
    },
    [baseUrl, mutationsEnabled],
  );

  const submitCommand = useCallback(
    (raw: unknown) => {
      void postCommand(raw);
    },
    [postCommand],
  );

  const resolveApproval = useCallback(
    (
      decision: "approved" | "rejected" | "revision_requested",
      resolvedBy: string,
      resolutionNote?: string,
    ) => {
      const pending = worldState.approvals.find((a) => a.status === "pending");
      if (!pending) return;
      const commandType =
        decision === "approved"
          ? "Approval.Approve"
          : decision === "rejected"
            ? "Approval.Reject"
            : "Approval.RequestRevision";
      void postCommand({
        commandType,
        entityId: pending.id,
        params: { resolvedBy, resolutionNote },
        actor: { actorType: "operator", actorId: resolvedBy },
      });
    },
    [postCommand, worldState.approvals],
  );

  // Selection is a UI-only concern with no operational authority
  // (world-model.md → Object selection), so it stays local and remains
  // available while disconnected.
  const selectBuilding = useCallback(() => {}, []);
  const clearSelection = useCallback(() => {}, []);

  return (
    <RuntimeContext.Provider
      value={{
        events,
        worldState,
        isRunning: connectionStatus === "connected",
        isComplete: worldState.currentBuild?.status === "completed",
        connectionStatus,
        mutationsEnabled,
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
