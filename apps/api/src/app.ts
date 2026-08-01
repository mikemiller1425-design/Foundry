import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { CommandRequestSchema, WorldStateSchema } from "@foundry/contracts";
import type { ActorType } from "@foundry/event-types";
import {
  CommandHandler,
  ENTITY_TYPES,
  type EntityType,
  type PersistenceService,
} from "@foundry/persistence";
import { handleEventStream } from "./eventStream";

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
const MAX_BODY_BYTES = 1_000_000;
const DEFAULT_ACTOR = { actorType: "operator" as ActorType, actorId: "operator" };

/**
 * FBL-024 built the query/snapshot/health surface and a deny-by-default
 * command endpoint. FBL-025 replaces the deny-only stub with real
 * `CommandHandler` enforcement (`@foundry/persistence`) — a command is
 * now actually applied when (and only when) it passes shape validation,
 * the entity's transition graph, and every named invariant guard. An
 * invalid or unauthorized command still leaves persisted state
 * byte-for-byte unchanged, exactly as it did at FBL-024, because
 * `CommandHandler` never calls `appendEvent` for a rejected command.
 */
export function createApp(persistence: PersistenceService): Server {
  const commandHandler = new CommandHandler(persistence);
  return createServer((req, res) => {
    void handleRequest(persistence, commandHandler, req, res).catch((err: unknown) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: "internal_error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
  });
}

async function handleRequest(
  persistence: PersistenceService,
  commandHandler: CommandHandler,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const segments = url.pathname.split("/").filter(Boolean);

  // The Next.js frontend runs on its own port, so browser requests to this
  // service are cross-origin. V1 is a single-operator, local/trusted-network
  // deployment with no authentication and no cookie-based session to
  // protect (see README security caveat), so a permissive origin is
  // acceptable here; it must be revisited before any networked deployment.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "health") {
    sendJson(res, 200, {
      status: "ok",
      service: "@foundry/api",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "world-state") {
    const snapshot = persistence.getWorldStateSnapshot();
    // Contract-conformance: never respond with a shape the schema itself would reject.
    const validated = WorldStateSchema.parse(snapshot);
    sendJson(res, 200, validated);
    return;
  }

  if (method === "GET" && segments.length >= 1 && segments[0] === "entities") {
    handleEntitiesGet(persistence, segments.slice(1), res);
    return;
  }

  if (method === "GET" && segments.length === 2 && segments[0] === "events" && segments[1] === "stream") {
    handleEventStream(persistence, req, res);
    return;
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "events") {
    sendJson(res, 200, persistence.getEventsSince(url.searchParams.get("since")));
    return;
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "commands") {
    await handleCommandPost(commandHandler, req, res);
    return;
  }

  sendJson(res, 404, { error: "not_found", message: `No route for ${method} ${url.pathname}` });
}

function handleEntitiesGet(
  persistence: PersistenceService,
  rest: string[],
  res: ServerResponse,
): void {
  const [rawEntityType, entityId] = rest;
  if (!rawEntityType || !ENTITY_TYPE_SET.has(rawEntityType)) {
    sendJson(res, 400, {
      error: "unknown_entity_type",
      message: `entityType must be one of: ${ENTITY_TYPES.join(", ")}`,
    });
    return;
  }
  const entityType = rawEntityType as EntityType;

  if (entityId === undefined) {
    sendJson(res, 200, persistence.listEntities(entityType));
    return;
  }

  const entity = persistence.getEntity(entityType, entityId);
  if (entity === undefined) {
    sendJson(res, 404, { error: "not_found", message: `No ${entityType} with id ${entityId}` });
    return;
  }
  sendJson(res, 200, entity);
}

async function handleCommandPost(
  commandHandler: CommandHandler,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, {
      error: "invalid_request",
      message: err instanceof Error ? err.message : "Malformed request body",
    });
    return;
  }

  const parsed = CommandRequestSchema.safeParse(raw);
  if (!parsed.success) {
    sendJson(res, 400, {
      error: "invalid_request",
      message: "Request does not match the known command envelope shape",
      issues: parsed.error.issues,
    });
    return;
  }

  // No V1 authentication system exists (out of scope, v1-scope.md
  // exclusions) — `actor` is a caller-asserted claim, defaulted to a
  // generic operator when omitted. See CommandActorSchema's doc comment
  // in @foundry/contracts for the security caveat this implies for
  // actor-sensitive guards (e.g. F-05's Inspector-only check).
  const actor = parsed.data.actor
    ? { actorType: parsed.data.actor.actorType as ActorType, actorId: parsed.data.actor.actorId }
    : DEFAULT_ACTOR;

  const outcome = commandHandler.submit(parsed.data, actor);
  sendJson(res, 200, outcome);
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf-8");
      if (body.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}
