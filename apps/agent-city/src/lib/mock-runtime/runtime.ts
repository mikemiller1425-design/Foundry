import type { Approval, WorldState } from "@foundry/contracts";
import type { DemoCommand, FoundryEvent } from "@foundry/event-types";
import { DemoCommandSchema } from "@foundry/event-types";
import {
  buildApprovalRejectedEvents,
  buildApprovalRevisionRequestedEvents,
} from "./approvalActions";
import { createEventFactory } from "./eventFactory";
import { createIdGenerator } from "./ids";
import { buildCanonicalScript } from "./script";
import { applyEvent, createInitialWorldState } from "./worldStateReducer";

export const DEFAULT_SEED = "v1-demo";
const BASE_INTERVAL_MS = 200;
const OPERATOR_SESSION_ENTITY = "operator-session";
const UI_SESSION_ENTITY = "ui-session";

export type MockRuntimeListener = (event: FoundryEvent) => void;
export type CommandRejectedListener = (rejection: { commandType: string; reason: string }) => void;
export type ApprovalDecision = "approved" | "rejected" | "revision_requested";

/**
 * Deterministic, replayable, in-memory V1 demo engine (ADR-001). It is the
 * temporary operational authority pre-backend (principles.md 3a): its
 * emitted events, not arbitrary UI logic, are the sole source of
 * completion/transfer/approval/upgrade outcomes while it runs.
 */
export class MockRuntime {
  private script: FoundryEvent[];
  private seed: string;
  private cursor = 0;
  private running = false;
  private speedMultiplier = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private worldState: WorldState = createInitialWorldState();
  private emittedIds = new Set<string>();
  private emittedLog: FoundryEvent[] = [];
  private listeners = new Set<MockRuntimeListener>();
  private rejectionListeners = new Set<CommandRejectedListener>();
  private commandEvent: ReturnType<typeof createEventFactory>;
  private selectionEvent: ReturnType<typeof createEventFactory>;
  private revisionIdGenerator: ReturnType<typeof createIdGenerator>;
  private lastSelectedBuildingId: string | null = null;

  constructor(seed: string = DEFAULT_SEED) {
    this.seed = seed;
    this.script = buildCanonicalScript(seed);
    this.commandEvent = createEventFactory(seed, OPERATOR_SESSION_ENTITY, "evt-cmd");
    this.selectionEvent = createEventFactory(seed, UI_SESSION_ENTITY, "evt-select");
    this.revisionIdGenerator = createIdGenerator(`${seed}-manual`);
  }

