import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { CommandRequestSchema, WorldStateSchema } from "@foundry/contracts";
import { ENTITY_TYPES, type EntityType, type PersistenceService } from "@foundry/persistence";

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
const MAX_BODY_BYTES = 1_000_000;

/**
 * FBL-024: query/snapshot/health surface plus deny-by-default command
 * endpoints. No command handler mutates persisted state at this rung
 * (that is FBL-025) — every command that passes shape validation still
 * receives a structured rejection, and nothing is written to
 * `PersistenceService` from this module at all.
 */
export function createApp(persistence: PersistenceService): Server {
  return createServer((req, res) => {
    void handleRequest(persistence, req, res).catch((err: unknown) => {
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
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const segments = url.pathname.split("/").filter(Boolean);

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

  if (method === "POST" && segments.length === 1 && segments[0] === "commands") {
    await handleCommandPost(req, res);
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

async function handleCommandPost(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  // Deny-by-default (FBL-024 → FBL-025 gate): the command shape is valid
  // and known, but no invariant/state-machine enforcement exists yet, so
  // it is structurally impossible for this handler to mutate persisted
  // state — nothing here ever calls `persistence.appendEvent`.
  const { commandType, entityId } = parsed.data;
  sendJson(res, 200, {
    accepted: false,
    commandType,
    entityId,
    reason: "Enforcement not yet available — FBL-025 has not shipped state-machine validation for this command.",
    correctiveAction: "Resubmit once FBL-025 (state machines and prerequisite enforcement) is complete.",
  });
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
