import type { WorldState } from "@foundry/contracts";
import type { DemoCommand, FoundryEvent } from "@foundry/event-types";
import { DemoCommandSchema } from "@foundry/event-types";
import { buildCanonicalScript } from "./script";
import { applyEvent, createInitialWorldState } from "./worldStateReducer";

export const DEFAULT_SEED = "v1-demo";
const BASE_INTERVAL_MS = 200;

export type MockRuntimeListener = (event: FoundryEvent) => void;
export type CommandRejectedListener = (rejection: { commandType: string; reason: string }) => void;

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
  private listeners = new Set<MockRuntimeListener>();
  private rejectionListeners = new Set<CommandRejectedListener>();

  constructor(seed: string = DEFAULT_SEED) {
    this.seed = seed;
    this.script = buildCanonicalScript(seed);
  }

  onEvent(listener: MockRuntimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onCommandRejected(listener: CommandRejectedListener): () => void {
    this.rejectionListeners.add(listener);
    return () => this.rejectionListeners.delete(listener);
  }

  getEvents(): readonly FoundryEvent[] {
    return this.script.slice(0, this.cursor);
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

  /** Synchronously emits every remaining event with no pacing — for headless tests. */
  runToCompletion(): void {
    while (this.cursor < this.script.length) {
      this.emitNext();
    }
  }

  /** Validates and applies a bounded demo command. Invalid commands are rejected, never silently accepted. */
  submitCommand(raw: unknown): void {
    const result = DemoCommandSchema.safeParse(raw);
    if (!result.success) {
      const commandType =
        typeof raw === "object" && raw !== null && "commandType" in raw
          ? String((raw as { commandType: unknown }).commandType)
          : "unknown";
      this.rejectCommand(commandType, "commandType is not one of the approved demo commands");
      return;
    }
    this.applyCommand(result.data);
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
    this.worldState = createInitialWorldState();
    this.script = buildCanonicalScript(this.seed);
  }

  /** Re-emits the identical seeded sequence deterministically from the start. */
  replay(seed?: string): void {
    this.pause();
    if (seed) this.seed = seed;
    this.cursor = 0;
    this.emittedIds.clear();
    this.worldState = createInitialWorldState();
    this.script = buildCanonicalScript(this.seed);
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
  }

  /** Idempotent apply: a duplicated event id is ignored, never re-applied. */
  private applyAndNotify(event: FoundryEvent): void {
    if (this.emittedIds.has(event.id)) return;
    this.emittedIds.add(event.id);
    this.worldState = applyEvent(this.worldState, event);
    this.worldState = { ...this.worldState, lastProcessedEventId: event.id };
    for (const listener of this.listeners) listener(event);
  }
}
