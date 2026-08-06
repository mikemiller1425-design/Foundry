/**
 * Temporary stub API for Package 1b-iii hardening browser checks.
 * Not a product surface. Uses a temp process only; does not touch the
 * operational database.
 */
/* global process, console */
import http from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load the TS fixture as JSON-equivalent by importing compiled path is hard;
// inline a minimal valid body matching COMMAND_CENTER_SAMPLE_SNAPSHOT.
const sample = JSON.parse(
  readFileSync(join(__dirname, "sample-snapshot.json"), "utf8"),
);

const world = {
  buildings: [],
  agents: [],
  currentBuild: null,
  activeTransfers: [],
  approvals: [],
  inventoryCounts: { successfulPackages: 9 },
  health: { status: "healthy", reasons: ["nominal"] },
  lastProcessedEventId: null,
};

let latestSequence = sample.latestSequence;
const streams = new Set();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Last-Event-ID, Content-Type");
}

const server = http.createServer((req, res) => {
  cors(res);
  const url = req.url ?? "";
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (url.startsWith("/world-state")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(world));
    return;
  }
  if (url.startsWith("/command-center")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ...sample, latestSequence }));
    return;
  }
  if (url.startsWith("/events/stream")) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(": connected\n\n");
    streams.add(res);
    req.on("close", () => streams.delete(res));
    return;
  }
  if (url.startsWith("/events")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify([]));
    return;
  }
  if (url.startsWith("/__emit-briefing")) {
    latestSequence = 11;
    const event = {
      id: "briefing-created-live",
      type: "briefing.created",
      occurredAt: "2026-08-05T00:00:00.000Z",
      actorType: "operator",
      actorId: "op-1",
      entityType: "Briefing",
      entityId: "brief-1",
      correlationId: "corr-brief",
      severity: "info",
      schemaVersion: 1,
      payload: {
        briefingId: "brief-1",
        previousAcknowledgedSequence: 0,
        capturedEndSequence: 11,
        sourceCoverageIds: [],
        externalActionClassifierVersion: 1,
      },
    };
    for (const stream of streams) {
      stream.write(`id: ${event.id}\nevent: foundry-event\ndata: ${JSON.stringify(event)}\n\n`);
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, latestSequence }));
    return;
  }
  res.statusCode = 404;
  res.end("{}");
});

const port = Number(process.env.PORT ?? 4100);
server.listen(port, "127.0.0.1", () => {
  console.log(`hardening-stub listening on ${port}`);
});
