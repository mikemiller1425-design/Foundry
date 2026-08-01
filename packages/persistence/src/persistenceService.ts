import { DatabaseSync } from "node:sqlite";
import type { Agent, Approval, Build, Building, WorldState } from "@foundry/contracts";
import { FoundryEventSchema, type FoundryEvent } from "@foundry/event-types";
import {
  createInitialEntityState,
  reduceEntities,
  type EntityState,
  type EntityType,
} from "./reducer";
import { SCHEMA_SQL, type EventRow } from "./schema";
import { projectWorldState } from "./worldStateProjection";

export interface AppendEventResult {
  /** False when `event.id` had already been persisted — idempotent no-op, nothing mutated (required invariant 6 / F-09). */
  applied: boolean;
}

export interface ReconcileResult {
  snapshot: WorldState;
  missedEvents: FoundryEvent[];
}

/**
 * The one public surface for durable Foundry state (ADR-002: backend owns
 * operational truth). Storage details (SQLite via `node:sqlite`, the
 * on-disk schema) are private to this class — callers only see entities,
 * events, and the WorldState snapshot/reconciliation API. No HTTP is
 * exposed here (FBL-023 explicitly stops before FBL-024's API surface).
 */
export class PersistenceService {
  private readonly db: DatabaseSync;
  private state: EntityState;
  private closed = false;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA_SQL);
    this.state = this.rebuildFromLog();
  }

  /** Full deterministic replay of the persisted event log — the mechanism that proves restart-reconstruction (F-08). */
  private rebuildFromLog(): EntityState {
    let state = createInitialEntityState();
    const rows = this.db.prepare("SELECT * FROM events ORDER BY sequence ASC").all() as unknown as EventRow[];
    for (const row of rows) {
      const event = rowToEvent(row);
      state = reduceEntities(state, event).state;
    }
    return state;
  }

  /** Transactional, idempotent append: the event and every entity it touches are written atomically, or not at all. */
  appendEvent(event: FoundryEvent): AppendEventResult {
    const alreadyExists = this.db.prepare("SELECT 1 FROM events WHERE id = ?").get(event.id);
    if (alreadyExists) {
      return { applied: false };
    }

    const result = reduceEntities(this.state, event);
    if (!result.applied) {
      return { applied: false };
    }

    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare(
          `INSERT INTO events
             (id, type, occurred_at, actor_type, actor_id, entity_type, entity_id, correlation_id, causation_id, severity, schema_version, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.type,
          event.occurredAt,
          event.actorType,
          event.actorId,
          event.entityType,
          event.entityId,
          event.correlationId,
          event.causationId ?? null,
          event.severity,
          event.schemaVersion,
          JSON.stringify(event.payload),
        );

      const upsert = this.db.prepare(
        `INSERT INTO entities (entity_type, entity_id, data, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(entity_type, entity_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      );
      for (const ref of result.touched) {
        const record = (result.state[ref.entityType] as Record<string, unknown>)[ref.entityId];
        upsert.run(ref.entityType, ref.entityId, JSON.stringify(record), event.occurredAt);
      }

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    this.state = result.state;
    return { applied: true };
  }

  getEntity<T = unknown>(entityType: EntityType, entityId: string): T | undefined {
    return this.state[entityType][entityId] as T | undefined;
  }

  listEntities<T = unknown>(entityType: EntityType): T[] {
    return Object.values(this.state[entityType]) as T[];
  }

  getAgent(id: string): Agent | undefined {
    return this.getEntity<Agent>("agents", id);
  }

  getBuilding(id: string): Building | undefined {
    return this.getEntity<Building>("buildings", id);
  }

  getBuild(id: string): Build | undefined {
    return this.getEntity<Build>("builds", id);
  }

  getApproval(id: string): Approval | undefined {
    return this.getEntity<Approval>("approvals", id);
  }

  /** WorldState snapshot construction (domain-model.md → WorldState commands). */
  getWorldStateSnapshot(): WorldState {
    return projectWorldState(this.state);
  }

  getAllEvents(): FoundryEvent[] {
    const rows = this.db.prepare("SELECT * FROM events ORDER BY sequence ASC").all() as unknown as EventRow[];
    return rows.map(rowToEvent);
  }

  /** Events strictly after `lastProcessedEventId` (or the full log if it's null/unknown) — the "later events" half of snapshot reconciliation. */
  getEventsSince(lastProcessedEventId: string | null): FoundryEvent[] {
    if (lastProcessedEventId === null) {
      return this.getAllEvents();
    }
    const anchor = this.db
      .prepare("SELECT sequence FROM events WHERE id = ?")
      .get(lastProcessedEventId) as unknown as { sequence: number } | undefined;
    if (!anchor) {
      // Unknown/too-stale reference: caller needs a full resync.
      return this.getAllEvents();
    }
    const rows = this.db
      .prepare("SELECT * FROM events WHERE sequence > ? ORDER BY sequence ASC")
      .all(anchor.sequence) as unknown as EventRow[];
    return rows.map(rowToEvent);
  }

  /**
   * Snapshot plus later-event reconciliation (`ReconcileFromSnapshot` /
   * `ApplyEvent`, domain-model.md → WorldState). A caller holding a stale
   * `lastProcessedEventId` gets back the events it missed plus the current
   * authoritative snapshot; it never has to invent state for the gap.
   */
  reconcileFromSnapshot(lastProcessedEventId: string | null): ReconcileResult {
    return {
      snapshot: this.getWorldStateSnapshot(),
      missedEvents: this.getEventsSince(lastProcessedEventId),
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

function rowToEvent(row: EventRow): FoundryEvent {
  const raw = {
    id: row.id,
    type: row.type,
    occurredAt: row.occurred_at,
    actorType: row.actor_type,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id ?? undefined,
    severity: row.severity,
    schemaVersion: row.schema_version,
    payload: JSON.parse(row.payload) as unknown,
  };
  return FoundryEventSchema.parse(raw);
}
