import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FoundryEvent } from "@foundry/event-types";
import { PersistenceService } from "@foundry/persistence";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

let dir: string;
let persistence: PersistenceService;
let server: Server;
let baseUrl: string;

function makeEvent(id: string, entityId = "project-1"): FoundryEvent {
  return {
    id,
    type: "operator.objective_submitted",
    occurredAt: "2026-07-30T00:00:00.000Z",
    actorType: "operator",
    actorId: "operator-1",
    entityType: "Project",
    entityId,
    correlationId: "corr-1",
    severity: "info",
    schemaVersion: 1,
    payload: { objective: `Objective ${id}`, projectId: entityId },
  } as FoundryEvent;
}

/** Reads SSE frames off a live stream until `count` `foundry-event`s have arrived (or it times out). */
async function readEvents(
  res: Response,
  count: number,
  timeoutMs = 3000,
): Promise<FoundryEvent[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const collected: FoundryEvent[] = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  const timedOut = Symbol("timed-out");

  while (collected.length < count) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    // A bare `reader.read()` blocks indefinitely when no further event is
    // coming, so the deadline has to actually interrupt it — several tests
    // here deliberately expect *fewer* events than requested.
    const result = await Promise.race([
      reader.read(),
      new Promise<typeof timedOut>((r) => setTimeout(() => r(timedOut), remaining)),
    ]);
    if (result === timedOut) break;
    const { value, done } = result;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
      if (dataLine) collected.push(JSON.parse(dataLine.slice(6)) as FoundryEvent);
    }
  }
  await reader.cancel();
  return collected;
}

/** Reads raw SSE text until `marker` appears (or timeout), so assertions can inspect frame structure. */
async function readRawUntil(res: Response, marker: string, timeoutMs = 2000): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + timeoutMs;
  const timedOut = Symbol("timed-out");
  while (!text.includes(marker) && Date.now() < deadline) {
    const result = await Promise.race([
      reader.read(),
      new Promise<typeof timedOut>((r) => setTimeout(() => r(timedOut), deadline - Date.now())),
    ]);
    if (result === timedOut || result.done) break;
    text += decoder.decode(result.value, { stream: true });
  }
  await reader.cancel();
  return text;
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "foundry-sse-"));
  persistence = new PersistenceService(join(dir, "foundry.sqlite"));
  server = createApp(persistence);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  // Open SSE connections would otherwise keep `close()` pending forever.
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  persistence.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("GET /events/stream", () => {
  it("connects and receives events appended after connection", async () => {
    const res = await fetch(`${baseUrl}/events/stream`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const received = readEvents(res, 2);
    await new Promise((r) => setTimeout(r, 50));
    persistence.appendEvent(makeEvent("evt-live-1"));
    persistence.appendEvent(makeEvent("evt-live-2", "project-2"));

    const events = await received;
    expect(events.map((e) => e.id)).toEqual(["evt-live-1", "evt-live-2"]);
  });

  it("replays the full backlog to a client connecting with no Last-Event-ID", async () => {
    persistence.appendEvent(makeEvent("evt-1"));
    persistence.appendEvent(makeEvent("evt-2", "project-2"));

    const res = await fetch(`${baseUrl}/events/stream`);
    const events = await readEvents(res, 2);
    expect(events.map((e) => e.id)).toEqual(["evt-1", "evt-2"]);
  });

  it("missed-event recovery: replays only events after Last-Event-ID, in order", async () => {
    persistence.appendEvent(makeEvent("evt-1"));
    persistence.appendEvent(makeEvent("evt-2", "project-2"));
    persistence.appendEvent(makeEvent("evt-3", "project-3"));

    const res = await fetch(`${baseUrl}/events/stream`, {
      headers: { "Last-Event-ID": "evt-1" },
    });
    const events = await readEvents(res, 2);
    expect(events.map((e) => e.id)).toEqual(["evt-2", "evt-3"]);
  });

  it("an unknown Last-Event-ID falls back to a full resync rather than silently dropping events", async () => {
    persistence.appendEvent(makeEvent("evt-1"));
    persistence.appendEvent(makeEvent("evt-2", "project-2"));

    const res = await fetch(`${baseUrl}/events/stream`, {
      headers: { "Last-Event-ID": "evt-does-not-exist" },
    });
    const events = await readEvents(res, 2);
    expect(events.map((e) => e.id)).toEqual(["evt-1", "evt-2"]);
  });

  it("emits an SSE id: line per event so browsers track Last-Event-ID automatically", async () => {
    persistence.appendEvent(makeEvent("evt-1"));
    const res = await fetch(`${baseUrl}/events/stream`);
    const text = await readRawUntil(res, "id: evt-1");
    expect(text).toContain("id: evt-1");
    expect(text).toContain("event: foundry-event");
  });

  it("duplicate delivery safety: a duplicate append is not broadcast to subscribers", async () => {
    const res = await fetch(`${baseUrl}/events/stream`);
    const received = readEvents(res, 2, 700);
    await new Promise((r) => setTimeout(r, 50));

    persistence.appendEvent(makeEvent("evt-dup"));
    persistence.appendEvent(makeEvent("evt-dup")); // same id — idempotent no-op

    const events = await received;
    expect(events.map((e) => e.id)).toEqual(["evt-dup"]);
  });

  it("unsubscribes on client disconnect so a closed stream stops receiving", async () => {
    const res = await fetch(`${baseUrl}/events/stream`);
    const reader = res.body!.getReader();
    await reader.cancel();
    await new Promise((r) => setTimeout(r, 50));

    // Appending after the client is gone must not throw or hang.
    expect(() => persistence.appendEvent(makeEvent("evt-after-close"))).not.toThrow();
  });
});

describe("GET /events", () => {
  it("returns the full log, or only events after ?since=", async () => {
    persistence.appendEvent(makeEvent("evt-1"));
    persistence.appendEvent(makeEvent("evt-2", "project-2"));

    const all = await (await fetch(`${baseUrl}/events`)).json();
    expect(all.map((e: FoundryEvent) => e.id)).toEqual(["evt-1", "evt-2"]);

    const since = await (await fetch(`${baseUrl}/events?since=evt-1`)).json();
    expect(since.map((e: FoundryEvent) => e.id)).toEqual(["evt-2"]);
  });
});