  onEvent(listener: MockRuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onCommandRejected(listener: CommandRejectedListener): () => void {
    this.rejectionListeners.add(listener);
    return () => this.rejectionListeners.delete(listener);
  }

  /** Chronological, deduped log of every event emitted so far — scripted and injected alike. */
  getEvents(): readonly FoundryEvent[] {
    return this.emittedLog;
  }

  getFullScriptLength(): number {
    return this.script.length;
  }

  getWorldState(): WorldState {
    return this.worldState;
  }

  isRunning(): boolean {
    return this.running;
  }

  isComplete(): boolean {
    return this.cursor >= this.script.length;
  }

  /** True once an approval.requested has fired and no resolution has followed yet. */
  hasPendingApproval(): boolean {
    return this.worldState.approvals.some((a) => a.status === "pending");
  }

  /** Synchronously emits every remaining event with no pacing — for headless tests. */
  runToCompletion(): void {
    this.fastForwardTo(this.script.length);
  }

  /**
   * Synchronously (re)emits events up to `targetCursor` with no pacing, then
   * pauses. Used for FBL-009 history reconstruction after reload: given the
   * same seed, the deterministic script regenerates identical events, so a
   * saved `{ seed, cursor }` marker (frontend-local storage — no backend
   * persistence) is enough to replay the exact prior history to listeners.
   */
  fastForwardTo(targetCursor: number): void {
    this.pause();
    const bound = Math.min(Math.max(targetCursor, 0), this.script.length);
    while (this.cursor < bound) {
      this.emitNext();
      // The approval gate applies here too, not only to timer-paced
      // playback — a synchronous fast-forward must not blow past a pending
      // approval any more than the scheduled path would.
      if (this.hasPendingApproval()) break;
    }
  }

  /**
   * Rebuilds a read-only fixture view at an exact canonical cursor and
   * remains paused there. This is presentation navigation, not a domain
   * command: it creates no event and grants no operational authority.
   */
  previewAtCursor(targetCursor: number): void {
    this.reset();
    const bound = Math.min(Math.max(targetCursor, 0), this.script.length);
    // Unlike operational fast-forward, a fixture preview may inspect a
    // later point in the already-recorded canonical journey. Replaying its
    // declared approval resolution is not approving anything now.
    while (this.cursor < bound) this.emitNext();
    this.pause();
  }

  getCursor(): number {
    return this.cursor;
  }

  getSeed(): string {
    return this.seed;
  }

  /**
   * Validates and applies a bounded demo command, emitting the real
   * operator.command_submitted/_accepted/_rejected events the domain model
   * defines for this (event-model.md → "Operator") — not just an ad hoc UI
   * callback. Invalid commands are rejected, never silently accepted.
   */
  submitCommand(raw: unknown): void {
    const result = DemoCommandSchema.safeParse(raw);
    if (!result.success) {
      const commandType =
        typeof raw === "object" && raw !== null && "commandType" in raw
          ? String((raw as { commandType: unknown }).commandType)
          : "unknown";
      const reason = "commandType is not one of the approved demo commands";
      this.emitInjected(
        this.commandEvent({
          type: "operator.command_rejected",
          entityType: "Operator",
          entityId: OPERATOR_SESSION_ENTITY,
          actorType: "operator",
          actorId: "operator-1",
          severity: "warning",
          payload: { commandType, reason },
        }),
      );
      this.rejectCommand(commandType, reason);
      return;
    }
    this.emitInjected(
      this.commandEvent({
        type: "operator.command_submitted",
        entityType: "Operator",
        entityId: OPERATOR_SESSION_ENTITY,
        actorType: "operator",
        actorId: "operator-1",
        payload: result.data,
      }),
    );
    this.emitInjected(
      this.commandEvent({
        type: "operator.command_accepted",
        entityType: "Operator",
        entityId: OPERATOR_SESSION_ENTITY,
        actorType: "backend",
        actorId: "backend",
        payload: { commandType: result.data.commandType, params: result.data.params },
      }),
    );
    this.applyCommand(result.data);
  }

  /**
   * Resolves the current pending Approval (event-model.md → "Approval").
   * "approved" resumes playback — the scripted approval.approved event is
   * always the next event after approval.requested, so approving simply
   * lets the canonical journey continue. "rejected"/"revision_requested"
   * inject the real alternate-path events (approvalActions.ts) and leave
   * the runtime paused there — v1-scope.md's Required workflow describes
   * exactly one canonical journey past approval, so no further scripted
   * events exist for a non-approved outcome; nothing is invented.
   */
  resolveApproval(decision: ApprovalDecision, resolvedBy: string, resolutionNote?: string): void {
    const pending = this.worldState.approvals.find((a: Approval) => a.status === "pending");
    if (!pending) return;

    if (decision === "approved") {
      this.resume();
      return;
    }
    if (decision === "rejected") {
      const events = buildApprovalRejectedEvents({
        seed: this.seed,
        correlationId: pending.buildId,
        approvalId: pending.id,
        resolvedBy,
        resolutionNote,
      });
      for (const event of events) this.emitInjected(event);
      return;
    }
    const events = buildApprovalRevisionRequestedEvents({
      seed: this.seed,
      correlationId: pending.buildId,
      approvalId: pending.id,
      stageId: pending.stageId,
      resolvedBy,
      revisionId: this.revisionIdGenerator("revision"),
      reason: resolutionNote ?? "Operator requested revision",
      resolutionNote,
    });
    for (const event of events) this.emitInjected(event);
  }

  /**
   * Records a UI-facing building.selected event (event-model.md → "Building":
   * "Backend effect: None on operational truth (selection is UI)"; FBL-015).
   * Re-selecting the already-selected object emits nothing further — this
   * is the "duplicate selection events must not duplicate ... timeline
   * records" guarantee; a fresh selection (a different object, or the same
   * one again after an intervening deselect) always emits its own event.
   */
  selectBuilding(buildingId: string): void {
    if (this.lastSelectedBuildingId === buildingId) return;
    this.lastSelectedBuildingId = buildingId;
    this.emitInjected(
      this.selectionEvent({
        type: "building.selected",
        entityType: "Building",
        entityId: buildingId,
        actorType: "frontend",
        actorId: "frontend-ui",
        severity: "info",
        payload: { buildingId },
      }),
    );
  }

  /** Deselection is pure frontend state — no event exists for it (event-model.md has no "building.deselected"). */
  clearSelection(): void {
    this.lastSelectedBuildingId = null;
  }

  private rejectCommand(commandType: string, reason: string): void {
    for (const listener of this.rejectionListeners) listener({ commandType, reason });
  }

  private applyCommand(command: DemoCommand): void {
    switch (command.commandType) {
      case "demo.start":
        this.start();
        return;
      case "demo.pause":
        this.pause();
        return;
      case "demo.resume":
        this.resume();
        return;
      case "demo.set_speed":
        this.setSpeed(command.params.multiplier);
        return;
      case "demo.reset":
        this.reset();
        return;
      case "demo.replay":
        this.replay(command.params.seed);
        return;
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  pause(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Resumes from exactly where it paused — never re-emits, never reorders. */
  resume(): void {
    if (this.running || this.isComplete()) return;
    this.running = true;
    this.scheduleNext();
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
    // Affects only future emission timing, never event order/content.
    if (this.running) {
      if (this.timer) clearTimeout(this.timer);
      this.scheduleNext();
    }
  }

  /** Clears all state; re-initializes as if freshly booted. */
  reset(): void {
    this.pause();
    this.cursor = 0;
    this.emittedIds.clear();
    this.emittedLog = [];
    this.worldState = createInitialWorldState();
    this.script = buildCanonicalScript(this.seed);
    this.lastSelectedBuildingId = null;
  }

  /** Re-emits the identical seeded sequence deterministically from the start. */
  replay(seed?: string): void {
    this.pause();
    if (seed) this.seed = seed;
    this.cursor = 0;
    this.emittedIds.clear();
    this.emittedLog = [];
    this.worldState = createInitialWorldState();
    this.script = buildCanonicalScript(this.seed);
    this.lastSelectedBuildingId = null;
    this.start();
  }

  private scheduleNext(): void {
    if (!this.running || this.isComplete()) {
      this.running = false;
      return;
    }
    const interval = BASE_INTERVAL_MS / this.speedMultiplier;
    this.timer = setTimeout(() => {
      this.emitNext();
      this.scheduleNext();
    }, interval);
  }

  private emitNext(): void {
    const event = this.script[this.cursor];
    if (!event) return;
    this.cursor += 1;
    this.applyAndNotify(event);
    // Pending approval pauses protected progression (domain-model.md
    // Approval invariants; F-06) — the engine enforces this itself, not
    // just the UI.
    if (event.type === "approval.requested") {
      this.pause();
    }
  }

  /** For events outside script playback (commands, approval resolutions). */
  private emitInjected(event: FoundryEvent): void {
    this.applyAndNotify(event);
  }

  /** Idempotent apply: a duplicated event id is ignored, never re-applied. */
  private applyAndNotify(event: FoundryEvent): void {
    if (this.emittedIds.has(event.id)) return;
    this.emittedIds.add(event.id);
    this.emittedLog.push(event);
    this.worldState = applyEvent(this.worldState, event);
    this.worldState = { ...this.worldState, lastProcessedEventId: event.id };
    for (const listener of this.listeners) listener(event);
  }
}
