import type { IncomingMessage, ServerResponse } from "node:http";
import type { PersistedEvent } from "@foundry/event-types";
import { VOCABULARY_PARAM, eventFilterFor, resolveVocabulary } from "./commandCenter/eventVocabulary";
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

  /**
   * Package 1b-ii-a — vocabulary negotiation (Decision 10.5), resolved before
   * the stream headers are written so a refusal is an ordinary 400 rather
   * than an error mid-stream that a client would have to interpret.
   */
  const vocabulary = resolveVocabulary(url.searchParams.get(VOCABULARY_PARAM));
  if (!vocabulary.ok) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(vocabulary.refusal));
    return { close: () => {} };
  }
  const passes = eventFilterFor(vocabulary.vocabulary);

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
  /**
   * Package 1b-ii: the stream carries the **V1 vocabulary only**.
   *
   * The reconciled frontend validates every frame against `FoundryEventSchema`
   * and, since the projection-honesty checkpoint, treats a contract-invalid
   * frame as a possible gap in canonical history — it marks the projection
   * stale and reconciles. Streaming a `briefing.created` to a client that has
   * never heard of one would therefore not degrade gracefully; it would close
   * the stream.
   *
   * So backend-only events stay backend-side until Package 1b-iii widens the
   * frontend and this filter together, as one change. They are persisted,
   * replayed, and projected exactly as any other event — they are simply not
   * pushed at a client built before they existed.
   */
  for (const event of backlog) {
    if (passes(event)) writeEvent(res, event);
  }

  const unsubscribe = persistence.subscribe((event) => {
    if (passes(event)) writeEvent(res, event);
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

function writeEvent(res: ServerResponse, event: PersistedEvent): void {
  // One write per frame: an SSE frame split across chunks is legal on the
  // wire but makes readers (and tests) reassemble it needlessly.
  // `id:` is what drives the browser's Last-Event-ID on reconnect.
  res.write(`id: ${event.id}\nevent: foundry-event\ndata: ${JSON.stringify(event)}\n\n`);
}
