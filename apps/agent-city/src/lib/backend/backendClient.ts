import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { nextBackoffMs } from "./connectionState";
import { mergeEvents, resumeCursor } from "./reconcile";

export interface BackendClientOptions {
  baseUrl: string;
  /** Injectable for tests; defaults to the global EventSource. */
  createEventSource?: (url: string) => EventSourceLike;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to setTimeout. */
  scheduleRetry?: (fn: () => void, ms: number) => void;
}

/** The slice of EventSource this client relies on — lets tests substitute a fake without a DOM. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  onerror: ((this: unknown, ev: unknown) => unknown) | null;
  onopen: ((this: unknown, ev: unknown) => unknown) | null;
  close(): void;
}

export interface BackendSnapshotState {
  worldState: WorldState | null;
  events: FoundryEvent[];
  connectionStatus: ConnectionStatus;
}

export type BackendListener = (state: BackendSnapshotState) => void;

/**
 * Live projection of backend truth (FBL-026). Owns the SSE subscription,
 * bounded-backoff reconnection, and snapshot reconciliation.
 *
 * The client never fabricates events or advances state while
 * disconnected — on reconnect it re-fetches the authoritative snapshot
 * and merges the missed events the server replays, rather than guessing
 * at the gap.
 */
export class BackendClient {
  private readonly baseUrl: string;
  private readonly createEventSource: (url: string) => EventSourceLike;
  private readonly fetchImpl: typeof fetch;
  private readonly scheduleRetry: (fn: () => void, ms: number) => void;

  private source: EventSourceLike | null = null;
  private listeners = new Set<BackendListener>();
  private attempt = 0;
  private stopped = false;

  private events: FoundryEvent[] = [];
  private worldState: WorldState | null = null;
  private connectionStatus: ConnectionStatus = "disconnected";

  constructor(options: BackendClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.createEventSource =
      options.createEventSource ?? ((url) => new EventSource(url) as unknown as EventSourceLike);
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.scheduleRetry = options.scheduleRetry ?? ((fn, ms) => setTimeout(fn, ms));
  }

  subscribe(listener: BackendListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  getState(): BackendSnapshotState {
    return {
      worldState: this.worldState,
      events: this.events,
      connectionStatus: this.connectionStatus,
    };
  }

  /** Fetches the authoritative snapshot, then opens the stream resuming from what we already hold. */
  async start(): Promise<void> {
    this.stopped = false;
    await this.reconcile();
    this.openStream();
  }

  stop(): void {
    this.stopped = true;
    this.source?.close();
    this.source = null;
    this.setConnectionStatus("disconnected");
  }

  private async reconcile(): Promise<void> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/world-state`);
      if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
      const snapshot = (await res.json()) as WorldState;

      const eventsRes = await this.fetchImpl(`${this.baseUrl}/events`);
      const authoritative = eventsRes.ok ? ((await eventsRes.json()) as FoundryEvent[]) : [];

      this.worldState = snapshot;
      this.events = mergeEvents(
        this.events,
        authoritative,
        authoritative.map((e) => e.id),
      );
      this.emit();
    } catch {
      // Snapshot unavailable — stay disconnected and let backoff retry.
      this.setConnectionStatus("disconnected");
    }
  }

  private openStream(): void {
    if (this.stopped) return;
    const cursor = resumeCursor(this.events);
    const url = cursor
      ? `${this.baseUrl}/events/stream?lastEventId=${encodeURIComponent(cursor)}`
      : `${this.baseUrl}/events/stream`;

    const source = this.createEventSource(url);
    this.source = source;

    source.onopen = () => {
      this.attempt = 0;
      this.setConnectionStatus("connected");
    };

    source.addEventListener("foundry-event", (message: MessageEvent) => {
      try {
        const event = JSON.parse(message.data as string) as FoundryEvent;
        // Duplicate-safe and order-preserving (see reconcile.ts).
        this.events = mergeEvents(this.events, [event]);
        this.setConnectionStatus("connected");
        this.emit();
      } catch {
        // A malformed frame must never corrupt the local log.
      }
    });

    source.onerror = () => {
      this.setConnectionStatus("disconnected");
      source.close();
      this.source = null;
      this.retryLater();
    };
  }

  private retryLater(): void {
    if (this.stopped) return;
    const delay = nextBackoffMs(this.attempt);
    this.attempt += 1;
    this.scheduleRetry(() => {
      if (this.stopped) return;
      void this.start();
    }, delay);
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus === status) return;
    this.connectionStatus = status;
    this.emit();
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}
