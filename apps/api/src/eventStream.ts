import type { IncomingMessage, ServerResponse } from "node:http";
import type { FoundryEvent } from "@foundry/event-types";
import type { PersistenceService } from "@foundry/persistence";

// SSE is the transport ADR/ladder recommendation (foundry-build-ladder.md
// § FBL-026: "SSE/WebSocket stream"). SSE is sufficient here because
// delivery is strictly backend → frontend: commands already travel over
// POST /commands, so no bidirectional channel is required, and SSE gets
// automatic browser reconnect plus Last-Event-ID replay for free.

const HEARTBEAT_INTERVAL_MS = 15_000;

export interface StreamHandle {
  close(): void;
}

/**
 * Streams the durable event log to one client.
 *
 * Missed-event recovery: the client's `Last-Event-ID` header (sent
 * automatically by EventSource on reconnect, and settable explicitly via
 * `?lastEventId=`) is resolved against the persisted log, so everything
 * appended during a disconnect is replayed in order before live delivery
 * resumes. The client never has to invent the gap.
 */
export function handleEventStream(
  persistence: PersistenceService,
  req: IncomingMessage,
  res: ServerResponse,
): StreamHandle {
  const url = new URL(req.url ?? "/", "http://localhost");
  const lastEventId =
    req.headers["last-event-id"] ?? url.searchParams.get("lastEventId") ?? null;

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Flush an opening comment immediately: clients (and `fetch`) don't
  // resolve the response until the first body byte arrives, so without
  // this a stream with no backlog appears to hang until its first event.
  res.write(": connected\n\n");

  // Replay anything the client missed, in log order, before going live.
  const backlog = persistence.getEventsSince(
    typeof lastEventId === "string" && lastEventId.length > 0 ? lastEventId : null,
  );
  for (const event of backlog) {
    writeEvent(res, event);
  }

  const unsubscribe = persistence.subscribe((event) => {
    writeEvent(res, event);
  });

  // Keeps intermediaries from closing an idle connection, and gives the
  // client a positive liveness signal between real events.
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  const close = () => {
    clearInterval(heartbeat);
    unsubscribe();
  };

  req.on("close", close);
  res.on("close", close);

  return { close };
}

function writeEvent(res: ServerResponse, event: FoundryEvent): void {
  // One write per frame: an SSE frame split across chunks is legal on the
  // wire but makes readers (and tests) reassemble it needlessly.
  // `id:` is what drives the browser's Last-Event-ID on reconnect.
  res.write(`id: ${event.id}\nevent: foundry-event\ndata: ${JSON.stringify(event)}\n\n`);
}
