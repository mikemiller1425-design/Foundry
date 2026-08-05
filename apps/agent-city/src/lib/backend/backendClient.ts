import { WorldStateSchema, type ConnectionStatus, type WorldState } from "@foundry/contracts";
import { FoundryEventSchema, type FoundryEvent } from "@foundry/event-types";
import { nextBackoffMs } from "./connectionState";
import { mergeEvents, resumeCursor } from "./reconcile";
import type { ProjectionStatus } from "@/lib/runtime/adapter";

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
  projectionStatus: ProjectionStatus;
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
  private projectionStatus: ProjectionStatus = "unavailable";

  /** A live event has arrived and the held projection has not caught up yet. */
  private worldStateStale = false;
  /** A `/world-state` read is in flight; guarantees at most one at a time. */
  private worldStateFetching = false;

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
      projectionStatus: this.projectionStatus,
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
    this.setProjectionStatus(this.worldState ? "stale" : "unavailable");
    this.setConnectionStatus("disconnected");
  }

  /**
   * Re-reads the authoritative `/world-state` projection (AC-103 fix).
   *
   * The bug this exists to close: the live-event listener merged each
   * incoming event into the local log and emitted, but never touched
   * `worldState`. `worldState` was therefore only ever written by
   * `reconcile()` — at `start()` and on reconnect — so after any live
   * change the timeline advanced while every world-state-derived panel
   * kept showing the page-load snapshot. Submitting an objective produced
   * exactly that: two new timeline rows, and "Current build: No build
   * yet." The projection was not stale by a race; it was never refreshed
   * at all.
   *
   * The projection is **refetched, not recomputed**. Deriving it locally
   * from events would mean a second reducer whose agreement with the
   * backend's is a thing to be maintained and proved, and the frontend
   * would be computing operational state it does not own (principle 1,
   * ADR-002). One read of the endpoint the backend already projects is
   * both cheaper to reason about and correct by construction.
   *
   * Reads are coalesced rather than issued per event: at most one is in
   * flight, and events arriving during it collapse into a single
   * follow-up. A 124-event replay therefore costs two reads, not 124.
   */
  async refreshWorldState(): Promise<void> {
    this.worldStateStale = true;
    this.setProjectionStatus(this.worldState ? "stale" : "unavailable");
    await this.drainWorldStateRefresh();
  }

  private async drainWorldStateRefresh(): Promise<void> {
    // A caller that finds a read already in flight returns immediately,
    // having set the stale flag — the running pass is responsible for
    // picking it up. That hand-off is why the loop below must not abandon
    // a request that arrived while it was working.
    if (this.worldStateFetching) return;
    this.worldStateFetching = true;
    try {
      while (this.worldStateStale && !this.stopped) {
        this.worldStateStale = false;
        const applied = await this.readWorldStateOnce();

        // A failed read leaves the last good projection in place — a
        // world that blanks itself because one request failed is worse
        // than one that is briefly behind, and the SSE connection, not
        // this read, owns connection status.
        //
        // The `worldStateStale` check is the part that is easy to get
        // wrong: if a refresh was requested *during* this read, that
        // caller has already returned believing this pass would serve it.
        // Giving up here would strand it until the next event arrived,
        // which is a lost wake-up, not a retry policy. So the loop
        // continues for the newer request. It still cannot spin: each
        // iteration consumes exactly one request, and with no new
        // requests `worldStateStale` is false and the loop ends.
        if (!applied && !this.worldStateStale) break;
      }
    } finally {
      this.worldStateFetching = false;
    }
  }

  private async readWorldStateOnce(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/world-state`);
      if (!res.ok) {
        this.setProjectionStatus(this.worldState ? "stale" : "unavailable");
        return false;
      }
      const parsed = WorldStateSchema.safeParse(await res.json());
      if (!parsed.success) {
        this.setProjectionStatus(this.worldState ? "stale" : "unavailable");
        return false;
      }
      this.worldState = parsed.data;
      this.projectionStatus = "current";
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  private async reconcile(): Promise<void> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/world-state`);
      if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
      const snapshot = WorldStateSchema.parse(await res.json());

      const eventsRes = await this.fetchImpl(`${this.baseUrl}/events`);
      const authoritative = eventsRes.ok ? parseEventArray(await eventsRes.json()) : [];

      this.worldState = snapshot;
      this.events = mergeEvents(
        this.events,
        authoritative,
        authoritative.map((e) => e.id),
      );
      this.projectionStatus = "current";
      this.emit();
    } catch {
      // Snapshot unavailable — stay disconnected and let backoff retry.
      this.setProjectionStatus(this.worldState ? "stale" : "unavailable");
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
        const event = FoundryEventSchema.parse(JSON.parse(message.data as string));
        // Duplicate-safe and order-preserving (see reconcile.ts).
        this.events = mergeEvents(this.events, [event]);
        this.worldStateStale = true;
        this.projectionStatus = this.worldState ? "stale" : "unavailable";
        this.setConnectionStatus("connected");
        this.emit();
        // The event log and the world-state projection are two views of
        // the same truth, so they have to advance together. Emitting the
        // new event without this is what let the timeline and "Current
        // build" disagree.
        void this.drainWorldStateRefresh();
      } catch {
        // A frame on the declared Foundry channel that does not satisfy
        // the shared event contract creates a possible gap in canonical
        // history. Preserve last-known state, mark it stale, and reconcile
        // from the backend rather than silently claiming the stream is live.
        this.handleStreamFailure(source);
      }
    });

    source.onerror = () => {
      this.handleStreamFailure(source);
    };
  }

  private handleStreamFailure(source: EventSourceLike): void {
    // Ignore a late error from a source that has already been replaced.
    if (this.source !== source) return;
    this.setProjectionStatus(this.worldState ? "stale" : "unavailable");
    this.setConnectionStatus("disconnected");
    source.close();
    this.source = null;
    this.retryLater();
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

  private setProjectionStatus(status: ProjectionStatus): void {
    if (this.projectionStatus === status) return;
    this.projectionStatus = status;
    this.emit();
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}

function parseEventArray(raw: unknown): FoundryEvent[] {
  if (!Array.isArray(raw)) throw new Error("events response is not an array");
  return raw.map((event) => FoundryEventSchema.parse(event));
}
