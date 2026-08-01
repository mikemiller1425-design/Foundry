import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { PersistenceService } from "@foundry/persistence";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

// docs/02-specification/v1-acceptance.md § performance:
// "Realtime update visible < 500 ms on local network".
const LATENCY_BUDGET_MS = 500;

let dir: string;
let persistence: PersistenceService;
let server: Server;
let baseUrl: string;

function makeEvent(id: string): FoundryEvent {
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

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-latency-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  server = createApp(persistence);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Time from `appendEvent` returning to the frame being readable by a connected client. */
async function measureDeliveryLatency(res: Response, eventId: string): Promise<number> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  // Drain the opening comment so the measurement starts from a live stream.
  await reader.read();

  const startedAt = performance.now();
  persistence.appendEvent(makeEvent(eventId));

  let text = "";
  while (!text.includes(eventId)) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  const elapsed = performance.now() - startedAt;
  await reader.cancel();
  return elapsed;
}

describe("realtime update latency budget (loopback stand-in for local network)", () => {
  it("delivers a newly appended event well inside the <500 ms budget", async () => {
    const res = await fetch(`${baseUrl}/events/stream`);
    const elapsed = await measureDeliveryLatency(res, "evt-latency-1");
    expect(elapsed).toBeLessThan(LATENCY_BUDGET_MS);
  });

  it("stays inside budget across repeated deliveries on one connection", async () => {
    const res = await fetch(`${baseUrl}/events/stream`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    await reader.read();

    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const id = `evt-latency-batch-${i}`;
      const startedAt = performance.now();
      persistence.appendEvent(makeEvent(id));
      let text = "";
      while (!text.includes(id)) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }
      samples.push(performance.now() - startedAt);
    }
    await reader.cancel();

    const worst = Math.max(...samples);
    expect(worst).toBeLessThan(LATENCY_BUDGET_MS);
  });

  it("serves a reconnect snapshot inside budget so reconciliation is not the bottleneck", async () => {
    for (let i = 0; i < 50; i += 1) {
      persistence.appendEvent(makeEvent(`evt-backlog-${i}`));
    }
    const startedAt = performance.now();
    const [snapshotRes, eventsRes] = await Promise.all([
      fetch(`${baseUrl}/world-state`),
      fetch(`${baseUrl}/events`),
    ]);
    await Promise.all([snapshotRes.json(), eventsRes.json()]);
    expect(performance.now() - startedAt).toBeLessThan(LATENCY_BUDGET_MS);
  });
});
