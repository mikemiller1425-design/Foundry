import { handleCommandCenterGet } from "./commandCenter/snapshotRoute";
import { VOCABULARY_PARAM, eventFilterFor, resolveVocabulary } from "./commandCenter/eventVocabulary";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { CommandRequestSchema, WorldStateSchema, type PersistedPlan } from "@foundry/contracts";
import {
  BuildOrchestrator,
  CommandHandler,
  evaluateExecutionGate,
  readExecutionGateInput,
  ENTITY_TYPES,
  ObjectiveIntake,
  PrincipalRegistry,
  bearerToken,
  defaultOrchestratorActors,
  planOrchestration,
  type EntityType,
  type ObjectiveRejectionCode,
  type PersistenceService,
  type Principal,
} from "@foundry/persistence";
import { BuildStageNameSchema, CLAUDE_CODE_STAGE } from "@foundry/contracts";
import { buildPlanForObjective, planRequirementCount, planStageIds } from "./architect/planBuild";
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
export interface AppOptions {
  /**
   * Pause between orchestration steps, in milliseconds (AC-109).
   *
   * Display-only pacing: an unpaced run would finish before the operator
   * could watch a single stage move. Every step is submitted and enforced
   * identically at any delay; tests run at 0.
   */
  orchestratorStepDelayMs?: number;
}

