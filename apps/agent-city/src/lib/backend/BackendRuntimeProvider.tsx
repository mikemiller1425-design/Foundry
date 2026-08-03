"use client";

import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { BackendClient } from "./backendClient";
import { interpretCommandResponse, requestedCommandType } from "./commandFeedback";
import { applyConnectionStatus, areMutationsAllowed } from "./connectionState";
import { postObjective, type ObjectiveInput } from "./objectiveSubmission";
import {
  commandHeaders,
  readOperatorCredential,
  writeOperatorCredential,
} from "./operatorCredential";
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
      const commandType = requestedCommandType(body);

      // Never send a mutation while disconnected — the backend is the
      // authority and we cannot know current state (F-10). Saying so is
      // part of the contract: refusing to send is still a refusal, and it
      // must read as one rather than as a button that did nothing.
      if (!mutationsEnabled) {
        setLastRejection({
          commandType,
          reason:
            "Not sent — the backend is not connected, so its current state is unknown. Commands resume when the connection is restored.",
        });
        return;
      }

      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, "")}/commands`, {
          method: "POST",
          // FBL-029/030: identity travels in the credential, not the body.
          headers: commandHeaders(readOperatorCredential()),
          body: JSON.stringify(body),
        });
        let outcome: unknown = null;
        try {
          outcome = await res.json();
        } catch {
          // An unparseable response is still an outcome to report.
        }
        setLastRejection(interpretCommandResponse(res.status, outcome, commandType));
      } catch (err) {
        setLastRejection({
          commandType,
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
      // No `actor` and no `resolvedBy`: both are now derived server-side
      // from the authenticated credential (FBL-029/030). Sending either
      // would be asserting an authority the payload is not allowed to
      // carry, and the backend refuses a payload that contradicts the
      // credential rather than silently overriding it.
      void postCommand({
        commandType,
        entityId: pending.id,
        params: resolutionNote ? { resolutionNote } : {},
      });
    },
    [postCommand, worldState.approvals],
  );

  /**
   * AC-103 — the operator's objective enters the system here.
   *
   * Not routed through `submitCommand`: an objective is not one of the 84
   * declared command types, and inventing one would be a specification
   * change made in passing. `POST /objectives` translates it into
   * `Project.Create` and `Build.Create` server-side, through the same
   * `CommandHandler` every other caller faces.
   *
   * The result is returned rather than stored, so the form can show the
   * per-field detail a one-line rejection banner cannot carry.
   */
  const submitObjective = useCallback(
    async (input: ObjectiveInput) => {
      if (!mutationsEnabled) {
        return {
          accepted: false,
          reason:
            "Not sent — the backend is not connected, so its current state is unknown. Submission resumes when the connection is restored.",
        };
      }
      const result = await postObjective(baseUrl, input, readOperatorCredential());
      // The SSE stream also re-arms the refresh when the two events land,
      // so this is not the only path — but a success message that claims a
      // Project and Build exist must not be able to appear next to a panel
      // still saying "No build yet", even for the width of a round trip,
      // and not at all if the stream is momentarily wedged.
      if (result.accepted) await client.refreshWorldState();
      return result;
    },
    [baseUrl, client, mutationsEnabled],
  );

  // Selection is a UI-only concern with no operational authority
  // (world-model.md → Object selection), so it stays local and remains
  // available while disconnected.
  const selectBuilding = useCallback(() => {}, []);
  const clearSelection = useCallback(() => {}, []);

  const [hasCredential, setHasCredential] = useState(false);
  useEffect(() => {
    // Read after mount only: localStorage does not exist during SSR, and
    // reading it during render would make the first paint differ between
    // server and client.
    setHasCredential(readOperatorCredential() !== null);
  }, []);

  const setOperatorCredential = useCallback((value: string) => {
    writeOperatorCredential(value);
    setHasCredential(readOperatorCredential() !== null);
  }, []);

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
        submitObjective,
        resolveApproval,
        selectBuilding,
        clearSelection,
        lastRejection,
        operatorCredentialRequired: !hasCredential,
        setOperatorCredential,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  );
}
