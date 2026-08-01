import type { WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";
import { beforeEach, describe, expect, it } from "vitest";
import { BackendClient, type EventSourceLike } from "./backendClient";
import { INITIAL_BACKOFF_MS } from "./connectionState";

function evt(id: string): FoundryEvent {
  return {
    id,
    type: "system.started",
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "backend",
    actorId: "backend",
    entityType: "System",
    entityId: "neighborhood-1",
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { serviceVersion: "1.0.0", neighborhoodId: "neighborhood-1" },
  } as FoundryEvent;
}

const snapshot: WorldState = {
  buildings: [],
  agents: [],
  currentBuild: null,
  activeTransfers: [],
  approvals: [],
  inventoryCounts: { successfulPackages: 9 },
  health: { status: "healthy", reasons: ["nominal"] },
  lastProcessedEventId: null,
};

class FakeEventSource implements EventSourceLike {
  static instances: FakeEventSource[] = [];
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null;
  onopen: ((this: unknown, ev: unknown) => unknown) | null = null;
  closed = false;
  private listeners = new Map<string, ((event: MessageEvent) => void)[]>();

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  close(): void {
    this.closed = true;
  }

  open(): void {
    this.onopen?.call(this, {});
  }

  emit(event: FoundryEvent): void {
    for (const listener of this.listeners.get("foundry-event") ?? []) {
      listener({ data: JSON.stringify(event) } as MessageEvent);
    }
  }

  fail(): void {
    this.onerror?.call(this, {});
  }
}

let serverEvents: FoundryEvent[];
let retries: { fn: () => void; ms: number }[];

function makeClient() {
  return new BackendClient({
    baseUrl: "http://api.test",
    createEventSource: (url) => new FakeEventSource(url),
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/world-state")) {
        return { ok: true, json: async () => snapshot } as Response;
      }
      if (url.includes("/events")) {
        return { ok: true, json: async () => serverEvents } as Response;
      }
      return { ok: false, status: 404 } as Response;
    }) as typeof fetch,
    scheduleRetry: (fn, ms) => retries.push({ fn, ms }),
  });
}

beforeEach(() => {
  FakeEventSource.instances = [];
  serverEvents = [];
  retries = [];
});

describe("BackendClient — connect and receive", () => {
  it("fetches the snapshot then opens a stream, and reports connected on open", async () => {
    serverEvents = [evt("a")];
    const client = makeClient();
    await client.start();

    const source = FakeEventSource.instances[0]!;
    source.open();

    const state = client.getState();
    expect(state.connectionStatus).toBe("connected");
    expect(state.worldState).toEqual(snapshot);
    expect(state.events.map((e) => e.id)).toEqual(["a"]);
  });

  it("delivers live events to subscribers in order", async () => {
    const client = makeClient();
    await client.start();
    const source = FakeEventSource.instances[0]!;
    source.open();

    source.emit(evt("live-1"));
    source.emit(evt("live-2"));

    expect(client.getState().events.map((e) => e.id)).toEqual(["live-1", "live-2"]);
  });

  it("duplicate delivery of the same event id does not duplicate the local log", async () => {
    const client = makeClient();
    await client.start();
    const source = FakeEventSource.instances[0]!;
    source.open();

    source.emit(evt("dup"));
    source.emit(evt("dup"));

    expect(client.getState().events.map((e) => e.id)).toEqual(["dup"]);
  });
});

describe("BackendClient — disconnect marks state stale", () => {
  it("reports disconnected on stream error and stops treating state as live", async () => {
    const client = makeClient();
    await client.start();
    const source = FakeEventSource.instances[0]!;
    source.open();
    expect(client.getState().connectionStatus).toBe("connected");

    source.fail();

    expect(client.getState().connectionStatus).toBe("disconnected");
    expect(source.closed).toBe(true);
  });

  it("does not invent events while disconnected", async () => {
    const client = makeClient();
    await client.start();
    const source = FakeEventSource.instances[0]!;
    source.open();
    source.emit(evt("before-drop"));
    source.fail();

    const eventsWhileDown = client.getState().events.map((e) => e.id);
    expect(eventsWhileDown).toEqual(["before-drop"]);
  });
});

describe("BackendClient — reconnect with bounded backoff and reconciliation", () => {
  it("schedules a retry using bounded backoff after a failure", async () => {
    const client = makeClient();
    await client.start();
    FakeEventSource.instances[0]!.open();
    FakeEventSource.instances[0]!.fail();

    expect(retries).toHaveLength(1);
    expect(retries[0]!.ms).toBe(INITIAL_BACKOFF_MS);
  });

  it("on reconnect, re-fetches the snapshot and recovers events missed while down", async () => {
    const client = makeClient();
    await client.start();
    const first = FakeEventSource.instances[0]!;
    first.open();
    first.emit(evt("a"));
    first.fail();

    // Events the backend recorded while the client was disconnected.
    serverEvents = [evt("a"), evt("missed-1"), evt("missed-2")];

    await retries[0]!.fn();
    await new Promise((r) => setTimeout(r, 0));

    const state = client.getState();
    expect(state.events.map((e) => e.id)).toEqual(["a", "missed-1", "missed-2"]);
  });

  it("resumes the stream from the last held event id so the server can replay only the gap", async () => {
    const client = makeClient();
    await client.start();
    const first = FakeEventSource.instances[0]!;
    first.open();
    first.emit(evt("a"));
    first.emit(evt("b"));
    first.fail();

    serverEvents = [evt("a"), evt("b")];
    await retries[0]!.fn();
    await new Promise((r) => setTimeout(r, 0));

    const reconnected = FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
    expect(reconnected.url).toContain("lastEventId=b");
  });

  it("resets backoff after a successful reconnect", async () => {
    const client = makeClient();
    await client.start();
    FakeEventSource.instances[0]!.open();
    FakeEventSource.instances[0]!.fail();
    expect(retries[0]!.ms).toBe(INITIAL_BACKOFF_MS);

    await retries[0]!.fn();
    await new Promise((r) => setTimeout(r, 0));
    const reconnected = FakeEventSource.instances[FakeEventSource.instances.length - 1]!;
    reconnected.open();
    reconnected.fail();

    expect(retries[1]!.ms).toBe(INITIAL_BACKOFF_MS);
  });

  it("grows the delay while reconnects keep failing", async () => {
    const client = makeClient();
    await client.start();
    const source = FakeEventSource.instances[0]!;
    source.open();
    source.fail();

    // Fail the reconnect attempt itself, without ever opening successfully.
    await retries[0]!.fn();
    await new Promise((r) => setTimeout(r, 0));
    FakeEventSource.instances[FakeEventSource.instances.length - 1]!.fail();

    expect(retries[1]!.ms).toBeGreaterThan(retries[0]!.ms);
  });
});

describe("BackendClient — stop", () => {
  it("closes the stream and stops retrying", async () => {
    const client = makeClient();
    await client.start();
    const source = FakeEventSource.instances[0]!;
    source.open();

    client.stop();

    expect(source.closed).toBe(true);
    expect(client.getState().connectionStatus).toBe("disconnected");
  });
});