export function createApp(
  persistence: PersistenceService,
  principals: PrincipalRegistry = new PrincipalRegistry(),
  options: AppOptions = {},
): Server {
  const commandHandler = new CommandHandler(persistence);
  /**
   * AC-103: the objective intake is a *client* of the command handler, not
   * a second write path — see `objectiveIntake.ts`.
   *
   * AC-108 supplies the Architect planning step as an injected factory, so
   * a submitted objective is followed by one proposed plan. The factory is
   * pure and template-driven; nothing it returns is scheduled or executed.
   */
  const objectiveIntake = new ObjectiveIntake(commandHandler, undefined, (input) => {
    const plan = buildPlanForObjective({
      ...input,
      workspace: "foundry_managed",
      riskClass: "R2",
      createdAt: new Date().toISOString(),
    });
    return {
      plan,
      stageIds: planStageIds(input.planId),
      requirementCount: planRequirementCount(plan),
    };
  });
  /**
   * AC-109 — the orchestrator, a client of the same `CommandHandler`.
   *
   * Constructed with the handler and pacing, and nothing else. It is never
   * handed `persistence`: that is what makes "the orchestrator has no
   * second write path" a fact about what it can reach rather than a claim
   * about what it chooses to do.
   */
  const orchestrator = new BuildOrchestrator(commandHandler, {
    stepDelayMs: options.orchestratorStepDelayMs ?? 0,
  });

  return createServer((req, res) => {
    void handleRequest(
      persistence,
      commandHandler,
      objectiveIntake,
      orchestrator,
      principals,
      req,
      res,
    ).catch((err: unknown) => {
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
  objectiveIntake: ObjectiveIntake,
  orchestrator: BuildOrchestrator,
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

  /**
   * Package 1b-ii-a — the Command Center read contract.
   *
   * Unauthenticated, consistent with every other read surface (Decision 10.4,
   * explicitly provisional). Composed entirely from accepted 1b-ii
   * projections; it derives nothing.
   */
  if (method === "GET" && segments.length === 1 && segments[0] === "command-center") {
    handleCommandCenterGet(persistence, res);
    return;
  }

  if (method === "GET" && segments.length === 1 && segments[0] === "events") {
    /**
     * Package 1b-ii-a — vocabulary negotiation (Decision 10.5).
     *
     * Absent parameter keeps the frozen V1 behaviour, because the frontend
     * reconciles against this endpoint after an outage and an event type it
     * cannot parse would turn a reconnect into a refusal. An unknown value is
     * refused rather than quietly downgraded: a client served less than it
     * asked for would believe it had seen everything.
     */
    const vocabulary = resolveVocabulary(url.searchParams.get(VOCABULARY_PARAM));
    if (!vocabulary.ok) {
      sendJson(res, 400, vocabulary.refusal);
      return;
    }
    sendJson(
      res,
      200,
      persistence
        .getEventsSince(url.searchParams.get("since"))
        .filter(eventFilterFor(vocabulary.vocabulary)),
    );
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

  if (
    method === "GET" &&
    segments.length === 3 &&
    segments[0] === "builds" &&
    segments[2] === "execution-authorization"
  ) {
    handleExecutionGateGet(persistence, segments[1] ?? "", url, res);
    return;
  }

  if (
    method === "POST" &&
    segments.length === 3 &&
    segments[0] === "builds" &&
    segments[2] === "start"
  ) {
    handleBuildStartPost(persistence, orchestrator, principals, segments[1] ?? "", req, res);
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

/**
 * `POST /builds/{buildId}/start` — orchestrate a reviewed build with the
 * mock executor (AC-109).
 *
 * Deliberately not a new command type, for the reason `POST /objectives`
 * gives: `COMMAND_TYPES` is the closed vocabulary transcribed from
 * `domain-model.md`, and this route submits only commands already in it.
 * The first of them, `Build.Start`, is submitted **synchronously**, so the
 * response is the enforcement layer's own ruling on whether this build may
 * start — no plan, an unreviewed or rejected plan, a plan that changed
 * since review, an already-running build, or an unauthenticated caller
 * each answer here with their own reason.
 *
 * Once started, the remaining steps proceed in the background at a
 * watchable pace and reach the operator through the existing SSE stream,
 * because they are ordinary declared events with no special channel.
 *
 * The route reads the persisted plan and hands it to the orchestrator. The
 * orchestrator has no `PersistenceService` of its own — that read happens
 * here, at the layer that already owns database access, and is the reason
 * the "no second write path" property survives contact with a real
 * request.
 *
 * **Nothing real executes.** Every response says so, in a field that is
 * always present rather than one added on success.
 */
function handleBuildStartPost(
  persistence: PersistenceService,
  orchestrator: BuildOrchestrator,
  principals: PrincipalRegistry,
  buildId: string,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const simulation = { simulated: true as const, executor: "mock" as const, buildId };
  const principal: Principal = principals.resolve(bearerToken(req.headers.authorization));

  // Answered before the build is looked up, so the "no such build" reply
  // cannot be used as an existence oracle by a caller with no standing —
  // the same ordering `CommandHandler` uses for its own guards.
  if (!principal.authenticated || principal.actorType !== "operator") {
    sendJson(res, 403, {
      ...simulation,
      accepted: false,
      error: "unauthorized",
      reason:
        "Starting a build requires an authenticated operator (principle 14: humans govern). Agent, frontend, backend, and unauthenticated callers are rejected.",
      correctiveAction: "Present the operator credential this API session issued.",
    });
    return;
  }

  const persistedPlan = persistence
    .listEntities<PersistedPlan>("plans")
    .find((entry) => entry.plan.buildId === buildId);
  if (!persistedPlan) {
    // Distinguished from a plan-shaped refusal on purpose: "there is no
    // plan here" and "the plan here is not startable" have different
    // fixes, and a single 409 would hide which one applies.
    sendJson(res, 404, {
      ...simulation,
      accepted: false,
      error: "no_plan",
      reason: `No plan is recorded for build ${buildId}. There is nothing to orchestrate: the stages, their order, and their requirements all come from the plan.`,
      correctiveAction:
        "Submit an objective so the Architect produces a plan, then read and review it.",
    });
    return;
  }

  const actors = defaultOrchestratorActors({
    actorType: principal.actorType,
    actorId: principal.actorId,
    authenticated: principal.authenticated,
  });

  const handle = orchestrator.begin(persistedPlan, actors);

  if (!handle.started) {
    sendJson(res, 409, {
      ...simulation,
      accepted: false,
      error: "not_startable",
      planId: persistedPlan.plan.planId,
      reason: handle.outcome.reason ?? "Build.Start was refused.",
      correctiveAction: handle.outcome.correctiveAction,
    });
    return;
  }

  /**
   * The run continues after the response.
   *
   * A rejected step stops the run and is already recorded as a refusal
   * the operator can read; there is no exception path to swallow, and a
   * thrown error would otherwise become an unhandled rejection that takes
   * the process down mid-build. So it is caught and logged, and the
   * partially-advanced build stays exactly as the event log left it —
   * which is the honest outcome for an append-only system.
   */
  void handle.continue().catch((err: unknown) => {
    console.error(
      `[orchestrator] run for build ${buildId} stopped unexpectedly:`,
      err instanceof Error ? err.message : err,
    );
  });

  sendJson(res, 202, {
    ...simulation,
    accepted: true,
    planId: persistedPlan.plan.planId,
    stepCount: planOrchestration(persistedPlan.plan).length,
    stopsAt: "approval_gate",
    note: "Simulated run. Every stage is advanced by the deterministic mock executor; no Claude Code is invoked, no process is spawned, and no money is spent. The run stops at the approval gate.",
  });
}

/**
 * `GET /builds/{buildId}/execution-authorization` — the gate, read-only
 * (AC-110).
 *
 * This is the decision `AC-111`'s dispatcher must pass through, exposed
 * now so it can be proven in both directions before anything can run.
 *
 * **A GET, deliberately.** `F-114` requires that an unauthorized attempt
 * have zero side effects, and the cheapest way to guarantee that is a
 * surface with no write path at all: this handler holds no
 * `CommandHandler`, and `evaluateExecutionGate` is a pure function. Zero
 * side effects is therefore a property of what the code can reach, not a
 * promise about how carefully it was written.
 *
 * It is also unauthenticated, and that is a considered choice rather than
 * an oversight. It reports whether permission *exists*; it grants none,
 * changes none, and reveals nothing an operator cannot already read from
 * `/world-state`, which is likewise open on this loopback-only service.
 * Issuing an authorization requires an authenticated operator — that is
 * `POST /commands` with `Plan.Authorize`, and it is refused without a
 * credential.
 *
 * **`permitted: true` starts nothing.** The response says so in a field
 * that is always present, so no caller can read a preflight as a dispatch.
 */
function handleExecutionGateGet(
  persistence: PersistenceService,
  buildId: string,
  url: URL,
  res: ServerResponse,
): void {
  const requestedStage = url.searchParams.get("stage") ?? CLAUDE_CODE_STAGE;
  const parsedStage = BuildStageNameSchema.safeParse(requestedStage);
  if (!parsedStage.success) {
    sendJson(res, 400, {
      error: "unknown_stage",
      permitted: false,
      executed: false,
      reason: `\`${requestedStage}\` is not one of the seven named build stages.`,
      correctiveAction: "Request one of the stages the plan declares.",
    });
    return;
  }

  const input = readExecutionGateInput(persistence, buildId, parsedStage.data);
  const decision = evaluateExecutionGate(input);

  sendJson(res, 200, {
    buildId,
    stageName: parsedStage.data,
    permitted: decision.permitted,
    /** Always false. This endpoint reports; it never dispatches. */
    executed: decision.executed,
    refusals: decision.refusals,
    authorization: decision.authorization,
    /** The binding, recomputed from persisted content on this request. */
    currentContentHash: input.currentContentHash,
    spentRunIds: input.spentRunIds,
    note: "Reports whether one real execution of this stage would be permitted. Nothing is started, spent, or scheduled by reading this. Performing the run is AC-111.",
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
