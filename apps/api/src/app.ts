import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { CommandRequestSchema, WorldStateSchema } from "@foundry/contracts";
import {
  CommandHandler,
  ENTITY_TYPES,
  ObjectiveIntake,
  PrincipalRegistry,
  bearerToken,
  type EntityType,
  type ObjectiveRejectionCode,
  type PersistenceService,
} from "@foundry/persistence";
import { handleEventStream } from "./eventStream";

const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
const MAX_BODY_BYTES = 1_000_000;

/**
 * FBL-024 built the query/snapshot/health surface and a deny-by-default
 * command endpoint. FBL-025 replaces the deny-only stub with real
 * `CommandHandler` enforcement (`@foundry/persistence`) — a command is
 * now actually applied when (and only when) it passes shape validation,
 * the entity's transition graph, and every named invariant guard. An
 * invalid or unauthorized command still leaves persisted state
 * byte-for-byte unchanged, exactly as it did at FBL-024, because
 * `CommandHandler` never calls `appendEvent` for a rejected command.
 *
 * FBL-029 adds authenticated identity: the actor is established by an
 * `Authorization: Bearer` credential resolved through `PrincipalRegistry`,
 * not by the request body. A caller with no credential is anonymous and
 * unauthenticated, which is what makes the Inspector-only validation
 * guard (F-05) a real authorization decision rather than a check against
 * a name the caller chose for itself.
 */
export function createApp(
  persistence: PersistenceService,
  principals: PrincipalRegistry = new PrincipalRegistry(),
): Server {
  const commandHandler = new CommandHandler(persistence);
  // AC-103: the objective intake is a *client* of the command handler, not
  // a second write path — see `objectiveIntake.ts`.
  const objectiveIntake = new ObjectiveIntake(commandHandler);
  return createServer((req, res) => {
    void handleRequest(persistence, commandHandler, objectiveIntake, principals, req, res).catch(
      (err: unknown) => {
        if (!res.headersSent) {
          sendJson(res, 500, {
            error: "internal_error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      },
    );
  });
}

async function handleRequest(
  persistence: PersistenceService,
  commandHandler: CommandHandler,
  objectiveIntake: ObjectiveIntake,
  principals: PrincipalRegistry,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";
  const segments = url.pathname.split("/").filter(Boolean);

  // The Next.js frontend runs on its own port, so browser requests to this
  // service are cross-origin. V1 is a single-operator, local/trusted-network
  // deployment with no cookie-based session to protect, so a permissive
  // origin is acceptable here; it must be revisited before any networked
  // deployment. Note this is safe *specifically* because agent credentials
  // (FBL-029) are bearer tokens the browser never holds — a permissive
  // origin cannot be leveraged to replay an authority it does not possess.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID, Authorization");
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

  if (
    method === "GET" &&
    segments.length === 2 &&
    segments[0] === "events" &&
    segments[1] === "stream"
  ) {
    handleEventStream(persistence, req, res);
    return;
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "events") {
    sendJson(res, 200, persistence.getEventsSince(url.searchParams.get("since")));
    return;
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "commands") {
    await handleCommandPost(commandHandler, principals, req, res);
    return;
  }

  if (method === "POST" && segments.length === 1 && segments[0] === "objectives") {
    await handleObjectivePost(objectiveIntake, principals, req, res);
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
  principals: PrincipalRegistry,
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

  // FBL-029: identity comes from the credential, never from the body.
  //
  // Until this rung, `actor` in the payload *was* the identity, so the
  // F-05 Inspector check could be satisfied by typing a name. Now the
  // bearer token decides who the caller is; a request with no credential
  // is anonymous and unauthenticated, which is what makes a frontend
  // attempt to self-certify a denial rather than a naming coincidence.
  const principal = principals.resolve(bearerToken(req.headers.authorization));

  // A body `actor` that contradicts the credential is refused outright
  // rather than silently overridden. Silently ignoring it would let a
  // caller believe it had acted as someone else — and would make the
  // resulting audit trail a quiet lie about what was attempted.
  const claimed = parsed.data.actor;
  if (
    claimed &&
    (claimed.actorId !== principal.actorId || claimed.actorType !== principal.actorType)
  ) {
    sendJson(res, 403, {
      accepted: false,
      commandType: parsed.data.commandType,
      entityId: parsed.data.entityId,
      error: "actor_mismatch",
      reason:
        "The `actor` in the request body does not match the authenticated credential. Identity is established by the credential; the body may not assert a different one.",
      correctiveAction:
        "Omit `actor`, or send it matching the authenticated principal, or present the correct credential.",
    });
    return;
  }

  const outcome = commandHandler.submit(parsed.data, principal);
  sendJson(res, 200, outcome);
}

/**
 * The status each intake rejection deserves.
 *
 * These are separated because they mean genuinely different things to the
 * operator, and a UI that renders all failures identically teaches nobody
 * anything: 403 is "you are not permitted to do this", 400 is "what you
 * typed is out of bounds", 409 is "what you typed is fine but the world is
 * not in a state that allows it".
 */
const OBJECTIVE_REJECTION_STATUS: Record<ObjectiveRejectionCode, number> = {
  unauthorized: 403,
  invalid_objective: 400,
  command_rejected: 409,
};

/**
 * `POST /objectives` — the operator's intention enters the system (AC-103).
 *
 * Deliberately *not* a new command type. `COMMAND_TYPES` is the closed V1
 * vocabulary transcribed from `domain-model.md`, and adding an entry to it
 * would be a specification change made in passing. This route submits the
 * existing declared commands (`Project.Create`, `Build.Create`) through the
 * same `CommandHandler` and the same enforcement every other caller faces.
 *
 * Every failure answers with a body of the same shape as the success case,
 * carrying a reason and a corrective action. A control that can fail
 * silently is worse than one that is missing, because the operator cannot
 * tell "refused" from "broken".
 */
async function handleObjectivePost(
  objectiveIntake: ObjectiveIntake,
  principals: PrincipalRegistry,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch (err) {
    sendJson(res, 400, {
      accepted: false,
      error: "invalid_request",
      reason: err instanceof Error ? err.message : "Malformed request body",
      correctiveAction: "Send a JSON object with objective, workspace, and riskClass.",
    });
    return;
  }

  const principal = principals.resolve(bearerToken(req.headers.authorization));
  const result = objectiveIntake.submit(raw, principal);

  if (result.accepted) {
    sendJson(res, 201, result);
    return;
  }

  const status = result.code ? OBJECTIVE_REJECTION_STATUS[result.code] : 400;
  sendJson(res, status, { ...result, error: result.code });
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
