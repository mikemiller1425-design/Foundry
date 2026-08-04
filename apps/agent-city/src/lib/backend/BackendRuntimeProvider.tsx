"use client";

import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { BackendClient } from "./backendClient";
import {
  interpretCommandResponse,
  isKnownCommandType,
  requestedCommandType,
  unreachableBackend,
  unsupportedCommand,
} from "./commandFeedback";
import { applyConnectionStatus, areMutationsAllowed } from "./connectionState";
import { postObjective, type ObjectiveInput } from "./objectiveSubmission";
import { postBuildRun, type BuildRunResult } from "./buildRun";
import { fetchExecutionGate, type ExecutionGateReport } from "./executionGate";
import { deriveCredentialState, isAuthFailure } from "./credentialState";
import {
  clearOperatorCredential,
  commandHeaders,
  fetchHandoffCredential,
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

      // AC-106: a control the backend has no command for is answered here,
      // truthfully, instead of being sent to collect a 400 that would read
      // as "your input was invalid". The vocabulary is closed and the
      // client validates against the same list the backend does.
      if (!isKnownCommandType(commandType)) {
        setLastRejection(unsupportedCommand(commandType));
        return;
      }

      // Never send a mutation while disconnected — the backend is the
      // authority and we cannot know current state (F-10). Saying so is
      // part of the contract: refusing to send is still a refusal, and it
      // must read as one rather than as a button that did nothing.
      if (!mutationsEnabled) {
        setLastRejection(
          unreachableBackend(
            commandType,
            "Not sent — the backend is not connected, so its current state is unknown.",
          ),
        );
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
        // An authorization refusal is a credential fact, not just a
        // command outcome — it is what turns "held" into "rejected" so the
        // panel can stop claiming the credential is fine.
        if (isAuthFailure(res.status, outcome)) setCredentialRejected(true);
        setLastRejection(interpretCommandResponse(res.status, outcome, commandType));
      } catch (err) {
        setLastRejection(
          unreachableBackend(commandType, err instanceof Error ? err.message : undefined),
        );
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
      if (!result.accepted && /authenticated operator/i.test(result.reason ?? "")) {
        setCredentialRejected(true);
      }
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

  /**
   * AC-106 / PV1-013 — `building.selected` now reaches the timeline in
   * backend mode.
   *
   * `world-model.md` § "Object selection": selection "emits UI-facing
   * `building.selected` … without mutating operational truth", and
   * `event-model.md` names the producer as "Frontend (recorded) / backend
   * optional ack". In backend mode this callback was empty, so the
   * declared event had no producer and the timeline was less complete
   * than the mock's.
   *
   * `Building.Select` is already in the closed command vocabulary and its
   * definition carries no `toStatus`, so submitting it appends the
   * declared event and changes no entity status. No specification
   * amendment, no new command, no orchestration.
   *
   * Two deliberate properties:
   *
   * - **Selection visuals never depend on this.** `AppShell` holds
   *   selection in local React state, which is correct — selection carries
   *   no operational authority — so a refusal is reported but never undoes
   *   what the operator selected.
   * - **Repeat selection is not resubmitted.** The mock runtime dedupes
   *   re-selection for the same reason: a click that changes nothing
   *   should not append an event that says something changed.
   */
  const lastSelectedRef = useRef<string | null>(null);

  const selectBuilding = useCallback(
    (buildingId: string) => {
      if (lastSelectedRef.current === buildingId) return;
      lastSelectedRef.current = buildingId;
      void postCommand({
        commandType: "Building.Select",
        entityId: buildingId,
        params: { buildingId },
      });
    },
    [postCommand],
  );

  // Clearing selection has no declared event — `event-model.md` defines
  // `building.selected` and no deselection counterpart — so there is
  // nothing to record. It resets the dedup guard and nothing else.
  const clearSelection = useCallback(() => {
    lastSelectedRef.current = null;
  }, []);

  /**
   * AC-108 — records the operator's plan review.
   *
   * Goes through `postCommand` → `POST /commands` → `CommandHandler` like
   * every other authority-bearing decision, so it inherits the whole
   * failure taxonomy: an unauthenticated caller, a stale revision, or a
   * conflicting second decision each produce their own readable refusal.
   *
   * `reviewedRevision` is the revision this browser is displaying. If the
   * plan changed since it was rendered the backend refuses, rather than
   * recording a decision about something the operator did not read.
   *
   * Recording a review authorizes nothing. Execution requires a separate
   * single-use authorization, which does not exist yet (AC-110).
   */
  const reviewPlan = useCallback(
    async (input: { decision: "proceed" | "rejected" | "revision_requested"; note?: string }) => {
      const persisted = worldState.currentPlan;
      if (!persisted) return;
      await postCommand({
        commandType: "Plan.Review",
        entityId: persisted.plan.planId,
        params: {
          planId: persisted.plan.planId,
          buildId: persisted.plan.buildId,
          reviewedRevision: persisted.revision,
          decision: input.decision,
          ...(input.note ? { note: input.note } : {}),
        },
      });
      // The review is backend truth; re-read it rather than assuming.
      await client.refreshWorldState();
    },
    [client, postCommand, worldState.currentPlan],
  );

  /**
   * AC-109 — starts the orchestrated run for the current build.
   *
   * Not routed through `submitCommand`: starting a run is not one of the
   * declared command types, and inventing one would be a specification
   * change made in passing. `POST /builds/{id}/start` translates it into
   * `Build.Start` server-side — through the same `CommandHandler` every
   * other caller faces — and then drives the rest of the run from the
   * backend, where the authority lives.
   *
   * The result is returned rather than stored, so the panel can show the
   * backend's own reason and corrective action instead of a banner.
   *
   * **Simulated.** The backend advances every stage with the deterministic
   * mock executor. Nothing here authorizes a real invocation; that gate
   * does not exist yet (AC-110).
   */
  const startBuildRun = useCallback(async (): Promise<BuildRunResult> => {
    const buildId = worldState.currentBuild?.id;
    if (!buildId) {
      return {
        accepted: false,
        code: "no_build",
        reason: "There is no current build to run. Submit an objective first.",
      };
    }
    if (!mutationsEnabled) {
      return {
        accepted: false,
        code: "unreachable",
        reason:
          "Not sent — the backend is not connected, so its current state is unknown. Starting resumes when the connection is restored.",
      };
    }

    const result = await postBuildRun(baseUrl, buildId, readOperatorCredential());
    if (!result.accepted && /authenticated operator/i.test(result.reason ?? "")) {
      setCredentialRejected(true);
    }
    // The first events land immediately; re-read rather than assume, for
    // the same reason objective submission does.
    if (result.accepted) await client.refreshWorldState();
    return result;
  }, [baseUrl, client, mutationsEnabled, worldState.currentBuild?.id]);

  /**
   * AC-110 — issues the single-use execution authorization.
   *
   * Goes through `postCommand` → `POST /commands` → `CommandHandler` like
   * every other authority-bearing decision, so it inherits the whole
   * failure taxonomy: an unauthenticated caller, an unreviewed plan, a
   * stage the plan runs with the mock, a budget over the ceiling, or a
   * second authorization each produce their own readable refusal.
   *
   * `acknowledgedContentHash` is the hash **this browser is displaying**.
   * If the persisted plan hashes to anything else the backend refuses,
   * rather than recording permission for something the operator did not
   * see. It is evidence about what was on screen — never the binding.
   *
   * Authorizing starts nothing.
   */
  const authorizeExecution = useCallback(
    async (input: { stageName: string; maxBudgetUsd: number; note?: string }) => {
      const persisted = worldState.currentPlan;
      if (!persisted) return;
      await postCommand({
        commandType: "Plan.Authorize",
        entityId: persisted.plan.planId,
        params: {
          planId: persisted.plan.planId,
          buildId: persisted.plan.buildId,
          stageName: input.stageName,
          maxBudgetUsd: input.maxBudgetUsd,
          acknowledgedContentHash: persisted.contentHash,
          ...(input.note ? { note: input.note } : {}),
        },
      });
      // The authorization is backend truth; re-read it rather than assuming.
      await client.refreshWorldState();
    },
    [client, postCommand, worldState.currentPlan],
  );

  /** AC-110 — reads the gate's verdict. A GET; it changes nothing. */
  const readExecutionGate = useCallback(
    async (stageName: string): Promise<ExecutionGateReport | null> => {
      const buildId = worldState.currentBuild?.id;
      if (!buildId) return null;
      return fetchExecutionGate(baseUrl, buildId, stageName);
    },
    [baseUrl, worldState.currentBuild?.id],
  );

  // ---- Operator credential (AC-105) --------------------------------------

  const [storedCredential, setStoredCredential] = useState<string | null>(null);
  const [handoffCredential, setHandoffCredential] = useState<string | null>(null);
  const [credentialRejected, setCredentialRejected] = useState(false);

  useEffect(() => {
    // Read after mount only: localStorage does not exist during SSR, and
    // reading it during render would make the first paint differ between
    // server and client.
    setStoredCredential(readOperatorCredential());
  }, []);

  useEffect(() => {
    /**
     * Ask this host's server what the launch path handed it.
     *
     * Two jobs, and the second is why it runs even when a credential is
     * already held: it supplies one when there is none, and it is what
     * makes a *stale* credential detectable at all — a token that differs
     * from the one this API session issued is left over from an earlier
     * boot, which is otherwise indistinguishable from a wrong paste.
     */
    let cancelled = false;
    void fetchHandoffCredential().then((credential) => {
      if (cancelled) return;
      setHandoffCredential(credential);
      // Adopt it only when the browser holds nothing. An operator who
      // deliberately pasted something is not overruled without being asked.
      if (credential && readOperatorCredential() === null) {
        writeOperatorCredential(credential);
        setStoredCredential(readOperatorCredential());
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setOperatorCredential = useCallback((value: string) => {
    writeOperatorCredential(value);
    setStoredCredential(readOperatorCredential());
    // A new credential deserves a fresh verdict; keeping the old rejection
    // would label a correct token invalid.
    setCredentialRejected(false);
  }, []);

  const clearCredential = useCallback(() => {
    clearOperatorCredential();
    setStoredCredential(null);
    setCredentialRejected(false);
  }, []);

  const useHandoffCredential = useCallback(() => {
    if (!handoffCredential) return;
    setOperatorCredential(handoffCredential);
  }, [handoffCredential, setOperatorCredential]);

  const credentialState = useMemo(
    () =>
      deriveCredentialState({
        connected: connectionStatus === "connected",
        stored: storedCredential,
        handoff: handoffCredential,
        rejected: credentialRejected,
      }),
    [connectionStatus, storedCredential, handoffCredential, credentialRejected],
  );

  return (
    <RuntimeContext.Provider
      value={{
        // AC-106: stated, never inferred. A control that needs to know
        // which runtime it is attached to must not guess from a proxy
        // like connection status — the mock runtime is permanently
        // "connected" and would read as a live backend.
        runtimeMode: "backend",
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
        // Kept as the existing boolean so every current call site behaves
        // exactly as before; `credentialState` carries the detail.
        operatorCredentialRequired: credentialState.needsCredential,
        setOperatorCredential,
        credentialState,
        storedCredential,
        handoffAvailable: handoffCredential !== null,
        useHandoffCredential,
        clearOperatorCredential: clearCredential,
        reviewPlan,
        startBuildRun,
        authorizeExecution,
        readExecutionGate,
      }}
    >
      {children}
    </RuntimeContext.Provider>
  );
}
